[CmdletBinding()]
param(
    [string]$IdentityName = 'Switly.PlayStreamers',
    [string]$Publisher = 'CN=C7E10994-8739-4CF7-9F8C-2F23700A5BDC',
    [string]$PublisherDisplayName = 'Switly',
    [ValidatePattern('^\d+\.\d+\.\d+\.\d+$')]
    [ValidateScript({
        if (($_ -split '\.')[3] -ne '0') {
            throw 'Microsoft Store MSIX sürümünün son hanesi 0 olmalıdır (ör. 0.4.1.0).'
        }
        $true
    })]
    [string]$PackageVersion,
    [ValidateSet('10.0.19041.0', '10.0.22000.0')]
    [string]$MinimumWindowsVersion = '10.0.22000.0',
    [switch]$WithoutVirtualCameraRegistration,
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
if (-not $PackageVersion) {
    $PackageVersion = ($versionParts | Select-Object -First 4) -join '.'
}
if (-not $OutputPath) {
    $flavor = if ($WithoutVirtualCameraRegistration) { 'win10' } else { 'win11' }
    $OutputPath = Join-Path $storeRelease "Play-Streamers-$PackageVersion-$flavor-x64.msix"
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

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$manifest = [System.IO.File]::ReadAllText((Join-Path $desktopRoot 'store\AppxManifest.template.xml'), [System.Text.Encoding]::UTF8)
$manifest = $manifest.Replace('__IDENTITY_NAME__', [Security.SecurityElement]::Escape($IdentityName))
$manifest = $manifest.Replace('__PUBLISHER__', [Security.SecurityElement]::Escape($Publisher))
$manifest = $manifest.Replace('__PUBLISHER_DISPLAY_NAME__', [Security.SecurityElement]::Escape($PublisherDisplayName))
$manifest = $manifest.Replace('__VERSION__', $PackageVersion)
$manifest = $manifest.Replace('__MIN_WINDOWS_VERSION__', $MinimumWindowsVersion)
$virtualCameraExtension = if ($WithoutVirtualCameraRegistration) {
    ''
} else {
@'
        <com4:Extension Category="windows.comServer">
          <com4:ComServer>
            <com5:InProcessServer Path="binaries\vcam\PlayStreamersVirtualCamera.dll">
              <com5:Class Id="7F293AB7-BE5C-4E3F-97D1-C10D938637E1" ThreadingModel="Both" />
            </com5:InProcessServer>
          </com4:ComServer>
        </com4:Extension>
'@
}
$manifest = $manifest.Replace('__VIRTUAL_CAMERA_EXTENSION__', $virtualCameraExtension)
[System.IO.File]::WriteAllText((Join-Path $stageRoot 'AppxManifest.xml'), $manifest, $utf8WithoutBom)

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
    Version = $PackageVersion
    MinimumWindowsVersion = $MinimumWindowsVersion
    VirtualCameraRegistration = -not $WithoutVirtualCameraRegistration
    IdentityName = $IdentityName
    Publisher = $Publisher
    Sha256 = $hash
    Signed = $false
} | ConvertTo-Json
