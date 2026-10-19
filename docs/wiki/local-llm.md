# 현재 PC의 로컬 LLM 테스트 준비

로컬 모델로 요청·응답 형식, 문장 다듬기·질문·요약, 취소와 출력 검증을 시험할 수 있다. 사내와 같은 모델·템플릿·양자화·컨텍스트 설정을 쓰면 비교가 더 유용하다. 하지만 사내 인증·프록시·TLS·네트워크·서버 제한과 모델 품질까지 동일하다는 뜻은 아니다. 특히 로컬 OpenAI 호환 시험은 사내 Anthropic Messages 경로의 실연결 증거가 아니다.

## Ollama로 준비하는 순서

1. [공식 Windows 설치 안내](https://docs.ollama.com/windows)에 따라 Ollama를 준비한다. 이 프로젝트에는 Ollama나 모델을 동봉하지 않는다.
2. PC 메모리·GPU에 맞는 로컬 모델을 선택하고 해당 모델의 라이선스를 확인한다. 인터넷이 가능한 환경에서 모델을 받아야 하며 이 작업에서 설치·대용량 모델 다운로드를 자동 실행하지 않았다.
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

Ollama는 OpenAI API의 일부와 로컬 `/v1/chat/completions`를 지원한다. [공식 호환 문서](https://docs.ollama.com/api/openai-compatibility)를 기준으로 연결 경로를 준비했다. 모델별 한 줄 응답·한국어 성능·출처 인용은 실측 대상이다. 현재 PC에는 사용 가능한 Ollama/LM Studio가 확인되지 않아 실제 모델 추론은 미실행이다. 자동 테스트의 합성 HTTP 응답과 실제 모델 추론은 구분한다.
