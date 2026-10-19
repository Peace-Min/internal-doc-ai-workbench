param([Parameter(Mandatory=$true)][string]$ConfigFile,[switch]$Check)
$ErrorActionPreference='Stop'
$configPath=[IO.Path]::GetFullPath($ConfigFile)
$stage=Split-Path -Parent $configPath
$enableResult=Join-Path $stage 'enable-result.json'
$readiness=@{ready=$false;configExists=(Test-Path -LiteralPath $configPath -PathType Leaf);inputFilesPresent=$true;featureEnabled=$false;cliAvailable=$false;restartRequired=$false;environmentReadFailed=$false;vmStarted=$false;automaticRestart=$false}
foreach($name in @('manifest.json','guest-only.marker','DesktopEditors.zip','node.exe','NODE-LICENSE','workbench-source.zip','Bootstrap-Guest.ps1')){
  if(-not (Test-Path -LiteralPath (Join-Path $stage "input\$name") -PathType Leaf)){$readiness.inputFilesPresent=$false}
}
try {
  if(Test-Path -LiteralPath $enableResult){
    $enable=Get-Content -LiteralPath $enableResult -Raw | ConvertFrom-Json
    $boot=(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime()
    $readiness.restartRequired=[bool]($enable.restartNeeded -and $boot -lt (Get-Item -LiteralPath $enableResult).LastWriteTimeUtc)
  }
  $feature=Get-CimInstance Win32_OptionalFeature -Filter "Name='Containers-DisposableClientVM'"
  $readiness.featureEnabled=$feature.InstallState -eq 1
}catch{$readiness.environmentReadFailed=$true}
$wsb=Get-Command wsb.exe -ErrorAction SilentlyContinue
$readiness.cliAvailable=[bool]$wsb
$readiness.ready=$readiness.configExists -and $readiness.inputFilesPresent -and $readiness.featureEnabled -and $readiness.cliAvailable -and -not $readiness.restartRequired -and -not $readiness.environmentReadFailed
if($Check){
  $readiness | ConvertTo-Json
  if(-not $readiness.ready){exit 1}
  exit 0
}
if($readiness.environmentReadFailed){throw 'Unable to inspect Windows readiness. Run with -Check to inspect prerequisites.'}
if($readiness.restartRequired){throw 'Restart Windows before starting this sandbox. No automatic restart is performed.'}
if(-not $readiness.featureEnabled){throw 'Windows Sandbox is not enabled. Run Enable-WindowsSandbox.ps1 as administrator and restart if required.'}
if(-not $readiness.cliAvailable){throw 'Windows Sandbox CLI (wsb.exe) is unavailable. Check Windows Sandbox installation on Windows 11 24H2 or later.'}
if(-not $readiness.configExists -or -not $readiness.inputFilesPresent){throw 'Sandbox input bundle is missing. Prepare this PC with prepare-sandbox.mjs before starting.'}
$stateFile=Join-Path $stage 'host-state.json'
if(Test-Path -LiteralPath $stateFile){
  $old=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  $listing=(& $wsb.Source list --raw 2>&1 | Out-String)
  if($old.id -and $listing.Contains($old.id)){throw 'A sandbox recorded for this stage already exists. Inspect wsb list before starting another.'}
}
$startText=(& $wsb.Source start --config (Get-Content -LiteralPath $configPath -Raw -Encoding UTF8) --raw 2>&1 | Out-String)
if($LASTEXITCODE -ne 0){throw 'Sandbox startup failed. No host desktop automation was attempted.'}
$match=[regex]::Match($startText,'(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b')
if(-not $match.Success){throw 'Sandbox started but returned an unrecognized ID format. Inspect wsb list; do not create duplicate sandboxes.'}
$id=$match.Value
@{id=$id;stage='started';hostDesktopConnected=$false} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
$guestCommand='powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\QAInput\Bootstrap-Guest.ps1 -SystemProvision'
& $wsb.Source exec --id $id -r System -c $guestCommand
if($LASTEXITCODE -ne 0){throw 'Guest provisioning failed. Read results/bootstrap.json and node-tests.log.'}
$reportPath=Join-Path $stage 'results/bootstrap.json'
if(-not (Test-Path -LiteralPath $reportPath)){throw 'Guest returned without a readiness report. Inspect wsb list and guest provisioning.'}
$report=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
if(-not $report.ok){throw 'Guest is not ready. Read results/bootstrap.json.'}
@{id=$id;stage='guest-prepared';actualAppQATested=$false;hostDesktopConnected=$false} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
Write-Output 'Windows Sandbox guest prepared. Actual Desktop UI QA has not run. No host desktop connection was opened.'
