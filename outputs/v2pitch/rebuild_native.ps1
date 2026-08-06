# Rebuild the report-feedback capture on one slide as NATIVE shapes so each
# element can be animated individually. Reads Korean strings from
# rebuild_texts.json (UTF-8) because PS 5.1 mangles Korean literals in .ps1.
#
# Recreated spec (from presentation-report.css):
#   said block : bg #F7F8FB  border #E1E6F0  radius 12px  label #7D879E  text #3F4A63
#   fb block   : bg #FDF5F5  border #F3CFCF  radius 12px  label #B4534F  text #7A4340
#   headline   : bold ink #172346
# Animation story: headline (auto) -> click: my speech panel -> click: AI feedback panel
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\SSAFY\Desktop\aivo\outputs\v2pitch"
$deckPath = Join-Path $root "work_native.pptx"
$json = [System.IO.File]::ReadAllText((Join-Path $root "rebuild_texts.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$PT = 72.0
$FONT = "Noto Sans KR"
$FONTB = "Noto Sans KR Black"

function RGB($hex) {
    $r = [Convert]::ToInt32($hex.Substring(0,2),16)
    $g = [Convert]::ToInt32($hex.Substring(2,2),16)
    $b = [Convert]::ToInt32($hex.Substring(4,2),16)
    return $r + ($g * 256) + ($b * 65536)   # OLE BGR
}

$msoShapeRoundedRectangle = 5
$msoAnimEffectFade = 10
$trgAfterPrev = 3; $trgWithPrev = 2; $trgOnClick = 1

$ppt = New-Object -ComObject PowerPoint.Application
$deck = $ppt.Presentations.Open($deckPath, $false, $false, $false)
$sld = $deck.Slides.Item([int]$json.slideIndex)

# 1) remove the picture (old capture) and its dangling effects
for ($i = $sld.Shapes.Count; $i -ge 1; $i--) {
    $sh = $sld.Shapes.Item($i)
    if ($sh.Type -eq 13) { $sh.Delete() }
}

# geometry (inches)
$X = 1.0; $W = 11.33
$HEAD_Y = 2.42; $HEAD_H = 0.92
$SAID_Y = 3.52; $SAID_H = 1.02
$FB_Y   = 4.68; $FB_H   = 1.62
$PAD = 0.18

function AddText($sld, $text, $x, $y, $w, $h, $size, $bold, $colorHex, $lineSp, $fontName) {
    $tb = $sld.Shapes.AddTextbox(1, $x*$PT, $y*$PT, $w*$PT, $h*$PT)
    $tf = $tb.TextFrame
    $tf.MarginLeft = 0; $tf.MarginRight = 0; $tf.MarginTop = 0; $tf.MarginBottom = 0
    $tf.WordWrap = -1
    $tf.TextRange.Text = $text
    $tf.TextRange.Font.Name = $fontName
    $tf.TextRange.Font.NameFarEast = $fontName
    $tf.TextRange.Font.Size = [single]$size
    $tf.TextRange.Font.Bold = $bold
    $tf.TextRange.Font.Color.RGB = RGB $colorHex
    $tf.TextRange.ParagraphFormat.SpaceWithin = [single]$lineSp
    $tf.TextRange.ParagraphFormat.Alignment = 1
    return $tb
}

function AddPanel($sld, $x, $y, $w, $h, $bgHex, $lineHex) {
    $r = $sld.Shapes.AddShape($msoShapeRoundedRectangle, $x*$PT, $y*$PT, $w*$PT, $h*$PT)
    $r.Adjustments.Item(1) = [Math]::Min(0.5, (9.0 / ($h * $PT)))   # ~12px corner
    $r.Fill.ForeColor.RGB = RGB $bgHex
    $r.Fill.Transparency = 0
    $r.Line.ForeColor.RGB = RGB $lineHex
    $r.Line.Weight = 1
    $r.Shadow.Visible = 0
    return $r
}

# 2) headline
$headline = AddText $sld $json.headline $X $HEAD_Y $W $HEAD_H 13.5 (-1) "172346" 1.32 $FONT

# 3) said panel (gray)
$saidPanel = AddPanel $sld $X $SAID_Y $W $SAID_H "F7F8FB" "E1E6F0"
$saidLabel = AddText $sld $json.saidLabel ($X+$PAD) ($SAID_Y+0.14) ($W-2*$PAD) 0.24 10 (-1) "7D879E" 1.1 $FONT
$saidText  = AddText $sld $json.saidText  ($X+$PAD) ($SAID_Y+0.44) ($W-2*$PAD) 0.5 12.5 0 "3F4A63" 1.3 $FONT

# 4) feedback panel (pink)
$fbPanel = AddPanel $sld $X $FB_Y $W $FB_H "FDF5F5" "F3CFCF"
$fbLabel = AddText $sld $json.fbLabel ($X+$PAD) ($FB_Y+0.14) ($W-2*$PAD) 0.24 10 (-1) "B4534F" 1.1 $FONT
$fbText  = AddText $sld $json.fbText  ($X+$PAD) ($FB_Y+0.44) ($W-2*$PAD) 1.1 12 0 "7A4340" 1.32 $FONT

# 5) animations - three story beats
$seq = $sld.TimeLine.MainSequence
# clear leftover effects on this slide (they pointed at deleted picture or old shapes)
for ($i = $seq.Count; $i -ge 1; $i--) { $seq.Item($i).Delete() }

function FX($shape, $trigger, $delay) {
    $e = $sld.TimeLine.MainSequence.AddEffect($shape, $msoAnimEffectFade)
    $e.Timing.TriggerType = $trigger
    $e.Timing.Duration = 0.45
    if ($delay -gt 0) { $e.Timing.TriggerDelayTime = $delay }
    return $e
}

FX $headline  $trgAfterPrev 0.2 | Out-Null
FX $saidPanel $trgOnClick   0   | Out-Null
FX $saidLabel $trgWithPrev  0.1 | Out-Null
FX $saidText  $trgWithPrev  0.1 | Out-Null
FX $fbPanel   $trgOnClick   0   | Out-Null
FX $fbLabel   $trgWithPrev  0.1 | Out-Null
FX $fbText    $trgWithPrev  0.1 | Out-Null

$deck.Save()
$deck.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
"rebuilt slide $($json.slideIndex): 7 native shapes, 3 animation beats"
