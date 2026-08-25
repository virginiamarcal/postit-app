Add-Type -AssemblyName System.Drawing

$src = "C:\Users\T-GAMER\postit-app\assets\postit-cat.png"
$out = "C:\Users\T-GAMER\postit-app\assets"
$bmp = New-Object System.Drawing.Bitmap($src)

# Recorta a cabeca do gatinho (quadrado) para virar icone
$rect = New-Object System.Drawing.Rectangle(300, 30, 640, 640)
$face = $bmp.Clone($rect, $bmp.PixelFormat)

function SaveScaled($size, $name, $tint) {
  $canvas = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($face, 0, 0, $size, $size)
  if ($tint) {
    # bolinha vermelha de alerta no canto inferior direito
    $r = [int]($size * 0.34)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 229, 57, 53))
    $g.FillEllipse($brush, $size - $r - 1, $size - $r - 1, $r, $r)
    $brush.Dispose()
  }
  $g.Dispose()
  $canvas.Save("$out\$name", [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Output "$name -> ${size}x${size}"
}

SaveScaled 32 "tray-normal.png" $false
SaveScaled 32 "tray-alert.png" $true
SaveScaled 256 "app-cat.png" $false

$face.Dispose()
$bmp.Dispose()
