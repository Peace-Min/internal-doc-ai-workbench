param(
  [string]$StageDirectory,
  [guid]$SandboxId=[guid]::Empty,
  [string[]]$UiArguments,
  [guid]$GuestRequest=[guid]::Empty
)
$ErrorActionPreference='Stop'
if ($GuestRequest -ne [guid]::Empty) {
  if ($env:USERNAME -ne 'WDAGUtilityAccount' -or
      (Get-Content C:\QAInput\guest-only.marker -Raw).Trim() -ne 'INTERNAL_DOC_AI_SANDBOX_INPUT_V1') {
    throw 'Expected configured Sandbox guest.'
  }
  $request=Get-Content "C:\QAInput\ui-$GuestRequest.json" -Raw | ConvertFrom-Json
  $arguments=@($request.arguments)
  if ($arguments.Count -eq 0 -or $arguments -contains '--on') {throw 'Expected guest-local UI arguments.'}
  $cli='C:\QATools\WinApp071\winapp.exe'
  $signature=Get-AuthenticodeSignature $cli
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'Invalid automation tool signature.'
  }
  $env:WINAPP_CLI_TELEMETRY_OPTOUT='1'
  # Windows PowerShell treats redirected native stderr as error records.
  $ErrorActionPreference='Continue'
  & $cli ui @arguments 1> "C:\QAResults\ui-$GuestRequest.stdout.txt" 2> "C:\QAResults\ui-$GuestRequest.stderr.txt"
  $code=$LASTEXITCODE
  @{exitCode=$code;scope='guest-only';requestId="$GuestRequest"} | ConvertTo-Json |
    Set-Content "C:\QAResults\ui-$GuestRequest.result.json" -Encoding UTF8
  exit $code
}
if (-not $StageDirectory -or $SandboxId -eq [guid]::Empty -or -not $UiArguments.Count) {
  throw 'Supply StageDirectory, SandboxId and UiArguments.'
}
$stage=[IO.Path]::GetFullPath($StageDirectory)
if ((Get-Content (Join-Path $stage 'input/guest-only.marker') -Raw).Trim() -ne 'INTERNAL_DOC_AI_SANDBOX_INPUT_V1') {
  throw 'Expected an existing prepared Sandbox stage.'
}
$wsb=(Get-Command wsb.exe -ErrorAction Stop).Source
$listing=(& $wsb list --raw | Out-String | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or "$SandboxId" -notin @($listing.WindowsSandboxEnvironments.Id)) {
  throw 'The requested Sandbox is not running. No host fallback or automatic connection.'
}
$requestId=[guid]::NewGuid()
Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $stage 'input/Invoke-SandboxUI.ps1') -Force
@{arguments=@($UiArguments)} | ConvertTo-Json | Set-Content (Join-Path $stage "input/ui-$requestId.json") -Encoding UTF8
$command="powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\QAInput\Invoke-SandboxUI.ps1 -GuestRequest $requestId"
& $wsb exec --id "$SandboxId" -r ExistingLogin -c $command | Out-Null
$execCode=$LASTEXITCODE
$resultFile=Join-Path $stage "results/ui-$requestId.result.json"
if (-not (Test-Path -LiteralPath $resultFile)) {throw 'No guest result. Check sign-in and stage mappings; no host UI was used.'}
$result=Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json
Get-Content -LiteralPath (Join-Path $stage "results/ui-$requestId.stdout.txt") -Raw
if ($execCode -ne 0 -or $result.exitCode -ne 0) {
  throw "Guest UI command failed. See results/ui-$requestId.stderr.txt."
}
