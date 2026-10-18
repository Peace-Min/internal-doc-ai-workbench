# 사내 LLM 게이트웨이 연결

## 확인한 연결 형태

제공된 VS Code 설정은 `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_*_MODEL`을 지정하는 방식이다. 따라서 현재 알려진 클라이언트 인터페이스는 Anthropic Messages 호환 방식이다. 실제 주소·토큰·모델 식별자나 원본 설정은 공개 저장소에 포함하지 않는다.

vLLM은 이 인터페이스를 제공할 수 있다. 그러나 설정만으로 서버가 vLLM 단독인지, 앞단 프록시가 있는지 또는 어떤 버전인지는 확정하지 않는다. 기존 `/v1/chat/completions` 지원만으로 연결된다고 가정하지 않는다.

```text
ONLYOFFICE 플러그인
       ↓ 사용자 PC localhost (pairing token)
로컬 Workbench 서비스
       ↓ Anthropic Messages HTTP 요청 (사내 인증)
기존 사내 게이트웨이 → 사내 모델
```

Claude Code 설치는 이 편집기 연동의 필수 의존성이 아니다. 이 서비스가 동일한 프로토콜로 직접 요청한다. Poppler의 pdftoppm은 PDF 렌더링 도구이며 모델 게이트웨이와 별개다. 아직 PDF·Marker를 통합하지 않았으므로 이번 연결 단계에서 Poppler나 Claude Code를 설치하지 않는다.

## 방법 A: 기존 설정을 로컬에서 읽기

`.env.example`을 `.env`로 복사하고 다음 값을 지정한다. 가상 경로를 해당 PC의 실제 비공개 설정 경로로 바꾼다. 사용자 PC의 시스템 환경 변수나 원본 VS Code 파일은 변경하지 않는다.

```dotenv
WB_MODE=anthropic-compatible
WB_CLAUDE_CONFIG=C:\Private\config.json
WB_CLAUDE_MODEL_TIER=sonnet
```

다음 JSON 형식을 지원한다.

```json
{
  "claudeCode.environmentVariables": [
    {"name":"ANTHROPIC_BASE_URL","value":"http://gateway.example.invalid/anthropic"},
    {"name":"ANTHROPIC_AUTH_TOKEN","value":"replace-locally"},
    {"name":"ANTHROPIC_DEFAULT_SONNET_MODEL","value":"internal-model"}
  ]
}
```

`{"env": {...}}` 형태의 Claude 설정도 지원한다. 연결에 필요한 변수만 읽으며, 설정 파일 안의 명령·확장 기능·텔레메트리 설정을 실행하거나 다른 프로그램에 적용하지 않는다.

```sh
npm run inspect-config -- C:\Private\config.json
```

이 명령은 파일 읽기·설정 형식만 검증한다. 주소·키·모델명을 출력하지 않으며 네트워크 요청은 보내지 않는다. `valid: true`는 실제 게이트웨이 접속 성공을 뜻하지 않는다. 기본 모델 tier는 sonnet이며 opus/haiku도 선택할 수 있다. `inspect-config`는 파일의 기본 sonnet 구성을 검사한다.

## 방법 B: 직접 설정

```dotenv
WB_MODE=anthropic-compatible
WB_LLM_URL=http://gateway.example.invalid/anthropic/v1/messages
WB_LLM_MODEL=internal-model
WB_LLM_KEY=replace-locally
WB_LLM_AUTH=bearer
WB_LLM_MAX_TOKENS=2048
```

`WB_LLM_URL`은 **전체 요청 경로**다. 기존 설정의 `ANTHROPIC_BASE_URL`을 읽는 경우에는 `/v1/messages`를 붙인다. base가 `/v1`로 끝나면 `/messages`만 붙이고, 이미 `/v1/messages`면 중복하지 않는다. 게이트웨이의 앞 경로는 유지한다.

인증 매핑은 다음과 같다.

| 설정 | 전송 헤더 |
| --- | --- |
| ANTHROPIC_AUTH_TOKEN 또는 기본 WB_LLM_KEY | Authorization: Bearer … |
| ANTHROPIC_API_KEY (auth token이 없을 때) | x-api-key: … |
| WB_LLM_AUTH=api-key | x-api-key: … |
| WB_LLM_AUTH=none | 인증 헤더 생략 (인증 없는 내부 시험 서버에만 명시적으로 사용) |

`anthropic-version: 2023-06-01`을 함께 보낸다. 명시적인 `WB_LLM_*` 값이 가져온 설정보다 우선하고, 프로세스의 `ANTHROPIC_*` 변수는 파일 설정보다 우선한다. 인증값을 플러그인에 전달하지 않는다.

## 실행 및 실제 연결 확인

편집기나 브라우저를 열기 전에, 위의 로컬 `.env` 설정으로 진단 CLI를 실행할 수 있다.

```sh
npm run diagnose-llm
```

`inspect-config`와 달리 이 명령은 **설정한 게이트웨이에 고정된 합성 문장을 실제 전송**한다. 문서 파일이나 임의 입력은 받지 않는다. 주소·키·모델 식별자·응답 원문을 출력하지 않고 JSON 결과만 출력한다. 기본 mock 모드는 연결 성공으로 처리하지 않는다. 기본 제한 시간은 10초이며 `.env`의 `WB_PROBE_TIMEOUT_MS`로 1~30000ms를 지정할 수 있다.

| 결과 code | 의미 / 확인할 사항 |
| --- | --- |
| OK | 응답을 받아 한 줄 수정안 형식 검증 통과. 문장 품질·문서 편집·전체 통합 성공을 보장하지 않는다. |
| MOCK_MODE | 모의 모드. 실제 연결 모드 설정 필요. 요청하지 않음. |
| CONFIG_INVALID / CLI_ARGUMENTS | 설정 또는 지원하지 않는 명령 인자. 요청하지 않음. |
| UPSTREAM_AUTH | HTTP 401/403. 인증·권한·게이트웨이 정책 확인. |
| UPSTREAM_RATE_LIMIT | HTTP 429. 사용량 제한·서버 상태 확인. |
| UPSTREAM_HTTP | 기타 HTTP 오류. 비노출 상태 코드만 제공. |
| UPSTREAM_TIMEOUT | 연결 또는 응답 본문 수신 중 제한 시간 초과. 네트워크·모델 처리 시간 확인. |
| UPSTREAM_CONNECTION | 연결·TLS·redirect 등 요청 실패. 서버 도달 여부는 별도 확인 필요. |
| UPSTREAM_RESPONSE_TOO_LARGE | 응답 64KiB 초과. |
| UPSTREAM_INVALID_RESPONSE | JSON·종료 사유·수정안 형식 등 부적합. |

종료 코드는 성공 `0`, 설정 단계 오류 `2`, 요청/응답 오류 `3`이다. `networkRequestAttempted: true`는 요청을 시도했다는 뜻이며 서버에 도달했다는 보장은 아니다. 진단은 로컬 서비스의 pairing token을 생성하지 않는다.

플러그인에서 요청하려면 다음으로 로컬 서비스를 실행한다.

```sh
npm start
```

사내망에서 서비스 실행 후 합성 문장으로 먼저 요청한다. 연결 코드는 `private/runtime.json`에서 확인한다. `/api/health`는 **로컬 서비스의 설정·기동 확인**이며 upstream 모델의 health check가 아니다. 실제 모델 성공은 `/api/propose`에 합성 문장을 보내 응답 형식과 내용이 맞는지 별도로 확인한다.

모든 요청은 비스트리밍이다. `max_tokens` 기본값 2048, 허용 범위 1~8192이며 요청 제한 시간은 30초다. 실제 모델의 지원 한도는 별도로 확인한다. 끝나지 않은 응답, tool call, 잘못된 JSON, 과도한 응답, 여러 줄 또는 빈 수정안은 문서에 적용하지 않는다. thinking 블록은 문서에 포함하지 않는다. 임의 코드·도구 실행 기능은 없다.

## QA 범위

백그라운드 Node 테스트에서 실제 loopback HTTP로 요청 형식·인증·정상 응답·timeout·redirect·잘못된 응답을 검증했다. 원본 로컬 설정 파일의 dry-run도 통과했지만 실제 사내 게이트웨이 요청은 아직 보내지 않았다. 사용자 PC의 화면을 점유하는 QA는 하지 않는다.

## 공식 근거

- [vLLM의 Claude Code / Anthropic Messages 연동](https://docs.vllm.ai/en/latest/serving/integrations/claude_code/)
- [Claude Code 게이트웨이 설정](https://code.claude.com/docs/en/llm-gateway)
- [Claude Code 환경 변수](https://code.claude.com/docs/ko/env-vars)
