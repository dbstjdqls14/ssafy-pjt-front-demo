# Insert real service screenshots into the USER-EDITED deck via PowerPoint COM.
# Works in place on a copy so the user's edits (removed slides/lines, team slide) are preserved.
# Reads shots_spec.txt lines: "<slideIndex> <assetName> <mode>"
#   column  : remove the gray placeholder, drop the image into the right column area
#   band    : remove the placeholder, lay the image as a full-width band low on the slide
#   replace : swap the existing picture on the slide for the new one (wide layout)
Add-Type -AssemblyName System.Drawing

$root  = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$src   = Join-Path $root "user_deck.pptx"
$dst   = Join-Path $root "pitch_shots.pptx"
$shots = Join-Path $root "shots"
$spec  = Join-Path $root "shots_spec.txt"

$PT = 72.0
# placeholder geometry written by build_pitch.js (inches -> points)
$PH_X = 6.5 * $PT; $PH_W = 5.83 * $PT
$TOL  = 8.0

Copy-Item $src $dst -Force

$ppt  = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($dst, $false, $false, $false)

$log = @()
foreach ($line in Get-Content $spec) {
    $t = $line.Trim(); if ($t -eq "") { continue }
    $p = $t -split '\s+'
    $idx = [int]$p[0]; $asset = $p[1]; $mode = $p[2]
    $file = Join-Path $shots "$asset.png"
    if (-not (Test-Path $file)) { $log += "MISSING $asset"; continue }

    $img = [System.Drawing.Image]::FromFile($file)
    $ar  = $img.Width / $img.Height
    $img.Dispose()

    $sld = $deck.Slides.Item($idx)

    # --- remove what the new image replaces -------------------------------
    $removed = 0
    for ($i = $sld.Shapes.Count; $i -ge 1; $i--) {
        $sh = $sld.Shapes.Item($i)
        if ($mode -eq "replace") {
            if ($sh.Type -eq 13) { $sh.Delete(); $removed++ }          # msoPicture
        } else {
            # the placeholder rect and its centered label share the same bounds
            if ([Math]::Abs($sh.Left - $PH_X) -lt $TOL -and [Math]::Abs($sh.Width - $PH_W) -lt $TOL) {
                $sh.Delete(); $removed++
            }
        }
    }

    # --- place the image ---------------------------------------------------
    if ($mode -eq "band") {
        $w = 11.33 * $PT
        $h = $w / $ar
        $x = 1.0 * $PT
        $y = (6.15 * $PT) - $h
        if ($y -lt (4.6 * $PT)) { $y = 4.6 * $PT }
    } elseif ($mode -eq "replace") {
        $bx = 1.0 * $PT; $bw = 11.33 * $PT; $by = 2.5 * $PT; $bh = 3.8 * $PT
        $h = $bh; $w = $h * $ar
        if ($w -gt $bw) { $w = $bw; $h = $w / $ar }
        $x = $bx + ($bw - $w) / 2
        $y = $by + ($bh - $h) / 2
    } else {  # column
        $bx = 6.2 * $PT; $bw = 6.2 * $PT; $by = 1.35 * $PT; $bh = 4.8 * $PT
        $w = $bw; $h = $w / $ar
        if ($h -gt $bh) { $h = $bh; $w = $h * $ar }
        $x = $bx + ($bw - $w) / 2
        $y = $by + ($bh - $h) / 2
    }

    $pic = $sld.Shapes.AddPicture($file, $false, $true, $x, $y, $w, $h)
    $log += ("slide {0,2}  {1,-12} {2,-8} removed {3}  ->  {4:N2}x{5:N2} in" -f $idx, $asset, $mode, $removed, ($w/$PT), ($h/$PT))
}

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
$log
