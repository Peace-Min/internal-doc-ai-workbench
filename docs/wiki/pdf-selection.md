# PDF 선택 텍스트 질문·요약, 실험적

0.14.0은 같은 ONLYOFFICE Desktop 앱의 PDF 플러그인 변형에 읽기 전용 질문·요약을 연결한다. **실제 PDF 패널의 선택→질의 인수는 아직 미완료**다. 현재 확인한 것은 고정 SDK의 API 근거, 자동/브라우저 시험과 실제 VM 편집기의 합성 PDF 첫 페이지 열람이다.

## 사용 흐름과 범위

PDF 편집기에서 텍스트를 직접 선택한 뒤 Internal AI Workbench의 PDF 변형을 연다. 로컬 서비스 연결 후 ‘PDF 선택 텍스트 읽기’로 전송할 텍스트를 확인하고 질문 또는 요약을 요청한다. 모의 AI는 분석 결과를 만들지 않고 시험 답변임을 표시한다.

읽기는 GetSelectedText만 사용한다. 한 번에 최대 12,000자이며 빈 선택·문자열이 아닌 응답·NUL·길이 초과·15초 무응답은 거부한다. 공백/줄바꿈을 보존하고 긴 텍스트를 잘라 보내지 않는다. 스캔 PDF의 이미지에는 이 방법으로 텍스트가 생기지 않는다.

이 범위는 선택 부분만이다. 전체 PDF나 페이지 전체를 읽지 않고 선택의 페이지 번호/범위를 추정하지 않는다. 원문이나 선택이 바뀌면 다시 읽어야 한다. PDF 수정/일괄 적용 버튼을 제공하지 않으며 조작된 수정 작업과 문서 범위 요청도 전송 전에 거부한다. PPTX 쓰기 명령을 PDF에 호출하지 않는다.

정상 답변은 기존 최대 20건 기록·원문 대조·보고서에 포함한다. PDF 기록에는 슬라이드 대신 PDF 선택 텍스트와 미확인 페이지 범위를 표시한다. PDF 페이지 인용의 자동 정확성 검증은 하지 않는다. 원문 사본은 패널 메모리에만 남고 보고서에는 추가하지 않는다. 답변 자체에 원문이 포함될 수 있으므로 보고서의 내부 정보 여부를 확인한다.

## 다음 실제 인수

사용 가능한 VM UI에서 PDF 텍스트 선택과 플러그인 패널 실행, 선택 텍스트와 API 응답 일치, 연결/질의/요약/보고서, 편집 명령 미호출을 확인한다. 숫자·혼합 언어·긴 선택·스캔 페이지도 분리 시험한다. 0.15.0의 [분석 파일 가져오기](pdf-analysis-files.md)는 기존 Marker/OCR 결과를 연결한다. 자동 추출 실행, 실제 패널 인수, PDF 본문/주석/페이지 편집은 별도 미완료 작업이다.

근거: [PDF GetSelectedText](https://api.onlyoffice.com/docs/plugins/interacting-with-editors/pdf-api/Methods/GetSelectedText/), [PDF 플러그인 설정](https://api.onlyoffice.com/docs/plugins/configuration/), [고정 SDK API 구현](https://github.com/ONLYOFFICE/sdkjs/blob/72b0421c0bbf9d01eed9cf14834ae47eb2df1b50/common/apiBase_plugins.js), [QA 결과](../qa/2026-10-21-pdf-selection.md).
