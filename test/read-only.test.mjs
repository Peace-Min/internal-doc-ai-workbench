import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createWorkbenchServer } from '../src/server.mjs';

const token='synthetic-read-only-pairing-token';
const input={text:'합성 원문 첫 문단\n두 번째 문단',instruction:'핵심 조건을 알려 주세요.'};
async function bridge(options,run) {
  const server=createWorkbenchServer({token,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const request=body=>fetch(`http://127.0.0.1:${server.address().port}/api/propose`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try { await run(request); } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
}

test('read-only mock answers are labelled and never become replacement proposals',async()=>{
  await bridge({fetch:()=>{throw new Error('unexpected upstream request');}},async request=>{
    for(const operation of ['ask','summarize']) {
      const response=await request({...input,operation});
      assert.equal(response.status,200);
      const data=await response.json();
      assert.equal(data.operation,operation); assert.match(data.answer,/실제 질의·요약 결과가 아닙니다/);
      assert.equal(data.proposedText,undefined);
    }
    for(const body of [{...input,operation:'execute_code'},{...input,operation:'ask',text:'bad\u0000text'},{...input,operation:'summarize',instruction:''}]) assert.equal((await request(body)).status,400);
  });
});

test('both protocols carry read-only prompts and return multiline answers over real HTTP',async()=>{
  const received=[];
  const answer='첫 번째 핵심 조건\n두 번째 핵심 조건 <script>synthetic-only</script>';
  const gateway=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req) raw+=chunk;
    received.push(JSON.parse(raw));
    res.end(JSON.stringify(req.url==='/messages' ? {type:'message',stop_reason:'end_turn',content:[{type:'text',text:answer}]} : {choices:[{finish_reason:'stop',message:{content:answer}}]}));
  });
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  try {
    for(const mode of ['openai-compatible','anthropic-compatible']) {
      await bridge({mode,model:'synthetic-model',llmKey:'synthetic-upstream-secret',llmUrl:`http://127.0.0.1:${gateway.address().port}/${mode==='anthropic-compatible'?'messages':'chat'}`},async request=>{
        for(const operation of ['ask','summarize']) {
          const response=await request({...input,operation}); assert.equal(response.status,200);
          const data=await response.json(); assert.equal(data.answer,answer); assert.equal(data.operation,operation); assert.equal(data.proposedText,undefined);
          assert.equal(JSON.stringify(data).includes('synthetic-upstream-secret'),false);
          const sent=received.at(-1), prompt=sent.system || sent.messages[0].content;
          assert.match(prompt,/자료에 없는 정보는 확인할 수 없다고/);
          assert.match(prompt,/문서를 변경하는 명령이나 수정안을 만들지/);
          assert.match(prompt,/없는 출처를 만들거나 제외된 내용을 분석했다고 주장하지/);
          if(operation==='summarize') assert.match(prompt,/요약하세요/);
          assert.deepEqual(JSON.parse(sent.messages.at(-1).content),{instruction:input.instruction,document:input.text});
        }
      });
    }
  } finally { gateway.closeAllConnections(); await new Promise(resolve=>gateway.close(resolve)); }
});

test('invalid or truncated read-only answers fail closed for both protocols',async()=>{
  for(const mode of ['openai-compatible','anthropic-compatible']) {
    for(const answer of ['', 'x'.repeat(12001), 'bad\u0000text', null]) {
      const data=mode==='anthropic-compatible' ? {type:'message',stop_reason:'end_turn',content:[{type:'text',text:answer}]} : {choices:[{finish_reason:'stop',message:{content:answer}}]};
      await bridge({mode,model:'synthetic-model',llmUrl:'http://synthetic.example.invalid/api',fetch:async()=>new Response(JSON.stringify(data))},async request=>{
        assert.equal((await request({...input,operation:'ask'})).status,502);
      });
    }
    const data=mode==='anthropic-compatible' ? {type:'message',stop_reason:'max_tokens',content:[{type:'text',text:'일부 답변'}]} : {choices:[{finish_reason:'length',message:{content:'일부 답변'}}]};
    await bridge({mode,model:'synthetic-model',llmUrl:'http://synthetic.example.invalid/api',fetch:async()=>new Response(JSON.stringify(data))},async request=>{
      assert.equal((await request({...input,operation:'summarize'})).status,502);
    });
  }
});
