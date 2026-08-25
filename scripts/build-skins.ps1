# Gera as "peles" (papéis) do post-it a partir das artes em assets/skins-src.
#
# Para cada PNG encontrado, detecta sozinho onde fica o papel dentro da arte e
# recorta três fatias: topo (o bichinho + a borda de cima do papel), meio (uma
# faixa fina que a interface estica) e base (o rodapé com a dobrinha).
# No fim escreve assets/skins/skins.json com as medidas de cada pele.
#
# Uso:  powershell -File scripts/build-skins.ps1

Add-Type -AssemblyName System.Drawing

$root    = Split-Path -Parent $PSScriptRoot
$srcDir  = Join-Path $root "assets\skins-src"
$outRoot = Join-Path $root "assets\skins"

if (-not (Test-Path $srcDir)) { throw "Pasta nao encontrada: $srcDir" }
if (-not (Test-Path $outRoot)) { New-Item -ItemType Directory -Path $outRoot | Out-Null }

# Le a imagem inteira para um array de bytes (BGRA). GetPixel seria lento demais.
function Read-Pixels($bmp) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  return @{ Bytes = $bytes; Stride = $data.Stride }
}

# Descobre o retangulo do papel: as linhas do papel sao as unicas que ficam
# opacas de ponta a ponta (o bichinho no topo ocupa so o meio da arte).
function Find-Paper($bmp) {
  $px = Read-Pixels $bmp
  $bytes = $px.Bytes; $stride = $px.Stride
  $w = $bmp.Width; $h = $bmp.Height

  $widths = New-Object int[] $h
  $lefts  = New-Object int[] $h
  $rights = New-Object int[] $h

  for ($y = 0; $y -lt $h; $y++) {
    $rowStart = $y * $stride
    $left = -1; $right = -1; $count = 0
    for ($x = 0; $x -lt $w; $x++) {
      $alpha = $bytes[$rowStart + $x * 4 + 3]
      if ($alpha -gt 200) {
        if ($left -lt 0) { $left = $x }
        $right = $x
        $count++
      }
    }
    $widths[$y] = $count; $lefts[$y] = $left; $rights[$y] = $right
  }

  $maxWidth = ($widths | Measure-Object -Maximum).Maximum
  if ($maxWidth -le 0) { throw "Arte totalmente transparente." }
  $threshold = [int]($maxWidth * 0.90)

  # primeira e ultima linha "cheia" = topo e base do papel
  $top = -1; $bottom = -1
  for ($y = 0; $y -lt $h; $y++) { if ($widths[$y] -ge $threshold) { $top = $y; break } }
  for ($y = $h - 1; $y -ge 0; $y--) { if ($widths[$y] -ge $threshold) { $bottom = $y; break } }
  if ($top -lt 0 -or $bottom -le $top) { throw "Nao consegui achar o papel na arte." }

  # bordas laterais medidas no miolo do papel, longe do bichinho e da dobra
  $mid = [int](($top + $bottom) / 2)
  return @{
    Left = $lefts[$mid]; Right = $rights[$mid]
    Top = $top; Bottom = $bottom
    Width = $w; Height = $h
  }
}

function Save-Crop($bmp, $top, $height, $path) {
  $rect = New-Object System.Drawing.Rectangle(0, $top, $bmp.Width, $height)
  $piece = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $piece.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $piece.Dispose()
}

# Miniatura quadrada centrada no bichinho. Serve para o seletor de papel e,
# em 32px, para o icone da bandeja -- com bolinha vermelha na versao de alerta.
function Save-Thumb($bmp, $paper, $path, $size, $alertBadge) {
  $faceH = [Math]::Max(60, $paper.Top + [int](($paper.Bottom - $paper.Top) * 0.28))
  $side  = [Math]::Min($bmp.Width, $faceH)
  $x     = [int](($bmp.Width - $side) / 2)
  $rect  = New-Object System.Drawing.Rectangle($x, 0, $side, $side)
  $crop  = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  $canvas = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($crop, 0, 0, $size, $size)
  if ($alertBadge) {
    $r = [int]($size * 0.34)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 229, 57, 53))
    $g.FillEllipse($brush, $size - $r - 1, $size - $r - 1, $r, $r)
    $brush.Dispose()
  }
  $g.Dispose()
  $canvas.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose(); $crop.Dispose()
}

# "gatinho-laranja" -> "Gatinho laranja"
function Prettify($slug) {
  $s = ($slug -replace '[-_]+', ' ').Trim()
  if ($s.Length -eq 0) { return $slug }
  return $s.Substring(0,1).ToUpper() + $s.Substring(1)
}

$skins = @()
$files = Get-ChildItem -Path $srcDir -Filter *.png | Sort-Object Name

if ($files.Count -eq 0) { throw "Nenhum PNG em $srcDir" }

foreach ($file in $files) {
  $slug = [System.IO.Path]::GetFileNameWithoutExtension($file.Name).ToLower() -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  $bmp = New-Object System.Drawing.Bitmap($file.FullName)

  try {
    $paper = Find-Paper $bmp
    $paperH = $paper.Bottom - $paper.Top

    # topo: tudo ate um pouco abaixo da borda de cima do papel
    $headH = $paper.Top + [int]($paperH * 0.28)
    # base: o rodape, onde costuma ficar a dobrinha
    $footH = $bmp.Height - ($paper.Bottom - [int]($paperH * 0.22))
    # meio: faixa fina tirada do miolo limpo do papel
    $midTop = $paper.Top + [int]($paperH * 0.45)
    $midH = 60

    $dir = Join-Path $outRoot $slug
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

    Save-Crop $bmp 0 $headH (Join-Path $dir "head.png")
    Save-Crop $bmp $midTop $midH (Join-Path $dir "mid.png")
    Save-Crop $bmp ($bmp.Height - $footH) $footH (Join-Path $dir "foot.png")
    Save-Thumb $bmp $paper (Join-Path $dir "thumb.png") 96 $false
    Save-Thumb $bmp $paper (Join-Path $dir "tray.png") 32 $false
    Save-Thumb $bmp $paper (Join-Path $dir "tray-alert.png") 32 $true
    Save-Thumb $bmp $paper (Join-Path $dir "app.png") 256 $false

    # A dobrinha fica no canto inferior direito, dentro do papel. Reservamos esse
    # canto para o texto e os botoes nao passarem por cima dela. E uma estimativa
    # sobre a largura do papel: se numa arte a dobra for maior ou menor, basta
    # ajustar "curl" na mao em skins.json (o valor sobrevive ate rodar de novo).
    $paperW = $paper.Right - $paper.Left
    $curl = [int]($paperW * 0.20)

    $skins += [ordered]@{
      id     = $slug
      name   = Prettify $slug
      width  = $paper.Width
      height = $paper.Height
      headH  = $headH
      midH   = $midH
      footH  = $footH
      curl   = $curl
      paper  = [ordered]@{
        left = $paper.Left; right = $paper.Right
        top = $paper.Top;  bottom = $paper.Bottom
      }
    }

    Write-Output ("{0,-22} papel x {1}..{2} y {3}..{4}  | head {5}px mid {6}px foot {7}px" -f `
      $slug, $paper.Left, $paper.Right, $paper.Top, $paper.Bottom, $headH, $midH, $footH)
  }
  catch {
    Write-Warning ("{0}: {1}" -f $file.Name, $_.Exception.Message)
  }
  finally { $bmp.Dispose() }
}

$manifest = [ordered]@{ skins = $skins }
$json = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $outRoot "skins.json"), $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ""
Write-Output ("{0} pele(s) geradas em assets/skins" -f $skins.Count)
