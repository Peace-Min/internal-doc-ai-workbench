# Internal Document AI Workbench

폐쇄망의 클라우디움 문서를 열어 편집하고, 사내 LLM으로 내용을 질의·요약·보완하는 문서 워크벤치.

현재 상태: **PC 설치형 플러그인 PoC 0.3.1**. 실제 Desktop Editors의 단순 PPTX 기본 흐름을 확인했고, Anthropic/OpenAI 호환 LLM 어댑터·로컬 설정 읽기·화면 제어 없는 연결 진단 CLI를 구현했다. 자동 테스트 32개 통과. 실제 사내 LLM·클라우디움·Marker 연결과 완전한 폐쇄망 배포는 검증 전이다.

## 목표

- 기존 폐쇄망에 구축된 클라우디움과 사내 LLM을 활용한다.
- PPTX·PDF를 하나의 사용자 화면에서 열람하고 형식별 편집 기능을 제공한다.
- 선택 영역 또는 문서 내용을 사내 LLM에 전달하고 수정안을 확인·적용한다.
- 유료 에디션·외부 클라우드에 의존하지 않는 공개 소스 기반으로 개발한다.
- 인터넷 환경에서 의존성을 준비하고 폐쇄망에서 설치·운영한다.

## 문서 안내

| 단계 | 문서 |
| --- | --- |
| 기획 | [요구사항](docs/01-planning.md) |
| 개발 | [아키텍처와 기술 검증](docs/02-development.md) |
| QA | [검증 계획](docs/03-qa.md) |
| Wiki | [운영·설치 지식 문서](docs/wiki/README.md) |
| 사내 LLM | [Claude 설정 / Anthropic 게이트웨이 연결](docs/wiki/internal-llm.md) |
| 라이선스 | [의존성 역할과 조건](docs/04-dependencies.md) |
| 결정 이력 | [결정과 미확정 사항](docs/05-decisions.md) |
| 재개 | [다른 PC·세션에서 이어가기](HANDOFF.md) |

## 첫 개발 범위

사용자 선택에 따라 **PC 설치형을 우선**한다. ONLYOFFICE Desktop Editors 10.0.0의 PPTX 플러그인에서 단일 문단·내용이 있는 run 한 개의 텍스트 상자를 읽고, 로컬 서비스를 거쳐 AI 수정안을 확인·적용한다. 빈 run은 보존한다. 실제 엔진에서 합성 PPTX와 mock AI로 기본 흐름을 검증했다. 실제 모델 호출과 복잡한 문서 지원은 아직 아니다.

## 로컬 실행

Node.js 22.14.0 이상 필요. npm 외부 패키지 설치 없이 실행한다.

```sh
npm test
npm start
```

브라우저에서 `http://127.0.0.1:4318/?demo=1`을 열고 `private/runtime.json`의 연결 코드를 입력한다. 기본 모드는 **모의 AI**이며 실제 문서 파일을 편집하지 않는 시험 화면이다.

```sh
npm run package
```

`dist/`에 설치용 `.plugin`, 소스 ZIP, 체크섬을 생성한다. 편집기와 Node 런타임은 포함되지 않는다. [PC 설치와 실행](docs/wiki/desktop-setup.md), [실제 Desktop QA 결과](docs/qa/2026-10-18-desktop.md), [초기 모의 QA](docs/qa/2026-10-18-poc.md)를 참고한다.

## 공개 저장소 원칙

사내 문서, 내부 주소, 토큰, 인증서, 모델 가중치를 커밋하지 않는다. 예시는 합성 데이터와 가상 주소만 사용한다. 프로젝트 코드는 [AGPL-3.0-only](LICENSE)로 공개하며, 포함한 SDK의 추가 고지는 [THIRD_PARTY_NOTICES](plugin/THIRD_PARTY_NOTICES.md)를 따른다.

기준일: 2026-10-18 (Asia/Seoul)
