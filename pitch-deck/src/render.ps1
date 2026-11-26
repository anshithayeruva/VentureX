# Opens the deck in PowerPoint, saves the PDF preview and exports each slide as a PNG.
#   powershell -ExecutionPolicy Bypass -File render.ps1 [-ImageDir <folder>] [-Deck <path.pptx>]
# Close the deck in PowerPoint first. If PowerPoint is already running it is left open:
# only the copy of the deck this script opened is closed.
param([string]$ImageDir = "$PSScriptRoot\..\slides", [string]$Deck = "")
$root = Resolve-Path "$PSScriptRoot\.."
if ($Deck) { $deck = $Deck } else { $deck = Join-Path $root "VentureX_Pitch_Deck.pptx" }
$pdf = [IO.Path]::ChangeExtension($deck, ".pdf")
New-Item -ItemType Directory -Force $ImageDir | Out-Null
Get-ChildItem $ImageDir -Filter "slide-*.png" | Remove-Item -Confirm:$false
$wasRunning = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$pp = New-Object -ComObject PowerPoint.Application
try {
  $p = $pp.Presentations.Open($deck, $true, $false, $false)  # read-only, no window
  $p.SaveAs($pdf, 32)  # 32 = PDF
  $i = 1
  foreach ($s in $p.Slides) { $s.Export((Join-Path $ImageDir ("slide-{0:D2}.png" -f $i)), "PNG", 1920, 1080); $i++ }
  "Rendered $($p.Slides.Count) slides to $ImageDir and $pdf"
  $p.Close()
} finally {
  if (-not $wasRunning -and $pp.Presentations.Count -eq 0) { $pp.Quit() }
}
