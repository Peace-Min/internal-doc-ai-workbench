import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {analysisContext} from '../src/marker-context.mjs';

const root = new URL('../docs/qa/assets/marker-benchmark/',import.meta.url);
const pdf = new File([await readFile(new URL('fixture.pdf',root))],'fixture.pdf');
const packet = JSON.parse(await readFile(new URL('marker-ocr.json',root),'utf8'));
const scripts = await Promise.all(['analysis-context.js','analysis-files.js'].map(name=>readFile(new URL(`../plugin/${name}`,import.meta.url),'utf8')));
function capture(crypto=webcrypto) {
  const context=vm.createContext({crypto,Uint8Array,TextDecoder});
  for(const script of scripts)vm.runInContext(script,context);
  return context.WorkbenchAnalysisFiles.capture;
}
const json = input=>new File([JSON.stringify(input)],'analysis.json');

test('real Marker fixture binds PDF hash, selects pages and preserves page provenance',async()=>{
  const result=await capture()(pdf,json(packet),{startPage:'3',endPage:'3'});
  assert.equal(result.kind,'pdf_packet');assert.equal(result.readOnly,true);
  assert.equal(result.documentSha256,packet.documentSha256);
  assert.match(result.text,/\[page 3\]/);assert.match(result.text,/437/);
  assert.doesNotMatch(result.text,/\[page 1\]/);assert.equal(result.sources.length,1);
  assert.equal(result.engineLabel,'Marker 2.0.0 · OCR 켬');
  const baseline=JSON.parse(await readFile(new URL('baseline.json',root),'utf8'));
  assert.equal((await capture()(pdf,json(baseline),{startPage:1,endPage:1})).engineLabel,'pdfplumber 직접 추출');
});

test('file import refuses mismatches, malformed bytes, unsupported extraction and unavailable hashing',async()=>{
  const run=capture();
  for(const bad of [{...packet,documentSha256:'a'.repeat(64)},{...packet,useLlm:true},{...packet,markerVersion:'other'},{...packet,ocr:null},{...packet,engine:'unknown'}])await assert.rejects(run(pdf,json(bad),{}));
  await assert.rejects(run(new File(['%PDF-changed'],'other.pdf'),json(packet),{}),/SHA-256/);
  await assert.rejects(run(new File(['plain text'],'other.pdf'),json(packet),{}),/원본 PDF/);
  for(const content of ['{bad',new Uint8Array([0xff])])await assert.rejects(run(pdf,new File([content],'bad.json'),{}),/UTF-8/);
  await assert.rejects(capture(null)(pdf,json(packet),{}),/해시/);
  await assert.rejects(run(pdf,json({...packet,pages:[{page:1,text:'  '}]}),{}),/추출 텍스트/);
});

test('file boundaries reject absent, oversized and changed-size files before use',async()=>{
  const run=capture();
  for(const file of [undefined,{size:0},{size:20*1024*1024+1},{size:1.5},{size:5,arrayBuffer:async()=>new ArrayBuffer(1)}])await assert.rejects(run(file,json(packet),{}));
  await assert.rejects(run(pdf,{size:2*1024*1024+1},{}));
});

test('shared page ranges reject gaps, duplicates and invalid bounds without truncation',()=>{
  for(const range of [{startPage:0},{startPage:'1.5'},{startPage:3,endPage:1},{endPage:201},{startPage:'1e0'},{startPage:4}])assert.throws(()=>analysisContext(packet,range));
  for(const pages of [[{page:1,text:'one'},{page:3,text:'three'}],[{page:1,text:'one'},{page:1,text:'duplicate'}],[{page:1,text:'bad\0text'}]])assert.throws(()=>analysisContext({...packet,pages}));
  const large={...packet,pages:[{page:1,text:'x'.repeat(12000)},{page:2,text:'small'}]};
  assert.throws(()=>analysisContext(large));
  assert.equal(analysisContext(large,{startPage:2,endPage:2}).text,'[page 2]\nsmall');
  assert.match(analysisContext({...packet,pages:[...packet.pages].reverse()}).text,/^\[page 1\]/);
});
