# Generate a release signing keystore and write the local signing config.
#
# Notes:
#  - The keystore and its passwords are NEVER committed (see .gitignore),
#    so a leaked repo cannot be used to sign an installable impostor APK.
#  - The password is random; it is stored in client/android/keystore.properties,
#    which is also gitignored.
#  - Idempotent: if the keystore already exists it is reused, never overwritten,
#    because changing the key would break over-the-top upgrades of a released APK.
#
# Usage:  powershell -File scripts/gen-keystore.ps1
#
# NOTE: this file is intentionally pure ASCII. Windows PowerShell 5.1 reads
# .ps1 files as the ANSI codepage unless they have a UTF-8 BOM, so non-ASCII
# text here would be mojibake and break parsing.

param(
    [string]$Alias = 'talentmate',
    [string]$Dname = 'CN=TalentMate, OU=Course Project, O=Team-15, L=Beijing, ST=Beijing, C=CN'
)

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'client/android'
$ksPath     = Join-Path $androidDir 'release.keystore'
$propsPath  = Join-Path $androidDir 'keystore.properties'

# keytool (a Java program) fails with "java.io.IOException: Bad pathname" when
# the keystore path contains non-ASCII characters such as Chinese. The project
# may live under such a path, so build an ASCII path to the same file and pass
# that to keytool instead. `dir /x` yields the 8.3 short name for any component.
function Resolve-AsciiPath([string]$Path) {
    if ($Path -match '^[\x20-\x7E]+$') { return $Path }

    $full = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($full)
    $rest = $full.Substring($root.Length)

    $current = $root.TrimEnd('\')
    foreach ($part in ($rest -split '\\')) {
        if ($part -eq '') { continue }
        $candidate = Join-Path $current $part
        if ($candidate -match '^[\x20-\x7E]+$') { $current = $candidate; continue }

        # Ask the filesystem for the short (8.3) name of this component.
        $short = (cmd /c "for %I in (`"$candidate`") do @echo %~sI" 2>$null | Select-Object -First 1)
        if ($short -and ($short -match '^[\x20-\x7E]+$') -and (Test-Path $short)) {
            $current = $short.Trim()
        } else {
            throw "Path contains non-ASCII characters and no ASCII short name exists: $candidate`nRun this project from an ASCII-only path, or create the keystore manually."
        }
    }
    return (Join-Path $current (Split-Path $ksPath -Leaf))
}

if (Test-Path $ksPath) {
    Write-Host "keystore already exists, reusing (not overwriting): $ksPath" -ForegroundColor Yellow
    if (-not (Test-Path $propsPath)) {
        Write-Warning "But $propsPath is missing, so signing would fail. Restore the original password or delete the keystore and regenerate."
    }
    exit 0
}

# Locate keytool: prefer JAVA_HOME, fall back to PATH.
$keytool = $null
if ($env:JAVA_HOME) {
    $cand = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
    if (Test-Path $cand) { $keytool = $cand }
}
if (-not $keytool) {
    $cmd = Get-Command keytool -ErrorAction SilentlyContinue
    if ($cmd) { $keytool = $cmd.Source }
}
if (-not $keytool) {
    throw 'keytool not found. Set JAVA_HOME to a JDK 17+ (this project uses JDK 21).'
}

# Random password (local signing only).
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '').Substring(0, 24)

Write-Host "Generating keystore: $ksPath" -ForegroundColor Cyan
$ksPathAscii = Resolve-AsciiPath $ksPath
if ($ksPathAscii -ne $ksPath) {
    Write-Host "  (keytool receives ASCII path: $ksPathAscii)" -ForegroundColor DarkGray
}
& $keytool -genkeypair `
    -keystore $ksPathAscii `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $password `
    -keypass $password `
    -dname $Dname 2>&1 | Select-Object -Last 4

if (-not (Test-Path $ksPath)) { throw 'keystore generation failed' }

# Write the signing config (also gitignored).
$lines = @(
    '# Local release signing config -- DO NOT COMMIT',
    'storeFile=release.keystore',
    "storePassword=$password",
    "keyAlias=$Alias",
    "keyPassword=$password"
)
$lines -join "`n" | Set-Content -Path $propsPath -Encoding ASCII

Write-Host "Wrote $propsPath (random password, gitignored)" -ForegroundColor Green
Write-Host "Back up BOTH files: losing them means a released APK can no longer be upgraded in place." -ForegroundColor Yellow
