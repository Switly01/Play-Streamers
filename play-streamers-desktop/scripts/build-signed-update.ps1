param(
  [string]$ReleaseDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$signingDirectory = Join-Path $env:LOCALAPPDATA "PlayStreamers\signing"
$privateKeyPath = Join-Path $signingDirectory "updater.key"
$passwordPath = Join-Path $signingDirectory "updater-password.dpapi"
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { $null }

if (-not (Test-Path -LiteralPath $privateKeyPath) -or -not (Test-Path -LiteralPath $passwordPath)) {
  throw "Play Streamers updater imza anahtarı bu Windows kullanıcısında bulunamadı."
}
if (-not $nodeExecutable) { throw "Node.js bulunamadı." }

$securePassword = ConvertTo-SecureString ((Get-Content -LiteralPath $passwordPath -Raw).Trim())
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:TAURI_SIGNING_PRIVATE_KEY = $privateKeyPath
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $plainPassword
  $originalProcessPath = $env:Path
  $env:Path = "$(Split-Path -Parent $nodeExecutable);$originalProcessPath"

  Push-Location $projectRoot
  try {
    & pnpm.cmd run desktop:build
    if ($LASTEXITCODE -ne 0) { throw "Tauri üretim derlemesi başarısız oldu." }
  } finally {
    Pop-Location
  }

  if ($ReleaseDirectory) {
    $bundleDirectory = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
    $installer = Get-ChildItem -LiteralPath $bundleDirectory -Filter "*-setup.exe" | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $installer) { throw "NSIS kurucusu bulunamadı." }
    $signaturePath = $installer.FullName + ".sig"
    if (-not (Test-Path -LiteralPath $signaturePath)) { throw "Updater imzası oluşturulmadı." }
    New-Item -ItemType Directory -Path $ReleaseDirectory -Force | Out-Null
    Copy-Item -LiteralPath $installer.FullName -Destination (Join-Path $ReleaseDirectory "Play-Streamers-Setup.exe") -Force
    Copy-Item -LiteralPath $signaturePath -Destination (Join-Path $ReleaseDirectory "Play-Streamers-Setup.exe.sig") -Force
  }
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  if ($null -ne $originalProcessPath) { $env:Path = $originalProcessPath }
  Remove-Variable plainPassword,securePassword,originalProcessPath -ErrorAction SilentlyContinue
}
