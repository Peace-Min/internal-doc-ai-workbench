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

- QA 운영 제약: **사용자 PC 직접 제어 금지**. 사용자 작업을 방해하지 않도록 백그라운드 코드/API·헤드리스 브라우저 QA를 기본으로 한다. 실제 Desktop UI 검증은 별도 VM/전용 테스트 PC에서만 한다.
- 사용자 확정: **PC 설치형 데스크톱 앱 우선**. 웹 서버형 우선 가정은 철회.
- 완료: 실제 Desktop Editors 10.0.0 Windows x64 실행, 개발 경로 플러그인 설치·패널 로드, localhost mock 연결, 단순 PPTX 읽기·적용·undo/redo·저장·재열기. 해당 합성 슬라이드의 글자·도형 서식 XML 비교 통과. 자동 테스트 12개 통과.
- 수정: 실제 Origin `file://` 허용, 빈 run을 제외한 단일 nonempty run 처리. 여러 nonempty run·다중 문단 수정은 계속 제한.
- 미완료: 실제 클라우디움·사내 LLM·Marker, 복잡한 문서·PDF, 실제 편집기 선택변경/충돌 추가 QA, `.plugin` UI 설치, 완전 차단 환경 신규 설치, 통합 데스크톱 설치 프로그램.
- 실제 사내 환경에 접근하거나 API 응답을 확인한 적은 없다.
- 실행/설치: docs/wiki/desktop-setup.md. 최신 QA: docs/qa/2026-10-18-desktop.md. 초기 모의 QA는 이력으로 유지.
- 프로젝트 코드는 AGPL-3.0-only. vendor/plugins.js의 원본 헤더와 추가 고지는 유지.

## 다음 작업

1. `npm test` 후 `npm run package`로 소스 상태와 배포물을 재현한다. 외부 npm 의존성이 없다.
2. 별도 VM/전용 테스트 PC가 준비된 뒤 실제 엔진에서 선택변경/원문 충돌/삭제 시나리오와 `.plugin` UI 설치를 추가 검증한다. 사용자 PC에서는 직접 UI 제어를 하지 않는다. 기본 읽기→모의 AI→적용→undo/redo→저장·재열기는 완료했으므로 반복부터 시작하지 않는다.
3. 사내 LLM의 API 규격과 클라우디움 문서 열기/저장 API·SDK 제공 여부를 확인한다. 사용자에게 내부 주소·키 대신 비식별 규격을 질문해 둔 상태다. API 명세는 아직 없다.
4. 규격이 확인되면 `.env`와 내부 어댑터로 실제 모델·문서 저장소에 연결한다. URL·키는 커밋 금지.
5. PDF/표/그룹/다중 run/선택 문자열 편집과 Marker는 다음 단계다. 현재 플러그인은 PPTX 개체 전체·단일 문단·단일 nonempty run만 지원하도록 제한한다.
6. 통합 런처·설치 패키지와 전체 폐쇄망 반입 패키지를 만든다.

## 사내 모델 규격 확인 (2026-10-18)

사용자가 지정한 로컬 VS Code 설정 파일의 구조만 확인했다. `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, 모델별 `ANTHROPIC_DEFAULT_*_MODEL` 환경 변수 설정이 있어 Anthropic Messages 호환 연결을 우선 지원할 근거가 있다. 실제 내부 주소·토큰·모델 식별자는 이 저장소에 복사하지 않았다. vLLM 또는 앞단 게이트웨이의 실제 구현/버전과 엔드포인트 동작은 아직 확인하지 않았다. 기존 OpenAI 호환 어댑터만으로 연결된다고 가정하지 말고 Anthropic 호환 어댑터를 추가해 모의 HTTP 테스트부터 진행한다. 클라우디움 API는 미확인이다.

## 현재 PC의 검증용 준비물

공식 ZIP을 작업 폴더 `work/desktop-runtime/editor`에 압축 해제해 실행했다. 사용자 데이터의 sdkjs-plugins에 이 프로젝트 GUID의 개발 플러그인 디렉터리를 추가했다. 시스템 설치 프로그램이나 문서 연결 설정은 변경하지 않았다. 해당 경로는 이 PC의 편의 정보이며 저장소 재개에 필요한 전제는 아니다. 실제 문서에 영구 ID를 저장하는 구현은 없고, 세션 내 개체 ID만 사용한다.

## 매 작업 종료 시 기록

완료 항목, 검증 방법과 결과, 변경된 결정, 남은 문제, 다음 실행 작업을 이 문서 또는 관련 docs에 갱신한다. 실제 테스트 전에는 통과했다고 표시하지 않는다.
