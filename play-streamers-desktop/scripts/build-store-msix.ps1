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
    [string]$MinimumWindowsVersion = '10.0.19041.0',
    [switch]$WithoutVirtualCameraRegistration,
    [switch]$SkipStoreBuild,
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
    $OutputPath = Join-Path $storeRelease "Play-Streamers-$PackageVersion-windows-x64.msix"
}

if (-not $SkipStoreBuild) {
    $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue }
    if (-not $pnpm) { throw 'Store derlemesi için pnpm bulunamadı.' }
    $previousChannel = $env:VITE_DISTRIBUTION_CHANNEL
    try {
        $env:VITE_DISTRIBUTION_CHANNEL = 'store'
        # Microsoft Store MSIX kendi imzalama/güncelleme zincirini kullanır.
        # Bu nedenle NSIS ve Tauri updater artefaktlarını üretmeden yalnızca
        # Store paketine girecek uygulama ikilisini derle.
        & $pnpm.Source exec tauri build --no-bundle
        if ($LASTEXITCODE -ne 0) { throw 'Microsoft Store kanalına özel masaüstü derlemesi tamamlanamadı.' }
    } finally {
        $env:VITE_DISTRIBUTION_CHANNEL = $previousChannel
    }
}

$requiredFiles = @((Join-Path $releaseRoot 'play-streamers.exe'))
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
New-Item -ItemType Directory -Force -Path $storeRelease | Out-Null

Copy-Item -Force -LiteralPath (Join-Path $releaseRoot 'play-streamers.exe') -Destination (Join-Path $stageRoot 'Play Streamers.exe')

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
$virtualCameraExtension = ''
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
    VirtualCameraRegistration = $false
    IdentityName = $IdentityName
    Publisher = $Publisher
    Sha256 = $hash
    Signed = $false
} | ConvertTo-Json
