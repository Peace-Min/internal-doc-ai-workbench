import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { parseClaudeConfig, loadLlmConfig } from '../src/config.mjs';
import { anthropicMessagesUrl } from '../src/llm.mjs';

const synthetic = { ANTHROPIC_BASE_URL: 'http://gateway.example.invalid/anthropic', ANTHROPIC_AUTH_TOKEN: 'synthetic-secret', ANTHROPIC_DEFAULT_SONNET_MODEL: 'synthetic-sonnet', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'synthetic-haiku' };
const vscode = values => ({ 'claudeCode.environmentVariables': Object.entries(values).map(([name,value])=>({name,value})) });
async function withConfig(data, run) {
  const root = fileURLToPath(new URL('../private/', import.meta.url));
  await mkdir(root, {recursive:true});
  const dir = await mkdtemp(path.join(root, 'config-test-'));
  const file = path.join(dir, 'config.json');
  try { await writeFile(file, JSON.stringify(data)); await run(file); }
  finally { await unlink(file); await rmdir(dir); }
}
test('reads only allowed connection variables from VS Code config', () => {
  const parsed = parseClaudeConfig(vscode({...synthetic, DISABLE_TELEMETRY:'1',DANGEROUS_COMMAND:'do-not-run'}));
  assert.deepEqual(parsed, synthetic);
});
test('supports Claude env object and rejects duplicate/invalid connection values', () => {
  assert.deepEqual(parseClaudeConfig({env:synthetic}), synthetic);
  assert.throws(()=>parseClaudeConfig(vscode({ANTHROPIC_AUTH_TOKEN:12})));
  assert.throws(()=>parseClaudeConfig({'claudeCode.environmentVariables':[{name:'ANTHROPIC_BASE_URL',value:'one'},{name:'ANTHROPIC_BASE_URL',value:'two'}]}));
  assert.throws(()=>parseClaudeConfig([]));
});
test('Anthropic base URL preserves gateway prefix without duplicating v1/messages', () => {
  for(const [base,expected] of [
    ['http://example.invalid','http://example.invalid/v1/messages'],
    ['http://example.invalid/proxy/','http://example.invalid/proxy/v1/messages'],
    ['http://example.invalid/proxy/v1/','http://example.invalid/proxy/v1/messages'],
    ['http://example.invalid/proxy/v1/messages','http://example.invalid/proxy/v1/messages']
  ]) assert.equal(anthropicMessagesUrl(base),expected);
  for(const url of ['file:///secret','http://user:secret@example.invalid','http://example.invalid?token=secret','bad-secret-url']) assert.throws(()=>anthropicMessagesUrl(url), error=>!error.message.includes('secret'));
});
test('mock mode never reads a configured credential file', async () => {
  assert.deepEqual(await loadLlmConfig({WB_CLAUDE_CONFIG:'missing-private-config'}),{mode:'mock'});
});
test('config file maps bearer token, selected model tier and messages route', async () => {
  await withConfig(vscode(synthetic), async file => {
    const config = await loadLlmConfig({WB_MODE:'anthropic-compatible',WB_CLAUDE_CONFIG:file,WB_CLAUDE_MODEL_TIER:'haiku'});
    assert.equal(config.llmUrl,'http://gateway.example.invalid/anthropic/v1/messages');
    assert.equal(config.model,'synthetic-haiku'); assert.equal(config.llmKey,'synthetic-secret'); assert.equal(config.authStyle,'bearer');
  });
});
test('explicit local environment overrides imported values; API key fallback is distinct', async () => {
  await withConfig({env:synthetic}, async file => {
    const config=await loadLlmConfig({WB_MODE:'anthropic-compatible',WB_CLAUDE_CONFIG:file,WB_LLM_URL:'http://override.example.invalid/v1/messages',WB_LLM_MODEL:'override-model',WB_LLM_KEY:'override-key',WB_LLM_AUTH:'api-key'});
    assert.equal(config.model,'override-model'); assert.equal(config.llmKey,'override-key'); assert.equal(config.authStyle,'api-key');
    assert.equal(config.llmUrl,'http://override.example.invalid/v1/messages');
  });
  const config=await loadLlmConfig({WB_MODE:'anthropic-compatible',ANTHROPIC_BASE_URL:'http://example.invalid',ANTHROPIC_MODEL:'test',ANTHROPIC_API_KEY:'synthetic-key'});
  assert.equal(config.authStyle,'api-key');
});
test('dry-run validates real file reading without printing any values or making requests', async () => {
  await withConfig(vscode(synthetic),async file=>{
    const result=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../scripts/inspect-config.mjs',import.meta.url)),file]);
    const report=JSON.parse(result.stdout);
    assert.equal(report.valid,true); assert.equal(report.networkRequestSent,false);
    for(const value of Object.values(synthetic)) assert.equal((result.stdout+result.stderr).includes(value),false);
  });
});
