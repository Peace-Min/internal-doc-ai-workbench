# Internal Document AI Workbench

폐쇄망의 클라우디움 문서를 열어 편집하고, 사내 LLM으로 내용을 질의·요약·보완하는 문서 워크벤치.

현재 상태: **PC 설치형 플러그인 PoC 0.12.0**. PPTX 한 페이지의 텍스트를 자연어로 요청하고 변경 전후 검토 후 일괄 적용한다. 선택 개체 수정과 읽기 전용 질의·요약도 제공한다. 긴 문서는 구간별로 읽고, 기록 당시 원문·답변과 출처 번호를 대조할 수 있다. 자동 테스트 89개와 헤드리스 브라우저 흐름 검증 통과. 실제 로컬 모델의 세 작업·브라우저 통합도 확인했다. Marker의 실제 PDF/OCR 추출·로컬 LLM 비교도 수행했으나 전체 할루시네이션 감소는 확인하지 못했다. 실제 Desktop·사내 연결·PDF UI 통합·완전 차단망 설치는 검증 전이다. [현재 PC 로컬 LLM 준비](docs/wiki/local-llm.md).

Windows 배포물은 압축 해제 후 **Start-Workbench.cmd**로 실행한다. [처음 실행](FIRST-RUN.md), [배포물 준비와 검증](docs/wiki/portable-package.md)을 참고한다. 런타임 포함판은 Node 설치가 필요 없으며 ONLYOFFICE Desktop Editors는 별도로 준비한다.

0.7.0의 슬라이드 범위는 [구간별 읽기](docs/wiki/slide-ranges.md)를 따른다. 한 번에 최대 200슬라이드·2,000개 개체·범위와 출처 포함 12,000자다. 전체가 200장보다 긴 문서도 구간별로 읽을 수 있으며, 구간별 답변을 자동으로 합치지는 않는다.

0.8.0은 질문·요약 결과를 현재 창에서 최대 **20건** 보관하고 질문·범위·출처와 함께 `.txt` 보고서로 내보낸다. 닫기·새로고침 시 사라지므로 먼저 내려받는다. 서로 다른 문서의 결과가 섞일 수 있으며 자동 통합 요약은 아니다. [기록·보고서 사용법](docs/wiki/analysis-report.md).

[Marker 비교 실험 결과](docs/wiki/marker-evaluation.md)와 [재현 자료](docs/qa/assets/marker-benchmark/)를 참고한다.

[페이지 단위 텍스트 수정](docs/wiki/page-editing.md)은 여러 개체·문단·서식 구간을 함께 다룬다. 새 기능의 실제 Desktop·저장 QA는 별도 환경에서 검증 전이며 PDF 페이지 편집·배치 변경은 미지원이다.

[Windows VM 검증 환경](docs/wiki/windows-vm-qa.md)은 반입 패키지와 백그라운드 준비 스크립트를 추가한 상태다. 현재 PC의 Sandbox 기능 설치는 완료됐으나 재부팅 대기로 VM 첫 실행·실제 앱 QA는 미실행이다. VM 관련 검증을 포함한 현재 자동 테스트는 92개다.

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

0.6.0부터 분석 범위를 ‘문서 일반 텍스트’로 바꿔 전체 슬라이드의 지원 텍스트를 읽을 수 있다. 숨긴 슬라이드·개체도 포함하며 이미지·표·그룹·노트·마스터는 제외한다. 최대 200슬라이드·2,000개 개체, 출처 포함 12,000자까지 지원하고 초과 문서를 잘라서 분석하지 않는다. [문서 질문·요약](docs/wiki/document-ai.md)을 참고한다.

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
