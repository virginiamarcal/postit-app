# Prepara as artes do lembrete de agua: limpa a franja do chroma-key, recorta o
# vazio em volta e grava um agua.png por skin.
#
# As artes vem do gerador com alfa de verdade, mas os pixels da beirada ainda
# carregam a cor do fundo magenta misturada dentro deles -- por isso o contorno
# rosa. A conta abaixo desfaz essa mistura.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\build-agua.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$raiz    = Split-Path -Parent $PSScriptRoot
$origem  = Join-Path $raiz "assets\agua-src"
$destino = Join-Path $raiz "assets\skins"
# Altura do gatinho na tela. Ele aparece por uns segundos e some, entao precisa
# ser grande o bastante para ser notado sem que a pessoa procure.
$alturaAlvo = 560

# Cada arte de agua pertence a um gato ja existente no post-it.
$paraSkin = @{
  "agua-british-blue"     = "cinza-azul"
  "agua-frajola"          = "smoking-amarelo"
  "agua-magali"           = "magali"
  "agua-pretinho"         = "preto-pessego"
  "agua-ruivinho"         = "gatinho-laranja"
  "agua-siames"           = "siames-lilas"
  "agua-tricolor"         = "tricolor-rosa"
  "gatinho-lembrete-agua" = "tigrado-amarelo"
}

function Read-Pixels([System.Drawing.Bitmap]$bmp) {
  $r = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
  $d = $bmp.LockBits($r, 'ReadOnly', 'Format32bppArgb')
  $buf = New-Object byte[] ($bmp.Width * $bmp.Height * 4)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($d)
  # A virgula nao e enfeite: sem ela o PowerShell enumera o array na saida e o
  # chamador recebe um Object[]. Ao entrar numa funcao que pede [byte[]] isso
  # vira uma copia, e toda limpeza feita ali dentro se perde em silencio.
  return ,$buf
}

function Write-Pixels([System.Drawing.Bitmap]$bmp, [byte[]]$buf, [string]$fmt = 'Format32bppArgb') {
  $r = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
  $d = $bmp.LockBits($r, 'WriteOnly', $fmt)
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $d.Scan0, $buf.Length)
  $bmp.UnlockBits($d)
}

# Encolher de 1024 para ~190 px mistura cada pixel com os vizinhos. Se os
# vizinhos transparentes valem preto, a beirada do gato escurece -- troca de
# uma auréola rosa por uma cinza. Multiplicar a cor pelo alfa antes de
# reduzir faz o transparente entrar na conta com peso zero, que e o certo.
function ConvertTo-Premultiplied([byte[]]$buf) {
  for ($i = 0; $i -lt $buf.Length; $i += 4) {
    $a = $buf[$i + 3]
    if ($a -eq 255) { continue }
    if ($a -eq 0) { $buf[$i] = 0; $buf[$i+1] = 0; $buf[$i+2] = 0; continue }
    $buf[$i]     = [byte](($buf[$i]     * $a) / 255)
    $buf[$i + 1] = [byte](($buf[$i + 1] * $a) / 255)
    $buf[$i + 2] = [byte](($buf[$i + 2] * $a) / 255)
  }
}

# O chroma-key deixou opacos varios pixels da beirada que ainda sao magenta --
# e dai que vem o contorno rosa. Estes somem pela cor, nao pelo alfa: nenhum
# gato tem pelo magenta. O criterio precisa ser estreito para o nariz e a
# orelha rosados sobreviverem: neles o verde acompanha os outros canais, no
# magenta ele desaba sozinho.
function Remove-Spill([byte[]]$buf) {
  $mortos = 0
  for ($i = 0; $i -lt $buf.Length; $i += 4) {
    if ($buf[$i + 3] -eq 0) { continue }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
    if ($r -lt 120 -or $b -lt 120) { continue }
    $menor = [Math]::Min($r, $b)
    if (($menor - $g) -lt 60) { continue }
    $buf[$i] = 0; $buf[$i+1] = 0; $buf[$i+2] = 0; $buf[$i+3] = 0
    $mortos++
  }
  return $mortos
}

# Desfaz a mistura com o fundo. O que esta gravado num pixel de beirada e
# C = a*F + (1-a)*M -- a cor real do gato ja diluida no magenta. Isolar F
# devolve o pelo limpo, e o alfa continua fazendo o trabalho de transparencia.
function Remove-Fringe([byte[]]$buf, [int]$w, [int]$h, $fundo) {
  $mR = $fundo.R; $mG = $fundo.G; $mB = $fundo.B
  for ($i = 0; $i -lt $buf.Length; $i += 4) {
    $a = $buf[$i + 3]
    if ($a -eq 255) { continue }
    # Abaixo disso o pixel nao se ve, mas a divisao por um alfa minusculo
    # multiplica o ruido por vinte e tantos e devolve magenta puro no lugar
    # de pelo. Nao vale de-mattar: some.
    if ($a -lt 24) { $buf[$i] = 0; $buf[$i+1] = 0; $buf[$i+2] = 0; $buf[$i+3] = 0; continue }
    $af = $a / 255.0
    foreach ($c in 0, 1, 2) {
      $m = if ($c -eq 0) { $mB } elseif ($c -eq 1) { $mG } else { $mR }
      $v = ($buf[$i + $c] - (1 - $af) * $m) / $af
      $buf[$i + $c] = [byte][Math]::Max(0, [Math]::Min(255, [Math]::Round($v)))
    }
  }
}

# Caixa do conteudo. Exige alguns pixels na linha para nao morder um respingo
# solto que o chroma-key tenha deixado para tras.
function Get-ContentBox([byte[]]$buf, [int]$w, [int]$h) {
  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $linha = $y * $w * 4
    $conta = 0; $lo = -1; $hi = -1
    for ($x = 0; $x -lt $w; $x++) {
      if ($buf[$linha + $x * 4 + 3] -ge 24) {
        $conta++
        if ($lo -lt 0) { $lo = $x }
        $hi = $x
      }
    }
    if ($conta -lt 6) { continue }
    if ($y -lt $minY) { $minY = $y }
    $maxY = $y
    if ($lo -lt $minX) { $minX = $lo }
    if ($hi -gt $maxX) { $maxX = $hi }
  }
  return @{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1) }
}

foreach ($arq in (Get-ChildItem "$origem\*.png" | Sort-Object Name)) {
  $skin = $paraSkin[$arq.BaseName]
  if (-not $skin) { Write-Host "  ? $($arq.BaseName): sem skin correspondente, pulando"; continue }

  $pastaSkin = Join-Path $destino $skin
  if (-not (Test-Path $pastaSkin)) { Write-Host "  ! $skin nao existe, pulando"; continue }

  $bmp = [System.Drawing.Bitmap]::FromFile($arq.FullName)
  $w = $bmp.Width; $h = $bmp.Height
  $buf = Read-Pixels $bmp
  # De-mattar primeiro, limpar depois: a conta do de-matting pode ela mesma
  # devolver magenta saturado onde o pixel era quase so fundo.
  Remove-Fringe $buf $w $h $bmp.GetPixel(0, 0)
  $spill = Remove-Spill $buf
  $box = Get-ContentBox $buf $w $h

  ConvertTo-Premultiplied $buf
  $limpo = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  Write-Pixels $limpo $buf 'Format32bppPArgb'

  $escala = $alturaAlvo / $box.H
  $lw = [int][Math]::Round($box.W * $escala)

  $saida = New-Object System.Drawing.Bitmap($lw, $alturaAlvo, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($saida)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($limpo,
    (New-Object System.Drawing.Rectangle(0, 0, $lw, $alturaAlvo)),
    (New-Object System.Drawing.Rectangle($box.X, $box.Y, $box.W, $box.H)),
    [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  # Limpar de novo, agora no tamanho final. Reduzir e gravar em PNG passa pela
  # divisao por alfa mais uma vez, e ela torna a inventar magenta nas beiradas
  # translucidas. Esta passada e sobre o que realmente vai para o disco.
  $fim = Read-Pixels $saida
  $sobra = Remove-Spill $fim
  Write-Pixels $saida $fim

  $saida.Save((Join-Path $pastaSkin "agua.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host ("  OK {0,-22} -> {1,-16} {2}x{3}  franja: {4} + {5} px" -f $arq.BaseName, $skin, $lw, $alturaAlvo, $spill, $sobra)
  $saida.Dispose(); $limpo.Dispose(); $bmp.Dispose()
}

Write-Host "`nPronto."
