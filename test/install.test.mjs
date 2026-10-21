import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('desktop installer rejects a modified editor archive before creating the installation', {skip:process.platform!=='win32'}, async t => {
  const folder=await mkdtemp(path.join(tmpdir(),'workbench-install-'));
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const archive=path.join(folder,'modified.zip'),destination=path.join(folder,'install');
  await writeFile(archive,'Synthetic tampered archive');
  const script=fileURLToPath(new URL('../scripts/install-desktop.ps1',import.meta.url));
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const result=await new Promise(resolve=>execFile(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-EditorZip',archive,'-InstallDirectory',destination],{timeout:15000},(error,stdout,stderr)=>resolve({code:error?.code||0,stdout,stderr})));
  assert.notEqual(result.code,0);
  assert.match(result.stderr,/archive checksum mismatch/);
  await assert.rejects(access(destination));
});
