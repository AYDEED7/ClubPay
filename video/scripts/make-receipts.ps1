# Draws sample receipt images for the demo video. These are made-up receipts, not real purchases.
Add-Type -AssemblyName System.Drawing
$outDir = Join-Path $PSScriptRoot '..\assets\receipts'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Receipt($file, $store, $address, $date, $lines, $subtotal, $tax, $total, $pay) {
  $w = 560; $h = 300 + 34 * $lines.Count + 260
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(226, 229, 240))
  $paper = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(253, 252, 247))
  $g.FillRectangle($paper, 40, 24, $w - 80, $h - 48)
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 34, 40))
  $title = New-Object System.Drawing.Font 'Consolas', 20, ([System.Drawing.FontStyle]::Bold)
  $font = New-Object System.Drawing.Font 'Consolas', 13
  $bold = New-Object System.Drawing.Font 'Consolas', 15, ([System.Drawing.FontStyle]::Bold)
  $center = New-Object System.Drawing.StringFormat; $center.Alignment = 'Center'
  $right = New-Object System.Drawing.StringFormat; $right.Alignment = 'Far'
  $x1 = 70; $x2 = $w - 70; $y = 52
  $g.DrawString($store, $title, $ink, ($w / 2), $y, $center); $y += 44
  $g.DrawString($address, $font, $ink, ($w / 2), $y, $center); $y += 28
  $g.DrawString("Date: $date", $font, $ink, ($w / 2), $y, $center); $y += 40
  $dash = '-' * 42
  $g.DrawString($dash, $font, $ink, $x1, $y); $y += 30
  foreach ($l in $lines) {
    $g.DrawString($l[0], $font, $ink, $x1, $y)
    $g.DrawString($l[1], $font, $ink, $x2, $y, $right); $y += 34
  }
  $g.DrawString($dash, $font, $ink, $x1, $y); $y += 32
  $g.DrawString('Subtotal', $font, $ink, $x1, $y); $g.DrawString($subtotal, $font, $ink, $x2, $y, $right); $y += 30
  $g.DrawString('Tax', $font, $ink, $x1, $y); $g.DrawString($tax, $font, $ink, $x2, $y, $right); $y += 36
  $g.DrawString('TOTAL', $bold, $ink, $x1, $y); $g.DrawString($total, $bold, $ink, $x2, $y, $right); $y += 50
  $g.DrawString($pay, $font, $ink, ($w / 2), $y, $center); $y += 30
  $g.DrawString('Thank you!', $font, $ink, ($w / 2), $y, $center)
  $bmp.Save((Join-Path $outDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  "$file written"
}

New-Receipt 'pizza.png' "TONY'S PIZZERIA" '412 College Ave' '2026-11-09  18:42' @(
  @('2 x Large Cheese Pizza', '31.98'), @('1 x Garlic Knots (12)', '6.50'), @('3 x Soda 2L', '8.97')
) '47.45' '3.80' '51.25' 'VISA ****4821'

New-Receipt 'liquor.png' 'CAMPUS LIQUOR & WINE' '88 Mill Street' '2026-11-08  21:15' @(
  @('2 x Craft Beer 12-pack', '39.98'), @('1 x Red Wine 750ml', '14.99'), @('1 x Tortilla Chips', '4.49')
) '59.46' '4.91' '64.37' 'MASTERCARD ****7730'

New-Receipt 'printing.png' 'QUICKPRINT COPY CENTER' '15 University Plaza' '2026-11-04  10:07' @(
  @('60 x Color Flyer A4', '18.00'), @('2 x A2 Poster', '9.00')
) '27.00' '2.16' '29.16' 'VISA ****4821'

New-Receipt 'parts.png' 'MAKER ELECTRONICS' '230 Tech Parkway' '2026-11-02  14:31' @(
  @('4 x Servo Motor SG90', '23.96'), @('1 x Arduino Uno R4', '27.50'), @('2 x Jumper Wire Kit', '13.98'), @('1 x Li-Po Battery 2200', '18.99')
) '84.43' '6.75' '91.18' 'DEBIT ****0912'

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
'Voices: ' + (($s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }) -join ', ')
