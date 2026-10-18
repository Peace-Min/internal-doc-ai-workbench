# 다른 PC·세션에서 작업 재개

## 시작 방법

```sh
git clone https://github.com/Peace-Min/internal-doc-ai-workbench.git
cd internal-doc-ai-workbench
git status
```

README.md → 이 문서 → docs/05-decisions.md → docs/02-development.md 순으로 읽는다. 원본 대화 없이도 이 저장소의 문서를 기준으로 작업한다.

## 새 세션에 전달할 요청

> 이 저장소의 AGENTS.md, HANDOFF.md와 docs를 읽고 현재 상태를 파악해 주세요. 기획 → 개발 → QA → Wiki 순서로 작업하며, 검증 전 후보를 확정 사실로 취급하지 마세요. 다음 미완료 작업부터 진행하고 결과와 재개 정보를 함께 갱신해 주세요. 사내 주소·문서·인증정보는 공개 저장소에 넣지 마세요.

## 현재 상태

- 사용자 확정: **PC 설치형 데스크톱 앱 우선**. 웹 서버형 우선 가정은 철회.
- 완료: 기획 문서, Desktop Editors 10.0.0 고정 SDK 소스 조사, PPTX용 플러그인·로컬 서비스 코드, 의존성 없는 패키징, 자동 테스트 11개 통과, 브라우저 모의 편집기의 적용·충돌 시나리오 점검, Wiki 작성.
- 미완료: 실제 Desktop Editors 설치·통합·저장·실행 취소·서식 QA, 실제 클라우디움 연결, 사내 LLM 연결, Marker 실행, 완전 차단 환경 신규 설치, 통합 데스크톱 설치 프로그램.
- 실제 사내 환경에 접근하거나 API 응답을 확인한 적은 없다.
- 실행/설치: docs/wiki/desktop-setup.md. 검증 결과: docs/qa/2026-10-18-poc.md.
- 프로젝트 코드는 AGPL-3.0-only. vendor/plugins.js의 원본 헤더와 추가 고지는 유지.

## 다음 작업

1. `npm test` 후 `npm run package`로 소스 상태와 배포물을 재현한다. 외부 npm 의존성이 없다.
2. ONLYOFFICE Desktop Editors 10.0.0이 있는 PC에서 `.plugin` 수동 설치. 실제 플러그인 Origin과 localhost 통신, API 실행을 확인한다.
3. 새 PPTX의 단순 텍스트 상자에서 읽기→모의 AI→적용→실행 취소→저장·재열기 QA. 실제 서식 보존 확인 전 지원 확정 금지.
4. 모델 API 규격을 확인해 `.env`의 내부 LLM 어댑터를 연결한다. URL·키는 커밋 금지.
5. 클라우디움 공식 문서 열기/저장/버전 API를 확인해 연동한다.
6. PDF/표/그룹/다중 run/선택 문자열 편집과 Marker는 다음 단계다. 현재 플러그인은 PPTX 개체 전체·단일 문단·단일 run만 지원하도록 제한한다.
7. 실제 편집기 검증 후 통합 런처·설치 패키지와 전체 폐쇄망 반입 패키지를 만든다.

## 매 작업 종료 시 기록

완료 항목, 검증 방법과 결과, 변경된 결정, 남은 문제, 다음 실행 작업을 이 문서 또는 관련 docs에 갱신한다. 실제 테스트 전에는 통과했다고 표시하지 않는다.
