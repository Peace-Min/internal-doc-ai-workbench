#requires -RunAsAdministrator
param([Parameter(Mandatory=$true)][string]$ResultFile)
$ErrorActionPreference='Stop'
$report=@{ok=$false;feature='Containers-DisposableClientVM';restartNeeded=$false;automaticRestart=$false}
try {
  $feature=Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM
  if($feature.State -eq 'Enabled'){$report.ok=$true;$report.state='AlreadyEnabled'}
  elseif($feature.State -eq 'EnablePending'){$report.ok=$true;$report.state='EnablePending';$report.restartNeeded=$true}
  else {
    $result=Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All -NoRestart
    $report.ok=$true;$report.state='Enabled';$report.restartNeeded=[bool]$result.RestartNeeded
  }
}catch{$report.state='Failed';$report.errorType=$_.Exception.GetType().FullName;$report.hresult=$_.Exception.HResult}
$folder=Split-Path -Parent ([IO.Path]::GetFullPath($ResultFile))
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$report | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8
if(-not $report.ok){exit 1}
if($report.restartNeeded){exit 3010}
