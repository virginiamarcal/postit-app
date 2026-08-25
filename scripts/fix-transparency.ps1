# Devolve a transparencia de uma arte que veio com o "xadrez" pintado.
#
# Alguns geradores de imagem exportam o quadriculado cinza como pixel de verdade,
# em vez de um canal alfa. Aqui o fundo e apagado por preenchimento a partir das
# bordas: so sai o que esta ligado ao contorno da imagem.
#
# LIMITE CONHECIDO: isto e um remendo, nao substitui uma arte com alfa de verdade.
# Funciona bem em desenho com contorno definido. Em FOTO REAL, pelo branco claro
# (patinha, queixo) se dissolve no fundo sem fronteira nitida -- o preenchimento
# atravessa a beirada e come o pelo por dentro. Se a arte for foto, peca ao
# gerador um PNG com fundo transparente em vez de usar este script.
#
# Confira o resultado antes de usar: abra o PNG sobre um fundo colorido e veja se
# nao faltou pedaco do bichinho.
#
# Uso:  powershell -File scripts/fix-transparency.ps1 assets/skins-src/arte.png

param(
  [Parameter(Mandatory = $true)][string]$Path,
  # Quanto o pixel pode fugir de um cinza puro e ainda contar como fundo.
  [int]$Neutral = 14,
  # Quao claro o pixel precisa ser para contar como fundo.
  [int]$MinBright = 218
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Path)) { throw "Arquivo nao encontrado: $Path" }
$full = (Resolve-Path $Path).Path

$src = New-Object System.Drawing.Bitmap($full)
$w = $src.Width; $h = $src.Height

# Copia para um bitmap com canal alfa (o original pode ser 24bpp, sem alfa).
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $w, $h)
$g.Dispose()
$src.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
                      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

$visited = New-Object bool[] ($w * $h)
$stack = New-Object System.Collections.Generic.Stack[int]

# Semente: toda a moldura da imagem.
for ($x = 0; $x -lt $w; $x++) {
  $stack.Push($x)                    # linha de cima
  $stack.Push(($h - 1) * $w + $x)    # linha de baixo
}
for ($y = 0; $y -lt $h; $y++) {
  $stack.Push($y * $w)               # coluna da esquerda
  $stack.Push($y * $w + $w - 1)      # coluna da direita
}

$removed = 0
while ($stack.Count -gt 0) {
  $idx = $stack.Pop()
  if ($visited[$idx]) { continue }
  $visited[$idx] = $true

  # Floor, nao [int]: no PowerShell o cast [int] arredonda e estouraria a linha.
  $y = [Math]::Floor($idx / $w)
  $x = $idx - $y * $w
  $o = $y * $stride + $x * 4

  $b = $bytes[$o]; $gr = $bytes[$o + 1]; $r = $bytes[$o + 2]
  $max = [Math]::Max($r, [Math]::Max($gr, $b))
  $min = [Math]::Min($r, [Math]::Min($gr, $b))

  # E fundo? cinza quase puro e claro o bastante.
  if (($max - $min) -gt $Neutral -or $min -lt $MinBright) { continue }

  $bytes[$o + 3] = 0
  $removed++

  if ($x -gt 0)      { $n = $idx - 1;  if (-not $visited[$n]) { $stack.Push($n) } }
  if ($x -lt $w - 1) { $n = $idx + 1;  if (-not $visited[$n]) { $stack.Push($n) } }
  if ($y -gt 0)      { $n = $idx - $w; if (-not $visited[$n]) { $stack.Push($n) } }
  if ($y -lt $h - 1) { $n = $idx + $w; if (-not $visited[$n]) { $stack.Push($n) } }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

# Guarda o original antes de sobrescrever.
$backup = [System.IO.Path]::ChangeExtension($full, ".original.png")
if (-not (Test-Path $backup)) { Copy-Item $full $backup }

$bmp.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$pct = [math]::Round(100 * $removed / ($w * $h), 1)
Write-Output ("{0}: {1} pixels de fundo removidos ({2}% da imagem)" -f `
  (Split-Path $full -Leaf), $removed, $pct)
Write-Output ("original guardado em {0}" -f (Split-Path $backup -Leaf))
