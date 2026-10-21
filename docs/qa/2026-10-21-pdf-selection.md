# PDF 선택 분석 후보 0.14.0

실험적 PDF 플러그인 변형과 공통 패널의 읽기 전용 분기를 추가했다. SDK의 GetSelectedText 외 편집 메서드·callCommand는 사용하지 않는다. 제품 전체 PDF 편집 완료로 계산하지 않는다.

## 검증

- 고정 sdkjs 커밋 72b0421c0bbf9d01eed9cf14834ae47eb2df1b50의 common/apiBase_plugins.js에서 GetSelectedText 구현과 공식 PDF API/설정 문서를 확인했다.
- 자동 시험: 원문 공백·다중 문단·12,000자 경계 보존, 빈/비문자열/NUL/초과 선택·SDK 실패·15초 timeout 거부. 늦은 콜백이 timeout 실패를 성공으로 바꾸지 않음. 변조된 수정 operation/문서 scope가 읽기/쓰기/서비스 전송으로 이어지지 않음.
- 실제 loopback HTTP와 패널 핸들러로 PDF 질문·요약·원문 대조·PDF 기록 표시와 쓰기 호출 0회 확인. 기존 PPTX·숫자 보호·패키지 회귀 포함 101개 통과.
- 헤드리스 Chrome/Playwright CLI: 모의 PDF SDK에서 선택 읽기→연결→질문→요약→2건 기록→실제 보고서 다운로드 성공. PDF 범위가 표시되고 원문 사본/연결 토큰이 보고서에 추가되지 않음. HTML 모양 선택은 일반 텍스트로만 표시되고 초과 선택은 전송 차단. 모의 SDK이며 실제 PDF 선택 API 실행 증거는 아니다.
- 실제 네트워크 차단 VM: 기존 Marker 합성 3페이지 fixture를 별도 PDF 사본으로 열었다. Desktop Editors 10.0.0의 editors 프로세스/문서 창, 첫 페이지 렌더링과 1/3 표시를 캡처했다. Poppler 기준 렌더와 화면에 보이는 첫 페이지 제목/본문/표 상단 배치를 시각 대조했다. PDF는 새로 생성하거나 수정하지 않았다. Poppler가 Symbol/ArialUnicode 대체 폰트 경고를 출력했으나 확인한 영문 첫 페이지에 깨진 글자는 보이지 않았다.
- VM에 0.14.0 플러그인 파일을 준비하고 기존 0.13.0은 C:\QAPluginBackups\pdf-0140에 보관했다. 플러그인 패널 실행/선택·응답 인수는 미실행이다.

## 증거와 재개

로컬 work/pdf-browser/qa.js, qa-result.log와 outputs/pdf-selection-0140.png, pdf-selection-report-0140.txt는 브라우저 모의 SDK 증거다. VM results/pdf-0140-provision.json, pdf-0140-windows.json, pdf-0140-native.png/tree.json은 실제 PDF 열람 증거다. 실제 앱 읽기와 모의 읽기를 합치지 않는다.

VM의 현재 PDF 문서는 QA PDF 0140.pdf다. PID/HWND는 results와 실제 조회로 다시 식별한다. 호스트 입력을 점유하지 않으며 이전 no_interactive_desktop/자동 승인 검토 제한을 우회하지 않았다. 실제 페이지 수정·undo/저장, PDF 선택 패널·Marker UI, 사내 접속은 계속 미완료다. 절차는 [PDF 선택 분석](../wiki/pdf-selection.md)과 [완료 판정](../06-completion.md)을 따른다.

호스트와 PATH 없는 동봉 런타임 배포본에서 각각 101개 통과. 실제 VM 후보는 100개 통과/호스트 전용 1개 제외/실패 0개이며 results/candidate-0140-tests.json/log에 기록했다. 최종 배포본은 문서 갱신 외 실행 코드를 바꾸지 않았다.
