param([switch]$SystemProvision)
$ErrorActionPreference='Stop'
$inputRoot='C:\QAInput';$resultRoot='C:\QAResults';$workbench='C:\QAWorkbench'
if(-not (Test-Path -LiteralPath "$inputRoot\guest-only.marker") -or -not (Test-Path -LiteralPath $resultRoot)){throw 'Run only inside the configured Windows Sandbox.'}
if((Get-Content -LiteralPath "$inputRoot\guest-only.marker" -Raw).Trim() -ne 'INTERNAL_DOC_AI_SANDBOX_INPUT_V1'){throw 'Guest marker mismatch.'}
if(-not $SystemProvision -and $env:USERNAME -ne 'WDAGUtilityAccount'){throw 'Expected Windows Sandbox guest user.'}
$mutex=New-Object Threading.Mutex($false,'Global\InternalDocAIWorkbenchProvision')
$locked=$false
try{$locked=$mutex.WaitOne(180000)}catch [Threading.AbandonedMutexException]{$locked=$true}
if(-not $locked){$mutex.Dispose();throw 'Another guest provisioner did not finish.'}
try {
$report=@{stage='preparing';ok=$false;actualAppLaunched=$false;actualAppQATested=$false}
try {
  $manifest=Get-Content -LiteralPath "$inputRoot\manifest.json" -Raw | ConvertFrom-Json
  foreach($file in $manifest.files.PSObject.Properties){
    $actual=(Get-FileHash -LiteralPath (Join-Path $inputRoot $file.Name) -Algorithm SHA256).Hash.ToLower()
    if($actual -ne $file.Value){throw 'Input checksum mismatch.'}
  }
  $priorPath=Join-Path $resultRoot 'bootstrap.json'
  if(Test-Path -LiteralPath $priorPath){
    $prior=Get-Content -LiteralPath $priorPath -Raw | ConvertFrom-Json
    if($prior.ok -and $prior.sourceSha256 -eq $manifest.files.'workbench-source.zip' -and (Test-Path 'C:\QAEditors\DesktopEditors.exe')){exit 0}
  }
  $report.sourceSha256=$manifest.files.'workbench-source.zip'
  New-Item -ItemType Directory -Force -Path $workbench,'C:\QAEditors' | Out-Null
  Expand-Archive -LiteralPath "$inputRoot\workbench-source.zip" -DestinationPath $workbench -Force
  Expand-Archive -LiteralPath "$inputRoot\DesktopEditors.zip" -DestinationPath 'C:\QAEditors' -Force
  New-Item -ItemType Directory -Force -Path "$workbench\runtime" | Out-Null
  Copy-Item -LiteralPath "$inputRoot\node.exe" -Destination "$workbench\runtime\node.exe" -Force
  Copy-Item -LiteralPath "$inputRoot\NODE-LICENSE" -Destination "$workbench\runtime\LICENSE" -Force
  if(Test-Path "$inputRoot\synthetic.pptx"){Copy-Item -LiteralPath "$inputRoot\synthetic.pptx" -Destination "$workbench\synthetic.pptx" -Force}
  $config=Get-Content -LiteralPath "$workbench\plugin\config.json" -Raw | ConvertFrom-Json
  $guid=$config.guid -replace '^asc\.',''
  if($guid -notmatch '^\{[A-Fa-f0-9-]{36}\}$'){throw 'Unexpected plugin GUID.'}
  $profile=if($SystemProvision){'C:\Users\WDAGUtilityAccount'}else{$env:USERPROFILE}
  $pluginFolder=Join-Path $profile "AppData\Local\ONLYOFFICE\DesktopEditors\data\sdkjs-plugins\$guid"
  New-Item -ItemType Directory -Force -Path $pluginFolder | Out-Null
  Copy-Item -Path "$workbench\plugin\*" -Destination $pluginFolder -Recurse -Force
  Copy-Item -LiteralPath "$workbench\LICENSE" -Destination "$pluginFolder\LICENSE" -Force
  $node="$workbench\runtime\node.exe"
  $report.nodeVersion=(& $node --version)
  Push-Location $workbench
  try{& $node --test --test-concurrency=2 --test-reporter=spec 2>&1 | Set-Content -LiteralPath "$resultRoot\node-tests.log" -Encoding UTF8;$report.nodeTestsExitCode=$LASTEXITCODE}finally{Pop-Location}
  $report.editorExecutableFound=Test-Path 'C:\QAEditors\DesktopEditors.exe'
  if(-not $report.editorExecutableFound -or $report.nodeTestsExitCode -ne 0){throw 'Guest prerequisite check failed.'}
  $report.pluginInstalled=$true;$report.projectVersion=$config.version
  $report.stage='prepared';$report.ok=$true
}catch{$report.stage='failed';$report.errorType=$_.Exception.GetType().FullName}
$report | ConvertTo-Json | Set-Content -LiteralPath "$resultRoot\bootstrap.json" -Encoding UTF8
if(-not $report.ok){exit 1}
} finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
