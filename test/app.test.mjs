import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createWorkbenchServer } from '../src/server.mjs';

const app = await readFile(new URL('../plugin/app.js', import.meta.url), 'utf8');
const contract = await readFile(new URL('../plugin/contract.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../plugin/index.html', import.meta.url), 'utf8');
const token = 'synthetic-port-test-pairing-code';

// Exercise the actual UI handlers without controlling a desktop app or browser.
function panel(url, fetchImpl) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, { value: '', dataset: {}, disabled: false }]));
  const port = elements.get('port');
  port.value = html.match(/id="port"[^>]*value="([^"]+)"/)[1];
  elements.get('token').value = token;
  elements.get('instruction').value = '합성 문장 보완';
  const calls = [], commands = [];
  const context = vm.createContext({
    location: new URL(url), URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout,
    document: { getElementById: id => elements.get(id) },
    fetch: async (url, options) => { calls.push(String(url)); return fetchImpl(url, options); },
    Asc: { scope: {}, plugin: {
      info: { editorType: 'slide' },
      callCommand: (_command, _close, _recalculate, callback) => {
        const action = context.Asc.scope.workbenchPayload.action;
        commands.push(action);
        callback(action === 'apply' ? { applied: true } : { objectId: 'one', slideIndex: 0, text: action === 'inspect' ? '합성 문장\n두 번째 문단' : '합성 문장', readOnly: action === 'inspect' });
      }
    } }
  });
  context.window = context;
  vm.runInContext(contract, context);
  vm.runInContext(app, context);
  context.Asc.plugin.init();
  return { get: id => elements.get(id), calls, commands };
}

async function withServer(run) {
  const server = createWorkbenchServer({ token });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = String(server.address().port);
  try { await run(port); } finally { await new Promise(resolve => server.close(resolve)); }
}

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
