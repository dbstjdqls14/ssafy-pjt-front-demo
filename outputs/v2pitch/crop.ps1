# Crop focused regions out of the 3200x2000 (@2x) captures.
# ASCII only - PowerShell 5.1 reads .ps1 as ANSI.
Add-Type -AssemblyName System.Drawing

$SRC = "C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-Desktop-aivo\636821cc-0697-427a-b455-fcceaab6a1ea\scratchpad"
$DST = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch\shots"
New-Item -ItemType Directory -Force $DST | Out-Null

# name , source file , x , y , w , h
$jobs = @(
  @("c_score",      "$SRC\rep\rep_pres_2.png",   1320,  290, 1370,  560),
  @("c_speed",      "$SRC\rep\rep_pres_2.png",    490,  940, 2190,  920),
  @("c_trend",      "$SRC\rep\folder_pres.png",  1345,  300, 1330,  640),
  @("c_archive",    "$SRC\auth\archive.png",      500,  920, 2210,  820),
  @("c_interviewer","$SRC\auth\int_style.png",    770, 1080, 1660,  600),
  @("c_int_report", "$SRC\rep\rep_int_1.png",     490,  280, 2210, 1000)
)

foreach ($j in $jobs) {
  $name = $j[0]; $src = $j[1]; $x = $j[2]; $y = $j[3]; $w = $j[4]; $h = $j[5]
  if (-not (Test-Path $src)) { "MISSING $src"; continue }
  $img = [System.Drawing.Image]::FromFile($src)
  # clamp
  if ($x + $w -gt $img.Width)  { $w = $img.Width  - $x }
  if ($y + $h -gt $img.Height) { $h = $img.Height - $y }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $rect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $out = Join-Path $DST "$name.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  $ratio = [Math]::Round($w / $h, 2)
  "  {0,-15} {1}x{2}  aspect {3}" -f $name, $w, $h, $ratio
}
