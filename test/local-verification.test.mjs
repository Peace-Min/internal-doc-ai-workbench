import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {verifyLocalLlm} from '../src/local-verification.mjs';

test('local verification refuses mock, external destinations and credential URLs before requests',async()=>{
  for(const env of [{},{WB_MODE:'openai-compatible',WB_LLM_URL:'https://external.example.invalid/v1/chat/completions',WB_LLM_MODEL:'synthetic'},{WB_MODE:'openai-compatible',WB_LLM_URL:'http://user:secret@127.0.0.1:9/v1/chat/completions',WB_LLM_MODEL:'synthetic'}]){
    const report=await verifyLocalLlm(env);assert.equal(report.code,'LOCAL_CONFIG_INVALID');assert.equal(report.networkRequestAttempted,false);
  }
});

test('local verification exercises all operations through authenticated bridge and hides outputs',async()=>{
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;requests.push(JSON.parse(raw));
    res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'950 [슬라이드 1 · 개체 1] synthetic-private-output'}}]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const report=await verifyLocalLlm({WB_MODE:'openai-compatible',WB_LLM_URL:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,WB_LLM_MODEL:'synthetic-private-model'});
    assert.equal(report.ok,true);assert.equal(requests.length,3);assert.equal(report.results.length,3);
    assert.equal(report.results[0].observations.mentionsBudget,true);assert.equal(report.results[0].observations.knownCitationCount,1);
    assert.doesNotMatch(JSON.stringify(report),/synthetic-private|127\.0\.0\.1/);
    assert.equal(report.qualityCertified,false);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
