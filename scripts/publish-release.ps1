# Publish a GitHub Release with the signed APK and the notes.
#
# Requires a GitHub token with `repo` scope (the repository is private).
# Pass it via the GITHUB_TOKEN environment variable, or pass -Token.
#
# Nothing is sent anywhere except to api.github.com. The token is never written
# to disk and never echoed.
#
# Usage:
#   $env:GITHUB_TOKEN = 'ghp_...'
#   powershell -File scripts/publish-release.ps1 -Version v1.0.0
#
#   # or, to (re)publish notes only, after deleting a draft release:
#   powershell -File scripts/publish-release.ps1 -Version v1.0.0 -NotesOnly

param(
    [Parameter(Mandatory = $true)][string]$Version,   # e.g. v1.0.0
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$Repo = 'Team-15/TalentMate',
    [string]$NotesFile,
    [switch]$NotesOnly,
    [switch]$Draft
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $Token) { throw 'No token. Set $env:GITHUB_TOKEN (needs `repo` scope) or pass -Token.' }

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $NotesFile) { $NotesFile = Join-Path $repoRoot "docs\RELEASE_NOTES_$Version.md" }
if (-not (Test-Path $NotesFile)) { throw "Release notes not found: $NotesFile" }

$apk = Join-Path $repoRoot 'client\android\app\build\outputs\apk\release\app-release.apk'
if (-not $NotesOnly -and -not (Test-Path $apk)) {
    throw "Signed APK not found: $apk`nRun scripts/build-release.ps1 first."
}

$headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'talentmate-release-script'
}
$api = "https://api.github.com/repos/$Repo"

function Invoke-Gh {
    param([string]$Method, [string]$Uri, $Body, [string]$ContentType = 'application/json')
    $p = @{ Method = $Method; Uri = $Uri; Headers = $headers }
    if ($Body) {
        if ($ContentType -eq 'application/json') {
            $p.Body = ($Body | ConvertTo-Json -Depth 6 -Compress)
            $p.ContentType = 'application/json'
        }
    }
    return Invoke-RestMethod @p
}

# --- 1. confirm auth and that we can see the repo ---------------------------
Write-Host "=== authenticating ===" -ForegroundColor Cyan
$me = Invoke-Gh -Method GET -Uri 'https://api.github.com/user'
Write-Host "  as: $($me.login)"
$repoInfo = Invoke-Gh -Method GET -Uri $api
Write-Host "  repo: $($repoInfo.full_name) (private=$($repoInfo.private))"

# --- 2. resolve the tag to a commit ----------------------------------------
# The tag must exist before a release can point at it. Create it via the API if
# it does not, targeting the current tip of the default branch.
if ($Version -notmatch '^v') { $Version = "v$Version" }

$existingRef = $null
try { $existingRef = Invoke-Gh -Method GET -Uri "$api/git/ref/tags/$Version" } catch { $existingRef = $null }

if (-not $existingRef) {
    $branch = $repoInfo.default_branch
    $headRef = Invoke-Gh -Method GET -Uri "$api/git/ref/heads/$branch"
    $sha = $headRef.object.sha
    Write-Host "=== creating tag $Version -> $branch@$($sha.Substring(0,7)) ===" -ForegroundColor Cyan
    Invoke-Gh -Method POST -Uri "$api/git/refs" -Body @{ ref = "refs/tags/$Version"; sha = $sha } | Out-Null
} else {
    Write-Host "=== tag $Version already exists ===" -ForegroundColor DarkGray
}

# --- 3. create (or reuse) the release --------------------------------------
$notes = Get-Content $NotesFile -Raw
$name = "TalentMate 伴贤 $Version"

$release = $null
try { $release = Invoke-Gh -Method GET -Uri "$api/releases/tags/$Version" } catch { $release = $null }

if ($release) {
    Write-Host "=== release $Version exists, updating notes ===" -ForegroundColor Yellow
    $release = Invoke-Gh -Method PATCH -Uri "$api/releases/$($release.id)" -Body @{
        name = $name; body = $notes; draft = [bool]$Draft
    }
} else {
    Write-Host "=== creating release $Version ===" -ForegroundColor Cyan
    $release = Invoke-Gh -Method POST -Uri "$api/releases" -Body @{
        tag_name = $Version; name = $name; body = $notes
        draft = [bool]$Draft; prerelease = $false
    }
}
Write-Host "  release id=$($release.id) url=$($release.html_url)"

if ($NotesOnly) {
    Write-Host '=== notes only, skipping asset upload ===' -ForegroundColor DarkGray
    Write-Host $release.html_url
    exit 0
}

# --- 4. upload the APK -----------------------------------------------------
# Rename on upload so the downloaded filename is meaningful.
$assetName = "TalentMate-1.0.0-release.apk"

# Drop a previous asset of the same name so re-runs are idempotent.
$assets = Invoke-Gh -Method GET -Uri "$api/releases/$($release.id)/assets"
foreach ($a in $assets) {
    if ($a.name -eq $assetName) {
        Write-Host "  removing existing asset $assetName" -ForegroundColor Yellow
        Invoke-Gh -Method DELETE -Uri "https://api.github.com/repos/$Repo/releases/assets/$($a.id)" | Out-Null
    }
}

$sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 2)
Write-Host "=== uploading $assetName ($sizeMb MB) ===" -ForegroundColor Cyan
$uploadUri = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$assetName"
$upHeaders = @{
    Authorization          = "Bearer $Token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'talentmate-release-script'
    'Content-Type'         = 'application/vnd.android.package-archive'
}
$bytes = [System.IO.File]::ReadAllBytes($apk)
$asset = Invoke-RestMethod -Method POST -Uri $uploadUri -Headers $upHeaders -Body $bytes
Write-Host "  asset: $($asset.name)  $([math]::Round($asset.size/1MB,2)) MB"
Write-Host "  download: $($asset.browser_download_url)" -ForegroundColor Green

Write-Host ''
Write-Host "Release published: $($release.html_url)" -ForegroundColor Green
