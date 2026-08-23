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

$releaseNotes = "Play Streamers Desktop ${Version}: Studio ile yerel kayıt/yayın motoru rafa kaldırıldı. Uygulama artık 45 içerik, analiz, topluluk, marka, gelir, kasa ve ayar aracına odaklanır. Genel kayıt/yayın kısayolları kaldırıldı ve Windows üretim sürümü CMD penceresi açmadan bağımsız çalışır."

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
