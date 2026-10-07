@echo off
REM ============================================================================
REM TalentMate Android 构建脚本（在 client 目录下执行）
REM
REM   powershell -ExecutionPolicy Bypass -File build-android.ps1
REM   powershell -ExecutionPolicy Bypass -File build-android.ps1 -Task assembleRelease
REM   powershell -ExecutionPolicy Bypass -File build-android.ps1 -SkipWebBuild
REM
REM 本脚本处理两件本机特有的麻烦事：
REM   1. 项目路径含中文，java.exe 无法从中文 classpath 定位 gradle-wrapper.jar，
REM      因此通过一个 ASCII 目录联接（junction）从英文路径调用 Gradle。
REM   2. capacitor.settings.gradle 使用相对路径 ../node_modules/... 引用
REM      capacitor-android 模块，所以联接必须指向 client 目录（而不是 android
REM      目录），否则 Gradle 会报 "project :capacitor-android ... No variants exist"。
REM ============================================================================

param(
    # Gradle 任务：assembleDebug / assembleRelease / bundleRelease / clean 等
    [string]$Task = "assembleDebug",
    # 可选：显式指定 JDK 21 目录。留空则自动探测。
    [string]$JavaHome = "",
    # 跳过 vite build + cap sync（只重跑 Gradle 时使用）
    [switch]$SkipWebBuild
)

$ErrorActionPreference = "Stop"
$clientDir = $PSScriptRoot
$androidDir = Join-Path $clientDir "android"

if (-not (Test-Path $androidDir)) {
    throw "未找到 android 目录。请先在 client 目录执行：pnpm exec cap add android"
}

# --- 1. 解析 JDK 21 ----------------------------------------------------------
# Capacitor 8 生成的 capacitor.build.gradle 要求 Java 21，JDK 17 会报
# "invalid source release: 21"，因此这里强制 JDK 21。
if (-not $JavaHome) {
    $candidates = @(
        "D:\jdk-21.0.12.1+1",
        $env:JAVA_HOME,
        "$env:LOCALAPPDATA\Android\android-studio\jbr",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "bin\javac.exe"))) {
            $text = (& (Join-Path $c "bin\java.exe") -version 2>&1 | Out-String)
            if ($text -match 'version "(\d+)' -and [int]$Matches[1] -ge 21) { $JavaHome = $c; break }
        }
    }
}
if (-not $JavaHome) {
    throw "未找到 JDK 21。请安装 JDK 21（Temurin/Adoptium），或用 -JavaHome 指定路径。"
}

$java = Join-Path $JavaHome "bin\java.exe"
if (-not (Test-Path $java)) { throw "JDK 路径无效：$java" }
$env:JAVA_HOME = $JavaHome
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"

$versionText = (& $java -version 2>&1 | Out-String)
if ($versionText -match 'version "(\d+)') {
    $major = [int]$Matches[1]
    if ($major -lt 21) { throw "检测到 JDK $major，Capacitor 8 需要 JDK 21。当前：$JavaHome" }
    Write-Host "JDK: $JavaHome (Java $major)" -ForegroundColor Cyan
}

# --- 2. 解析 Android SDK -----------------------------------------------------
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $env:ANDROID_HOME)) {
    throw "未找到 Android SDK。请设置 ANDROID_HOME 环境变量。"
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "SDK: $env:ANDROID_HOME" -ForegroundColor Cyan

# --- 3. 构建 Web 资源并同步 --------------------------------------------------
if (-not $SkipWebBuild) {
    Write-Host "`n[1/3] vite build + cap sync android ..." -ForegroundColor Yellow
    Push-Location $clientDir
    try {
        & pnpm run android:sync
        if ($LASTEXITCODE -ne 0) { throw "vite build / cap sync 失败。" }
    } finally { Pop-Location }
} else {
    Write-Host "`n[1/3] 跳过 Web 构建（-SkipWebBuild）" -ForegroundColor DarkGray
}

# --- 4. 解析 ASCII 工作路径 ---------------------------------------------------
if ($clientDir -notmatch '[^\x00-\x7F]') {
    # 项目本身就在纯英文路径，直接用真实路径
    $gradleClient = $clientDir
} else {
    $gradleClient = Join-Path "C:\" "tm-client-build"
    if (Test-Path $gradleClient) {
        $target = (Get-Item $gradleClient -Force).Target
        if ($target -and ($target -ne $clientDir)) {
            throw "已存在 $gradleClient 且指向 $target，与本项目不符。请删除该联接后重试。"
        }
    } else {
        Write-Host "`n[2/3] 建立 ASCII 联接：$gradleClient -> $clientDir" -ForegroundColor Yellow
        # 必须联接 client 目录：capacitor.settings.gradle 依赖 ../node_modules 相对路径
        cmd /c "mklink /J `"$gradleClient`" `"$clientDir`"" | Out-Null
        if (-not (Test-Path (Join-Path $gradleClient "android\gradlew.bat"))) {
            throw "建立目录联接失败：$gradleClient"
        }
    }
    Write-Host "Gradle 工作目录：$gradleClient\android" -ForegroundColor DarkGray
}

$gradleRoot = Join-Path $gradleClient "android"
$wrapperJar = Join-Path $gradleRoot "gradle\wrapper\gradle-wrapper.jar"
if (-not (Test-Path $wrapperJar)) { throw "未找到 $wrapperJar" }

# --- 5. 调用 Gradle Wrapper ---------------------------------------------------
Write-Host "`n[3/3] gradle $Task ..." -ForegroundColor Yellow
& $java "-Dorg.gradle.appname=gradlew" `
    -classpath $wrapperJar `
    org.gradle.wrapper.GradleWrapperMain `
    -p $gradleRoot $Task

if ($LASTEXITCODE -ne 0) { throw "Gradle 任务 $Task 失败。" }

# --- 6. 汇报产物 -------------------------------------------------------------
$apkDir = Join-Path $androidDir "app\build\outputs\apk"
Write-Host "`n构建成功。产物目录：$apkDir" -ForegroundColor Green
if (Test-Path $apkDir) {
    Get-ChildItem $apkDir -Recurse -Filter "*.apk" |
        Select-Object FullName, @{n = '大小(MB)'; e = { [math]::Round($_.Length / 1MB, 2) } } |
        Format-Table -AutoSize
}
