# 현재 PC의 로컬 LLM 테스트 준비

## 실제 검증한 조합 (0.10.0)

2026-10-19에 llama.cpp b8201 + Qwen2.5 1.5B Q4_K_M + CPU 2스레드·4,096 컨텍스트로 실제 추론을 검증했다. 질문·요약·문장 보완, 헤드리스 브라우저의 기록·원문 대조·보고서 다운로드·모의 편집 적용이 통과했다. 실제 PPTX 엔진 시험은 아니다. 작은 모델은 한국어·중국어 혼합과 출처 누락이 관찰되어 문서 품질 보장용으로 사용하지 않는다.

Ollama 0.40.6도 공식 ZIP 체크섬을 확인하여 시험했으나 이 PC의 GPU 경로 timeout 및 CPU 경로 반복 출력·length 종료로 채택하지 않았다. 동일 모델 파일이 llama.cpp에서 정상 응답했지만 원인을 특정하지는 않았다. Ollama 일반 지원 불가를 뜻하지 않는다.

### 현재 작업 폴더에서 재실행

현재 PC의 기존 `llama-server` 실행기를 사용했다. 실행기 버전은 `llama-server --version`으로 확인한다. 다른 PC에서는 [공식 llama.cpp](https://github.com/ggml-org/llama.cpp/releases/tag/b8201)의 실행기와 필요한 DLL을 별도로 준비한다. 모델·실행기는 프로젝트 배포 ZIP에 포함하지 않는다.

저장소 루트에서 다음 PowerShell 명령으로 전용 포트에 실행한다. 모델 파일은 상위 작업 공간의 `work/local-llm`에 있으며 Git에 넣지 않았다.

```powershell
$modelFile = (Resolve-Path '../../work/local-llm/models/blobs/sha256-183715c435899236895da3869489cc30ac241476b4971a20285b1a462818a5b4').Path
llama-server -m $modelFile --host 127.0.0.1 --port 11440 --alias 'qwen2.5:1.5b' -c 4096 -t 2 -ngl 0
```

다른 터미널에서 프로젝트 전용 환경 변수를 지정한다. 사용자·시스템 환경 변수에는 영구 저장하지 않는다. 사내 설정 변수는 없는 별도 셸에서 실행한다.

```powershell
$env:WB_MODE='openai-compatible'
$env:WB_LLM_URL='http://127.0.0.1:11440/v1/chat/completions'
$env:WB_LLM_MODEL='qwen2.5:1.5b'
$env:WB_LLM_AUTH='none'
$env:WB_LLM_MAX_TOKENS='512'
$env:WB_PROBE_TIMEOUT_MS='30000'
node scripts/diagnose-llm.mjs
node scripts/verify-local-llm.mjs
```

`npm run verify-local-llm`도 제공한다. 이 명령은 `.env`를 읽으므로 실제 설정을 확인한다. 고정 합성 문서만 전송하여 임시 인증 브리지의 질문·요약·문장 보완 경로를 순차 확인하고 브리지를 종료한다. 원문 응답·키·모델 식별자는 보고하지 않는다. 127.0.0.1/::1의 명시적 loopback 주소만 허용하며 mock·외부 주소는 요청 전 거부한다. 성공 0, 설정 오류 2, 요청/응답 실패 3으로 종료한다. 금액/출처 집계는 관찰값이며 정답 판정이나 의미 검증이 아니다. 모델 서버는 이 명령이 자동 기동하거나 종료하지 않는다.

로컬 모델로 요청·응답 형식, 문장 다듬기·질문·요약, 취소와 출력 검증을 시험할 수 있다. 사내와 같은 모델·템플릿·양자화·컨텍스트 설정을 쓰면 비교가 더 유용하다. 하지만 사내 인증·프록시·TLS·네트워크·서버 제한과 모델 품질까지 동일하다는 뜻은 아니다. 특히 로컬 OpenAI 호환 시험은 사내 Anthropic Messages 경로의 실연결 증거가 아니다.

## Ollama로 준비하는 순서

1. [공식 Windows 설치 안내](https://docs.ollama.com/windows)에 따라 Ollama를 준비한다. 이 프로젝트에는 Ollama나 모델을 동봉하지 않는다.
2. PC 메모리·GPU에 맞는 로컬 모델을 선택하고 해당 모델의 라이선스를 확인한다. 인터넷이 가능한 준비 환경에서 모델을 받는다. 기본 npm 명령은 실행기 설치·모델 다운로드를 자동 수행하지 않는다.
3. `ollama list`로 다운로드된 모델의 정확한 이름을 확인한다. 클라우드 모델 대신 PC에서 실행하는 모델을 사용한다.
4. 프로젝트의 `.env.example`을 비공개 `.env`로 복사하고 아래 설정을 사용한다. 기존 사내 연결 설정 파일은 덮어쓰지 말고 별도로 보관한다.

```dotenv
WB_PORT=4318
WB_MODE=openai-compatible
WB_LLM_URL=http://127.0.0.1:11434/v1/chat/completions
WB_LLM_MODEL=replace-with-installed-model-name
WB_LLM_AUTH=none
WB_LLM_MAX_TOKENS=512
WB_PROBE_TIMEOUT_MS=30000
```

`WB_LLM_MODEL`은 `ollama list`의 실제 이름으로 교체한다. 로컬 테스트에는 `WB_CLAUDE_CONFIG`, `WB_LLM_KEY`를 설정하지 않는다. 터미널에 남아 있는 사내 `WB_*`/`ANTHROPIC_*` 변수도 사용하지 않도록 별도 셸에서 로컬 설정을 확인한다. `.env`는 Git에서 제외된다.

```sh
npm run diagnose-llm
npm start
```

첫 명령은 합성 문장을 실제 로컬 모델에 보내며 성공 시 code=OK를 반환한다. 느린 최초 모델 로딩·여러 줄 답변·thinking 전용 응답·토큰 잘림은 실패할 수 있다. 진단 OK만으로 문서 요약 품질을 판단하지 않는다. 서비스 기동 후 모의 편집기 `http://127.0.0.1:4318/?demo=1`에서 합성 내용으로 질문·요약·대조를 확인한다. 실제 PPTX 엔진 검증은 별도 VM/전용 PC에서 진행한다.

## 호환성과 현재 검증 상태

Ollama는 OpenAI API의 일부와 로컬 `/v1/chat/completions`를 지원한다. [공식 호환 문서](https://docs.ollama.com/api/openai-compatibility)를 기준으로 대안 연결 경로를 기록했다. 위 실제 검증은 llama.cpp 조합이며 모델별 품질과 사내 연결은 별도로 실측한다. 초기 0.9.0의 설치 준비 기록과 최신 실제 추론 결과를 구분한다.
