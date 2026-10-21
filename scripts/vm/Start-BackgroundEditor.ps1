param([string]$Document='C:\QACandidate0121\page-edit-qa.pptx')
$ErrorActionPreference='Stop'
if ($env:USERNAME -ne 'WDAGUtilityAccount' -or
    (Get-Content C:\QAInput\guest-only.marker -Raw).Trim() -ne 'INTERNAL_DOC_AI_SANDBOX_INPUT_V1') {
  throw 'Expected configured Sandbox guest user.'
}
if (-not (Test-Path C:\Windows\System32\MSVCP140.dll) -or -not (Test-Path -LiteralPath $Document)) {
  throw 'Prepare the VC runtime and synthetic document first.'
}
if (Get-Process DesktopEditors,editors -ErrorAction SilentlyContinue) {throw 'Inspect the existing editor before launching another.'}
if ($Document.Contains('"') -or $Document -notlike 'C:\QA*\*.pptx') {throw 'Expected a guest QA PPTX path.'}
# An interactive task uses the guest desktop rather than the wsb exec process desktop.
$action=New-ScheduledTaskAction -Execute 'C:\QAEditors\DesktopEditors.exe' -Argument ('"'+$Document+'"') -WorkingDirectory 'C:\QAEditors'
$principal=New-ScheduledTaskPrincipal -UserId 'WDAGUtilityAccount' -LogonType Interactive -RunLevel Limited
$taskName='Workbench-QA-Editor'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {throw 'Existing QA task found; inspect it before reuse.'}
Register-ScheduledTask -TaskName $taskName -InputObject (New-ScheduledTask -Action $action -Principal $principal) | Out-Null
Start-ScheduledTask -TaskName $taskName
@{scope='guest-only';taskName=$taskName;launchRequested=$true;actualAppQATested=$false;debugPortUsed=$false} |
  ConvertTo-Json | Set-Content C:\QAResults\background-editor-start.json -Encoding UTF8
