# OPC(pptx) 규격에 맞게 재압축 — 엔트리 경로 구분자를 반드시 '/' 로,
# [Content_Types].xml 을 첫 엔트리로 둔다.
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [Parameter(Mandatory = $true)][string]$OutFile
)
Add-Type -Assembly System.IO.Compression
Add-Type -Assembly System.IO.Compression.FileSystem

if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
$root = (Resolve-Path $SourceDir).Path.TrimEnd('\')

$files = Get-ChildItem $root -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1) -replace '\\', '/'
  [PSCustomObject]@{ Full = $_.FullName; Rel = $rel }
}
# [Content_Types].xml 먼저
$ordered = @($files | Where-Object { $_.Rel -eq '[Content_Types].xml' }) +
           @($files | Where-Object { $_.Rel -ne '[Content_Types].xml' })

$fs = [System.IO.File]::Open($OutFile, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($f in $ordered) {
  $entry = $zip.CreateEntry($f.Rel, [System.IO.Compression.CompressionLevel]::Optimal)
  $es = $entry.Open()
  $bytes = [System.IO.File]::ReadAllBytes($f.Full)
  $es.Write($bytes, 0, $bytes.Length)
  $es.Dispose()
}
$zip.Dispose(); $fs.Dispose()
"packed $($ordered.Count) entries -> $OutFile"
