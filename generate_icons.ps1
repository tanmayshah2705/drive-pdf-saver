Add-Type -AssemblyName System.Drawing
$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 115, 232))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    $font = New-Object System.Drawing.Font("Arial", ($size/3.5))
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $graphics.DrawString("PDF", $font, $textBrush, $rect, $stringFormat)
    
    $path = Join-Path $iconsDir "icon$size.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
}
Write-Output "Icons generated successfully."
