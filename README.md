# Internal Document AI Workbench

폐쇄망의 클라우디움 문서를 열어 편집하고, 사내 LLM으로 내용을 질의·요약·보완하는 문서 워크벤치.

현재 상태: **PC 설치형 플러그인 PoC 0.5.0**. 문장 다듬기와 선택 텍스트의 읽기 전용 질의·요약, Windows 실행기·런타임 포함 배포물을 제공한다. 질의·요약은 여러 문단·서식의 일반 텍스트를 읽으며 원문을 바꾸지 않는다. 자동 테스트 55개와 헤드리스 브라우저 흐름 검증을 통과했다. 새 기능의 실제 Desktop 동작, 실제 사내 LLM·클라우디움·Marker 연결 및 완전한 폐쇄망 설치는 검증 전이다.

Windows 배포물은 압축 해제 후 **Start-Workbench.cmd**로 실행한다. [처음 실행](FIRST-RUN.md), [배포물 준비와 검증](docs/wiki/portable-package.md)을 참고한다. 런타임 포함판은 Node 설치가 필요 없으며 ONLYOFFICE Desktop Editors는 별도로 준비한다.

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

0.5.0은 선택한 일반 텍스트 상자의 여러 문단·run을 질의·요약용으로 읽는 기능을 추가했다. 작업을 바꾼 뒤 개체를 다시 읽고 요청한다. 답변에는 적용 버튼이 없으며 수정 기능은 기존 제한을 유지한다. 읽은 시점의 선택 개체만 근거로 사용하므로 문서 전체 질의가 아니며, 내용이 바뀌면 다시 읽어야 한다. [사용법과 한계](docs/wiki/read-only-ai.md).

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

`dist/`에 설치용 `.plugin`, 소스 ZIP, Windows ZIP, 체크섬을 생성한다. 기본 빌드는 런타임을 포함하지 않는다. `--runtime-dir`에 고정 버전의 검증된 Node 배포 폴더를 지정하면 Windows ZIP에 런타임과 원본 고지를 포함한다. 편집기는 포함하지 않는다. [배포 준비](docs/wiki/portable-package.md), [PC 설치와 실행](docs/wiki/desktop-setup.md), [실제 Desktop QA 결과](docs/qa/2026-10-18-desktop.md)를 참고한다.

## 공개 저장소 원칙

사내 문서, 내부 주소, 토큰, 인증서, 모델 가중치를 커밋하지 않는다. 예시는 합성 데이터와 가상 주소만 사용한다. 프로젝트 코드는 [AGPL-3.0-only](LICENSE)로 공개하며, 포함한 SDK의 추가 고지는 [THIRD_PARTY_NOTICES](plugin/THIRD_PARTY_NOTICES.md)를 따른다.

기준일: 2026-10-19 (Asia/Seoul)
