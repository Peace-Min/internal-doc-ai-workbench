# PC 설치형 PoC 설치·실행

현재 범위는 ONLYOFFICE Desktop Editors용 PPTX 플러그인과 로컬 연동 서비스다. 별도의 통합 설치 프로그램은 아직 없다. 실제 Desktop Editors 수동 설치 절차는 공식 문서에 근거하며, 이번 PC에서 실행하지 못했다.

## 1. 준비

- Node.js 22.14.0 이상 (현재 자동 QA: 22.14.0 / Windows).
- ONLYOFFICE Desktop Editors 10.0.0 (통합 검증 대상).
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

플러그인은 `http://127.0.0.1:4318`에 접속한다. 현재 주소는 고정이다. `WB_PORT`만 바꾸면 플러그인은 연결되지 않으므로 변경 시 plugin/app.js도 함께 변경·패키징한다.

## 4. 사내 모델 연결 (실환경 미검증)

`.env.example`을 `.env`로 복사하고 로컬에서만 다음 값을 지정한다.

```dotenv
WB_MODE=openai-compatible
WB_LLM_URL=http://llm.example.invalid/v1/chat/completions
WB_LLM_MODEL=internal-model
WB_LLM_KEY=replace-locally
```

가상 주소를 실제 내부 API로 교체한다. URL은 실제 chat/completions 전체 경로다. API 키는 서버 프로세스에서만 사용하며 플러그인으로 전달하지 않는다. 임의 내부 API 규격이면 어댑터 수정이 필요하다. 서비스 재시작 후 연결 코드를 다시 확인한다.

## 5. Origin 및 오류 처리

서비스는 loopback만 수신하고 pairing token을 요구한다. 기본 플러그인 Origin은 `null`을 허용한다. Desktop Editors에서 실제 전송 Origin이 다르면 해당 값을 확인해 `.env`의 `WB_PLUGIN_ORIGINS`에 정확히 등록한다. 이 통신은 아직 실제 Desktop 환경에서 확인되지 않았다.

‘원문 변경’ 오류면 다시 읽고 요청한다. ‘한 문단·한 서식’ 오류면 새 단순 텍스트 상자로 시험한다. 실제 엔진에서 API 오류나 적용 시간이 초과되면 문서에서 적용 여부를 먼저 확인한다. 문서 내용·토큰을 공개 이슈에 첨부하지 않는다.

## 6. 폐쇄망 QA

브라우저 모의 QA는 완전한 폐쇄망 검증이 아니다. 깨끗한 PC에 인터넷 차단 상태로 설치하고, 플러그인 시작·모델 요청·저장·재열기·실행 취소 및 외부 요청 실패 영향을 확인해야 한다. Marker는 다음 단계에 별도 모델·런타임·라이선스 목록을 준비한다.
