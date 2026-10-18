import { loadLlmConfig } from './config.mjs';
import { createLlmAdapter } from './llm.mjs';

// Fixed synthetic input only. No document, path, endpoint, credential or output text in reports.
const input = Object.freeze({operation:'replace_text',text:'연결 확인용 합성 문장입니다.',instruction:'이 문장을 간결한 한국어 한 문장으로 바꾸세요. 한 줄의 일반 텍스트만 반환하세요.'});
const upstreamCodes = new Set(['UPSTREAM_AUTH','UPSTREAM_RATE_LIMIT','UPSTREAM_HTTP','UPSTREAM_RESPONSE_TOO_LARGE','UPSTREAM_INVALID_RESPONSE','UPSTREAM_TIMEOUT','UPSTREAM_CONNECTION']);

export async function diagnoseLlm(env = process.env, overrides = {}) {
  const start = performance.now();
  let config, propose;
  try {
    config = await loadLlmConfig(env);
    if (config.mode === 'mock') return {ok:false,stage:'config',code:'MOCK_MODE',networkRequestAttempted:false};
    propose = createLlmAdapter({...config,timeoutMs:Number(env.WB_PROBE_TIMEOUT_MS || 10000),...(overrides.fetch ? {fetch:overrides.fetch} : {})});
  } catch { return {ok:false,stage:'config',code:'CONFIG_INVALID',networkRequestAttempted:false}; }
  try {
    await propose(input);
    return {ok:true,stage:'response',code:'OK',protocol:config.mode,networkRequestAttempted:true,syntheticInput:true,durationMs:Math.round(performance.now()-start)};
  } catch (error) {
    const code = upstreamCodes.has(error.code) ? error.code : 'UPSTREAM_INVALID_RESPONSE';
    const report = {ok:false,stage:['UPSTREAM_TIMEOUT','UPSTREAM_CONNECTION'].includes(code)?'request':'response',code,protocol:config.mode,networkRequestAttempted:true,syntheticInput:true,durationMs:Math.round(performance.now()-start)};
    if(Number.isInteger(error.httpStatus) && error.httpStatus>=100 && error.httpStatus<=599) report.httpStatus=error.httpStatus;
    return report;
  }
}
