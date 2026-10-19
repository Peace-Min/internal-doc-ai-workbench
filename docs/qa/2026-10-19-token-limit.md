# LLM 출력 토큰 제한 QA

- 실행일: 2026-10-19 (Asia/Seoul)
- 대상: PoC 0.3.4, src/llm.mjs, test/token-limit.test.mjs, test/server.test.mjs
- 환경: Windows, Node.js 24.15.0, 실제 loopback HTTP의 합성 게이트웨이
- 입력: 합성 문장·모델명·가상 주소만 사용. 사내 게이트웨이·문서 미사용

## 원인과 수정

loadLlmConfig는 WB_LLM_MAX_TOKENS를 읽고 어댑터도 범위를 검사하지만 OpenAI 요청 본문에 max_tokens가 누락되어 있었다. Anthropic 요청에는 이미 포함되어 있었다. OpenAI 요청에도 같은 값을 전달하도록 수정했다.

## 재현과 검증

변경 전 `node --test test/token-limit.test.mjs`는 2개 중 1개 실패했다. OpenAI 기본값 2048이 요청에서 undefined로 확인됐다.

수정 후 `npm test`는 전체 42개 통과, 실패·건너뜀 0개다.

- 새 테스트 1: 실제 loopback HTTP로 두 프로토콜의 기본 2048 및 설정값 1·257·8192 전송과 정상 수정안 수신 확인. 총 8개 요청.
- 새 테스트 2: 두 모드에서 설정값 0·-1·8193·1.5·invalid를 진단 단계에서 거부. CONFIG_INVALID, networkRequestAttempted=false이며 fetch 미호출 확인.
- 기존 서버 통합 테스트 보강: OpenAI 기본 max_tokens=2048 확인. finish_reason=length인 응답은 오류로 처리하여 잘린 수정안을 성공 반환하지 않음.
- Anthropic의 stop_reason=max_tokens 거부는 기존 테스트로 유지.

`npm run package`: 플러그인·소스 ZIP·SHA-256 목록 생성 성공.

## 한계

실제 모델이 설정 상한을 준수하는지, 입력 문맥과 출력 한도의 합이 실제 모델 한도에 맞는지, 사내 게이트웨이가 max_tokens를 지원하는지는 미검증이다. 토큰 수와 문자 수는 다르다. max_completion_tokens만 허용하는 서버의 지원은 이번 범위에 포함하지 않는다.

사용자가 별도 VM/전용 테스트 PC가 아직 준비되지 않았다고 확인했다. 실제 Desktop QA와 사내 LLM 연결은 수행하지 않았다. 다음 검증은 준비된 사내 환경에서 고정 합성 문장으로 진행한다.
