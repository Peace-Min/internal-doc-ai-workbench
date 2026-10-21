import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createWorkbenchServer } from '../src/server.mjs';

const app = await readFile(new URL('../plugin/app.js', import.meta.url), 'utf8');
const contract = await readFile(new URL('../plugin/contract.js', import.meta.url), 'utf8');
const report = await readFile(new URL('../plugin/report.js', import.meta.url), 'utf8');
const pdf = await readFile(new URL('../plugin/pdf-selection.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../plugin/index.html', import.meta.url), 'utf8');
const token = 'synthetic-port-test-pairing-code';

// Exercise the actual UI handlers without controlling a desktop app or browser.
function panel(url, fetchImpl, documentError = false, options = {}) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, { value: '', dataset: {}, disabled: false }]));
  const port = elements.get('port');
  port.value = html.match(/id="port"[^>]*value="([^"]+)"/)[1];
  elements.get('token').value = token;
  elements.get('instruction').value = '합성 문장 보완';
  const calls = [], commands = [], payloads = [], methods = [];
  const context = vm.createContext({
    location: new URL(url), URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout,
    document: { getElementById: id => elements.get(id) },
    fetch: async (url, options) => { calls.push(String(url)); return fetchImpl(url, options); },
    Asc: { scope: {}, plugin: {
      info: { editorType: options.editorType || 'slide' },
      executeMethod: (method, args, callback) => {
        methods.push(method);
        assert.equal(method,'GetSelectedText');
        assert.equal(args[0].Numbering,false);
        if(options.pdfFailure) throw Error('Synthetic SDK failure');
        callback(Object.hasOwn(options,'pdfText') ? options.pdfText : ' PDF Budget 950\nDelivery 2026. ');
      },
      callCommand: (_command, _close, _recalculate, callback) => {
        if(options.editorType==='pdf') throw Error('PPTX/write command called from PDF');
        const action = context.Asc.scope.workbenchPayload.action;
        commands.push(action);
        payloads.push({...context.Asc.scope.workbenchPayload});
        if(action==='page_capture') {
          const segments=[{id:'s1',text:'원래 제목'},{id:'s2',text:'예산 950만원'}];
          return callback({scope:'slide_edit',slideNumber:1,slideIndex:0,segments,excludedCount:1,emptyCount:0,text:JSON.stringify({slideNumber:1,segments})});
        }
        if(action==='page_apply')return callback({applied:true,changedSegments:2});
        if(action==='inspect_document') return callback(documentError ? {error:'문서 텍스트가 12,000자를 초과합니다.'} : {scope:'document',readOnly:true,slideCount:2,textObjectCount:2,skippedObjectCount:1,emptyObjectCount:0,sources:[{slide:1,object:1,label:'[슬라이드 1 · 개체 1]'}],text:'[슬라이드 1 · 개체 1]\n합성 내용\n\n[슬라이드 2 · 개체 1]\n다른 슬라이드'});
        callback(action === 'apply' ? { applied: true } : { objectId: 'one', slideIndex: 0, text: action === 'inspect' ? '합성 문장\n두 번째 문단' : '합성 문장', readOnly: action === 'inspect' });
      }
    } }
  });
  context.window = context;
  vm.runInContext(contract, context);
  vm.runInContext(report, context);
  vm.runInContext(pdf, context);
  vm.runInContext(app, context);
  context.Asc.plugin.init();
  return { get: id => elements.get(id), calls, commands, payloads, methods };
}

test('PDF selected-text questions use the existing authenticated bridge without edit commands', async () => {
  await withServer(async port => {
    const ui=panel('file:///synthetic/index.html',fetch,false,{editorType:'pdf'});
    assert.equal(ui.get('operation').value,'ask');assert.equal(ui.get('scope').disabled,true);
    assert.equal(ui.get('pdf-note').hidden,false);
    ui.get('port').value=port;await ui.get('connect').onclick();
    await ui.get('capture').onclick();
    assert.equal(ui.get('source').textContent,' PDF Budget 950\nDelivery 2026. ');
    ui.get('instruction').value='예산과 일정을 알려 주세요.';
    await ui.get('request').onsubmit({preventDefault(){}});
    assert.match(ui.get('answer').textContent,/모의/);
    assert.match(ui.get('report').value,/PDF 선택 텍스트, 전체 문서·페이지 범위 미확인/);
    assert.doesNotMatch(ui.get('report').value,/PDF Budget 950/);
    assert.equal(ui.get('review-source').textContent,ui.get('source').textContent);
    ui.get('operation').value='summarize';ui.get('operation').onchange();
    await ui.get('capture').onclick();await ui.get('request').onsubmit({preventDefault(){}});
    assert.match(ui.get('answer').textContent,/모의/);
    assert.equal(ui.get('apply').disabled,true);assert.equal(ui.get('page-apply').disabled,true);
    await ui.get('apply').onclick();await ui.get('page-apply').onclick();
    assert.deepEqual(ui.methods,['GetSelectedText','GetSelectedText']);assert.deepEqual(ui.commands,[]);
  });
});

test('PDF rejects empty, nontext, NUL, overlong and failed SDK selections without sending partial input', async () => {
  for(const options of [{pdfText:''},{pdfText:'   '},{pdfText:null},{pdfText:'x\0y'},{pdfText:'x'.repeat(12001)},{pdfFailure:true}]) {
    const ui=panel('file:///synthetic/index.html',()=>{throw Error('No network expected')},false,{editorType:'pdf',...options});
    await ui.get('capture').onclick();
    assert.equal(ui.get('send').disabled,true);assert.equal(ui.get('status').dataset.error,'true');
    assert.deepEqual(ui.calls,[]);assert.deepEqual(ui.commands,[]);
  }
});

test('PDF forged edit operations or document scopes cannot reach editor writes or the bridge', async () => {
  const ui=panel('file:///synthetic/index.html',async()=>new Response(JSON.stringify({mode:'mock'})),false,{editorType:'pdf'});
  await ui.get('connect').onclick();await ui.get('capture').onclick();
  for(const operation of ['replace_text','rewrite_slide']) {
    ui.get('operation').value=operation;
    await ui.get('request').onsubmit({preventDefault(){}});
    await ui.get('apply').onclick();await ui.get('page-apply').onclick();await ui.get('capture').onclick();
  }
  ui.get('operation').value='ask';ui.get('scope').value='document';await ui.get('capture').onclick();
  assert.deepEqual(ui.calls,['http://127.0.0.1:4318/api/health']);
  assert.deepEqual(ui.methods,['GetSelectedText']);assert.deepEqual(ui.commands,[]);
});

test('review retains captured source across mode changes and clears it with history', async () => {
  const ui = panel('file:///synthetic/index.html', async url => new Response(JSON.stringify(String(url).endsWith('/api/health') ? {mode:'mock'} : {operation:'summarize',answer:'조건 [슬라이드 1 · 개체 1] / 범위 밖 [슬라이드 99 · 개체 1]\n<script>bad()</script>',mode:'mock'})));
  await ui.get('connect').onclick();
  ui.get('operation').value='summarize'; ui.get('operation').onchange();
  ui.get('scope').value='document';ui.get('scope').onchange();await ui.get('capture').onclick();
  const source=ui.get('source').textContent;
  await ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(ui.get('review-source').textContent,source);
  assert.match(ui.get('review-check').textContent,/읽은 출처에 있음 1개 · 읽은 출처에 없음 1개/);
  assert.match(ui.get('review-answer').textContent,/<script>bad\(\)<\/script>/);
  assert.doesNotMatch(ui.get('report').value,/합성 내용|다른 슬라이드/);
  assert.match(ui.get('report').value,/미확인 출처: \[슬라이드 99 · 개체 1\]/);
  ui.get('operation').value='ask';ui.get('operation').onchange();
  ui.get('scope').value='selected';ui.get('scope').onchange();
  await ui.get('capture').onclick();
  assert.equal(ui.get('review-source').textContent,source);
  for(const value of ['0','2','1e0','']){
    ui.get('review-number').value=value;ui.get('review-open').onclick();
    assert.equal(ui.get('review-section').hidden,true);assert.equal(ui.get('review-source').textContent,'');
  }
  ui.get('review-number').value='1';ui.get('review-open').onclick();
  assert.equal(ui.get('review-source').textContent,source);
  assert.deepEqual(ui.commands,['inspect_document','inspect']);
  ui.get('clear-history').onclick();
  assert.equal(ui.get('review-section').hidden,true);assert.equal(ui.get('review-source').textContent,'');
  assert.equal(ui.get('review-answer').textContent,'');assert.equal(ui.get('review-open').disabled,true);
});

async function withServer(run) {
  const server = createWorkbenchServer({ token });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = String(server.address().port);
  try { await run(port); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('whole-slide UI requests one plan, previews all changes and applies only after review',async()=>{
  await withServer(async port=>{
    const ui=panel('file:///synthetic/index.html',fetch);ui.get('port').value=port;
    await ui.get('connect').onclick();
    ui.get('operation').value='rewrite_slide';ui.get('operation').onchange();
    assert.equal(ui.get('scope').value,'slide_edit');assert.equal(ui.get('capture').textContent,'페이지 읽기');
    await ui.get('capture').onclick();assert.match(ui.get('source').textContent,/원래 제목/);assert.match(ui.get('source').textContent,/950/);
    ui.get('instruction').value='페이지 전체를 간결하게 보완';await ui.get('request').onsubmit({preventDefault(){}});
    assert.equal(ui.get('page-proposal-section').hidden,false);assert.match(ui.get('page-diff').textContent,/변경 전: 원래 제목/);assert.match(ui.get('page-diff').textContent,/변경 후: \[모의 수정안\]/);
    assert.equal(ui.get('page-apply').disabled,false);assert.deepEqual(ui.commands,['page_capture']);
    await ui.get('page-apply').onclick();assert.deepEqual(ui.commands,['page_capture','page_apply']);
    assert.equal(ui.get('page-proposal-section').hidden,true);assert.equal(ui.get('send').disabled,true);
    assert.equal(ui.get('report').value,'');
  });
});

test('invalid page plan cannot enable apply and a changed page number clears the proposal',async()=>{
  let bad=false;
  const ui=panel('file:///synthetic/index.html',async url=>new Response(JSON.stringify(String(url).endsWith('/api/health')?{mode:'mock'}:{operation:'rewrite_slide',mode:'mock',plan:{edits:[{id:'s1',text:'새 제목'},{id:bad?'s1':'s2',text:'예산 950 새 본문'}]}})));
  await ui.get('connect').onclick();ui.get('operation').value='rewrite_slide';ui.get('operation').onchange();await ui.get('capture').onclick();ui.get('instruction').value='페이지 수정';
  await ui.get('request').onsubmit({preventDefault(){}});assert.equal(ui.get('page-apply').disabled,false);
  ui.get('page-number').value='2';ui.get('page-number').oninput();assert.equal(ui.get('page-apply').disabled,true);
  await ui.get('page-apply').onclick();assert.deepEqual(ui.commands,['page_capture']);
  await ui.get('capture').onclick();bad=true;await ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(ui.get('page-apply').disabled,true);assert.equal(ui.get('page-proposal-section').hidden,true);
});

test('installed panel defaults to 4318 and rejects invalid ports before sending credentials', async () => {
  const ui = panel('file:///synthetic/index.html', () => { throw new Error('unexpected network'); });
  assert.equal(ui.get('port').value, '4318');
  for (const port of ['', '0', '65536', '-1', '1.5', '1e3', '4318/path', '4318@external.example.invalid']) {
    ui.get('port').value = port;
    await ui.get('connect').onclick();
    assert.match(ui.get('status').textContent, /1~65535/);
    assert.equal(ui.get('status').dataset.error, 'true');
    assert.equal(ui.get('port').disabled, false);
  }
  assert.deepEqual(ui.calls, []);
  for (const port of ['1', '65535']) {
    const valid = panel('file:///synthetic/index.html', async () => new Response(JSON.stringify({ mode: 'mock' })));
    valid.get('port').value = port;
    await valid.get('connect').onclick();
    assert.equal(valid.calls[0], `http://127.0.0.1:${port}/api/health`);
    assert.equal(valid.get('status').dataset.error, 'false');
  }
});

test('panel connects and proposes on a custom loopback port; edits require reconnection', async () => {
  await withServer(async port => {
    const ui = panel('file:///synthetic/index.html', fetch);
    ui.get('port').value = port;
    await ui.get('connect').onclick();
    assert.match(ui.get('status').textContent, /모의 AI 연결 완료/);
    await ui.get('capture').onclick();
    assert.equal(ui.get('send').disabled, false);
    await ui.get('request').onsubmit({ preventDefault() {} });
    assert.equal(ui.get('proposal').value, '[모의 수정안] 합성 문장');
    assert.deepEqual(ui.calls, [`http://127.0.0.1:${port}/api/health`, `http://127.0.0.1:${port}/api/propose`]);
    ui.get('port').oninput();
    assert.equal(ui.get('send').disabled, true);
    await ui.get('request').onsubmit({ preventDefault() {} });
    assert.equal(ui.calls.length, 2);
    await ui.get('connect').onclick();
    assert.equal(ui.get('send').disabled, false);
    ui.get('token').oninput();
    assert.equal(ui.get('send').disabled, true);
  });
});

test('browser-hosted panel uses its current local HTTP port', async () => {
  await withServer(async port => {
    for (const hostname of ['127.0.0.1', 'localhost']) {
      const ui = panel(`http://${hostname}:${port}/`, fetch);
      assert.equal(ui.get('port').value, port);
      await ui.get('connect').onclick();
      assert.equal(ui.calls[0], `http://127.0.0.1:${port}/api/health`);
      assert.equal(ui.get('status').dataset.error, 'false');
    }
  });
  const ui = panel('http://external.example.invalid:9999/', () => { throw new Error('unexpected network'); });
  assert.equal(ui.get('port').value, '4318');
});

test('connection locks port and token and prevents duplicate health requests', async () => {
  let finish;
  const ui = panel('file:///synthetic/index.html', () => new Promise(resolve => { finish = resolve; }));
  const connecting = ui.get('connect').onclick();
  assert.equal(ui.get('port').disabled, true);
  assert.equal(ui.get('token').disabled, true);
  assert.equal(ui.get('cancel').hidden, true);
  await ui.get('connect').onclick();
  assert.equal(ui.calls.length, 1);
  finish(new Response(JSON.stringify({ mode: 'mock' })));
  await connecting;
  assert.equal(ui.get('port').disabled, false);
  assert.equal(ui.get('token').disabled, false);
});

test('questions and summaries display answers without enabling or invoking document writes', async () => {
  await withServer(async port => {
    const ui=panel('file:///synthetic/index.html',fetch);
    ui.get('port').value=port; await ui.get('connect').onclick();
    for (const operation of ['ask','summarize']) {
      ui.get('operation').value=operation; ui.get('operation').onchange();
      assert.equal(ui.get('send').disabled,true);
      await ui.get('capture').onclick();
      if(operation==='ask') ui.get('instruction').value='핵심 조건이 무엇인가요?';
      await ui.get('request').onsubmit({preventDefault(){}});
      assert.equal(ui.get('answer-section').hidden,false);
      assert.match(ui.get('answer').textContent,/모의 답변/);
      assert.equal(ui.get('proposal-section').hidden,true);
      assert.equal(ui.get('apply').disabled,true);
      await ui.get('apply').onclick();
    }
    assert.deepEqual(ui.commands,['inspect','inspect']);
    ui.get('operation').value='replace_text'; ui.get('operation').onchange();
    assert.equal(ui.get('answer-section').hidden,true);
    assert.equal(ui.get('send').disabled,true);
    await ui.get('capture').onclick(); ui.get('instruction').value='보완';
    await ui.get('request').onsubmit({preventDefault(){}});
    assert.equal(ui.get('apply').disabled,false);
    await ui.get('apply').onclick();
    assert.deepEqual(ui.commands,['inspect','inspect','capture','apply']);
  });
});

test('mismatched response operations cannot become applicable edits', async () => {
  const ui=panel('file:///synthetic/index.html',async url=>new Response(JSON.stringify(String(url).endsWith('/api/health') ? {mode:'mock'} : {operation:'ask',answer:'다른 응답',proposedText:'잘못된 수정안'})));
  await ui.get('connect').onclick(); await ui.get('capture').onclick();
  await ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(ui.get('proposal-section').hidden,true);
  assert.equal(ui.get('apply').disabled,true);
  assert.match(ui.get('status').textContent,/요청과 다릅니다/);
  await ui.get('apply').onclick();
  assert.deepEqual(ui.commands,['capture']);
});

test('document scope sends labelled text, shows exclusions and resets scope before editing',async()=>{
  let sent;
  await withServer(async port=>{
    const ui=panel('file:///synthetic/index.html',async(url,options)=>{
      if(options.body)sent=JSON.parse(options.body);
      return fetch(url,options);
    });
    ui.get('port').value=port;await ui.get('connect').onclick();
    assert.equal(ui.get('scope').disabled,true);
    ui.get('operation').value='summarize';ui.get('operation').onchange();
    assert.equal(ui.get('scope').disabled,false);
    ui.get('scope').value='document';ui.get('scope').onchange();
    await ui.get('capture').onclick();
    assert.match(ui.get('target').textContent,/2슬라이드/);
    assert.match(ui.get('coverage').textContent,/제외 개체 1개/);
    await ui.get('request').onsubmit({preventDefault(){}});
    assert.match(sent.text,/슬라이드 1/);assert.match(sent.text,/슬라이드 2/);
    assert.equal(ui.get('answer-section').hidden,false);assert.equal(ui.get('apply').disabled,true);
    await ui.get('apply').onclick();assert.deepEqual(ui.commands,['inspect_document']);
    ui.get('operation').value='replace_text';ui.get('operation').onchange();
    assert.equal(ui.get('scope').value,'selected');assert.equal(ui.get('scope').disabled,true);
    assert.equal(ui.get('send').disabled,true);assert.equal(ui.get('answer-section').hidden,true);
    assert.equal(ui.get('coverage').textContent,'');
  });
});

test('failed document capture clears previous source and cannot send partial content',async()=>{
  let calls=0;
  const ui=panel('file:///synthetic/index.html',async()=>{calls++;return new Response(JSON.stringify({mode:'mock'}));},true);
  await ui.get('connect').onclick();await ui.get('capture').onclick();
  ui.get('operation').value='ask';ui.get('operation').onchange();
  ui.get('scope').value='document';ui.get('scope').onchange();
  await ui.get('capture').onclick();
  assert.match(ui.get('status').textContent,/12,000자/);
  assert.equal(ui.get('target').textContent,'읽은 내용이 없습니다.');
  assert.equal(ui.get('send').disabled,true);
  await ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(calls,1);
});

test('range inputs are passed to the editor and invalidate captured data and answers',async()=>{
  await withServer(async port=>{
    const ui=panel('file:///synthetic/index.html',fetch);
    ui.get('port').value=port;await ui.get('connect').onclick();
    ui.get('operation').value='summarize';ui.get('operation').onchange();
    ui.get('scope').value='document';ui.get('scope').onchange();
    assert.equal(ui.get('slide-range').hidden,false);
    ui.get('slide-start').value='2';ui.get('slide-end').value='2';ui.get('slide-start').oninput();
    await ui.get('capture').onclick();
    assert.equal(ui.payloads.at(-1).startSlide,2);assert.equal(ui.payloads.at(-1).endSlide,2);
    await ui.get('request').onsubmit({preventDefault(){}});
    assert.equal(ui.get('answer-section').hidden,false);
    ui.get('slide-end').value='3';ui.get('slide-end').oninput();
    assert.equal(ui.get('answer-section').hidden,true);assert.equal(ui.get('send').disabled,true);
    const count=ui.commands.length;ui.get('slide-start').value='1.5';
    await ui.get('capture').onclick();assert.equal(ui.commands.length,count);
    assert.match(ui.get('status').textContent,/정수/);
  });
});

test('range fields lock while a model request is pending',async()=>{
  let finish;
  const ui=panel('file:///synthetic/index.html',async url=>String(url).endsWith('/api/health')?new Response(JSON.stringify({mode:'mock'})):new Promise(resolve=>{finish=resolve;}));
  await ui.get('connect').onclick();ui.get('operation').value='summarize';ui.get('operation').onchange();
  ui.get('scope').value='document';ui.get('scope').onchange();await ui.get('capture').onclick();
  const sending=ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(ui.get('slide-start').disabled,true);assert.equal(ui.get('slide-end').disabled,true);
  finish(new Response(JSON.stringify({operation:'summarize',answer:'모의 구간 답변',mode:'mock'})));await sending;
  assert.equal(ui.get('slide-start').disabled,false);assert.equal(ui.get('slide-end').disabled,false);
});

test('history survives scope and mode changes, keeps effective prompts and excludes source text and credentials', async () => {
  await withServer(async port => {
    const ui = panel('file:///synthetic/index.html', fetch);
    ui.get('port').value = port; await ui.get('connect').onclick();
    ui.get('operation').value = 'summarize'; ui.get('operation').onchange();
    ui.get('scope').value = 'document'; ui.get('scope').onchange();
    await ui.get('capture').onclick();
    await ui.get('request').onsubmit({ preventDefault() {} });
    const first = ui.get('report').value;
    assert.match(first, /핵심 사실과 조건을 간결하게 요약/);
    assert.match(first, /출처: \[슬라이드 1 · 개체 1\]/);
    assert.match(first, /제외 개체 1개/);
    assert.match(first, /모의 답변, 실제 분석 아님/);
    assert.doesNotMatch(first, /다른 슬라이드|합성 내용|synthetic-port-test-pairing-code|127\.0\.0\.1/);
    ui.get('operation').value = 'ask'; ui.get('operation').onchange();
    ui.get('scope').value = 'selected'; ui.get('scope').onchange();
    assert.equal(ui.get('report').value, first);
    await ui.get('capture').onclick(); ui.get('instruction').value = '두 번째 질문';
    await ui.get('request').onsubmit({ preventDefault() {} });
    assert.match(ui.get('report').value, /결과 2/);
    assert.match(ui.get('report').value, /두 번째 질문/);
    assert.ok(ui.get('report').value.includes(first));
    assert.deepEqual(ui.commands, ['inspect_document', 'inspect']);
    ui.get('clear-history').onclick();
    assert.equal(ui.get('report').value, '');
    assert.equal(ui.get('history-section').hidden, true);
    assert.equal(ui.get('export-report').disabled, true);
  });
});

test('twenty records stop read-only requests without dropping results and clearing allows continuation', async () => {
  let requests = 0;
  const ui = panel('file:///synthetic/index.html', async url => {
    const health = String(url).endsWith('/api/health');
    if (!health) requests++;
    return new Response(JSON.stringify(health ? { mode: 'mock' } : { operation: 'summarize', answer: '합성 답변', mode: 'mock' }));
  });
  await ui.get('connect').onclick();
  ui.get('operation').value = 'summarize'; ui.get('operation').onchange();
  await ui.get('capture').onclick();
  for (let i = 0; i < 20; i++) await ui.get('request').onsubmit({ preventDefault() {} });
  assert.equal(ui.get('send').disabled, true);
  const report = ui.get('report').value;
  assert.match(report, /결과 20/);
  await ui.get('request').onsubmit({ preventDefault() {} });
  assert.equal(requests, 20);
  assert.equal(ui.get('report').value, report);
  assert.match(ui.get('status').textContent, /20건/);
  ui.get('clear-history').onclick();
  assert.equal(ui.get('send').disabled, false);
  await ui.get('request').onsubmit({ preventDefault() {} });
  assert.equal(requests, 21);
  assert.match(ui.get('history-count').textContent, /^1 \/ 20/);
});

test('pending requests preserve submitted instruction and lock history deletion', async () => {
  let finish;
  const ui = panel('file:///synthetic/index.html', async url => String(url).endsWith('/api/health') ? new Response(JSON.stringify({mode:'mock'})) : new Promise(resolve => { finish = resolve; }));
  await ui.get('connect').onclick();
  ui.get('operation').value = 'ask'; ui.get('operation').onchange();
  await ui.get('capture').onclick(); ui.get('instruction').value = '送信時の質問';
  const sending = ui.get('request').onsubmit({preventDefault(){}});
  assert.equal(ui.get('clear-history').disabled, true);
  assert.equal(ui.get('export-report').disabled, true);
  ui.get('clear-history').onclick(); ui.get('instruction').value = '変更後の質問';
  finish(new Response(JSON.stringify({operation:'ask', answer:'<script>example</script>\n=1+1', mode:'mock'})));
  await sending;
  assert.match(ui.get('report').value, /送信時の質問/);
  assert.doesNotMatch(ui.get('report').value, /変更後の質問/);
  assert.match(ui.get('report').value, /<script>example<\/script>\n=1\+1/);
});

test('invalid, failed and mismatched answers never enter analysis history; unsupported download offers copying', async () => {
  let response;
  const ui = panel('file:///synthetic/index.html', async url => {
    if (String(url).endsWith('/api/health')) return new Response(JSON.stringify({mode:'mock'}));
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response));
  });
  await ui.get('connect').onclick();
  ui.get('operation').value = 'ask'; ui.get('operation').onchange();
  await ui.get('capture').onclick(); ui.get('instruction').value = '질문';
  for (response of [{operation:'ask',answer:''}, {operation:'summarize',answer:'잘못된 작업'}, new Error('합성 네트워크 오류'), Object.assign(new Error('취소'),{name:'AbortError'})]) {
    await ui.get('request').onsubmit({preventDefault(){}});
    assert.equal(ui.get('report').value, '');
  }
  response = {operation:'ask',answer:'유효 답변',mode:'mock'};
  await ui.get('request').onsubmit({preventDefault(){}});
  const saved = ui.get('report').value;
  ui.get('export-report').onclick();
  assert.match(ui.get('status').textContent, /직접 복사/);
  assert.equal(ui.get('report').value, saved);
});
