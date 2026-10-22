import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const script = fileURLToPath(new URL('../scripts/package.mjs', import.meta.url));
async function directory(t) {
  const folder = await mkdtemp(path.join(tmpdir(), 'workbench-package-'));
  t.after(async () => {
    assert.equal(path.dirname(folder), tmpdir());
    await rm(folder, { recursive: true, force: true });
  });
  return folder;
}
function build(args) {
  return new Promise(resolve => execFile(process.execPath, [script, ...args], { timeout: 20000 }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
function zipEntries(bytes) {
  const entries = new Map();
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0, 'test reader expects stored ZIP entries');
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    entries.set(bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), bytes.subarray(start, start + size));
    offset = start + size;
  }
  return entries;
}

test('distribution includes launcher, plugin, source and notices without local secrets; checksums match', async t => {
  const folder = await directory(t);
  const result = await build(['--output-dir', folder]);
  assert.equal(result.code, 0, result.stderr);
  const manifest = JSON.parse(await readFile(path.join(folder, 'SHA256SUMS.json'), 'utf8'));
  assert.equal(Object.keys(manifest).length, 3);
  for (const [name, expected] of Object.entries(manifest)) {
    const bytes = await readFile(path.join(folder, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    const entries = zipEntries(bytes);
    assert.ok(entries.has('LICENSE'));
    assert.ok(![...entries.keys()].some(name => name === '.env' || name.startsWith('private/') || name.includes('node_modules/')));
    if (name.endsWith('-windows.zip')) {
      for (const required of ['FIRST-RUN.md', 'Start-Workbench.cmd', 'Install-Desktop.cmd', 'scripts/install-desktop.ps1', 'scripts/launch.mjs', 'internal-ai-workbench.plugin', '.env.example']) assert.ok(entries.has(required), required);
      assert.ok(!entries.has('runtime/node.exe'));
      assert.ok(!/(?<!\r)\n/.test(entries.get('Start-Workbench.cmd').toString('utf8')), 'Windows launcher has CRLF line endings');
      const plugin = zipEntries(entries.get('internal-ai-workbench.plugin'));
      assert.ok(plugin.has('report.js'));
      assert.ok(plugin.has('pdf-selection.js'));
      for(const script of ['analysis-context.js','analysis-files.js']) {
        assert.ok(plugin.has(script));
        assert.ok(plugin.get('index.html').toString('utf8').includes(`src="${script}"`));
      }
      assert.ok(plugin.get('index.html').toString('utf8').includes('src="pdf-selection.js"'));
    assert.ok(plugin.has('page-command.js'));
    assert.ok(plugin.get('index.html').toString('utf8').includes('src="page-command.js"'));
      assert.ok(plugin.get('index.html').toString('utf8').includes('src="report.js"'));
      assert.equal(JSON.parse(plugin.get('config.json').toString('utf8')).version, JSON.parse(entries.get('package.json').toString('utf8')).version);
    }
  }
});

test('unverified runtime and unsupported package arguments fail before publishing artifacts', async t => {
  const folder = await directory(t);
  const output = path.join(folder, 'delivery');
  await writeFile(path.join(folder, 'node.exe'), 'synthetic unverified executable');
  await writeFile(path.join(folder, 'LICENSE'), 'synthetic unverified notice');
  const result = await build(['--runtime-dir', folder, '--output-dir', output]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /checksum mismatch/);
  await assert.rejects(access(output));
  assert.equal((await build(['--unknown', folder])).code, 1);
});
