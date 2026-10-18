import { readFile } from 'node:fs/promises';
import { anthropicMessagesUrl } from './llm.mjs';

const names = new Set(['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']);

export function parseClaudeConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Claude 설정 형식을 확인하세요.');
  const entries = config['claudeCode.environmentVariables'] ?? config.claudeCode?.environmentVariables;
  const output = {};
  if (entries !== undefined) {
    if (!Array.isArray(entries)) throw new Error('Claude 환경 변수 배열을 확인하세요.');
    for (const entry of entries) {
      if (!entry || !names.has(entry.name)) continue;
      if (Object.hasOwn(output, entry.name) || typeof entry.value !== 'string') throw new Error('Claude 연결 변수의 중복 또는 형식을 확인하세요.');
      output[entry.name] = entry.value;
    }
  } else if (config.env && typeof config.env === 'object' && !Array.isArray(config.env)) {
    for (const name of names) {
      if (config.env[name] !== undefined) {
        if (typeof config.env[name] !== 'string') throw new Error('Claude 연결 변수 형식을 확인하세요.');
        output[name] = config.env[name];
      }
    }
  } else throw new Error('지원하는 Claude 환경 변수 설정이 없습니다.');
  return output;
}

export async function loadLlmConfig(env = process.env) {
  const mode = env.WB_MODE || 'mock';
  if (mode === 'mock') return { mode };
  let fileEnv = {};
  if (env.WB_CLAUDE_CONFIG) {
    if (mode !== 'anthropic-compatible') throw new Error('Claude 설정 파일은 anthropic-compatible 모드에서 사용하세요.');
    try { fileEnv = parseClaudeConfig(JSON.parse((await readFile(env.WB_CLAUDE_CONFIG, 'utf8')).replace(/^\uFEFF/, ''))); }
    catch { throw new Error('로컬 Claude 설정 파일을 읽을 수 없습니다. 경로와 JSON 형식을 확인하세요.'); }
  }
  const connection = { ...fileEnv };
  for (const name of names) if (env[name] !== undefined) connection[name] = env[name];
  const tier = env.WB_CLAUDE_MODEL_TIER || 'sonnet';
  if (!['sonnet', 'opus', 'haiku'].includes(tier)) throw new Error('WB_CLAUDE_MODEL_TIER를 확인하세요.');
  const model = env.WB_LLM_MODEL || connection.ANTHROPIC_MODEL || connection[`ANTHROPIC_DEFAULT_${tier.toUpperCase()}_MODEL`];
  const llmKey = env.WB_LLM_KEY || connection.ANTHROPIC_AUTH_TOKEN || connection.ANTHROPIC_API_KEY;
  const authStyle = env.WB_LLM_AUTH || (env.WB_LLM_KEY || connection.ANTHROPIC_AUTH_TOKEN ? 'bearer' : connection.ANTHROPIC_API_KEY ? 'api-key' : 'none');
  const llmUrl = env.WB_LLM_URL || (mode === 'anthropic-compatible' ? anthropicMessagesUrl(connection.ANTHROPIC_BASE_URL) : undefined);
  return { mode, llmUrl, model, llmKey, authStyle, maxTokens: Number(env.WB_LLM_MAX_TOKENS || 2048) };
}
