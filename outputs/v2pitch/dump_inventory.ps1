# Dump effect counts for all slides + full shape inventory of feature slides (24-35)
# into inventory.json (UTF-8) for the Node planner. ASCII only.
$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open((Join-Path $root "work_anim.pptx"), $true, $false, $false)

$out = @{ counts = @{}; slides = @{} }
for ($i = 1; $i -le $deck.Slides.Count; $i++) {
    $out.counts["$i"] = $deck.Slides.Item($i).TimeLine.MainSequence.Count
}
foreach ($idx in 24..35) {
    $sld = $deck.Slides.Item($idx)
    $arr = @()
    foreach ($sh in $sld.Shapes) {
        $o = [ordered]@{
            id = $sh.Id; name = $sh.Name; type = $sh.Type
            x = [Math]::Round($sh.Left/72, 3); y = [Math]::Round($sh.Top/72, 3)
            w = [Math]::Round($sh.Width/72, 3); h = [Math]::Round($sh.Height/72, 3)
            text = ""; fill = ""; lineColor = ""; ast = -1; rot = 0
        }
        try { $o.ast = $sh.AutoShapeType } catch {}
        try { $o.rot = [Math]::Round($sh.Rotation, 1) } catch {}
        try {
            if ($sh.HasTextFrame -eq -1 -and $sh.TextFrame.HasText -eq -1) {
                $t = $sh.TextFrame.TextRange.Text
                if ($t.Length -gt 40) { $t = $t.Substring(0, 40) }
                $o.text = $t
            }
        } catch {}
        try { if ($sh.Fill.Visible -eq -1) { $o.fill = "{0:X6}" -f $sh.Fill.ForeColor.RGB } } catch {}
        try { if ($sh.Line.Visible -eq -1) { $o.lineColor = "{0:X6}" -f $sh.Line.ForeColor.RGB } } catch {}
        $arr += $o
    }
    $out.slides["$idx"] = $arr
}
$deck.Close(); $ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

$json = $out | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $root "inventory.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
"inventory written"
