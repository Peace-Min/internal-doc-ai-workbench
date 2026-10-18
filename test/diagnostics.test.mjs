import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnoseLlm } from '../src/diagnostics.mjs';

const secret='synthetic-secret-key';
const model='synthetic-private-model';
const output='synthetic-private-model-output';
const env={WB_MODE:'anthropic-compatible',WB_LLM_URL:'http://example.invalid/v1/messages',WB_LLM_MODEL:model,WB_LLM_KEY:secret};
const success={type:'message',stop_reason:'end_turn',content:[{type:'text',text:output}]};
function sanitized(report) {
  const raw=JSON.stringify(report);
  for(const value of [secret,model,output,'example.invalid','127.0.0.1','raw-private-error'])assert.equal(raw.includes(value),false);
}
async function cli(extra={},args=[]) {
  return new Promise(resolve=>execFile(process.execPath,[fileURLToPath(new URL('../scripts/diagnose-llm.mjs',import.meta.url)),...args],{
    env:{SystemRoot:process.env.SystemRoot,...extra},timeout:10000
  },(error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
}
async function gateway(behavior,run) {
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    behavior(req,res,raw);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await run({...env,WB_LLM_URL:`http://127.0.0.1:${server.address().port}/v1/messages`}); }
  finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}

test('diagnostics reject mock, invalid config and timeout bounds before network',async()=>{
  for(const [config,code] of [[{},'MOCK_MODE'],[{WB_MODE:'unknown'},'CONFIG_INVALID'],[{...env,WB_PROBE_TIMEOUT_MS:'30001'},'CONFIG_INVALID'],[{...env,WB_LLM_URL:'file:///private'},'CONFIG_INVALID']]) {
    let called=false;
    const report=await diagnoseLlm(config,{fetch:()=>{called=true;throw Error('unexpected');}});
    assert.equal(report.code,code);assert.equal(report.networkRequestAttempted,false);assert.equal(called,false);sanitized(report);
  }
});

test('diagnostics send fixed synthetic text and discard model output',async()=>{
  const report=await diagnoseLlm(env,{fetch:async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.messages[0].content),{instruction:'이 문장을 간결한 한국어 한 문장으로 바꾸세요. 한 줄의 일반 텍스트만 반환하세요.',document:'연결 확인용 합성 문장입니다.'});
    assert.equal(body.stream,false);assert.equal(body.tools,undefined);
    assert.equal(options.redirect,'error');
    return new Response(JSON.stringify(success));
  }});
  assert.equal(report.ok,true);assert.equal(report.code,'OK');assert.equal(report.syntheticInput,true);sanitized(report);
});

test('diagnostics classify upstream failures without exposing raw errors',async()=>{
  const cases=[
    [async()=>new Response('raw-private-error',{status:401}),'UPSTREAM_AUTH',401],
    [async()=>new Response('raw-private-error',{status:403}),'UPSTREAM_AUTH',403],
    [async()=>new Response('raw-private-error',{status:429}),'UPSTREAM_RATE_LIMIT',429],
    [async()=>new Response('raw-private-error',{status:503}),'UPSTREAM_HTTP',503],
    [async()=>new Response('x'.repeat(70000)),'UPSTREAM_RESPONSE_TOO_LARGE'],
    [async()=>new Response('{raw-private-error'),'UPSTREAM_INVALID_RESPONSE'],
    [async()=>new Response(JSON.stringify({...success,stop_reason:'max_tokens'})),'UPSTREAM_INVALID_RESPONSE'],
    [async()=>{throw new DOMException('raw-private-error','TimeoutError');},'UPSTREAM_TIMEOUT'],
    [async()=>{throw new TypeError('raw-private-error');},'UPSTREAM_CONNECTION']
  ];
  for(const [fetch,code,status] of cases) {
    const report=await diagnoseLlm(env,{fetch});assert.equal(report.ok,false);assert.equal(report.code,code);assert.equal(report.httpStatus,status);sanitized(report);
  }
});

test('CLI exit codes distinguish config errors without network',async()=>{
  for(const args of [[],['unexpected-private-path']]) {
    const result=await cli({},args);assert.equal(result.code,2);assert.equal(result.stderr,'');
    const report=JSON.parse(result.stdout);assert.equal(report.networkRequestAttempted,false);sanitized(report);
    assert.equal(report.code,args.length?'CLI_ARGUMENTS':'MOCK_MODE');
  }
});

test('CLI verifies both protocols through real loopback HTTP without leaking values',async()=>{
  for(const mode of ['anthropic-compatible','openai-compatible'])await gateway((req,res,raw)=>{
    assert.equal(req.headers.authorization,`Bearer ${secret}`);assert.equal(JSON.parse(raw).model,model);
    res.end(JSON.stringify(mode==='anthropic-compatible'?success:{choices:[{finish_reason:'stop',message:{content:output}}]}));
  },async config=>{
    const result=await cli({...config,WB_MODE:mode});assert.equal(result.code,0);assert.equal(result.stderr,'');
    const report=JSON.parse(result.stdout);assert.equal(report.code,'OK');assert.equal(report.protocol,mode);sanitized(report);
  });
});

test('CLI reports HTTP auth and real request/body timeouts with exit 3',async()=>{
  for(const kind of ['auth','timeout','body-timeout'])await gateway((req,res)=>{
    if(kind==='auth'){res.writeHead(401);res.end('raw-private-error');}
    if(kind==='body-timeout'){res.writeHead(200,{'Content-Type':'application/json'});res.write('{');}
  },async config=>{
    const result=await cli({...config,WB_PROBE_TIMEOUT_MS:'150'});assert.equal(result.code,3);assert.equal(result.stderr,'');
    const report=JSON.parse(result.stdout);assert.equal(report.code,kind==='auth'?'UPSTREAM_AUTH':'UPSTREAM_TIMEOUT');sanitized(report);
  });
});
