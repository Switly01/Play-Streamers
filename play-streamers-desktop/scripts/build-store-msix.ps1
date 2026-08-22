[CmdletBinding()]
param(
    [string]$IdentityName = 'SWCREATE.PlayStreamers.Dev',
    [string]$Publisher = 'CN=SW CREATE',
    [string]$PublisherDisplayName = 'SW CREATE',
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path -Parent $PSScriptRoot
$tauriRoot = Join-Path $desktopRoot 'src-tauri'
$releaseRoot = Join-Path $tauriRoot 'target\release'
$stageRoot = Join-Path $tauriRoot 'target\msix\x64'
$stageParent = Split-Path -Parent $stageRoot
$storeRelease = Join-Path $desktopRoot '..\release\microsoft-store'

$config = Get-Content -Raw -LiteralPath (Join-Path $tauriRoot 'tauri.conf.json') | ConvertFrom-Json
$versionParts = @($config.version.Split('.'))
while ($versionParts.Count -lt 4) { $versionParts += '0' }
$packageVersion = ($versionParts | Select-Object -First 4) -join '.'
if (-not $OutputPath) {
    $OutputPath = Join-Path $storeRelease "Play-Streamers-$packageVersion-x64.msix"
}

$requiredFiles = @(
    (Join-Path $releaseRoot 'play-streamers.exe'),
    (Join-Path $tauriRoot 'binaries\ffmpeg-x86_64-pc-windows-msvc.exe'),
    (Join-Path $tauriRoot 'binaries\vcam\PlayStreamersVirtualCamera.dll'),
    (Join-Path $tauriRoot 'binaries\vcam\PlayStreamersVirtualCameraManager.exe')
)
foreach ($required in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $required)) { throw "MSIX girdisi bulunamadı: $required" }
}

if (Test-Path -LiteralPath $stageRoot) {
    $resolvedStage = (Resolve-Path -LiteralPath $stageRoot).Path
    $resolvedParent = (Resolve-Path -LiteralPath $stageParent).Path
    if (-not $resolvedStage.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'MSIX hazırlama klasörü güvenli değil.'
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot 'Assets') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot 'binaries\vcam') | Out-Null
New-Item -ItemType Directory -Force -Path $storeRelease | Out-Null

Copy-Item -Force -LiteralPath (Join-Path $releaseRoot 'play-streamers.exe') -Destination (Join-Path $stageRoot 'Play Streamers.exe')
Copy-Item -Force -LiteralPath (Join-Path $tauriRoot 'binaries\ffmpeg-x86_64-pc-windows-msvc.exe') -Destination (Join-Path $stageRoot 'ffmpeg-x86_64-pc-windows-msvc.exe')
Copy-Item -Force -LiteralPath (Join-Path $tauriRoot 'binaries\vcam\PlayStreamersVirtualCamera.dll') -Destination (Join-Path $stageRoot 'binaries\vcam\PlayStreamersVirtualCamera.dll')
Copy-Item -Force -LiteralPath (Join-Path $tauriRoot 'binaries\vcam\PlayStreamersVirtualCameraManager.exe') -Destination (Join-Path $stageRoot 'binaries\vcam\PlayStreamersVirtualCameraManager.exe')
Copy-Item -Force -LiteralPath (Join-Path $desktopRoot 'FFMPEG-GPL-3.0-LICENSE.txt') -Destination (Join-Path $stageRoot 'FFMPEG-GPL-3.0-LICENSE.txt')
Copy-Item -Force -LiteralPath (Join-Path $desktopRoot 'THIRD_PARTY_NOTICES.md') -Destination (Join-Path $stageRoot 'THIRD_PARTY_NOTICES.md')
Copy-Item -Force -LiteralPath (Join-Path $desktopRoot 'native\virtual-camera\MICROSOFT-WINDOWS-CAMERA-LICENSE.txt') -Destination (Join-Path $stageRoot 'MICROSOFT-WINDOWS-CAMERA-LICENSE.txt')

$iconRoot = Join-Path $tauriRoot 'icons'
Copy-Item -Force -LiteralPath (Join-Path $iconRoot 'Square44x44Logo.png') -Destination (Join-Path $stageRoot 'Assets\Square44x44Logo.png')
Copy-Item -Force -LiteralPath (Join-Path $iconRoot 'Square150x150Logo.png') -Destination (Join-Path $stageRoot 'Assets\Square150x150Logo.png')
Copy-Item -Force -LiteralPath (Join-Path $iconRoot 'Square310x310Logo.png') -Destination (Join-Path $stageRoot 'Assets\Square310x310Logo.png')
Copy-Item -Force -LiteralPath (Join-Path $iconRoot 'StoreLogo.png') -Destination (Join-Path $stageRoot 'Assets\StoreLogo.png')

$manifest = Get-Content -Raw -LiteralPath (Join-Path $desktopRoot 'store\AppxManifest.template.xml')
$manifest = $manifest.Replace('__IDENTITY_NAME__', [Security.SecurityElement]::Escape($IdentityName))
$manifest = $manifest.Replace('__PUBLISHER__', [Security.SecurityElement]::Escape($Publisher))
$manifest = $manifest.Replace('__PUBLISHER_DISPLAY_NAME__', [Security.SecurityElement]::Escape($PublisherDisplayName))
$manifest = $manifest.Replace('__VERSION__', $packageVersion)
Set-Content -LiteralPath (Join-Path $stageRoot 'AppxManifest.xml') -Value $manifest -Encoding UTF8

$makeAppx = Get-ChildItem -LiteralPath 'C:\Program Files (x86)\Windows Kits\10\bin' -Filter makeappx.exe -Recurse |
    Where-Object { $_.FullName -match '\\x64\\makeappx\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $makeAppx) { throw 'Windows SDK MakeAppx aracı bulunamadı.' }

& $makeAppx pack /d $stageRoot /p $OutputPath /o
if ($LASTEXITCODE -ne 0) { throw 'Microsoft Store MSIX paketi oluşturulamadı.' }

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash
[pscustomobject]@{
    Path = (Resolve-Path -LiteralPath $OutputPath).Path
    Version = $packageVersion
    IdentityName = $IdentityName
    Publisher = $Publisher
    Sha256 = $hash
    Signed = $false
} | ConvertTo-Json
