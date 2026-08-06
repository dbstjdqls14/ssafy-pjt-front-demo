# Reduce feature-slide animation to the essentials.
# Policy: content composes automatically on slide entry (soft waves);
#         at most ONE click per slide, kept only for a true punchline:
#   24 keep click 2 (current-sentence highlight)   27 keep click 2 (gaze warning)
#   28 keep click 2 (AI feedback)                  29 keep click 1 (problem-section ring)
#   32 keep click 1 (countdown)                    all other clicks -> automatic waves
# ASCII only.
$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open((Join-Path $root "work_simple.pptx"), $false, $false, $false)

# slide -> click ordinal to KEEP (0 = none)
$keep = @{ 24=2; 25=0; 26=0; 27=2; 28=2; 29=1; 30=0; 31=0; 32=1; 33=0; 34=0; 35=0 }

foreach ($idx in ($keep.Keys | Sort-Object)) {
    $sld = $deck.Slides.Item($idx)
    $seq = $sld.TimeLine.MainSequence
    $ord = 0; $demoted = 0; $kept = 0
    for ($i = 1; $i -le $seq.Count; $i++) {
        $e = $seq.Item($i)
        if ($e.Timing.TriggerType -ne 1) { continue }
        $ord++
        if ($ord -eq $keep[$idx]) { $kept++; continue }
        $e.Timing.TriggerType = 3           # AfterPrevious -> plays automatically
        $e.Timing.TriggerDelayTime = [single]0.3
        $demoted++
    }
    "slide {0} : kept {1} click(s), demoted {2}" -f $idx, $kept, $demoted
}

# tighten: cap every effect duration at 0.4s so auto waves feel brisk
foreach ($idx in ($keep.Keys | Sort-Object)) {
    $seq = $deck.Slides.Item($idx).TimeLine.MainSequence
    for ($i = 1; $i -le $seq.Count; $i++) {
        $e = $seq.Item($i)
        if ($e.Timing.Duration -gt 0.4) { $e.Timing.Duration = [single]0.4 }
    }
}

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"done"
