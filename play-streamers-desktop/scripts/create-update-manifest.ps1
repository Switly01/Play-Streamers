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

$releaseNotesJson = '"Play Streamers Desktop __VERSION__: Studio ile yerel kay\u0131t/yay\u0131n motoru rafa kald\u0131r\u0131ld\u0131. Uygulama art\u0131k 45 i\u00e7erik, analiz, topluluk, marka, gelir, kasa ve ayar arac\u0131na odaklan\u0131r. Genel kay\u0131t/yay\u0131n k\u0131sayollar\u0131 kald\u0131r\u0131ld\u0131 ve Windows \u00fcretim s\u00fcr\u00fcm\u00fc CMD penceresi a\u00e7madan ba\u011f\u0131ms\u0131z \u00e7al\u0131\u015f\u0131r."'
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
