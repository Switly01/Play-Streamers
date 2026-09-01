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

  $canvas = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $source = [System.Drawing.Image]::FromFile($sourceFile)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $bounds = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $bounds,
      [System.Drawing.Color]::FromArgb(255, 22, 24, 29),
      [System.Drawing.Color]::FromArgb(255, 5, 6, 8),
      135.0
    )
    $graphics.FillRectangle($background, $bounds)
    $background.Dispose()

    $inset = [Math]::Max(1, [int][Math]::Round($Size * 0.025))
    $borderWidth = [Math]::Max(1, [single]($Size / 150.0))
    $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 58, 62, 70), $borderWidth)
    $graphics.DrawRectangle($border, $inset, $inset, $Size - (2 * $inset) - 1, $Size - (2 * $inset) - 1)
    $border.Dispose()

    $markSize = [int][Math]::Round($Size * 0.74)
    $markOffset = [int][Math]::Round(($Size - $markSize) / 2)
    $destinationRect = [System.Drawing.Rectangle]::new($markOffset, $markOffset, $markSize, $markSize)
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
