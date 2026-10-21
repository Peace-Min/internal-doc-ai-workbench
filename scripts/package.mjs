import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { writeZip } from './zip.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--runtime-dir', '--output-dir'].includes(args[i]) || !args[i + 1] || Object.hasOwn(options, args[i])) throw new Error('Usage: package.mjs [--runtime-dir directory] [--output-dir directory]');
  options[args[i]] = path.resolve(args[i + 1]);
}
const destination = options['--output-dir'] || path.join(root, 'dist');
const hash = data => createHash('sha256').update(data).digest('hex');
const runtimeFiles = [];
if (options['--runtime-dir']) {
  const { portableNode } = JSON.parse(await readFile(path.join(root, 'versions.json'), 'utf8'));
  for (const [name, expected] of [['node.exe', portableNode.executableSha256], ['LICENSE', portableNode.licenseSha256]]) {
    const data = await readFile(path.join(options['--runtime-dir'], name));
    if (hash(data) !== expected) throw new Error(`Pinned Node runtime checksum mismatch: ${name}`);
    runtimeFiles.push({ name: `runtime/${name}`, data });
  }
  runtimeFiles.push({ name: 'runtime/ORIGIN.json', data: Buffer.from(JSON.stringify(portableNode, null, 2) + '\n') });
}
async function collect(relative) {
  const result = [];
  for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await collect(name));
    else if (entry.isFile()) result.push({ name, data: await readFile(path.join(root, name)) });
  }
  return result;
}
await mkdir(destination, { recursive: true });
const pluginFiles = await collect('plugin');
await writeZip(path.join(destination, 'internal-ai-workbench.plugin'), [...pluginFiles.map(f => ({ ...f, name: f.name.slice(7) })), { name: 'LICENSE', data: await readFile(path.join(root, 'LICENSE')) }]);
const sourceFiles = [...pluginFiles, ...await collect('src'), ...await collect('scripts'), ...await collect('docs'), ...await collect('test')];
for (const name of ['package.json', 'versions.json', '.gitattributes', '.gitignore', '.env.example', 'README.md', 'FIRST-RUN.md', 'Start-Workbench.cmd', 'Install-Desktop.cmd', 'HANDOFF.md', 'AGENTS.md', 'LICENSE']) {
  const data = await readFile(path.join(root, name));
  sourceFiles.push({ name, data: name.endsWith('.cmd') ? Buffer.from(data.toString('utf8').replace(/\r?\n/g, '\r\n')) : data });
}
await writeZip(path.join(destination, 'internal-ai-workbench-source.zip'), sourceFiles);
await writeZip(path.join(destination, 'internal-ai-workbench-windows.zip'), [...sourceFiles, ...runtimeFiles, { name: 'internal-ai-workbench.plugin', data: await readFile(path.join(destination, 'internal-ai-workbench.plugin')) }]);
const manifest = {};
for (const name of ['internal-ai-workbench.plugin', 'internal-ai-workbench-source.zip', 'internal-ai-workbench-windows.zip']) manifest[name] = hash(await readFile(path.join(destination, name)));
await writeFile(path.join(destination, 'SHA256SUMS.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built plugin, source ZIP, Windows ZIP and SHA256SUMS.json. Node runtime: ${runtimeFiles.length ? 'bundled and checksum verified' : 'not bundled (requires installed Node)'}. Desktop Editors is not bundled.`);
