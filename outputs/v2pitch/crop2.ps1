# Crop new assets out of the tall @2x report capture (3200x4800).
# ASCII only.
Add-Type -AssemblyName System.Drawing
$SRC = "C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-Desktop-aivo\636821cc-0697-427a-b455-fcceaab6a1ea\scratchpad\tall\hi_rep.png"
$DST = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch\shots"

# name, x, y, w, h    (coordinates in the 3200x4800 capture)
$jobs = @(
  @("c_replay",   500, 1830, 2200,  950),   # video player + slide thumbnails + progress bar
  @("c_subtitle",1330, 1860, 1370,  700),   # slide key content + actual utterances (subtitle-like)
  @("c_feedback", 500, 2900, 2200, 1500),   # slide-by-slide AI feedback
  @("c_filler",   580, 1620, 2050,  180)    # filler / silence chips strip
)

foreach ($j in $jobs) {
  $name=$j[0]; $x=$j[1]; $y=$j[2]; $w=$j[3]; $h=$j[4]
  $img = [System.Drawing.Image]::FromFile($SRC)
  if ($x + $w -gt $img.Width)  { $w = $img.Width  - $x }
  if ($y + $h -gt $img.Height) { $h = $img.Height - $y }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$w,$h), (New-Object System.Drawing.Rectangle $x,$y,$w,$h), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $DST "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  "  {0,-13} {1}x{2}  aspect {3}" -f $name, $w, $h, [Math]::Round($w/$h,2)
}
