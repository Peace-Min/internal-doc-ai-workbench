import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { writeZip } from './zip.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
async function collect(relative) {
  const result = [];
  for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await collect(name));
    else if (entry.isFile()) result.push({ name, data: await readFile(path.join(root, name)) });
  }
  return result;
}
await mkdir(path.join(root, 'dist'), { recursive: true });
const pluginFiles = await collect('plugin');
await writeZip(path.join(root, 'dist/internal-ai-workbench.plugin'), [...pluginFiles.map(f => ({ ...f, name: f.name.slice(7) })), { name: 'LICENSE', data: await readFile(path.join(root, 'LICENSE')) }]);
const sourceFiles = [...pluginFiles, ...await collect('src'), ...await collect('scripts'), ...await collect('docs'), ...await collect('test')];
for (const name of ['package.json', 'versions.json', '.gitattributes', '.gitignore', '.env.example', 'README.md', 'HANDOFF.md', 'AGENTS.md', 'LICENSE']) sourceFiles.push({ name, data: await readFile(path.join(root, name)) });
await writeZip(path.join(root, 'dist/internal-ai-workbench-source.zip'), sourceFiles);
const manifest = {};
for (const name of ['internal-ai-workbench.plugin', 'internal-ai-workbench-source.zip']) manifest[name] = createHash('sha256').update(await readFile(path.join(root, 'dist', name))).digest('hex');
await writeFile(path.join(root, 'dist/SHA256SUMS.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Built dist/internal-ai-workbench.plugin, source ZIP and SHA256SUMS.json (editor and Node runtime not bundled).');
