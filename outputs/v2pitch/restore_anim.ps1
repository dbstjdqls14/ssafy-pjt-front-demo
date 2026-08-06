# Restore animations lost when the user grouped/moved content.
# Positions are never changed: groups are ungrouped in place (identical layout),
# then shapes are classified by color/geometry and the original story beats re-applied.
# Also removes the accidental duplicate slide 35 (two stacked content groups, dup page no).
# ASCII only.
$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$PT = 72.0
function RGB($hex) {
    $r=[Convert]::ToInt32($hex.Substring(0,2),16); $g=[Convert]::ToInt32($hex.Substring(2,2),16); $b=[Convert]::ToInt32($hex.Substring(4,2),16)
    return $r + ($g*256) + ($b*65536)
}
$C_GREEN = RGB "209E66"; $C_CUR = RGB "F1F3F8"; $C_VIDEO = RGB "141733"
$C_INDIGO = RGB "5968DC"; $C_TRACK = RGB "E5E8F0"; $C_WHITE = RGB "FFFFFF"

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open((Join-Path $root "work_anim.pptx"), $false, $false, $false)

# ---- 0) drop the accidental duplicate (slide 35: two content groups stacked) ----
$s35 = $deck.Slides.Item(35)
$gcount = 0
foreach ($sh in $s35.Shapes) { if ($sh.Type -eq 6) { $gcount++ } }
if ($gcount -ge 2) { $s35.Delete(); "dup slide 35 removed" } else { "WARN: slide 35 not a dup (groups=$gcount) - kept" }

function UngroupAll($sld) {
    $again = $true
    while ($again) {
        $again = $false
        for ($i = $sld.Shapes.Count; $i -ge 1; $i--) {
            $sh = $sld.Shapes.Item($i)
            if ($sh.Type -eq 6) { [void]$sh.Ungroup(); $again = $true; break }
        }
    }
}
function Content($sld, $minX) {
    $r = @()
    foreach ($sh in $sld.Shapes) {
        $x = $sh.Left/$PT; $y = $sh.Top/$PT
        if ($y -lt 1.05) { continue }
        if ($x -gt 12.0 -and $y -gt 6.6) { continue }
        if ($x -lt $minX) { continue }
        $r += $sh
    }
    return $r
}
function FillRGB($sh) { try { if ($sh.Fill.Visible -eq -1) { return $sh.Fill.ForeColor.RGB } } catch {}; return -1 }
function LineRGB($sh) { try { if ($sh.Line.Visible -eq -1) { return $sh.Line.ForeColor.RGB } } catch {}; return -1 }
function IsText($sh) { try { return ($sh.HasTextFrame -eq -1 -and $sh.TextFrame.HasText -eq -1) } catch {}; return $false }
function FX($sld,$shape,$trig,$delay,$dur) {
    $e = $sld.TimeLine.MainSequence.AddEffect($shape, 10)
    $e.Timing.TriggerType = $trig
    $e.Timing.Duration = [single]$dur
    if ($delay -gt 0) { $e.Timing.TriggerDelayTime = [single]$delay }
}
function ClearSeq($sld) {
    $seq = $sld.TimeLine.MainSequence
    for ($i = $seq.Count; $i -ge 1; $i--) { $seq.Item($i).Delete() }
}

# ---------------- 24 : realtime subtitles ----------------
$sld = $deck.Slides.Item(24); UngroupAll $sld; ClearSeq $sld
$card=$null;$dot=$null;$curBox=$null;$texts=@()
foreach ($sh in (Content $sld 5.5)) {
    $f = FillRGB $sh
    if (IsText $sh) { $texts += $sh; continue }
    if ($f -eq $C_GREEN) { $dot = $sh; continue }
    if ($f -eq $C_CUR) { $curBox = $sh; continue }
    if ($sh.Width/$PT -gt 5) { $card = $sh; continue }
}
$hdr=$null;$liveTx=$null;$curTx=$null;$past=@()
foreach ($t in ($texts | Sort-Object Top)) {
    if ($liveTx -eq $null -and $t.Width/$PT -lt 1.2 -and $t.Left -gt $card.Left + 4*$PT) { $liveTx = $t; continue }
    if ($hdr -eq $null) { $hdr = $t; continue }
    if ($curBox -ne $null -and $curTx -eq $null -and [Math]::Abs(($t.Top) - $curBox.Top) -lt 0.5*$PT) { $curTx = $t; continue }
    $past += $t
}
FX $sld $card 3 0.2 0.4
if ($hdr) { FX $sld $hdr 2 0.1 0.4 }
if ($dot) { FX $sld $dot 2 0.1 0.4 }
if ($liveTx) { FX $sld $liveTx 2 0.1 0.4 }
$first = $true
foreach ($p in ($past | Sort-Object Top)) {
    if ($first) { FX $sld $p 1 0 0.35; $first = $false } else { FX $sld $p 3 0.25 0.35 }
}
if ($curBox) { FX $sld $curBox 1 0 0.4 }
if ($curTx) { FX $sld $curTx 2 0.1 0.4 }
"24 ok"

# ---------------- 29 : replay player ----------------
$sld = $deck.Slides.Item(29); UngroupAll $sld; ClearSeq $sld
$video=$null;$tri=$null;$ring=$null;$pbtn=$null;$track=$null;$fillbar=$null;$knob=$null
$thumbs=@();$glyph=$null;$time=$null
foreach ($sh in (Content $sld 5.5)) {
    $f = FillRGB $sh; $l = LineRGB $sh
    $w = $sh.Width/$PT; $h = $sh.Height/$PT
    if (IsText $sh) {
        if ($sh.TextFrame.TextRange.Text.Contains(":")) { $time = $sh } else { $glyph = $sh }
        continue
    }
    if ($f -eq $C_VIDEO) { $video = $sh; continue }
    if ($sh.Name -match 'Triangle') { $tri = $sh; continue }
    if ($f -eq $C_TRACK) { $track = $sh; continue }
    if ($f -eq $C_INDIGO -and $h -lt 0.12) { $fillbar = $sh; continue }
    if ($f -eq $C_INDIGO -and $w -lt 0.35) { $knob = $sh; continue }
    if ($f -lt 0 -and $l -eq $C_INDIGO -and $w -lt 1.3) { $ring = $sh; continue }
    if ($f -eq $C_WHITE -and $w -lt 0.55) { $pbtn = $sh; continue }
    if ($f -eq $C_WHITE -and $w -ge 0.55 -and $w -lt 1.3) { $thumbs += $sh; continue }
}
FX $sld $video 3 0.2 0.4
if ($tri) { FX $sld $tri 2 0.1 0.4 }
if ($pbtn) { FX $sld $pbtn 2 0.1 0.4 }
if ($glyph) { FX $sld $glyph 2 0.1 0.4 }
if ($track) { FX $sld $track 2 0.1 0.4 }
$d = 0.1
foreach ($tb in ($thumbs | Sort-Object Left)) { FX $sld $tb 2 $d 0.3; $d += 0.06 }
if ($ring) { FX $sld $ring 1 0 0.35 }
if ($fillbar) { FX $sld $fillbar 1 0 0.4 }
if ($knob) { FX $sld $knob 2 0.15 0.3 }
if ($time) { FX $sld $time 2 0.15 0.3 }
"29 ok"

# ---------------- 32 : five-second countdown ----------------
$sld = $deck.Slides.Item(32); UngroupAll $sld; ClearSeq $sld
$video=$null;$qbar=$null;$qtxt=$null;$cir=$null;$cnum=$null;$clab=$null
foreach ($sh in (Content $sld 5.5)) {
    $f = FillRGB $sh; $l = LineRGB $sh
    if (IsText $sh) {
        $len = $sh.TextFrame.TextRange.Text.Trim().Length
        if ($len -le 2) { $cnum = $sh; continue }
        if ($qtxt -eq $null) { $qtxt = $sh } else { if ($sh.Top -lt $qtxt.Top) { $clab = $qtxt; $qtxt = $sh } else { $clab = $sh } }
        continue
    }
    if ($f -eq $C_VIDEO) { $video = $sh; continue }
    if ($f -eq $C_WHITE) { $qbar = $sh; continue }
    if ($f -lt 0 -and $l -eq $C_WHITE) { $cir = $sh; continue }
}
FX $sld $video 3 0.2 0.4
if ($qbar) { FX $sld $qbar 2 0.1 0.4 }
if ($qtxt) { FX $sld $qtxt 2 0.1 0.4 }
if ($cir)  { FX $sld $cir 1 0 0.35 }
if ($cnum) { FX $sld $cnum 2 0.1 0.35 }
if ($clab) { FX $sld $clab 2 0.1 0.35 }
"32 ok"

# ---------------- 34 : archive folder ----------------
$sld = $deck.Slides.Item(34); UngroupAll $sld; ClearSeq $sld
$card=$null;$lines=@();$texts=@()
foreach ($sh in (Content $sld 5.5)) {
    if (IsText $sh) { $texts += $sh; continue }
    if ($sh.Type -eq 9) { $lines += $sh; continue }
    if ($sh.Width/$PT -gt 4) { $card = $sh; continue }
}
$texts = $texts | Sort-Object Top
$ttl = $texts[0]
$rows = @{}
for ($i = 1; $i -lt $texts.Count; $i++) {
    $k = [Math]::Round($texts[$i].Top / (0.35*$PT))
    if (-not $rows.ContainsKey($k)) { $rows[$k] = @() }
    $rows[$k] += $texts[$i]
}
FX $sld $card 3 0.2 0.4
FX $sld $ttl 2 0.1 0.4
foreach ($ln in $lines) { FX $sld $ln 2 0.1 0.4 }
$first = $true
foreach ($k in ($rows.Keys | Sort-Object)) {
    $trig = 3; if ($first) { $trig = 1; $first = $false }
    $lead = $true
    foreach ($t in $rows[$k]) {
        if ($lead) { FX $sld $t $trig 0.2 0.35; $lead = $false } else { FX $sld $t 2 0.08 0.35 }
    }
}
"34 ok"

# ---------------- 35 : growth trend (was 36) ----------------
$sld = $deck.Slides.Item(35); UngroupAll $sld; ClearSeq $sld
$card=$null;$segs=@();$marks=@();$blue=@();$gray=@();$texts=@()
foreach ($sh in (Content $sld 5.5)) {
    if (IsText $sh) { $texts += $sh; continue }
    if ($sh.Type -eq 9) { $segs += $sh; continue }
    if ($sh.Width/$PT -lt 0.35) { $marks += $sh; continue }
    if ($sh.Width/$PT -gt 4) { $card = $sh; continue }
}
foreach ($t in $texts) {
    $c = -1; try { $c = $t.TextFrame.TextRange.Font.Color.RGB } catch {}
    if ($c -eq $C_INDIGO) { $blue += $t } else { $gray += $t }
}
$gray = $gray | Sort-Object Top
$hdr = $gray[0]; $sub = $gray[1]
$xlabs = @(); for ($i = 2; $i -lt $gray.Count; $i++) { $xlabs += $gray[$i] }
$blue = $blue | Sort-Object Left
$xlabs = $xlabs | Sort-Object Left
$marks = $marks | Sort-Object Left
$segs = $segs | Sort-Object Left
FX $sld $card 3 0.2 0.4
if ($hdr) { FX $sld $hdr 2 0.1 0.4 }
if ($sub) { FX $sld $sub 2 0.1 0.4 }
for ($i = 0; $i -lt $marks.Count; $i++) {
    $trig = 3; $del = 0.05
    if ($i -eq 0) { $trig = 1; $del = 0 }
    FX $sld $marks[$i] $trig $del 0.3
    if ($i -lt $blue.Count) { FX $sld $blue[$i] 2 0.05 0.3 }
    if ($i -lt $xlabs.Count) { FX $sld $xlabs[$i] 2 0.05 0.3 }
    if ($i -lt $segs.Count) { FX $sld $segs[$i] 3 0.1 0.25 }
}
"35 ok"

# ---------------- generic : any other slide left with 0 effects but real body content ----------------
for ($i = 1; $i -le $deck.Slides.Count; $i++) {
    $sld = $deck.Slides.Item($i)
    if ($sld.TimeLine.MainSequence.Count -gt 0) { continue }
    $body = @()
    foreach ($sh in $sld.Shapes) {
        $x = $sh.Left/$PT; $y = $sh.Top/$PT
        if ($y -lt 2.3) { continue }
        if ($x -gt 12.0 -and $y -gt 6.6) { continue }
        if ($sh.Width/$PT -lt 0.8 -and $sh.Height/$PT -lt 0.4) { continue }
        $body += $sh
    }
    if ($body.Count -lt 4) { continue }
    $first = $true
    foreach ($sh in $body) {
        if ($first) { FX $sld $sh 3 0.2 0.45; $first = $false } else { FX $sld $sh 2 0.05 0.45 }
    }
    "generic fade -> slide $i ($($body.Count) shapes)"
}

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"done"
