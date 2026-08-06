# Recreate the remaining feature captures (slides 24/25/26/29) as NATIVE shapes
# so each element can be animated. Korean strings come from rebuild_texts2.json.
# Colors follow the service CSS (presentation-report.css / record UI):
#   card border #E1E6F0  chip bg #FFFFFF  panel bg #F7F8FB  highlight box #F1F3F8
#   ink #172346  muted #9AA3B8  body #45506E  indigo #5968DC  green #209E66
#   dark video #141733
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$deckPath = Join-Path $root "work_native2.pptx"
$J = [System.IO.File]::ReadAllText((Join-Path $root "rebuild_texts2.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$PT = 72.0
$FONT = "Noto Sans KR"

function RGB($hex) {
    $r=[Convert]::ToInt32($hex.Substring(0,2),16); $g=[Convert]::ToInt32($hex.Substring(2,2),16); $b=[Convert]::ToInt32($hex.Substring(4,2),16)
    return $r + ($g*256) + ($b*65536)
}
$RR=5; $OVAL=9; $TRI=7
$FADE=10
$AFTER=3; $WITH=2; $CLICK=1

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($deckPath, $false, $false, $false)

function KillPictures($sld) {
    for ($i=$sld.Shapes.Count; $i -ge 1; $i--) {
        if ($sld.Shapes.Item($i).Type -eq 13) { $sld.Shapes.Item($i).Delete() }
    }
}
function T($sld,$text,$x,$y,$w,$h,$size,$bold,$hex,$sp,$align) {
    $tb=$sld.Shapes.AddTextbox(1,$x*$PT,$y*$PT,$w*$PT,$h*$PT)
    $tf=$tb.TextFrame
    $tf.MarginLeft=0;$tf.MarginRight=0;$tf.MarginTop=0;$tf.MarginBottom=0;$tf.WordWrap=-1
    $tf.TextRange.Text=$text
    $tf.TextRange.Font.Name=$FONT; $tf.TextRange.Font.NameFarEast=$FONT
    $tf.TextRange.Font.Size=[single]$size; $tf.TextRange.Font.Bold=$bold
    $tf.TextRange.Font.Color.RGB=RGB $hex
    $tf.TextRange.ParagraphFormat.SpaceWithin=[single]$sp
    $tf.TextRange.ParagraphFormat.Alignment=$align
    return $tb
}
function Box($sld,$x,$y,$w,$h,$bg,$line,$lw,$radPx) {
    $r=$sld.Shapes.AddShape($RR,$x*$PT,$y*$PT,$w*$PT,$h*$PT)
    $r.Adjustments.Item(1)=[Math]::Min(0.5,($radPx/($h*$PT)))
    if ($bg -eq "") { $r.Fill.Visible=0 } else { $r.Fill.ForeColor.RGB=RGB $bg; $r.Fill.Transparency=0 }
    if ($line -eq "") { $r.Line.Visible=0 } else { $r.Line.ForeColor.RGB=RGB $line; $r.Line.Weight=[single]$lw }
    $r.Shadow.Visible=0
    return $r
}
function Seg($sld,$x1,$y1,$x2,$y2,$hex,$wt,$dash) {
    $l=$sld.Shapes.AddLine($x1*$PT,$y1*$PT,$x2*$PT,$y2*$PT)
    $l.Line.ForeColor.RGB=RGB $hex; $l.Line.Weight=[single]$wt
    if ($dash) { $l.Line.DashStyle=4 }
    $l.Shadow.Visible=0
    return $l
}
function FX($sld,$shape,$trig,$delay,$dur) {
    $e=$sld.TimeLine.MainSequence.AddEffect($shape,$FADE)
    $e.Timing.TriggerType=$trig
    $e.Timing.Duration=[single]$dur
    if ($delay -gt 0) { $e.Timing.TriggerDelayTime=[single]$delay }
    return $e
}

# ================= Slide 24 : realtime subtitles =================
$s = $deck.Slides.Item([int]$J.s24.idx)
KillPictures $s
$X=6.2; $W=6.13
$card   = Box $s $X 1.5 $W 4.6 "FFFFFF" "E1E6F0" 1 12
$hdr    = T $s $J.s24.header ($X+0.3) 1.78 3.5 0.3 11 (-1) "172346" 1.1 1
$liveDot= Box $s ($X+$W-1.05) 1.84 0.11 0.11 "209E66" "" 0 6
$liveTx = T $s $J.s24.live ($X+$W-0.85) 1.78 0.6 0.28 9.5 (-1) "209E66" 1.1 1
$curBox = Box $s ($X+0.3) 2.28 ($W-0.6) 0.72 "F1F3F8" "" 0 10
$curTx  = T $s $J.s24.current ($X+0.52) 2.48 ($W-1.04) 0.35 12.5 (-1) "172346" 1.2 1
$p1 = T $s $J.s24.past[0] ($X+0.52) 3.28 ($W-1.04) 0.4 11.5 0 "9AA3B8" 1.3 1
$p2 = T $s $J.s24.past[1] ($X+0.52) 3.82 ($W-1.04) 0.4 11.5 0 "9AA3B8" 1.3 1
$p3 = T $s $J.s24.past[2] ($X+0.52) 4.36 ($W-1.04) 0.4 11.5 0 "9AA3B8" 1.3 1
# story: card auto -> click: sentences stack up -> click: latest highlighted
FX $s $card  $AFTER 0.2 0.4 | Out-Null
FX $s $hdr   $WITH  0.1 0.4 | Out-Null
FX $s $liveDot $WITH 0.1 0.4 | Out-Null
FX $s $liveTx  $WITH 0.1 0.4 | Out-Null
FX $s $p1 $CLICK 0    0.35 | Out-Null
FX $s $p2 $AFTER 0.25 0.35 | Out-Null
FX $s $p3 $AFTER 0.25 0.35 | Out-Null
FX $s $curBox $CLICK 0   0.4 | Out-Null
FX $s $curTx  $WITH  0.1 0.4 | Out-Null

# ================= Slide 25 : speaking speed graph =================
$s = $deck.Slides.Item([int]$J.s25.idx)
KillPictures $s
$card  = Box $s 1.0 2.45 11.33 3.75 "FFFFFF" "E1E6F0" 1 14
$range = T $s $J.s25.range 8.6 2.7 3.5 0.28 9 0 "9AA3B8" 1.1 3
$avgLn = Seg $s 1.35 4.55 12.0 4.55 "C3C9D8" 1.2 $true
$avgTx = T $s $J.s25.avg 1.35 4.26 3.0 0.26 9.5 0 "6B7590" 1.1 1
$t0 = T $s $J.s25.t0 1.35 5.78 1.0 0.26 9 0 "9AA3B8" 1.1 1
$t1 = T $s $J.s25.t1 11.15 5.78 0.85 0.26 9 0 "9AA3B8" 1.1 3
$fast = T $s $J.s25.fast 3.3 5.78 1.0 0.26 9 0 "9AA3B8" 1.1 1
$slow = T $s $J.s25.slow 7.5 5.78 1.0 0.26 9 0 "9AA3B8" 1.1 1
$g1 = Seg $s 1.55 3.05 5.3 3.05 "5968DC" 2.5 $false
$g2 = Seg $s 5.3 3.05 5.3 5.45 "5968DC" 2.5 $false
$g3 = Seg $s 5.3 5.45 8.9 5.45 "5968DC" 2.5 $false
$g4 = Seg $s 8.9 5.45 8.9 5.2 "5968DC" 2.5 $false
$g5 = Seg $s 8.9 5.2 11.85 5.2 "5968DC" 2.5 $false
$dot = Box $s 5.18 2.93 0.24 0.24 "FFFFFF" "172346" 2 24
$dot.AutoShapeType = 9
# story: frame auto -> click: line draws left to right
FX $s $card  $AFTER 0.2 0.4 | Out-Null
FX $s $range $WITH 0.1 0.4 | Out-Null
FX $s $avgLn $WITH 0.1 0.4 | Out-Null
FX $s $avgTx $WITH 0.1 0.4 | Out-Null
FX $s $t0 $WITH 0.1 0.4 | Out-Null
FX $s $t1 $WITH 0.1 0.4 | Out-Null
FX $s $g1 $CLICK 0    0.3 | Out-Null
FX $s $g2 $AFTER 0.05 0.2 | Out-Null
FX $s $dot $WITH 0    0.2 | Out-Null
FX $s $g3 $AFTER 0.05 0.3 | Out-Null
FX $s $g4 $AFTER 0.05 0.15 | Out-Null
FX $s $g5 $AFTER 0.05 0.3 | Out-Null
FX $s $fast $AFTER 0.1 0.3 | Out-Null
FX $s $slow $WITH 0 0.3 | Out-Null

# ================= Slide 26 : filler chips =================
$s = $deck.Slides.Item([int]$J.s26.idx)
KillPictures $s
$cw = @(2.2, 1.9, 3.25, 3.25)
$gap = 0.2
$x = 1.0
$chips = @()
for ($i=0; $i -lt 4; $i++) {
    $w = $cw[$i]
    $box = Box $s $x 5.05 $w 0.55 "FFFFFF" "E1E6F0" 1 10
    $txt = T $s $J.s26.chips[$i] ($x+0.12) 5.18 ($w-0.24) 0.3 10 (-1) "45506E" 1.1 2
    $chips += ,@($box,$txt)
    $x += $w + $gap
}
# story: click -> chips cascade
for ($i=0; $i -lt 4; $i++) {
    $trig = if ($i -eq 0) { $CLICK } else { $AFTER }
    FX $s $chips[$i][0] $trig 0.12 0.3 | Out-Null
    FX $s $chips[$i][1] $WITH 0.05 0.3 | Out-Null
}

# ================= Slide 29 : replay player =================
$s = $deck.Slides.Item([int]$J.s29.idx)
KillPictures $s
$X=6.2; $W=6.13
$video = Box $s $X 1.5 $W 2.55 "141733" "" 0 12
$tri = $s.Shapes.AddShape($TRI, ($X+$W/2-0.17)*$PT, (1.5+2.55/2-0.2)*$PT, 0.34*$PT, 0.4*$PT)
$tri.Rotation = 90
$tri.Fill.ForeColor.RGB = RGB "FFFFFF"
$tri.Line.Visible = 0
$tri.Shadow.Visible = 0
# thumbnails
$tw=0.92; $tg=0.12; $ty=4.25
$thumbs=@()
for ($i=0; $i -lt 6; $i++) {
    $tx = $X + $i * ($tw + $tg)
    $line = "E1E6F0"; $lw = 1
    if ($i -eq 0) { $line = "5968DC"; $lw = 1.75 }
    $tb = Box $s $tx $ty $tw 0.62 "FFFFFF" $line $lw 6
    $thumbs += $tb
}
# highlight ring on 3rd thumbnail (problem section)
$ringX = $X + 2 * ($tw + $tg) - 0.04
$ring = Box $s $ringX ($ty-0.04) ($tw+0.08) 0.7 "" "5968DC" 2.5 8
# play control + progress
$pbtn = Box $s $X 5.22 0.4 0.4 "FFFFFF" "E1E6F0" 1 20
$ptri = $s.Shapes.AddShape($TRI, ($X+0.145)*$PT, (5.32)*$PT, 0.13*$PT, 0.19*$PT)
$ptri.Rotation = 90
$ptri.Fill.ForeColor.RGB = RGB "45506E"
$ptri.Line.Visible = 0
$track = Box $s ($X+0.62) 5.39 5.5 0.06 "E5E8F0" "" 0 3
$fill  = Box $s ($X+0.62) 5.39 2.4 0.06 "5968DC" "" 0 3
$knob  = Box $s ($X+0.62+2.4-0.07) 5.32 0.2 0.2 "5968DC" "FFFFFF" 1.5 20
$knob.AutoShapeType = 9
$time = T $s $J.s29.time ($X+$W-1.15) 5.55 1.15 0.26 9 0 "9AA3B8" 1.1 3
# story: player auto -> click: pick problem thumb -> click: playback jumps
FX $s $video $AFTER 0.2 0.4 | Out-Null
FX $s $tri   $WITH 0.1 0.4 | Out-Null
FX $s $pbtn  $WITH 0.1 0.4 | Out-Null
FX $s $ptri  $WITH 0.1 0.4 | Out-Null
FX $s $track $WITH 0.1 0.4 | Out-Null
for ($i=0; $i -lt 6; $i++) { FX $s $thumbs[$i] $WITH (0.1 + $i*0.06) 0.3 | Out-Null }
FX $s $ring $CLICK 0 0.35 | Out-Null
FX $s $fill $CLICK 0 0.4 | Out-Null
FX $s $knob $WITH 0.15 0.3 | Out-Null
FX $s $time $WITH 0.15 0.3 | Out-Null

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"rebuilt slides 24 / 25 / 26 / 29 as native shapes"
