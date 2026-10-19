import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sandboxConfiguration} from './sandbox-config.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const options={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){if(!['--desktop-zip','--node-dir','--output-dir','--fixture'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Usage: prepare-sandbox.mjs --desktop-zip file --node-dir folder [--output-dir folder] [--fixture synthetic.pptx]');options[args[i]]=path.resolve(args[i+1]);}
if(!options['--desktop-zip']||!options['--node-dir'])throw Error('Desktop archive and pinned Node runtime are required.');
const destination=options['--output-dir']||path.join(root,'private/vm-sandbox');
if(destination===path.resolve(root)||path.resolve(root).startsWith(destination+path.sep))throw Error('Choose a dedicated staging directory.');
const versions=JSON.parse(await readFile(path.join(root,'versions.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[
  ['DesktopEditors.zip',options['--desktop-zip'],versions.desktopDistributionSha256],
  ['node.exe',path.join(options['--node-dir'],'node.exe'),versions.portableNode.executableSha256],
  ['NODE-LICENSE',path.join(options['--node-dir'],'LICENSE'),versions.portableNode.licenseSha256],
  ['workbench-source.zip',path.join(root,'dist/internal-ai-workbench-source.zip')],
  ['Bootstrap-Guest.ps1',path.join(root,'scripts/vm/Bootstrap-Guest.ps1')]
];
if(options['--fixture'])files.push(['synthetic.pptx',options['--fixture']]);
const manifest={schemaVersion:1,projectVersion:JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,desktopVersion:versions.desktopEditorsTarget,nodeVersion:versions.portableNode.version,files:{}};
for(const [name,source,expected]of files){const digest=hash(await readFile(source));if(expected&&digest!==expected)throw Error(`Pinned checksum mismatch: ${name}`);manifest.files[name]=digest;}
const input=path.join(destination,'input'),results=path.join(destination,'results');
await mkdir(input,{recursive:true});await mkdir(results,{recursive:true});
for(const [name,source]of files)await copyFile(source,path.join(input,name));
await writeFile(path.join(input,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(input,'guest-only.marker'),'INTERNAL_DOC_AI_SANDBOX_INPUT_V1\n');
const config=sandboxConfiguration(input,results);
await writeFile(path.join(destination,'Workbench-QA.wsb'),config);
console.log(JSON.stringify({prepared:true,inputChecksumsVerified:true,memoryMB:4096,networking:false,featureEnablePerformed:false,vmStarted:false,config:path.join(destination,'Workbench-QA.wsb')}));
