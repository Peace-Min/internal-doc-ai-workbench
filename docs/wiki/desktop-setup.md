# PC 설치형 PoC 설치·실행

0.7.0은 문서 범위에서 시작·끝 슬라이드를 지정할 수 있다. [긴 문서 구간별 읽기](slide-ranges.md)를 참고한다. 실제 편집기 API 검증은 여전히 별도 환경이 필요하다.

0.6.0은 질문·요약에서 분석 범위를 ‘문서 일반 텍스트’로 선택할 수 있다. [문서 범위 사용법과 제외 항목](document-ai.md)을 확인한다. 수정 범위는 계속 선택한 단일 텍스트 상자로 제한한다.

0.5.0은 선택 텍스트의 읽기 전용 질문·요약을 지원한다. [질의·요약 사용법](read-only-ai.md)을 참고한다. 수정 기능의 대상 제한은 아래와 같이 유지한다.

0.4.0 런타임 포함 배포물은 압축 해제 후 Start-Workbench.cmd로 시작한다. 별도 Node 설치는 필요 없다. [처음 실행](../../FIRST-RUN.md)과 [배포 준비](portable-package.md)를 참고한다. 아래는 소스에서 직접 실행·편집기를 준비하는 방법이다.

현재 범위는 ONLYOFFICE Desktop Editors용 PPTX 플러그인과 로컬 연동 서비스다. 별도의 통합 설치 프로그램은 아직 없다. Windows x64의 실제 10.0.0에서 개발 경로 설치와 단순 PPTX 기본 편집 흐름을 확인했다. `.plugin` UI 메뉴 설치 절차는 공식 문서에 근거하며 해당 경로 자체는 미검증이다.

## 1. 준비

- Node.js 22.14.0 이상 (현재 자동 QA: 22.14.0 / Windows).
- ONLYOFFICE Desktop Editors 10.0.0 (Windows x64 기본 통합 검증 완료).
- 이 저장소 소스. `npm install`은 필요 없다.
- 실제 사내 모델을 연결하려면 승인된 OpenAI 호환 chat/completions API 명세.

온라인 반입 시 편집기 설치물·Node 런타임·소스·폰트를 별도로 준비한다. 이번 패키지는 편집기 바이너리나 Marker 모델을 포함하지 않는다.

## 2. 모의 기능 확인

```sh
npm test
npm start
```

`http://127.0.0.1:4318/?demo=1`을 열고 `private/runtime.json`의 token을 연결 코드에 입력한다. 이 파일은 로컬 전용이며 커밋되지 않는다. 모의 화면은 실제 PPTX/PDF를 열지 않는다.

선택 개체 읽기 → 지시 입력 → 수정안 요청 → 확인·수정 → 적용을 수행한다. 본문 A 요청 후 본문 B로 선택을 바꾸면 A만 변경되어야 한다. 요청 후 원문을 직접 바꾸면 적용이 거부되어야 한다.

## 3. Desktop 플러그인 패키지

```sh
npm run package
```

`dist/internal-ai-workbench.plugin`을 Desktop Editors의 Plugins → Plugin Manager → Install plugin manually 메뉴에서 설치한다. 메뉴 명칭은 언어에 따라 다를 수 있다. [공식 수동 설치](https://api.onlyoffice.com/docs/plugins/development-workflow/installing-and-testing/desktop-editors-installation)

새 PPTX에서 한 문단·한 서식의 텍스트 상자를 만들고 **테두리를 클릭**해 개체 한 개를 선택한 후 플러그인을 실행한다. 부분 문자열, 다중 문단·run·표·그룹·PDF는 현재 수정 대상이 아니다. 적용 후 저장은 편집기에서 한다.

0.2.0은 편집기가 남기는 빈 run을 보존하면서 내용이 있는 run 한 개를 수정한다. 여러 nonempty run의 서식 병합은 지원하지 않는다. 패널이 길어 버튼이 보이지 않으면 Tab으로 다음 컨트롤에 이동하거나 패널 안에서 스크롤한다. 저장·undo/redo는 편집기 상단 버튼을 이용한다. 플러그인 입력창 안에서는 편집기 단축키가 전달되지 않을 수 있다.

개발 설치를 재현하려면 Desktop Editors를 종료한 상태에서 아래처럼 이 프로젝트 GUID의 폴더에 소스를 배치하고 다시 실행한다. 이 방식으로 실제 로드를 확인했다.

```powershell
$pluginPath = Join-Path $env:LOCALAPPDATA 'ONLYOFFICE/DesktopEditors/data/sdkjs-plugins/{A5BA9AF1-7BCE-4B75-86F7-C28D4E922B1B}'
New-Item -ItemType Directory -Force -Path $pluginPath | Out-Null
Copy-Item -Path './plugin/*' -Destination $pluginPath -Recurse -Force
Copy-Item -LiteralPath './LICENSE' -Destination (Join-Path $pluginPath 'LICENSE') -Force
```

플러그인 UI만 닫았다 열면 플러그인 JavaScript 수정분을 다시 로드할 수 있다. 최초 플러그인 등록은 편집기 재시작 후 확인했다.

0.3.3부터 로컬 서비스 연결의 **서비스 포트**를 설정할 수 있다. 기본은 4318이다. `.env`에서 `WB_PORT`를 변경했다면 서비스를 재시작하고, 플러그인에서 같은 포트와 `private/runtime.json`의 연결 코드를 입력한 뒤 연결 확인을 누른다. 소스 변경·재패키징은 필요 없다. 포트·연결 코드를 변경하면 재연결이 필요하다. 설정은 창을 닫으면 초기화된다.

브라우저 데모는 서비스를 실행한 주소의 포트를 기본으로 사용한다. 연결 목적지는 항상 `127.0.0.1`이며 포트는 1~65535 정수만 받는다. 원격 서버 주소는 입력할 수 없다. 예를 들어 `.env`에 `WB_PORT=4320`을 지정했다면 데모 주소는 `http://127.0.0.1:4320/?demo=1`이다. 다른 프로세스가 이미 해당 포트를 사용하면 서비스를 실행할 수 없으므로 사용 가능한 포트를 선택한다.

## 4. 사내 모델 연결 (실환경 미검증)

현재 제공된 Claude 설정의 `ANTHROPIC_BASE_URL`·`ANTHROPIC_AUTH_TOKEN` 방식은 [사내 LLM 게이트웨이 연결](internal-llm.md)을 따른다. 아래는 기존 OpenAI 호환 경로의 별도 설정 예시다. 두 프로토콜을 혼동하지 않는다.

`.env.example`을 `.env`로 복사하고 로컬에서만 다음 값을 지정한다.

```dotenv
WB_MODE=openai-compatible
WB_LLM_URL=http://llm.example.invalid/v1/chat/completions
WB_LLM_MODEL=internal-model
WB_LLM_KEY=replace-locally
```

가상 주소를 실제 내부 API로 교체한다. URL은 실제 chat/completions 전체 경로다. API 키는 서버 프로세스에서만 사용하며 플러그인으로 전달하지 않는다. 임의 내부 API 규격이면 어댑터 수정이 필요하다. 서비스 재시작 후 연결 코드를 다시 확인한다.

## 5. Origin 및 오류 처리

서비스는 loopback만 수신하고 pairing token을 요구한다. 기본 플러그인 Origin은 `null`과 `file://`를 허용한다. Windows Desktop Editors 10.0.0에서 `file://` preflight를 관찰했고 이 설정으로 실제 통신에 성공했다. 기존 `.env`에 `WB_PLUGIN_ORIGINS=null`만 있으면 `null,file://`로 갱신한 뒤 서비스를 재시작한다. 다른 배포에서 실제 출처가 다르면 확인한 출처만 정확히 등록한다.

‘원문 변경’ 오류면 다시 읽고 요청한다. ‘한 문단·한 서식’ 오류면 새 단순 텍스트 상자로 시험한다. 실제 엔진에서 API 오류나 적용 시간이 초과되면 문서에서 적용 여부를 먼저 확인한다. 문서 내용·토큰을 공개 이슈에 첨부하지 않는다.

## 6. 편집 실패와 복구 안내 (0.3.2)

수정 API의 실패·예외 또는 결과 불일치를 감지하면 원문 복구를 시도한다. ‘원문이 유지되었거나 복구되었습니다’는 API에서 원문 일치를 확인했다는 의미이며 화면과 서식은 사용자가 확인한다. ‘원문 복구를 확인하지 못했습니다’가 나오면 추가 편집·저장 전에 문서를 확인하고 편집기의 실행 취소 또는 저장 전 사본으로 복구한다. 복구 성공이나 실제 엔진의 자동 롤백을 보장하지 않는다.

이번 실패 주입 검증은 Node의 모의 편집 API로 수행했다. 실제 Desktop의 실패·undo 동작은 별도 VM/전용 테스트 PC에서 검증해야 한다. [QA 결과](../qa/2026-10-19-recovery.md).

## 7. 폐쇄망 QA

실제 Desktop 기본 QA도 완전한 폐쇄망 검증은 아니다. 깨끗한 PC에 인터넷 차단 상태로 설치하고, 플러그인 시작·실제 모델 요청 및 편집기 기본 플러그인·업데이트 등 외부 요청 실패 영향을 확인해야 한다. Marker는 다음 단계에 별도 모델·런타임·라이선스 목록을 준비한다. [이번 Desktop QA 결과](../qa/2026-10-18-desktop.md)의 범위와 남은 항목을 참고한다.

## 8. 합성 PPTX 수동 QA 재현

1. 새 PPTX 제목 상자에 한 줄의 일반 문장을 입력하고 Escape로 개체 선택 상태로 바꾼다.
2. 파일을 저장한 뒤 변경 전 사본을 만든다. 제목 테두리를 선택하고 플러그인에서 읽는다.
3. mock 수정안을 요청하고 미리보기에서 짧은 문장으로 확인·편집한 뒤 적용한다.
4. 편집기 Undo 한 번으로 원문, Redo 한 번으로 수정 문장이 복구되는지 확인한다.
5. 저장 후 편집기를 닫고 파일을 다시 열어 내용을 확인한다.
6. 변경 전 사본과 변경 후 닫은 파일에 `scripts/compare-pptx.ps1`을 실행한다.

내부 개체 ID는 저장·재열기 후 달라질 수 있다. 재열기 후에는 다시 읽고 요청한다. 위 검사는 단순 합성 첫 슬라이드에 한정되며 모든 PPTX 구조 보존을 보장하지 않는다.
