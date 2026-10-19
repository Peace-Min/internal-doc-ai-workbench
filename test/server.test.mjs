import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createWorkbenchServer } from '../src/server.mjs';
const token = 'synthetic-test-pairing-token-only';
async function withServer(options, run) {
  const server = createWorkbenchServer({ token, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, headers = {}) => fetch(url + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try { await run(request, url); } finally { await new Promise(resolve => server.close(resolve)); }
}
const input = { operation: 'replace_text', text: '합성 문장', instruction: '보고용 문장으로 보완' };
test('mock works without calling any upstream and returns a labelled proposal', async () => {
  await withServer({ fetch: () => { throw new Error('network forbidden'); } }, async request => {
    assert.equal((await request('/api/health')).status, 200);
    const data = await (await request('/api/propose', input)).json();
    assert.equal(data.mode, 'mock'); assert.equal(data.proposedText, '[모의 수정안] 합성 문장');
  });
});
test('reject missing auth, foreign origin and forged host', async () => {
  await withServer({}, async (request, url) => {
    assert.equal((await request('/api/health', null, { Authorization: '' })).status, 401);
    assert.equal((await request('/api/propose', input, { Origin: 'https://untrusted.example.invalid' })).status, 403);
    // Node fetch rewrites Host: use raw HTTP to exercise DNS-rebinding protection.
    const status = await new Promise((resolve, reject) => {
      const req = http.get(url + '/api/health', {headers: {Host:'untrusted.example.invalid',Authorization:`Bearer ${token}`}}, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(status, 403);
  });
});
test('desktop file:// and null origin preflight and authenticated requests', async () => {
  await withServer({}, async (request, url) => {
    for (const origin of ['file://', 'null']) {
      const preflight = await fetch(url + '/api/propose', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Headers': 'authorization,content-type' } });
      assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.equal((await request('/api/propose', input, { Origin: origin })).status, 200);
      assert.equal((await request('/api/propose', input, { Origin: origin, Authorization: '' })).status, 401);
    }
  });
});
test('reject malformed, oversized and unsupported commands', async () => {
  await withServer({}, async (request, url) => {
    for (const body of [{...input, instruction: ''}, {...input, operation: 'execute_code'}, {...input, text: 'x'.repeat(12001)}]) assert.equal((await request('/api/propose', body)).status, 400);
    assert.equal((await request('/api/propose', {...input, text: 'x'.repeat(70000)})).status, 413);
    const bad = await fetch(url + '/api/propose', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(bad.status, 400);
    assert.equal((await request('/api/propose', input, {'Content-Type': 'text/plain'})).status, 415);
  });
});
test('OpenAI adapter sends only validated text/instruction; key stays upstream', async () => {
  let sent;
  await withServer({ mode: 'openai-compatible', llmUrl: 'http://llm.example.invalid/v1/chat/completions', model: 'synthetic-model', llmKey: 'synthetic-upstream-key', fetch: async (url, options) => {
    sent = options; return new Response(JSON.stringify({choices: [{message: {content: '보완된 합성 문장'}}]}));
  } }, async request => {
    const data = await (await request('/api/propose', {...input, injectedTarget: 'ignored'})).json();
    assert.equal(data.proposedText, '보완된 합성 문장'); assert.equal(JSON.stringify(data).includes('synthetic-upstream-key'), false);
    const body = JSON.parse(sent.body); assert.equal(body.model, 'synthetic-model');
    assert.equal(body.max_tokens, 2048);
    assert.deepEqual(JSON.parse(body.messages[1].content), {instruction: input.instruction, document: input.text});
    assert.equal(sent.redirect, 'error');
  });
});
test('upstream errors and malformed/empty/multiline proposals never become successful edits', async () => {
  for (const response of [new Response('secret-error', {status: 500}), new Response('{}'), new Response(JSON.stringify({choices:[{message:{content:'line1\nline2'}}]})), new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'중간에 끊긴 합성 문장'}}]}))]) {
    await withServer({mode:'openai-compatible',llmUrl:'http://llm.example.invalid/v1/chat/completions',model:'test',fetch:async()=>response}, async request => {
      const result = await request('/api/propose', input); assert.ok(result.status >= 400);
      assert.equal((await result.text()).includes('secret-error'), false);
    });
  }
});
test('static allowlist cannot expose env, runtime token or source server', async () => {
  await withServer({}, async request => {
    for (const name of ['/.env','/private/runtime.json','/src/server.mjs']) assert.equal((await request(name)).status, 404);
    assert.equal((await request('/?demo=1')).status, 200);
    assert.equal((await request('/vendor/plugins.js')).status, 200);
    assert.equal((await request('/notices.html')).status, 200);
    assert.equal((await request('/LICENSE')).status, 200);
  });
});
