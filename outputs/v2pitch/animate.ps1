# Apply entrance animations via PowerPoint COM (PowerPoint writes valid XML itself).
#
# Policy (kept deliberately coarse - one soft reveal per slide):
#   - Header elements (progress rail, page number, eyebrow, title, rule) are never animated.
#   - Only body shapes (Top > 2.3in) of meaningful size are targets.
#   - DEFAULT: ONE step. Every body shape fades in together, right after the slide arrives.
#   - Slides listed in steps.txt get 2-3 steps instead (axis + max group count).
#     Within a step all shapes appear together (WithPrevious), so nothing reveals line-by-line.
#   - Step 1 is automatic; later steps wait for a click so the presenter controls pacing.
#
# NOTE: This file must stay ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI,
#       so Korean literals would be mangled. Korean text matching happens in plan_steps.js.

$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$src = Join-Path $root "pitch_src.pptx"
$dst = Join-Path $root "pitch_anim.pptx"
$stepFile = Join-Path $root "steps.txt"

$msoAnimEffectFade = 10
$trgAfterPrev = 3
$trgWithPrev = 2
$trgOnClick = 1

$PT = 72.0
$CONTENT_TOP = 2.3 * $PT
$MIN_W = 0.8 * $PT
$MIN_H = 0.4 * $PT
$MIN_SHAPES = 3

# slide index -> @{ Axis = 'x'|'y'; Max = n }
$plan = @{}
if (Test-Path $stepFile) {
    foreach ($line in Get-Content $stepFile) {
        $t = $line.Trim()
        if ($t -eq "") { continue }
        $p = $t -split '\s+'
        if ($p.Count -ge 3) {
            $plan[[int]$p[0]] = @{ Axis = $p[1]; Max = [int]$p[2] }
        }
    }
}

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($src, $false, $false, $false)

$slidesTouched = 0
$stepCount = 0
$effectCount = 0

for ($si = 1; $si -le $deck.Slides.Count; $si++) {
    $sld = $deck.Slides.Item($si)

    $content = @()
    foreach ($sh in $sld.Shapes) {
        if ($sh.Top -gt $CONTENT_TOP -and ($sh.Width -gt $MIN_W -or $sh.Height -gt $MIN_H)) {
            $content += $sh
        }
    }
    if ($content.Count -lt $MIN_SHAPES) { continue }

    # Assign each shape a group index
    $groupOf = @{}
    if ($plan.ContainsKey($si)) {
        $axis = $plan[$si].Axis
        $maxG = $plan[$si].Max
        $band = if ($axis -eq 'x') { 0.6 * $PT } else { 0.4 * $PT }
        $keys = @{}
        foreach ($sh in $content) {
            $v = if ($axis -eq 'x') { $sh.Left } else { $sh.Top }
            $k = [Math]::Round($v / $band)
            $keys[$k] = 1
        }
        $sortedKeys = $keys.Keys | Sort-Object
        $kc = $sortedKeys.Count
        $keyToGroup = @{}
        for ($i = 0; $i -lt $kc; $i++) {
            $g = [Math]::Floor($i * $maxG / $kc)
            if ($g -gt ($maxG - 1)) { $g = $maxG - 1 }
            $keyToGroup[$sortedKeys[$i]] = $g
        }
        foreach ($sh in $content) {
            $v = if ($axis -eq 'x') { $sh.Left } else { $sh.Top }
            $k = [Math]::Round($v / $band)
            $groupOf[$sh.Id] = $keyToGroup[$k]
        }
        $nGroups = $maxG
    } else {
        foreach ($sh in $content) { $groupOf[$sh.Id] = 0 }
        $nGroups = 1
    }

    for ($g = 0; $g -lt $nGroups; $g++) {
        $first = $true
        foreach ($sh in $content) {
            if ($groupOf[$sh.Id] -ne $g) { continue }
            try { $eff = $sld.TimeLine.MainSequence.AddEffect($sh, $msoAnimEffectFade) } catch { continue }
            if ($first) {
                if ($g -eq 0) {
                    $eff.Timing.TriggerType = $trgAfterPrev
                    $eff.Timing.TriggerDelayTime = 0.2
                } else {
                    $eff.Timing.TriggerType = $trgOnClick
                }
                $first = $false
                $stepCount++
            } else {
                $eff.Timing.TriggerType = $trgWithPrev
                $eff.Timing.TriggerDelayTime = 0
            }
            $eff.Timing.Duration = 0.5
            $effectCount++
        }
    }
    $slidesTouched++
}

$deck.SaveAs($dst)
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

"slides animated : $slidesTouched"
"click/auto steps: $stepCount"
"total effects   : $effectCount"
