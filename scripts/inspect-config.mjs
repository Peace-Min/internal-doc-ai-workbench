// Dry run: no network, no endpoint/credential/model identifier output.
import { loadLlmConfig } from '../src/config.mjs';
import { createLlmAdapter } from '../src/llm.mjs';
try {
  if (process.argv.length !== 3) throw new Error('Usage: npm run inspect-config -- path-to-config.json');
  const config = await loadLlmConfig({ WB_MODE: 'anthropic-compatible', WB_CLAUDE_CONFIG: process.argv[2] });
  createLlmAdapter(config);
  console.log(JSON.stringify({ valid: true, mode: config.mode, endpointConfigured: Boolean(config.llmUrl), modelConfigured: Boolean(config.model), authStyle: config.authStyle, credentialsConfigured: Boolean(config.llmKey), networkRequestSent: false }, null, 2));
} catch {
  console.error('로컬 설정 검증에 실패했습니다. 경로·JSON·연결 변수·모델 설정을 확인하세요. 설정값은 출력하지 않았습니다.');
  process.exitCode = 1;
}
