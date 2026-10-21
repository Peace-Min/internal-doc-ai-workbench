# VM 내부 백그라운드 자동화 환경 QA

앱 버전 0.12.1 유지. 사용자 요청에 따라 호스트 화면 입력 대신 기존 Sandbox 내부에서 공식 Microsoft winapp CLI를 실행하는 경로를 구축했다. 이전에 거부된 원격 디버깅 명령은 재실행하지 않았다.

## 실제 확인

- winapp 0.7.1 공식 릴리스 ZIP 해시 대조, 게스트 실행 파일 Microsoft 서명 Valid. 게스트 로그인 사용자/세션 1에서 CLI UIA 조회 성공.
- 실제 편집기 실행 초기 오류를 게스트 UIA로 읽어 `MSVCP140.dll` 누락 확인. 공식 VC++ x64 14.51.36247.0의 Microsoft 서명/고정 해시 확인 후 **게스트에만** 설치. 종료 0, DLL 존재, 재시작 불필요. 설치된 상태에서 저장소 준비 스크립트 재실행도 성공.
- 게스트 합성 WinForms 창을 Interactive 로그인 작업으로 실행. `QAValue=before` 관찰, 최소화/복원 InvokePattern 성공, `set-value` 후 `get-value`가 정확히 `background-write-verified` 반환. 최소화 상태에서는 입력란 조회/수정이 실패했으므로 복원 후 성공과 구분한다. 시험 창/작업/관련 프로세스 정리 완료.
- 저장소 시작 스크립트로 Interactive 게스트 작업 실행. 실제 `editors.exe` 세션 1의 `page-edit-qa.pptx - ONLYOFFICE` 창, 1216×748 캡처 및 합성 슬라이드 제목/950/2026/혼합 굵기를 시각 확인. UIA 29개 요소, 캔버스 내부 컨트롤은 노출되지 않음. 마지막 조회에서 편집기 창은 foreground=false.
- 저장소 호스트 래퍼를 통해 실제 게스트 get-value/list-windows/inspect/screenshot 성공. 각 요청별 stdout/stderr/종료 코드를 전달하며 호스트 UI API는 사용하지 않음. 기본 GUID 처리 버그와 System 사용자 판별을 실제 실행 중 수정하고 재검증.
- 실행 중이 아닌 Sandbox ID는 게스트 요청 전에 거부. 실제 편집기가 열린 상태에서 시작 스크립트가 중복 실행을 거부하는 것도 확인. 새 PowerShell 스크립트 3개 구문 검사와 git diff 공백 검사 통과. 앱 기능/테스트는 변경하지 않았고 이번 검증은 실제 VM 실행 결과다.
- 기존 mock 서비스 0.12.1의 인증 없는 요청 거부/인증 health/페이지 계획 검증 재확인. 토큰은 출력·커밋하지 않음.

## 증거와 한계

로컬 stage `work/vm/windows-sandbox/results`의 `background-prepared.json`, `background-ready.json`, `vcredist-installed.json`, `control-set.json`, `control-read.json`, `editor-ready-tree.json`, `editor-ready.png`, `editor-final-windows.json`, `bridge-0121-ready.json`이 증거다. 도구/설치 원본과 로그는 로컬에만 보관한다.

`actualAppLaunched=true`, `fixtureOpened=true`, `guestUIAReadWriteVerified=true`, **`actualAppQATested=false`**. 게스트 일반 컨트롤 검증을 실제 편집기 수정·서식 보존·undo·저장으로 계산하지 않는다. 호스트 Sandbox 클라이언트 최소화 상태도 아직 미검증이다. 사내 LLM/클라우디움 요청은 없었고 디버깅 포트는 사용하지 않았다.

다음은 이 경로에서 실제 플러그인 UI 접근 가능 범위를 확인하고 [페이지 인수 절차](../wiki/page-edit-acceptance.md)를 수행하는 것이다. [재개 절차](../wiki/background-vm.md).
