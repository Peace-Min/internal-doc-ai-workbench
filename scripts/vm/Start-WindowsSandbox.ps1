param([Parameter(Mandatory=$true)][string]$ConfigFile)
$ErrorActionPreference='Stop'
$configPath=(Resolve-Path -LiteralPath $ConfigFile).Path
$stage=Split-Path -Parent $configPath
$enableResult=Join-Path $stage 'enable-result.json'
if(Test-Path -LiteralPath $enableResult){
  $enable=Get-Content -LiteralPath $enableResult -Raw | ConvertFrom-Json
  $boot=(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime()
  if($enable.restartNeeded -and $boot -lt (Get-Item -LiteralPath $enableResult).LastWriteTimeUtc){throw 'Restart Windows before starting this sandbox. No automatic restart is performed.'}
}
$feature=Get-CimInstance Win32_OptionalFeature -Filter "Name='Containers-DisposableClientVM'"
if($feature.InstallState -ne 1){throw 'Windows Sandbox is not enabled. Run Enable-WindowsSandbox.ps1 as administrator and restart if required.'}
$wsb=Get-Command wsb.exe -ErrorAction SilentlyContinue
if(-not $wsb){throw 'Windows Sandbox CLI (wsb.exe) is unavailable. Check Windows Sandbox installation on Windows 11 24H2 or later.'}
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
