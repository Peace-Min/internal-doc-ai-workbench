import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadLlmConfig } from '../src/config.mjs';
import { createLlmAdapter } from '../src/llm.mjs';
import { diagnoseLlm } from '../src/diagnostics.mjs';

test('both protocols send default and configured output token limits over real HTTP', async () => {
  const received = [];
  const gateway = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    received.push({ path: req.url, body: JSON.parse(raw) });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/v1/messages'
      ? { type: 'message', stop_reason: 'end_turn', content: [{ type: 'text', text: '합성 수정안' }] }
      : { choices: [{ finish_reason: 'stop', message: { content: '합성 수정안' } }] }));
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  try {
    for (const mode of ['openai-compatible', 'anthropic-compatible']) {
      for (const limit of [undefined, '1', '257', '8192']) {
        const path = mode === 'openai-compatible' ? '/v1/chat/completions' : '/v1/messages';
        const env = { WB_MODE: mode, WB_LLM_URL: `http://127.0.0.1:${gateway.address().port}${path}`, WB_LLM_MODEL: 'synthetic-model' };
        if (limit !== undefined) env.WB_LLM_MAX_TOKENS = limit;
        const propose = createLlmAdapter(await loadLlmConfig(env));
        assert.equal(await propose({ text: '합성 원문', instruction: '간결하게 보완' }), '합성 수정안');
        const request = received.at(-1);
        assert.equal(request.path, path);
        assert.equal(request.body.max_tokens, limit === undefined ? 2048 : Number(limit), `${mode}: ${limit}`);
        assert.equal(request.body.stream, false);
      }
    }
    assert.equal(received.length, 8);
  } finally {
    gateway.closeAllConnections();
    await new Promise(resolve => gateway.close(resolve));
  }
});

test('invalid output token limits fail diagnostics before any network request in either protocol', async () => {
  for (const mode of ['openai-compatible', 'anthropic-compatible']) {
    for (const limit of ['0', '-1', '8193', '1.5', 'invalid']) {
      let called = false;
      const report = await diagnoseLlm({ WB_MODE: mode, WB_LLM_URL: 'http://synthetic.example.invalid/api', WB_LLM_MODEL: 'synthetic-model', WB_LLM_MAX_TOKENS: limit }, {
        fetch: () => { called = true; throw new Error('unexpected network'); }
      });
      assert.equal(report.code, 'CONFIG_INVALID');
      assert.equal(report.networkRequestAttempted, false);
      assert.equal(called, false);
    }
  }
});
