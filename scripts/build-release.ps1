# Build a signed release APK (and optionally an AAB for Play).
#
# Prerequisites:
#   1. Run scripts/gen-keystore.ps1 once to create client/android/release.keystore
#      and client/android/keystore.properties (both gitignored).
#   2. JAVA_HOME points at a JDK 21 (Capacitor 8 requires 17+; this project uses 21).
#
# Why JAVA_HOME matters: Capacitor 8 compiles with Java 21 language level, and
# keytool/gradle will fail with "invalid source release: 21" on an older JDK.
#
# Why the ASCII junction: this repo may live under a non-ASCII path (e.g. Chinese).
# Both keytool ("java.io.IOException: Bad pathname") and gradlew.bat (cmd codepage)
# break on such paths, so we build through an ASCII junction to the client dir.
#
# Usage:
#   powershell -File scripts/build-release.ps1               # APK only
#   powershell -File scripts/build-release.ps1 -Bundle       # APK + AAB

param(
    [switch]$Bundle
)

$ErrorActionPreference = 'Stop'

$repoRoot  = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path $repoRoot 'client'
$androidDir = Join-Path $clientDir 'android'

# --- 1. sanity checks -------------------------------------------------------
$propsPath = Join-Path $androidDir 'keystore.properties'
$ksPath    = Join-Path $androidDir 'release.keystore'
if (-not (Test-Path $propsPath) -or -not (Test-Path $ksPath)) {
    throw "Missing signing material. Run scripts/gen-keystore.ps1 first.`n  expected: $ksPath`n  expected: $propsPath"
}

if (-not $env:JAVA_HOME) {
    throw 'JAVA_HOME is not set. Point it at a JDK 21 (Capacitor 8 requires Java 21 language level).'
}
$javaExe = Join-Path $env:JAVA_HOME 'bin/java.exe'
if (-not (Test-Path $javaExe)) { throw "JAVA_HOME does not look like a JDK: $env:JAVA_HOME" }

# --- 2. ASCII workspace -----------------------------------------------------
# Reuse the well-known junction location if it already points at this client dir.
$link = 'C:\Users\' + $env:USERNAME + '\Documents\deepseek-harness\default-workspace\tm-client'
if (-not (Test-Path $link)) {
    $parent = Split-Path $link -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    cmd /c mklink /J "$link" "$clientDir" | Out-Null
    if (-not (Test-Path $link)) { throw "Failed to create ASCII junction: $link -> $clientDir" }
}
Write-Host "ASCII build path: $link" -ForegroundColor DarkGray

# --- 3. build ---------------------------------------------------------------
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'
Push-Location $clientDir
try {
    Write-Host '=== building web bundle ===' -ForegroundColor Cyan
    & pnpm run build
    if ($LASTEXITCODE -ne 0) { throw 'web build failed' }

    Write-Host '=== cap sync android ===' -ForegroundColor Cyan
    & pnpm exec cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }
} finally {
    Pop-Location
}

$gradleTasks = @('assembleRelease')
if ($Bundle) { $gradleTasks += 'bundleRelease' }

Write-Host "=== gradle $($gradleTasks -join ' ') ===" -ForegroundColor Cyan
& (Join-Path $link 'android\gradlew.bat') -p (Join-Path $link 'android') @gradleTasks
if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }

# --- 4. report --------------------------------------------------------------
$apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
if (Test-Path $apk) {
    $mb = [math]::Round((Get-Item $apk).Length / 1MB, 2)
    Write-Host "APK : $apk  ($mb MB)" -ForegroundColor Green
}
if ($Bundle) {
    $aab = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
    if (Test-Path $aab) {
        $mb = [math]::Round((Get-Item $aab).Length / 1MB, 2)
        Write-Host "AAB : $aab  ($mb MB)" -ForegroundColor Green
    }
}
