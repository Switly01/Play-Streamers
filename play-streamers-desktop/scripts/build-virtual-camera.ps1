[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path -Parent $PSScriptRoot
$cameraRoot = Join-Path $desktopRoot 'native\virtual-camera'
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'

if (-not (Test-Path -LiteralPath $vswhere)) {
    throw 'Visual Studio Build Tools bulunamadı.'
}

$visualStudioRoot = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $visualStudioRoot) {
    throw 'Visual C++ x64 derleyicisi bulunamadı.'
}

$msbuild = Join-Path $visualStudioRoot 'MSBuild\Current\Bin\MSBuild.exe'
$nugetRoot = Join-Path $env:LOCALAPPDATA 'PlayStreamers\build-tools'
$nuget = Join-Path $nugetRoot 'nuget.exe'
if (-not (Test-Path -LiteralPath $nuget)) {
    New-Item -ItemType Directory -Force -Path $nugetRoot | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri 'https://dist.nuget.org/win-x86-commandline/latest/nuget.exe' -OutFile $nuget
}

$packages = Join-Path $cameraRoot 'packages'
& $nuget install (Join-Path $cameraRoot 'media-source\packages.config') -OutputDirectory $packages -NonInteractive
if ($LASTEXITCODE -ne 0) { throw 'Sanal kamera bağımlılıkları indirilemedi.' }

$solutionDir = "$cameraRoot\"
& $msbuild (Join-Path $cameraRoot 'media-source\VirtualCameraMediaSource.vcxproj') '-p:Configuration=Release' '-p:Platform=x64' "-p:SolutionDir=$solutionDir" '-m' '-v:minimal'
if ($LASTEXITCODE -ne 0) { throw 'Sanal kamera medya kaynağı derlenemedi.' }

& $msbuild (Join-Path $cameraRoot 'manager\PlayStreamersVirtualCameraManager.vcxproj') '-p:Configuration=Release' '-p:Platform=x64' "-p:SolutionDir=$solutionDir" '-m' '-v:minimal'
if ($LASTEXITCODE -ne 0) { throw 'Sanal kamera yöneticisi derlenemedi.' }

$bundleDir = Join-Path $desktopRoot 'src-tauri\binaries\vcam'
New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
Copy-Item -Force -LiteralPath (Join-Path $cameraRoot 'x64\Release\PlayStreamersVirtualCamera.dll') -Destination (Join-Path $bundleDir 'PlayStreamersVirtualCamera.dll')
Copy-Item -Force -LiteralPath (Join-Path $cameraRoot 'artifacts\PlayStreamersVirtualCameraManager.exe') -Destination (Join-Path $bundleDir 'PlayStreamersVirtualCameraManager.exe')

Write-Host "Windows 11 sanal kamera bileşenleri hazır: $bundleDir"
