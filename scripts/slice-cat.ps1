Add-Type -AssemblyName System.Drawing

$src = "C:\Users\T-GAMER\postit-app\assets\postit-cat.png"
$out = "C:\Users\T-GAMER\postit-app\assets"
$bmp = New-Object System.Drawing.Bitmap($src)
$w = $bmp.Width

function Crop($top, $bottom, $name) {
  $h = $bottom - $top
  $rect = New-Object System.Drawing.Rectangle(0, $top, $w, $h)
  $piece = $bmp.Clone($rect, $bmp.PixelFormat)
  $piece.Save("$out\$name", [System.Drawing.Imaging.ImageFormat]::Png)
  $piece.Dispose()
  Write-Output "$name -> ${w}x${h}"
}

# topo: gatinho + inicio do papel
Crop 0 620 "cat-head.png"
# meio: faixa de papel para esticar verticalmente (preserva bordas laterais)
Crop 700 760 "cat-mid.png"
# base: fim do papel com a dobra no canto
Crop 1010 1268 "cat-foot.png"

$bmp.Dispose()
