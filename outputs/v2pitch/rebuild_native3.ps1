# Recreate remaining feature slides as NATIVE shapes (slides 27/30/31/32/33/34/35).
# Korean strings come from rebuild_texts3.json. ASCII-only script (PS 5.1 ANSI).
# Colors follow service CSS: border #E1E6F0, ink #172346, muted #9AA3B8, body #45506E,
# indigo #5968DC, green #209E66, warn bg #FDF5F5 / #F3CFCF / #B4534F, video #141733.
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$deckPath = Join-Path $root "work_native3.pptx"
$J = [System.IO.File]::ReadAllText((Join-Path $root "rebuild_texts3.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$PT = 72.0
$FONT = "Noto Sans KR"
function RGB($hex) {
    $r=[Convert]::ToInt32($hex.Substring(0,2),16); $g=[Convert]::ToInt32($hex.Substring(2,2),16); $b=[Convert]::ToInt32($hex.Substring(4,2),16)
    return $r + ($g*256) + ($b*65536)
}
$RRECT=5; $FADE=10; $AFTER=3; $WITH=2; $CLICK=1

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($deckPath, $false, $false, $false)

function KillPictures($sld) {
    for ($i=$sld.Shapes.Count; $i -ge 1; $i--) {
        if ($sld.Shapes.Item($i).Type -eq 13) { $sld.Shapes.Item($i).Delete() }
    }
}
function KillPlaceholder($sld) {
    # gray slot rect + its centered label live at x~6.5 w~5.83
    for ($i=$sld.Shapes.Count; $i -ge 1; $i--) {
        $sh=$sld.Shapes.Item($i)
        if ([Math]::Abs($sh.Left - 6.5*$PT) -lt 10 -and [Math]::Abs($sh.Width - 5.83*$PT) -lt 10) { $sh.Delete() }
    }
}
function T($sld,$text,$x,$y,$w,$h,$size,$bold,$hex,$sp,$align) {
    $tb=$sld.Shapes.AddTextbox(1,$x*$PT,$y*$PT,$w*$PT,$h*$PT)
    $tf=$tb.TextFrame
    $tf.MarginLeft=0;$tf.MarginRight=0;$tf.MarginTop=0;$tf.MarginBottom=0;$tf.WordWrap=-1
    $tf.TextRange.Text=[string]$text
    $tf.TextRange.Font.Name=$FONT; $tf.TextRange.Font.NameFarEast=$FONT
    $tf.TextRange.Font.Size=[single]$size; $tf.TextRange.Font.Bold=$bold
    $tf.TextRange.Font.Color.RGB=RGB $hex
    $tf.TextRange.ParagraphFormat.SpaceWithin=[single]$sp
    $tf.TextRange.ParagraphFormat.Alignment=$align
    return $tb
}
function Box($sld,$x,$y,$w,$h,$bg,$line,$lw,$radPx) {
    $r=$sld.Shapes.AddShape($RRECT,$x*$PT,$y*$PT,$w*$PT,$h*$PT)
    $r.Adjustments.Item(1)=[Math]::Min(0.5,($radPx/($h*$PT)))
    if ($bg -eq "") { $r.Fill.Visible=0 } else { $r.Fill.ForeColor.RGB=RGB $bg; $r.Fill.Transparency=0 }
    if ($line -eq "") { $r.Line.Visible=0 } else { $r.Line.ForeColor.RGB=RGB $line; $r.Line.Weight=[single]$lw }
    $r.Shadow.Visible=0
    return $r
}
function Circle($sld,$x,$y,$d,$bg,$line,$lw) {
    $c = Box $sld $x $y $d $d $bg $line $lw 50
    $c.AutoShapeType = 9
    return $c
}
function Seg($sld,$x1,$y1,$x2,$y2,$hex,$wt) {
    $l=$sld.Shapes.AddLine($x1*$PT,$y1*$PT,$x2*$PT,$y2*$PT)
    $l.Line.ForeColor.RGB=RGB $hex; $l.Line.Weight=[single]$wt
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

# ============ 27 : gaze & posture (live metrics panel) ============
$s = $deck.Slides.Item([int]$J.s27.idx)
KillPlaceholder $s
$X=6.2; $W=6.13
$card = Box $s $X 1.5 $W 4.15 "FFFFFF" "E1E6F0" 1 12
$hdr  = T $s $J.s27.header ($X+0.3) 1.76 2.5 0.3 11 (-1) "172346" 1.1 1
$badge= T $s $J.s27.badge ($X+$W-2.0) 1.78 1.8 0.28 9 0 "209E66" 1.1 3
$cells=@()
for ($i=0; $i -lt 4; $i++) {
    $cx = $X + 0.3 + ($i % 2) * (($W-0.6)/2)
    $cy = 2.25 + [Math]::Floor($i/2) * 1.6
    $cw = ($W-0.6)/2 - 0.12
    $cb = Box $s $cx $cy $cw 1.42 "F7F8FB" "" 0 10
    $cv = T $s $J.s27.cells[$i][1] ($cx+0.22) ($cy+0.28) ($cw-0.44) 0.55 24 (-1) "172346" 1.05 1
    $cl = T $s $J.s27.cells[$i][0] ($cx+0.22) ($cy+0.95) ($cw-0.44) 0.3 10.5 0 "9AA3B8" 1.1 1
    $cells += ,@($cb,$cv,$cl)
}
$ring = Box $s ($X+0.3+($W-0.6)/2-0.05) 2.25 (($W-0.6)/2-0.12+0.1) 1.52 "" "B4534F" 2 12
$ring.Top = (2.25+1.6-0.05)*$PT   # ring on gaze cell (row2 col1)
$ring.Left = ($X+0.3-0.05)*$PT
$warnB = Box $s $X 5.85 $W 0.55 "FDF5F5" "F3CFCF" 1 10
$warnT = T $s $J.s27.warn ($X+0.28) 5.98 ($W-0.56) 0.3 11 (-1) "B4534F" 1.1 1
FX $s $card $AFTER 0.2 0.4 | Out-Null
FX $s $hdr  $WITH 0.1 0.4 | Out-Null
FX $s $badge $WITH 0.1 0.4 | Out-Null
for ($i=0; $i -lt 4; $i++) {
    $trig = if ($i -eq 0) { $CLICK } else { $AFTER }
    FX $s $cells[$i][0] $trig 0.1 0.3 | Out-Null
    FX $s $cells[$i][1] $WITH 0.05 0.3 | Out-Null
    FX $s $cells[$i][2] $WITH 0.05 0.3 | Out-Null
}
FX $s $ring $CLICK 0 0.35 | Out-Null
FX $s $warnB $WITH 0.15 0.35 | Out-Null
FX $s $warnT $WITH 0.15 0.35 | Out-Null

# ============ 30 : audience questions ============
$s = $deck.Slides.Item([int]$J.s30.idx)
KillPlaceholder $s
$X=6.2; $W=6.13
$card = Box $s $X 1.5 $W 4.6 "FFFFFF" "E1E6F0" 1 12
$hdr  = T $s $J.s30.header ($X+0.3) 1.78 3.5 0.3 11 (-1) "172346" 1.1 1
$qs=@()
for ($i=0; $i -lt 3; $i++) {
    $qy = 2.3 + $i * 1.22
    $qb = Box $s ($X+0.3) $qy ($W-0.6) 1.05 "F7F8FB" "E1E6F0" 1 10
    $ql = T $s $J.s30.qs[$i][0] ($X+0.52) ($qy+0.18) 0.55 0.3 11 (-1) "5968DC" 1.1 1
    $qt = T $s $J.s30.qs[$i][1] ($X+1.05) ($qy+0.18) ($W-1.6) 0.72 11.5 0 "45506E" 1.3 1
    $qs += ,@($qb,$ql,$qt)
}
FX $s $card $AFTER 0.2 0.4 | Out-Null
FX $s $hdr  $WITH 0.1 0.4 | Out-Null
for ($i=0; $i -lt 3; $i++) {
    $trig = if ($i -eq 0) { $CLICK } else { $AFTER }
    FX $s $qs[$i][0] $trig 0.25 0.35 | Out-Null
    FX $s $qs[$i][1] $WITH 0.1 0.35 | Out-Null
    FX $s $qs[$i][2] $WITH 0.1 0.35 | Out-Null
}

# ============ 32 : interview 5-second countdown ============
$s = $deck.Slides.Item([int]$J.s32.idx)
KillPlaceholder $s
$X=6.2; $W=6.13
$video = Box $s $X 1.5 $W 4.6 "141733" "" 0 12
$qbar  = Box $s ($X+0.35) 1.85 ($W-0.7) 0.62 "FFFFFF" "" 0 10
$qtxt  = T $s $J.s32.q ($X+0.6) 2.0 ($W-1.2) 0.34 12 (-1) "172346" 1.15 1
$cir   = Circle $s ($X+$W/2-0.75) 3.15 1.5 "" "FFFFFF" 3
$cnum  = T $s $J.s32.count ($X+$W/2-0.75) 3.42 1.5 0.9 44 (-1) "FFFFFF" 1.0 2
$clab  = T $s $J.s32.label ($X+0.3) 5.05 ($W-0.6) 0.35 12 0 "8FA9F5" 1.1 2
FX $s $video $AFTER 0.2 0.4 | Out-Null
FX $s $qbar $CLICK 0 0.4 | Out-Null
FX $s $qtxt $WITH 0.1 0.4 | Out-Null
FX $s $cir  $CLICK 0 0.35 | Out-Null
FX $s $cnum $WITH 0.1 0.35 | Out-Null
FX $s $clab $WITH 0.1 0.35 | Out-Null

# ============ 31 : interviewer style cards (full width) ============
$s = $deck.Slides.Item([int]$J.s31.idx)
KillPictures $s
$cw3 = 3.5; $gap = 0.4
$x0 = 1.0 + (11.33 - (3*$cw3 + 2*$gap)) / 2
$cards31=@()
for ($i=0; $i -lt 3; $i++) {
    $cx = $x0 + $i * ($cw3 + $gap)
    $cb = Box $s $cx 2.55 $cw3 3.55 "FFFFFF" "E1E6F0" 1 14
    $av = Circle $s ($cx+$cw3/2-0.55) 2.85 1.1 ($J.s31.cards[$i][4]) "" 0
    $ai = T $s $J.s31.cards[$i][0] ($cx+$cw3/2-0.55) 3.13 1.1 0.5 18 (-1) "45506E" 1.0 2
    $nm = T $s $J.s31.cards[$i][1] $cx 4.15 $cw3 0.35 15 (-1) "172346" 1.1 2
    $ds = T $s $J.s31.cards[$i][2] $cx 4.55 $cw3 0.3 10.5 0 "9AA3B8" 1.15 2
    $exB= Box $s ($cx+0.25) 5.0 ($cw3-0.5) 0.85 "F7F8FB" "" 0 8
    $exT= T $s $J.s31.cards[$i][3] ($cx+0.42) 5.14 ($cw3-0.84) 0.6 9.5 0 "45506E" 1.3 2
    $cards31 += ,@($cb,$av,$ai,$nm,$ds,$exB,$exT)
}
$selRing = Box $s ($x0-0.05) 2.5 ($cw3+0.1) 3.65 "" "5968DC" 2.5 16
for ($i=0; $i -lt 3; $i++) {
    $trig = if ($i -eq 0) { $CLICK } else { $AFTER }
    FX $s $cards31[$i][0] $trig 0.2 0.35 | Out-Null
    for ($k=1; $k -lt 7; $k++) { FX $s $cards31[$i][$k] $WITH 0.08 0.35 | Out-Null }
}
FX $s $selRing $CLICK 0 0.35 | Out-Null

# ============ 33 : interview report (full width) ============
$s = $deck.Slides.Item([int]$J.s33.idx)
KillPictures $s
$ttl = T $s $J.s33.title 1.0 2.5 4.4 0.5 21 (-1) "172346" 1.1 1
$metaShapes=@()
for ($i=0; $i -lt 3; $i++) {
    $my = 3.2 + $i*0.52
    $ml = T $s $J.s33.meta[$i][0] 1.0 $my 1.8 0.32 11 0 "9AA3B8" 1.1 1
    $mv = T $s $J.s33.meta[$i][1] 2.9 $my 1.6 0.32 11.5 (-1) "45506E" 1.1 1
    $metaShapes += @($ml,$mv)
}
$resCard = Box $s 5.6 2.45 6.73 2.1 "FFFFFF" "E1E6F0" 1 14
$resL = T $s $J.s33.resultLabel 5.95 2.72 2.0 0.35 13 (-1) "172346" 1.1 1
$resV = T $s $J.s33.score 10.0 2.62 2.0 0.55 26 (-1) "5968DC" 1.0 3
$subShapes=@()
for ($i=0; $i -lt 3; $i++) {
    $sx = 5.95 + $i*2.15
    $sl = T $s $J.s33.subs[$i][0] $sx 3.5 1.9 0.3 10.5 0 "9AA3B8" 1.1 1
    $sv = T $s $J.s33.subs[$i][1] $sx 3.82 1.9 0.5 19 (-1) "172346" 1.0 1
    $subShapes += @($sl,$sv)
}
$fbH = T $s $J.s33.fbHeader 5.6 4.95 3.0 0.35 13 (-1) "172346" 1.1 1
$fbChips=@()
for ($i=0; $i -lt 4; $i++) {
    $fx = 5.6 + $i*1.73
    $fb = Box $s $fx 5.4 1.55 0.72 "F7F8FB" "E1E6F0" 1 10
    $fl = T $s $J.s33.fb[$i][0] $fx 5.52 1.55 0.26 9.5 0 "9AA3B8" 1.1 2
    $fv = T $s $J.s33.fb[$i][1] $fx 5.78 1.55 0.3 12 (-1) "45506E" 1.0 2
    $fbChips += ,@($fb,$fl,$fv)
}
FX $s $ttl $AFTER 0.2 0.4 | Out-Null
foreach ($m in $metaShapes) { FX $s $m $WITH 0.1 0.4 | Out-Null }
FX $s $resCard $CLICK 0 0.4 | Out-Null
FX $s $resL $WITH 0.1 0.4 | Out-Null
FX $s $resV $WITH 0.1 0.4 | Out-Null
foreach ($m in $subShapes) { FX $s $m $WITH 0.15 0.4 | Out-Null }
FX $s $fbH $CLICK 0 0.35 | Out-Null
for ($i=0; $i -lt 4; $i++) {
    $trig = if ($i -eq 0) { $WITH } else { $AFTER }
    FX $s $fbChips[$i][0] $trig 0.12 0.3 | Out-Null
    FX $s $fbChips[$i][1] $WITH 0.05 0.3 | Out-Null
    FX $s $fbChips[$i][2] $WITH 0.05 0.3 | Out-Null
}

# ============ 34 : archive folder summary (right column) ============
$s = $deck.Slides.Item([int]$J.s34.idx)
KillPictures $s
$X=6.2; $W=6.13
$card = Box $s $X 1.7 $W 3.9 "FFFFFF" "E1E6F0" 1 14
$ttl  = T $s $J.s34.title ($X+0.4) 2.1 ($W-0.8) 0.5 19 (-1) "172346" 1.15 1
$rows34=@()
for ($i=0; $i -lt 3; $i++) {
    $ry = 2.95 + $i*0.82
    $rl = T $s $J.s34.rows[$i][0] ($X+0.4) $ry 2.4 0.35 12 0 "9AA3B8" 1.1 1
    $rv = T $s $J.s34.rows[$i][1] ($X+$W-3.0) $ry 2.6 0.4 15 (-1) "172346" 1.1 3
    $rows34 += ,@($rl,$rv,$ry)
    if ($i -lt 2) { $hl = Seg $s ($X+0.4) ($ry+0.62) ($X+$W-0.4) ($ry+0.62) "ECEEF4" 0.75; $rows34[$i] += $hl }
}
FX $s $card $AFTER 0.2 0.4 | Out-Null
FX $s $ttl  $WITH 0.1 0.4 | Out-Null
for ($i=0; $i -lt 3; $i++) {
    $trig = if ($i -eq 0) { $CLICK } else { $AFTER }
    FX $s $rows34[$i][0] $trig 0.2 0.35 | Out-Null
    FX $s $rows34[$i][1] $WITH 0.08 0.35 | Out-Null
}

# ============ 35 : growth trend chart (right area) ============
$s = $deck.Slides.Item([int]$J.s35.idx)
KillPictures $s
$X=5.9; $W=6.43
$card = Box $s $X 1.6 $W 4.3 "FFFFFF" "E1E6F0" 1 14
$hdr  = T $s $J.s35.header ($X+0.35) 1.9 3.5 0.35 14 (-1) "172346" 1.1 1
$sub  = T $s $J.s35.sub ($X+0.35) 2.32 ($W-0.7) 0.3 10 0 "9AA3B8" 1.15 1
# chart points: (1,44) (2,54) (3,51) mapped into card area
$px = @(($X+1.0), ($X+$W/2), ($X+$W-1.0))
$py = @(4.95, 3.35, 3.85)
$l1 = Seg $s $px[0] $py[0] $px[1] $py[1] "5968DC" 2.5
$l2 = Seg $s $px[1] $py[1] $px[2] $py[2] "5968DC" 2.5
$mk=@(); $vl=@(); $xl=@()
for ($i=0; $i -lt 3; $i++) {
    $fillC = "FFFFFF"; if ($i -eq 2) { $fillC = "5968DC" }
    $m = Circle $s ($px[$i]-0.09) ($py[$i]-0.09) 0.18 $fillC "5968DC" 2
    $v = T $s $J.s35.pts[$i][1] ($px[$i]-0.5) ($py[$i]-0.45) 1.0 0.3 11.5 (-1) "5968DC" 1.0 2
    $x = T $s $J.s35.pts[$i][0] ($px[$i]-0.5) ($py[$i]+0.16) 1.0 0.28 9.5 0 "9AA3B8" 1.0 2
    $mk += $m; $vl += $v; $xl += $x
}
FX $s $card $AFTER 0.2 0.4 | Out-Null
FX $s $hdr  $WITH 0.1 0.4 | Out-Null
FX $s $sub  $WITH 0.1 0.4 | Out-Null
FX $s $mk[0] $CLICK 0 0.3 | Out-Null
FX $s $vl[0] $WITH 0.05 0.3 | Out-Null
FX $s $xl[0] $WITH 0.05 0.3 | Out-Null
FX $s $l1 $AFTER 0.1 0.25 | Out-Null
FX $s $mk[1] $AFTER 0.05 0.3 | Out-Null
FX $s $vl[1] $WITH 0.05 0.3 | Out-Null
FX $s $xl[1] $WITH 0.05 0.3 | Out-Null
FX $s $l2 $AFTER 0.1 0.25 | Out-Null
FX $s $mk[2] $AFTER 0.05 0.3 | Out-Null
FX $s $vl[2] $WITH 0.05 0.3 | Out-Null
FX $s $xl[2] $WITH 0.05 0.3 | Out-Null

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"rebuilt slides 27 / 30 / 31 / 32 / 33 / 34 / 35 as native shapes"
