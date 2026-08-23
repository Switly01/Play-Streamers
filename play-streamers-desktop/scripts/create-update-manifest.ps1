param(
  [Parameter(Mandatory = $true)][string]$ReleaseDirectory,
  [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = "Stop"
$installerPath = Join-Path $ReleaseDirectory "Play-Streamers-Setup.exe"
$signaturePath = Join-Path $ReleaseDirectory "Play-Streamers-Setup.exe.sig"
if (-not (Test-Path -LiteralPath $installerPath) -or -not (Test-Path -LiteralPath $signaturePath)) {
  throw "Kurucu veya Tauri updater imzası bulunamadı."
}

$releaseNotes = "Play Streamers Desktop ${Version}: tek kodlama ak$([char]0x0131)$([char]0x015F)$([char]0x0131)ndan iki g$([char]0x00FC)venli RTMPS hedefine e$([char]0x015F)zamanl$([char]0x0131) yay$([char]0x0131)n, $([char]0x00D6)nizleme tuvalinde s$([char]0x00FC)r$([char]0x00FC)kleyerek kaynak yerle$([char]0x015F)tirme, 32 sahne, sahne ba$([char]0x015F)$([char]0x0131)na 64 kaynak ve ger$([char]0x00E7)ek FFmpeg CPU telemetrisi. Kaynaklar, ayr$([char]0x0131) $([char]0x00D6)nizleme/Program, crossfade, replay buffer, ses filtreleri, otomatik yay$([char]0x0131)n kurtarma, do$([char]0x011F)rulanm$([char]0x0131)$([char]0x015F) Kick/Play Connect verileri ve 54 Creator OS $([char]0x00E7)al$([char]0x0131)$([char]0x015F)ma alan$([char]0x0131) korunur. Yay$([char]0x0131)n ve kay$([char]0x0131)t Windows 10/11'de; sanal kamera Windows 11'de $([char]0x00E7)al$([char]0x0131)$([char]0x015F)$([char]0x0131)r."

$manifest = [ordered]@{
  version = $Version
  notes = $releaseNotes
  pub_date = [DateTimeOffset]::UtcNow.ToString("o")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = (Get-Content -LiteralPath $signaturePath -Raw).Trim()
      url = "https://pstreamers.com/downloads/Play-Streamers-Setup.exe"
    }
  }
}

$manifestJson = $manifest | ConvertTo-Json -Depth 6
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $ReleaseDirectory "latest.json"), $manifestJson, $utf8WithoutBom)
