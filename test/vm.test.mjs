import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {sandboxConfiguration} from '../scripts/vm/sandbox-config.mjs';
const run=(exe,args)=>new Promise(resolve=>execFile(exe,args,{timeout:10000},(error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
test('sandbox configuration preserves XML paths and separates read-only inputs from writable results',()=>{
  const config=sandboxConfiguration('C:\\QA & Input','C:\\QA Results');
  assert.match(config,/QA &amp; Input/);assert.equal((config.match(/<MappedFolder>/g)||[]).length,2);
  assert.match(config,/<SandboxFolder>C:\\QAInput<\/SandboxFolder><ReadOnly>true/);
  assert.match(config,/<SandboxFolder>C:\\QAResults<\/SandboxFolder><ReadOnly>false/);
  assert.match(config,/<Networking>Disable/);assert.match(config,/<ClipboardRedirection>Disable/);
  assert.throws(()=>sandboxConfiguration('same','same'));
});
test('VM staging refuses an unverified executable bundle before creating its input folder',async t=>{
  const folder=await mkdtemp(path.join(tmpdir(),'workbench-vm-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const archive=path.join(folder,'fake.zip'),output=path.join(folder,'stage');await writeFile(archive,'not a vendor archive');
  const result=await run(process.execPath,[fileURLToPath(new URL('../scripts/vm/prepare-sandbox.mjs',import.meta.url)),'--desktop-zip',archive,'--node-dir',folder,'--output-dir',output]);
  assert.notEqual(result.code,0);assert.match(result.stderr,/Pinned checksum mismatch/);
  await assert.rejects(access(path.join(output,'input')));
});
test('guest bootstrap rejects execution on the host before provisioning', {skip:process.platform!=='win32'},async t=>{
  try{await access('C:\\QAInput\\guest-only.marker');t.skip('Host-only check; already inside the configured guest.');return;}catch{}
  const result=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/vm/Bootstrap-Guest.ps1',import.meta.url)),'-SystemProvision']);
  assert.notEqual(result.code,0);assert.match(result.stderr,/Run only inside/);
});
