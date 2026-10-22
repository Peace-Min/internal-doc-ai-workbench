$ErrorActionPreference='Stop'
$isSystem=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value -eq 'S-1-5-18'
if ((Get-Content C:\QAInput\guest-only.marker -Raw).Trim() -ne 'INTERNAL_DOC_AI_SANDBOX_INPUT_V1' -or
    (-not $isSystem -and $env:USERNAME -ne 'WDAGUtilityAccount')) {throw 'Run only inside the configured Sandbox.'}
$reportPath='C:\QAResults\background-prepared.json'
$report=@{ok=$false;stage='preparing';scope='guest-only';startedAt=[DateTime]::UtcNow.ToString('o');winappVersion='0.7.1'}
# A failed fresh VM preparation must not inherit an earlier VM's successful report.
$report | ConvertTo-Json | Set-Content $reportPath -Encoding UTF8
try {
$inputs=@{
  'winappcli-x64-0.7.1.zip'='d925d1e32cdc320b6d271f653fd2cd3c05b5d7558deb20d1b548bead77900fcf'
  'vc_redist.x64.exe'='843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c'
}
foreach ($name in $inputs.Keys) {
  if ((Get-FileHash "C:\QAInput\$name").Hash.ToLower() -ne $inputs[$name]) {throw 'Background tool checksum mismatch.'}
}
function Assert-MicrosoftSignature($Path) {
  $signature=Get-AuthenticodeSignature $Path
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'Invalid Microsoft signature.'
  }
}
Assert-MicrosoftSignature C:\QAInput\vc_redist.x64.exe
$cli='C:\QATools\WinApp071\winapp.exe'
if (-not (Test-Path $cli)) {
  Expand-Archive C:\QAInput\winappcli-x64-0.7.1.zip C:\QATools\WinApp071
}
Assert-MicrosoftSignature $cli
$env:WINAPP_CLI_TELEMETRY_OPTOUT='1'
$code=0
$vc=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
if (-not $vc -or $vc.Installed -ne 1 -or [version]($vc.Version.TrimStart('v')) -lt [version]'14.51.36247.0') {
  $process=Start-Process C:\QAInput\vc_redist.x64.exe -ArgumentList '/install /quiet /norestart /log C:\QAResults\vcredist-install.log' -WindowStyle Hidden -PassThru -Wait
  $code=$process.ExitCode
}
$ready=$code -in 0,3010 -and (Test-Path C:\Windows\System32\MSVCP140.dll)
$report.ok=$ready;$report.stage=if($ready){'prepared'}else{'failed'}
$report.runtimeExitCode=$code;$report.restartRequired=($code -eq 3010)
$report | ConvertTo-Json | Set-Content $reportPath -Encoding UTF8
if (-not $ready) {exit 1}
} catch {
  $report.ok=$false;$report.stage='failed';$report.errorType=$_.Exception.GetType().FullName
  $report | ConvertTo-Json | Set-Content $reportPath -Encoding UTF8
  throw
}
