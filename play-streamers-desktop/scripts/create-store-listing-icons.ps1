param(
  [string]$SourcePath = (Join-Path $PSScriptRoot '..\src-tauri\icons\Square310x310Logo.png'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\store\listing-assets')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourceFile = (Resolve-Path -LiteralPath $SourcePath).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-StoreListingIcon {
  param(
    [Parameter(Mandatory = $true)][int]$Size,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  # Store logos must remain legible on every theme. A 24-bit RGB canvas
  # guarantees that antialiased rounded corners cannot reintroduce alpha.
  $canvas = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $source = [System.Drawing.Image]::FromFile($sourceFile)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(7, 9, 13))

    # The Tauri tile is already a fully opaque, Store-safe composition. Resize
    # it edge-to-edge so the listing and installed application use one mark,
    # without the older nested tile/border treatment.
    $destinationRect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $graphics.DrawImage($source, $destinationRect)

    $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $source.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

foreach ($size in @(300, 150, 71)) {
  $output = Join-Path $OutputDirectory "Play-Streamers-App-Tile-$size.png"
  New-StoreListingIcon -Size $size -Destination $output
  Write-Host "Created $output"
}
