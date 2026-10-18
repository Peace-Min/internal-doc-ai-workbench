import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createWorkbenchServer } from '../src/server.mjs';
import { createLlmAdapter } from '../src/llm.mjs';

const token='synthetic-local-pairing-token-only';
const input={operation:'replace_text',text:'합성 원문',instruction:'간결하게 보완'};
const success={type:'message',stop_reason:'end_turn',content:[{type:'text',text:'보완 문장'}]};
async function withGateway(behavior, run, overrides={}) {
  const gateway=http.createServer(async(req,res)=>{
    let body=''; for await(const part of req)body+=part;
    await behavior(req,res,body);
  });
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  const bridge=createWorkbenchServer({token,mode:'anthropic-compatible',llmUrl:`http://127.0.0.1:${gateway.address().port}/proxy/v1/messages`,model:'synthetic-model',llmKey:'synthetic-gateway-key',...overrides});
  await new Promise(resolve=>bridge.listen(0,'127.0.0.1',resolve));
  const request=()=>fetch(`http://127.0.0.1:${bridge.address().port}/api/propose`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
  try{await run(request);}finally{
    bridge.closeAllConnections();gateway.closeAllConnections();
    await Promise.all([new Promise(resolve=>bridge.close(resolve)),new Promise(resolve=>gateway.close(resolve))]);
  }
}
test('real loopback HTTP carries Anthropic request and bearer auth, returning only proposal',async()=>{
  await withGateway(async(req,res,raw)=>{
    assert.equal(req.url,'/proxy/v1/messages');assert.equal(req.headers.authorization,'Bearer synthetic-gateway-key');
    assert.equal(req.headers['anthropic-version'],'2023-06-01');assert.equal(req.headers['x-api-key'],undefined);
    const body=JSON.parse(raw);assert.equal(body.model,'synthetic-model');assert.equal(body.max_tokens,2048);assert.equal(body.stream,false);
    assert.equal(typeof body.system,'string');assert.equal(body.messages.length,1);assert.equal(body.messages[0].role,'user');
    assert.deepEqual(JSON.parse(body.messages[0].content),{instruction:input.instruction,document:input.text});
    assert.equal(body.tools,undefined);res.end(JSON.stringify(success));
  },async request=>{
    const response=await request();assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.proposedText,'보완 문장');assert.equal(data.mode,'anthropic-compatible');
    assert.equal(JSON.stringify(data).includes('synthetic-gateway-key'),false);
  });
});
test('x-api-key authentication does not accidentally add bearer credentials',async()=>{
  await withGateway(async(req,res)=>{
    assert.equal(req.headers['x-api-key'],'synthetic-gateway-key');assert.equal(req.headers.authorization,undefined);
    res.end(JSON.stringify(success));
  },async request=>assert.equal((await request()).status,200),{authStyle:'api-key'});
});
test('thinking blocks stay out of the document and text blocks join as plain text',async()=>{
  await withGateway(async(req,res)=>res.end(JSON.stringify({...success,content:[{type:'thinking',thinking:'private-reasoning'},{type:'text',text:'보완 '},{type:'text',text:'문장'}]})),async request=>{
    const data=await(await request()).json();assert.equal(data.proposedText,'보완 문장');assert.equal(JSON.stringify(data).includes('private-reasoning'),false);
  });
});
test('truncation, tool calls, malformed content and multiline text fail without applying',async()=>{
  for(const result of [
    {...success,stop_reason:'max_tokens'},
    {...success,stop_reason:'tool_use',content:[{type:'tool_use',name:'run_code',input:{code:'forbidden'}}]},
    {...success,content:[{type:'text',text:'okay'},{type:'tool_use'}]},
    {...success,content:[{type:'thinking',thinking:'do-not-apply'}]},
    {...success,content:[{type:'text',text:'line1\nline2'}]},
    {...success,content:[{type:'text',text:null}]},
    {error:{message:'synthetic-secret-error'}}
  ])await withGateway(async(req,res)=>res.end(JSON.stringify(result)),async request=>{
    const response=await request();assert.equal(response.status,502);assert.equal((await response.text()).includes('synthetic-secret-error'),false);
  });
});
test('HTTP errors and oversized upstream bodies return a sanitized gateway error',async()=>{
  for(const kind of ['http','oversized','json'])await withGateway(async(req,res)=>{
    if(kind==='http'){res.statusCode=401;res.end('synthetic-private-error');}
    else if(kind==='oversized')res.end('x'.repeat(70000));else res.end('{invalid-synthetic-private-error');
  },async request=>{
    const response=await request();assert.equal(response.status,502);assert.equal((await response.text()).includes('synthetic-private-error'),false);
  });
});
test('real HTTP timeout and redirect do not return successful proposals',async()=>{
  for(const kind of ['timeout','redirect'])await withGateway(async(req,res)=>{
    if(kind==='redirect'){res.writeHead(307,{Location:'http://unreachable.example.invalid/'});res.end();}
  },async request=>assert.equal((await request()).status,502),{timeoutMs:100});
});
test('invalid adapter settings fail before any request',()=>{
  for(const overrides of [{authStyle:'bad'},{authStyle:'api-key',llmKey:''},{maxTokens:0},{timeoutMs:60000},{model:''}]){
    assert.throws(()=>createLlmAdapter({mode:'anthropic-compatible',llmUrl:'http://example.invalid/v1/messages',model:'test',...overrides}));
  }
});
