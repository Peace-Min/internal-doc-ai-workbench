# Anthropic 호환 어댑터 PoC 0.3.0 QA

날짜: 2026-10-18 (Asia/Seoul). Windows / Node 22.14.0. 사용자 PC 화면·마우스·키보드를 사용하지 않고 백그라운드 프로세스만 실행했다.

## 기획 → 개발

사용자가 제공한 설정의 연결 변수 구조를 근거로 Anthropic Messages 호환 프로토콜을 추가했다. 원본 설정이나 내부 식별자를 공개 소스에 복사하지 않았다.

- `src/llm.mjs`: mock/OpenAI/Anthropic 프로토콜별 요청·응답 처리.
- `src/config.mjs`: 허용된 Claude 연결 변수만 로컬 파일·환경에서 읽기.
- `scripts/inspect-config.mjs`: 설정 형식 검증. 네트워크·설정값 출력 없음.
- `src/server.mjs`: 공통 로컬 API와 pairing 인증은 유지하고 어댑터 호출로 분리.

## 자동 테스트

`npm test`: **26개 통과, 0 실패**. 기존 12개 회귀 + 새 14개.

| 검증 | 방법·결과 |
| --- | --- |
| Messages 요청 | 실제 loopback HTTP 서버에서 경로·model·system·messages·max_tokens·비스트리밍 확인 |
| 인증 | Bearer와 x-api-key 각각 확인. 불필요한 인증 헤더가 함께 전송되지 않음 |
| 응답 | 정상 text 추출, thinking 제외, 여러 text 블록 조합 |
| 비정상 응답 | max_tokens 중단·tool call·빈/여러 줄·잘못된 형식 거부 |
| 통신 실패 | HTTP 오류·과도한 본문·invalid JSON·실제 timeout·redirect에서 502 반환 |
| 설정 읽기 | VS Code 환경 변수 배열 및 Claude env 객체, tier 선택·명시 설정 우선순위 |
| 정보 출력 | 합성 주소·키·모델명이 dry-run 출력에 포함되지 않음 |
| mock 기본값 | 설정 경로가 있어도 기본 mock에서는 인증 파일을 읽거나 upstream을 호출하지 않음 |

## 실제 로컬 설정 dry-run

사용자가 지정한 로컬 config 파일을 `inspect-config`로 읽었으며, 다음 검증 결과만 확인했다.

```json
{
  "valid": true,
  "mode": "anthropic-compatible",
  "endpointConfigured": true,
  "modelConfigured": true,
  "authStyle": "bearer",
  "credentialsConfigured": true,
  "networkRequestSent": false
}
```

실제 주소·인증값·모델명·원본 파일 경로는 이 문서에 기록하지 않는다. 이 검사는 실제 게이트웨이 접속 성공이나 vLLM 버전·구현 검증을 의미하지 않는다.

## Wiki 및 남은 항목

[사내 연결 Wiki](../wiki/internal-llm.md)에 설정 매핑과 실제 연결 확인 절차를 기록했다. 다음은 폐쇄망에서 합성 문장으로 실제 모델 응답을 확인하는 단계다. 클라우디움 API·Marker·PDF 통합은 미완료이며, Desktop UI 추가 검증은 별도 VM/테스트 PC에서만 진행한다.
