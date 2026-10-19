import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('grounding CLI pairs the same model settings and rejects mismatched PDFs before sending',async t=>{
  const folder=await mkdtemp(path.join(tmpdir(),'marker-cli-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;
    const body=JSON.parse(raw);requests.push(body);
    res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:body.messages[1].content.includes('unknown question')?'UNKNOWN':'950',page:body.messages[1].content.includes('unknown question')?null:1})}}]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const common={schemaVersion:1,documentSha256:'a'.repeat(64),pages:[{page:1,text:'ORBIT budget 950.'}]};
  const files={baseline:path.join(folder,'baseline.json'),marker:path.join(folder,'marker.json'),questions:path.join(folder,'questions.json'),output:path.join(folder,'report.json')};
  await writeFile(files.baseline,JSON.stringify({...common,engine:'pdfplumber'}));
  await writeFile(files.marker,JSON.stringify({...common,engine:'marker',markerVersion:'2.0.0',mode:'fast',ocr:false,useLlm:false}));
  await writeFile(files.questions,JSON.stringify({synthetic:true,documentSha256:common.documentSha256,cases:[{id:'a',question:'budget?',answer:'950',page:1},{id:'b',question:'unknown question',answer:'UNKNOWN',page:null}]}));
  const run=()=>new Promise(resolve=>execFile(process.execPath,[fileURLToPath(new URL('../scripts/evaluate-grounding.mjs',import.meta.url)),...Object.entries(files).flatMap(([key,value])=>[`--${key}`,value])],{env:{SystemRoot:process.env.SystemRoot,WB_MODE:'openai-compatible',WB_LLM_URL:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,WB_LLM_MODEL:'synthetic-model',WB_LLM_AUTH:'none'},timeout:10000},(error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
  const result=await run();assert.equal(result.code,0,result.stderr);assert.equal(requests.length,4);
  for(const request of requests){assert.equal(request.temperature,0);assert.equal(request.seed,42);assert.equal(request.max_tokens,128);assert.equal(request.response_format.type,'json_schema');}
  const report=JSON.parse(await readFile(files.output,'utf8'));assert.equal(report.summaries.marker.correct,2);assert.equal(report.paired.markerWins,0);
  await writeFile(files.marker,JSON.stringify({...common,engine:'marker',documentSha256:'b'.repeat(64)}));
  assert.equal((await run()).code,2);assert.equal(requests.length,4);
});
