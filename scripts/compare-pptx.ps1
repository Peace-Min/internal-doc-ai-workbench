[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Original,
  [Parameter(Mandatory)][string]$Edited,
  [string]$Output
)

# QA utility for the simple first-slide fixture, not a general PPTX fidelity test.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Slide([string]$FilePath) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $FilePath).Path)
  try {
    $entry = $archive.GetEntry('ppt/slides/slide1.xml')
    if ($null -eq $entry) { throw 'The fixture needs ppt/slides/slide1.xml.' }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
    $ns.AddNamespace('p', 'http://schemas.openxmlformats.org/presentationml/2006/main')
    $texts = @($xml.SelectNodes('//a:t', $ns) | ForEach-Object InnerText)
    $runProperties = @($xml.SelectNodes('//a:rPr', $ns) | ForEach-Object OuterXml)
    $shapeProperties = @($xml.SelectNodes('//p:spPr', $ns) | ForEach-Object OuterXml)
    $drawingIds = @($xml.SelectNodes('//p:cNvPr', $ns) | ForEach-Object { $_.GetAttribute('id') })
    foreach ($node in $xml.SelectNodes('//a:t', $ns)) { $node.InnerText = '__TEXT__' }
    $normalized = $xml.OuterXml
    foreach ($node in $xml.SelectNodes('//p:cNvPr', $ns)) { $node.SetAttribute('id', '__ID__') }
    return @{
      texts = $texts; runProperties = $runProperties; shapeProperties = $shapeProperties
      drawingIds = $drawingIds; normalized = $normalized; normalizedWithoutIds = $xml.OuterXml
    }
  } finally { $archive.Dispose() }
}
$before = Read-Slide $Original
$after = Read-Slide $Edited
$result = [ordered]@{
  scope = 'simple-first-slide-fixture'
  textChanged = ($before.texts -join '') -cne ($after.texts -join '')
  runPropertiesPreserved = ($before.runProperties -join '') -ceq ($after.runProperties -join '')
  shapePropertiesPreserved = ($before.shapeProperties -join '') -ceq ($after.shapeProperties -join '')
  slideXmlIdenticalExceptText = $before.normalized -ceq $after.normalized
  drawingIdsChanged = ($before.drawingIds -join ',') -cne ($after.drawingIds -join ',')
  slideXmlIdenticalExceptTextAndDrawingIds = $before.normalizedWithoutIds -ceq $after.normalizedWithoutIds
}
$json = $result | ConvertTo-Json
if ($Output) { [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Output), $json + "`n", [System.Text.UTF8Encoding]::new($false)) }
Write-Output $json
if (-not $result.textChanged -or -not $result.runPropertiesPreserved -or -not $result.shapePropertiesPreserved -or -not $result.slideXmlIdenticalExceptTextAndDrawingIds) { throw 'Simple PPTX fixture comparison failed.' }
