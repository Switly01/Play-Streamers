$ErrorActionPreference = "Stop"

$ffmpegVersion = "9.0.1"
$expectedArchiveHash = "FEC81AE03971D9DD4BE3EBE02E263BD2EC1D789483F931BDBA5F5715E65DA2E9"
$archiveUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$scriptRoot = Split-Path -Parent $PSScriptRoot
$tauriRoot = Join-Path $scriptRoot "src-tauri"
$binaryDirectory = Join-Path $tauriRoot "binaries"
$targetBinary = Join-Path $binaryDirectory "ffmpeg-x86_64-pc-windows-msvc.exe"
$downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) "play-streamers-ffmpeg-$ffmpegVersion"
$archivePath = Join-Path $downloadRoot "ffmpeg.zip"
$extractRoot = Join-Path $downloadRoot "extracted"

New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash
if ($actualHash -ne $expectedArchiveHash) {
    throw "FFmpeg archive checksum mismatch. Expected $expectedArchiveHash, received $actualHash."
}

if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot
$packageRoot = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
if (-not $packageRoot) {
    throw "FFmpeg archive layout is invalid."
}

New-Item -ItemType Directory -Force -Path $binaryDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $packageRoot.FullName "bin\ffmpeg.exe") -Destination $targetBinary -Force
Copy-Item -LiteralPath (Join-Path $packageRoot.FullName "LICENSE") -Destination (Join-Path $scriptRoot "FFMPEG-GPL-3.0-LICENSE.txt") -Force
Copy-Item -LiteralPath (Join-Path $packageRoot.FullName "README.txt") -Destination (Join-Path $scriptRoot "FFMPEG-BUILD-README.txt") -Force

Write-Host "FFmpeg $ffmpegVersion verified and installed at $targetBinary"
