import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import http from 'node:http';
import { startWorkbench } from '../src/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const token = 'synthetic-launch-pairing-token';
const cleanEnv = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH };
async function project(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'workbench-launch-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  });
  for (const name of ['src', 'plugin', 'scripts', 'package.json']) await cp(path.join(root, name), path.join(directory, name), { recursive: true });
  return directory;
}
async function availablePort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function cli(directory, args = ['--check'], env = {}) {
  return new Promise(resolve => execFile(process.execPath, [path.join(directory, 'scripts/launch.mjs'), ...args], { cwd: tmpdir(), env: { ...cleanEnv, ...env }, timeout: 10000 },
    (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}

test('launcher checks project-relative env from another working directory without creating credentials', async t => {
  const directory = await project(t);
  await writeFile(path.join(directory, '.env'), `WB_MODE=mock\nWB_PORT=4320\nWB_TOKEN=${token}\n`);
  const result = await cli(directory);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, mode: 'mock', networkRequestSent: false, portAvailabilityChecked: false });
  assert.equal((result.stdout + result.stderr).includes(token), false);
  await assert.rejects(access(path.join(directory, 'private/runtime.json')));
});

test('launcher configuration and argument failures do not expose private values or create credentials', async t => {
  const directory = await project(t);
  const secret = 'synthetic-private-config-value';
  for (const env of [{ WB_PORT: '65536' }, { WB_MODE: secret }, { WB_MODE: 'anthropic-compatible', WB_CLAUDE_CONFIG: secret }]) {
    const result = await cli(directory, ['--check'], env);
    assert.equal(result.code, 1);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
    await assert.rejects(access(path.join(directory, 'private/runtime.json')));
  }
  const invalid = await cli(directory, ['--unknown']);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /Usage:/);
});

test('launcher starts service and duplicate launch preserves active credentials', async t => {
  const directory = await project(t);
  const port = await availablePort();
  await writeFile(path.join(directory, '.env'), `WB_MODE=mock\nWB_PORT=${port}\nWB_TOKEN=${token}\n`);
  const child = spawn(process.execPath, [path.join(directory, 'scripts/launch.mjs')], { cwd: tmpdir(), env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let output = '';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('launcher startup timeout')), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('launcher exited before ready')); });
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('Workbench ready:')) { clearTimeout(timer); resolve(); } });
    });
    const runtimePath = path.join(directory, 'private/runtime.json');
    const original = await readFile(runtimePath, 'utf8');
    assert.equal(JSON.parse(original).token, token);
    assert.equal(output.includes(token), false);
    const duplicate = await cli(directory, [], { WB_TOKEN: 'different-synthetic-launch-token' });
    assert.equal(duplicate.code, 1);
    assert.match(duplicate.stderr, /already in use/);
    assert.equal(await readFile(runtimePath, 'utf8'), original);
    const response = await fetch(`http://127.0.0.1:${port}/api/propose`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'replace_text', text: '합성 문장', instruction: '간결하게' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).proposedText, '[모의 수정안] 합성 문장');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    }
  }
});

test('runtime file write failure releases the listening port', async t => {
  const directory = await project(t);
  const runtimePath = path.join(directory, 'private/runtime.json');
  await mkdir(runtimePath, { recursive: true });
  const port = await availablePort();
  await assert.rejects(startWorkbench({ WB_MODE: 'mock', WB_PORT: String(port) }, runtimePath));
  const probe = http.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
});
