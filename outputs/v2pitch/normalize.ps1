# Normalize feature-slide headers + recenter content + fix animation flow.
# - Every feature slide gets the same header: eyebrow y0.73 / title y1.14 (30pt, one line)
#   / subtitle y1.94 (13pt muted). Pale big numbers are merged into the eyebrow.
# - Right-column content blocks are recentered horizontally and fitted into y 2.4-6.35.
# - Header text must never animate: effects on moved title/subtitle are removed.
# - Slide 31: user photos join each card's reveal beat; initial-letter avatars removed.
# - Slide 32: question bar joins the auto intro (was a pointless click).
# ASCII only.
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$deckPath = Join-Path $root "work_norm.pptx"
$PT = 72.0
$MUTED = 0x74 + (0x79*256) + (0x87*65536)

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($deckPath, $false, $false, $false)

function MergeLines($s) {
    $t = $s -replace "`r", " " -replace "`v", " " -replace [string][char]11, " "
    while ($t.Contains("  ")) { $t = $t.Replace("  ", " ") }
    return $t.Trim()
}
function DeleteEffectsOf($sld, $shapeIds) {
    $seq = $sld.TimeLine.MainSequence
    for ($i = $seq.Count; $i -ge 1; $i--) {
        if ($shapeIds -contains $seq.Item($i).Shape.Id) { $seq.Item($i).Delete() }
    }
}

# ---------- Phase A : header normalization ----------
$phaseA = @(24, 26, 27, 29, 30, 32, 34, 35)
foreach ($idx in $phaseA) {
    $sld = $deck.Slides.Item($idx)
    $eyebrow = $null; $palenum = $null; $title = $null; $desc = $null
    foreach ($sh in $sld.Shapes) {
        if ($sh.HasTextFrame -ne -1) { continue }
        if ($sh.TextFrame.HasText -ne -1) { continue }
        $x = $sh.Left / $PT; $y = $sh.Top / $PT
        $txt = $sh.TextFrame.TextRange.Text
        $size = 0; try { $size = $sh.TextFrame.TextRange.Font.Size } catch {}
        if ($y -lt 1.0 -and $x -lt 7) { $eyebrow = $sh; continue }
        if ($x -lt 2.5 -and $y -gt 1.2 -and $y -lt 1.9 -and $txt -match '^\d{1,2}$') { $palenum = $sh; continue }
        if ($x -lt 2.5 -and $y -gt 1.4 -and $y -lt 3.6 -and $size -ge 25) { $title = $sh; continue }
        if ($x -lt 2.5 -and $y -gt 3.2 -and $y -lt 4.7 -and $size -ge 11.5 -and $size -le 14.5) { $desc = $sh; continue }
    }
    $dead = @()
    if ($palenum -ne $null -and $eyebrow -ne $null) {
        $no = $palenum.TextFrame.TextRange.Text.Trim()
        $eb = $eyebrow.TextFrame.TextRange.Text
        if ($eb -notmatch '\d') { $eyebrow.TextFrame.TextRange.Text = $eb + "  " + $no }
        $dead += $palenum.Id
        $palenum.Delete()
    }
    if ($title -ne $null) {
        $title.TextFrame.TextRange.Text = MergeLines $title.TextFrame.TextRange.Text
        $title.TextFrame.TextRange.Font.Size = [single]30
        $title.Left = 1.0*$PT; $title.Top = 1.14*$PT; $title.Width = 11.33*$PT; $title.Height = 0.62*$PT
        $dead += $title.Id
    }
    if ($desc -ne $null) {
        $desc.TextFrame.TextRange.Text = MergeLines $desc.TextFrame.TextRange.Text
        $desc.TextFrame.TextRange.Font.Size = [single]13
        $desc.TextFrame.TextRange.Font.Bold = 0
        $desc.TextFrame.TextRange.Font.Color.RGB = $MUTED
        $desc.Left = 1.0*$PT; $desc.Top = 1.94*$PT; $desc.Width = 11.33*$PT; $desc.Height = 0.38*$PT
        $dead += $desc.Id
    }
    if ($dead.Count -gt 0) { DeleteEffectsOf $sld $dead }
    "A slide $idx : eyebrow=$($eyebrow -ne $null) num=$($palenum -ne $null) title=$($title -ne $null) desc=$($desc -ne $null)"
}

# ---------- Phase B : content recenter + fit ----------
$planB = @{
    24 = @{ top=1.5; bot=6.10; dx=-2.6 }
    27 = @{ top=1.5; bot=6.40; dx=-2.6 }
    29 = @{ top=1.5; bot=5.85; dx=-2.6 }
    30 = @{ top=1.5; bot=6.10; dx=-2.6 }
    32 = @{ top=1.5; bot=6.10; dx=-2.6 }
    34 = @{ top=1.7; bot=5.60; dx=-2.6 }
    35 = @{ top=1.6; bot=5.90; dx=-2.45 }
}
$T_TOP = 2.4; $T_BOT = 6.35
foreach ($idx in $planB.Keys) {
    $p = $planB[$idx]
    $S = [Math]::Min(1.0, ($T_BOT - $T_TOP) / ($p.bot - $p.top))
    $sld = $deck.Slides.Item($idx)
    $n = 0
    foreach ($sh in $sld.Shapes) {
        $x = $sh.Left / $PT; $y = $sh.Top / $PT
        if ($x -lt 5.3) { continue }                    # left/header zone
        if ($y -lt 1.05) { continue }                   # progress rail
        if ($x -gt 12.0 -and $y -gt 6.6) { continue }   # page number
        $newTop = $T_TOP + ($y - $p.top) * $S
        $h = $sh.Height / $PT
        $isSquare = ($sh.Width/$PT -lt 0.35) -and ([Math]::Abs($sh.Width - $sh.Height) -lt 6)
        $sh.Top = [single]($newTop * $PT)
        $sh.Height = [single]($h * $S * $PT)
        if ($isSquare) {
            $cx = $sh.Left + $sh.Width/2
            $sh.Width = $sh.Height
            $sh.Left = [single]($cx - $sh.Width/2)
        }
        $sh.Left = [single]($sh.Left + $p.dx * $PT)
        $n++
    }
    "B slide $idx : moved $n shapes (S=$([Math]::Round($S,3)))"
}
# 26 : chips band moves up to sit under the header
$sld = $deck.Slides.Item(26)
$n = 0
foreach ($sh in $sld.Shapes) {
    $y = $sh.Top / $PT; $x = $sh.Left / $PT
    if ($y -gt 4.8 -and $y -lt 6.2 -and $x -lt 12.0) { $sh.Top = [single](($y - 1.55) * $PT); $n++ }
}
"B slide 26 : moved $n chips up"

# ---------- Phase C : animation flow ----------
# 31 : photos join their card beat; lettered avatars go away
$sld = $deck.Slides.Item(31)
$pics = @()
$deadIds = @()
foreach ($sh in $sld.Shapes) {
    if ($sh.Type -eq 13) { $pics += $sh; continue }
    if ($sh.Name -match '^Oval') { $deadIds += $sh.Id; continue }
    if ($sh.HasTextFrame -eq -1) {
        if ($sh.TextFrame.HasText -eq -1) {
            $t = $sh.TextFrame.TextRange.Text.Trim()
            if ($t.Length -eq 1 -and $sh.Width/$PT -lt 1.3 -and $sh.Top/$PT -gt 2.5) { $deadIds += $sh.Id }
        }
    }
}
DeleteEffectsOf $sld $deadIds
for ($i = $sld.Shapes.Count; $i -ge 1; $i--) {
    if ($deadIds -contains $sld.Shapes.Item($i).Id) { $sld.Shapes.Item($i).Delete() }
}
# card anchors by X: card1 ~1.02 card2 ~4.92 card3 ~8.81 (photos at 2.19/6.09/9.99)
$seq = $sld.TimeLine.MainSequence
foreach ($pic in ($pics | Sort-Object Left)) {
    $e = $seq.AddEffect($pic, 10)
    $e.Timing.TriggerType = 2
    $e.Timing.Duration = [single]0.35
    $e.Timing.TriggerDelayTime = [single]0.08
    # place right after the matching card rect effect
    $px = $pic.Left / $PT
    $cardX = 1.02; if ($px -gt 5) { $cardX = 4.92 }; if ($px -gt 9) { $cardX = 8.81 }
    for ($i = 1; $i -le $seq.Count; $i++) {
        $es = $seq.Item($i).Shape
        if ($es.Name -match '^Rounded' -and [Math]::Abs($es.Left/$PT - $cardX) -lt 0.2 -and $es.Width/$PT -gt 3) {
            $e.MoveTo($i + 1)
            break
        }
    }
}
"C slide 31 : $($pics.Count) photos wired into beats, $($deadIds.Count) letter avatars removed"

# 32 : question bar joins the auto intro (was CLICK)
$sld = $deck.Slides.Item(32)
$seq = $sld.TimeLine.MainSequence
if ($seq.Count -ge 2) {
    $e2 = $seq.Item(2)
    if ($e2.Timing.TriggerType -eq 1) { $e2.Timing.TriggerType = 2; "C slide 32 : question bar -> auto intro" }
}

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"done"
