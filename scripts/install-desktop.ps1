param(
  [Parameter(Mandatory=$true)][string]$EditorZip,
  [string]$InstallDirectory
)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1')
$source=Split-Path -Parent $PSScriptRoot
$package=Get-Content (Join-Path $source 'package.json') -Raw | ConvertFrom-Json
$versions=Get-Content (Join-Path $source 'versions.json') -Raw | ConvertFrom-Json
$config=Get-Content (Join-Path $source 'plugin/config.json') -Raw | ConvertFrom-Json
if ($package.version -notmatch '^\d+\.\d+\.\d+$' -or $package.version -ne $config.version -or $versions.poc -ne $package.version) {throw 'Release version mismatch.'}
$guid=$config.guid -replace '^asc\.',''
if ($guid -ne '{A5BA9AF1-7BCE-4B75-86F7-C28D4E922B1B}') {throw 'Unexpected plugin identity.'}
if ((Get-FileHash -LiteralPath $EditorZip).Hash.ToLower() -ne $versions.desktopDistributionSha256) {throw 'Desktop Editors archive checksum mismatch.'}
foreach ($entry in @(@('node.exe',$versions.portableNode.executableSha256),@('LICENSE',$versions.portableNode.licenseSha256))) {
  if ((Get-FileHash -LiteralPath (Join-Path $source "runtime/$($entry[0])")).Hash.ToLower() -ne $entry[1]) {throw 'Use the verified runtime-bundled Windows ZIP.'}
}
if (-not (Test-Path "$env:WINDIR/System32/MSVCP140.dll")) {throw 'Install the official x64 Visual C++ runtime before continuing. No download or elevation was attempted.'}
if (Get-Process DesktopEditors,editors -ErrorAction SilentlyContinue) {throw 'Close Desktop Editors before installing the plugin. No application was closed.'}
if (-not $InstallDirectory) {$InstallDirectory=Join-Path $env:LOCALAPPDATA "InternalDocAIWorkbench/$($package.version)"}
$target=[IO.Path]::GetFullPath($InstallDirectory).TrimEnd([char[]]'\/')
if (Test-Path -LiteralPath $target) {throw 'Installation destination already exists. Choose a new empty destination; existing files were preserved.'}
if ($target -eq $source -or $source.StartsWith($target+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Choose a dedicated installation destination outside the release folder.'}
$parent=Split-Path -Parent $target
[IO.Directory]::CreateDirectory($parent) | Out-Null
$staging=Join-Path $parent ('.workbench-install-'+[guid]::NewGuid())
$app=Join-Path $staging 'app'
New-Item -ItemType Directory -Path $app | Out-Null
try {
  # Copy only release inputs, never a developer's private config or document folders.
  foreach ($name in @('src','plugin','scripts','docs','runtime','package.json','versions.json','LICENSE','README.md','FIRST-RUN.md','Start-Workbench.cmd','.env.example')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination $app -Recurse
  }
  Expand-Archive -LiteralPath $EditorZip -DestinationPath (Join-Path $staging 'editor')
  if (-not (Test-Path (Join-Path $staging 'editor/DesktopEditors.exe'))) {throw 'Editor executable missing from archive.'}
  & (Join-Path $app 'runtime/node.exe') (Join-Path $app 'scripts/launch.mjs') --check | Out-Null
  if ($LASTEXITCODE -ne 0) {throw 'Installed service preflight failed.'}
  @'
@echo off
start "" /min "%~dp0app\Start-Workbench.cmd"
start "" "%~dp0editor\DesktopEditors.exe" %*
'@.Replace("`r`n","`n").Replace("`n","`r`n") | Set-Content (Join-Path $staging 'Start-Desktop.cmd') -Encoding ASCII
  @{version=$package.version;editorVersion=$versions.desktopEditorsTarget;networkDownloadUsed=$false;serviceStarted=$false;editorStarted=$false} |
    ConvertTo-Json | Set-Content (Join-Path $staging 'installation.json') -Encoding UTF8
  [IO.Directory]::Move($staging,$target)
} catch {throw "Installation did not finish. Staging files were preserved for inspection at $staging. $($_.Exception.Message)"}
$pluginRoot=Join-Path $env:LOCALAPPDATA 'ONLYOFFICE/DesktopEditors/data/sdkjs-plugins'
$pluginTarget=Join-Path $pluginRoot $guid
New-Item -ItemType Directory -Force $pluginRoot | Out-Null
$backup=$null
if (Test-Path -LiteralPath $pluginTarget) {
  $backup=Join-Path $env:LOCALAPPDATA ('InternalDocAIWorkbench/plugin-backups/'+[guid]::NewGuid())
  New-Item -ItemType Directory -Force (Split-Path -Parent $backup) | Out-Null
  Move-Item -LiteralPath $pluginTarget -Destination $backup
}
try {
  Copy-Item -LiteralPath (Join-Path $target 'app/plugin') -Destination $pluginTarget -Recurse
  Copy-Item -LiteralPath (Join-Path $target 'app/LICENSE') -Destination (Join-Path $pluginTarget 'LICENSE')
} catch {
  # Keep partial files for inspection and restore the prior plugin, without deleting user data.
  if (Test-Path -LiteralPath $pluginTarget) {Move-Item -LiteralPath $pluginTarget -Destination (Join-Path $target 'failed-plugin')}
  if ($backup) {Move-Item -LiteralPath $backup -Destination $pluginTarget}
  throw 'Plugin install failed; previous plugin was restored when available. Inspect the installation directory.'
}
@{ok=$true;version=$package.version;installDirectory=$target;pluginInstalled=$true;pluginBackup=$backup;networkDownloadUsed=$false;serviceStarted=$false;editorStarted=$false} | ConvertTo-Json
