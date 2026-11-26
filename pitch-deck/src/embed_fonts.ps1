# Re-saves a deck through PowerPoint with its fonts embedded (Inter, Newsreader Medium), so it
# displays correctly on computers that don't have them installed.
#   powershell -ExecutionPolicy Bypass -File embed_fonts.ps1 -Deck <path.pptx>
# Close the deck in PowerPoint first. If PowerPoint is already running it is left open.
param([Parameter(Mandatory = $true)][string]$Deck)
$Deck = (Resolve-Path $Deck).Path
$tmp = [IO.Path]::Combine([IO.Path]::GetDirectoryName($Deck), "~embed_" + [IO.Path]::GetFileName($Deck))
$wasRunning = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$pp = New-Object -ComObject PowerPoint.Application
try {
  $p = $pp.Presentations.Open($Deck, $true, $false, $false)
  $p.SaveAs($tmp, 11, -1)  # 11 = default format (.pptx); -1 = embed TrueType fonts (this combination is the one that embeds)
  $p.Close()
} finally {
  if (-not $wasRunning -and $pp.Presentations.Count -eq 0) { $pp.Quit() }
}
Move-Item -Force $tmp $Deck
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [IO.Compression.ZipFile]::OpenRead($Deck)
$n = ($z.Entries | Where-Object { $_.FullName -like 'ppt/fonts/*' }).Count
$z.Dispose()
"Embedded $n font files in $Deck"
