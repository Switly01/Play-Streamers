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

$releaseNotesJson = '"Play Streamers Desktop __VERSION__: Kick yay\u0131nlar\u0131 art\u0131k site veya uygulama kapal\u0131yken de sunucuda otomatik \u00f6l\u00e7\u00fcl\u00fcr. Son yay\u0131n ortalamas\u0131, tepe izleyici ve do\u011frulanm\u0131\u015f etkile\u015fimler ana ekranda yenilenir. Windows 10 ve 11 ayn\u0131 sade, CMD penceresiz uygulama paketini kullan\u0131r."'
$releaseNotes = ($releaseNotesJson.Replace('__VERSION__', $Version) | ConvertFrom-Json)

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
