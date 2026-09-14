param([switch]$Replace)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskManifest = Get-Content -LiteralPath (Join-Path $taskRoot 'play-connect/manifest.json') -Raw | ConvertFrom-Json
$taskVersion = $taskManifest.version
foreach ($taskPlatform in @(@{Folder='chrome';Archive='chromium'}, @{Folder='firefox';Archive='gecko'})) {
  $taskSource = [System.IO.Path]::GetFullPath((Join-Path $taskRoot "play-connect-$($taskPlatform.Folder)-store-v$taskVersion"))
  if (-not $taskSource.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Invalid package target.' }
  $taskDestination = Join-Path $taskRoot "play-connect-$($taskPlatform.Archive)-v$taskVersion.zip"
  if ((Test-Path -LiteralPath $taskDestination) -and -not $Replace) { throw "Archive already exists: $taskDestination" }
  $taskFiles = Get-ChildItem -LiteralPath $taskSource -Recurse -File | Sort-Object FullName
  $taskArchiveStream = [System.IO.File]::Open($taskDestination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $taskArchive = [System.IO.Compression.ZipArchive]::new($taskArchiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($taskFile in $taskFiles) {
      if (-not $taskFile.FullName.StartsWith($taskSource + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Invalid archive file target.' }
      # ZIP paths must use forward slashes, including archives built on Windows.
      $taskEntryName = $taskFile.FullName.Substring($taskSource.Length + 1).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive, $taskFile.FullName, $taskEntryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally {
    $taskArchive.Dispose()
    $taskArchiveStream.Dispose()
  }
  Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256 | Select-Object Path,Hash
}
Copy-Item -LiteralPath (Join-Path $taskRoot "play-connect-chromium-v$taskVersion.zip") -Destination (Join-Path $taskRoot "play-connect-v$taskVersion.zip") -Force:$Replace
