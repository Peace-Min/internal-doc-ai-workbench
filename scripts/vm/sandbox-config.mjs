const xml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function sandboxConfiguration(input,results){
  if(!input||!results||input===results)throw Error('Separate input and result directories are required.');
  return `<Configuration>
  <MemoryInMB>4096</MemoryInMB><vGPU>Disable</vGPU><Networking>Disable</Networking>
  <AudioInput>Disable</AudioInput><VideoInput>Disable</VideoInput><PrinterRedirection>Disable</PrinterRedirection><ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder><HostFolder>${xml(input)}</HostFolder><SandboxFolder>C:\\QAInput</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>${xml(results)}</HostFolder><SandboxFolder>C:\\QAResults</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\QAInput\\Bootstrap-Guest.ps1</Command></LogonCommand>
</Configuration>\n`;
}
