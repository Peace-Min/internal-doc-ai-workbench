# Sandbox 클라이언트 보완과 실제 게스트 준비

실행일: 2026-10-21 (Asia/Seoul). 사용자가 환경 구축 보완을 요청했다. 호스트 화면·키보드·마우스를 제어하지 않고 공식 Store CLI와 wsb CLI를 사용했다.

## 원인과 조치

사용자 재부팅 뒤 Windows 기능은 활성화됐고 재부팅 대기는 해소됐으나, wsb.exe와 새 Appx 클라이언트는 없었다. 기존 WindowsSandbox.exe만 존재했다. [Microsoft FAQ](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-faq)는 기본 제공 클라이언트와 Store 클라이언트 및 wsb 버전 확인을 구분한다.

Store 이름 검색으로는 제품을 찾지 못했다. Windows에 포함된 WindowsSandbox.exe의 제품 ID와 PFN을 확인하고, 공식 Store CLI로 제품 ID 9NSMXC3NB0HN의 Windows Sandbox / Microsoft Windows 게시자 / MicrosoftWindows.WindowsSandbox_cw5n1h2txyewy를 대조한 뒤 설치했다. 제3자 다운로드 사이트·비공식 패키지는 사용하지 않았다.

설치된 클라이언트는 0.8.107.0이다. Get-AppxPackage Status=0 및 wsb --version 출력, wsb list --raw의 빈 목록을 확인했다. -Check는 ready/featureEnabled/cliAvailable/inputFilesPresent/configExists true, restartRequired/environmentReadFailed false였다.

## 실제 게스트 검증

기존 Start-WindowsSandbox.ps1로 wsb start와 System 컨텍스트 exec를 실행했다. 원격 화면 연결은 열지 않았으며 호스트에 WindowsSandboxRemoteSession 프로세스도 관찰되지 않았다. CLI가 반환한 VM ID와 list --raw 목록, host-state.json의 guest-prepared를 대조했다. 실행 중 ID는 비공개 작업 디렉터리에만 보관한다.

게스트 Bootstrap-Guest.ps1 완료 보고서는 다음과 같다.

- ok=true, stage=prepared, projectVersion=0.12.0
- nodeVersion=v24.22.0, nodeTestsExitCode=0
- editorExecutableFound=true, pluginInstalled=true
- actualAppLaunched=false, actualAppQATested=false

게스트의 실제 Node 테스트는 총 93개 중 92개 통과, 실패 0개, 호스트 전용 검사 1개 의도적으로 건너뜀이다. 준비 스크립트가 호스트에서 실행되지 않는지 확인하는 테스트는 이미 게스트 안이므로 제외됐다. 다른 테스트를 임의로 생략하지 않았다.

편집기 ZIP을 푸는 동안 별도의 System 명령으로 게스트 파일 목록을 결과 공유 폴더에 기록하여 실제 게스트 명령 실행과 압축 해제 진행을 확인했다. 최종 결과와 테스트 로그는 work/vm/windows-sandbox/results에 있다. 사용자 문서·인증정보·사내 연결은 사용하지 않았다.

## 현재 상태와 한계

게스트는 실행 상태로 유지했다. 메모리 설정 4096MB, vGPU·네트워크·클립보드 차단, 입력 읽기 전용·결과 쓰기 허용 설정을 유지한다. host-state.json에 기록된 해당 VM만 재사용하고 중복 시작하지 않는다. 종료하면 게스트 앱·설치 상태가 사라지지만 호스트 results 보고서는 남는다.

실제 Desktop UI·페이지 수정·undo/redo·저장/재열기·렌더링 및 게스트 내부 LLM은 아직 미검증이다. 합성 PPTX와 LLM 모델도 이번 반입 묶음에 추가하지 않았다. 현재 결과는 VM과 개발 도구 준비 완료이며 앱의 실제 UI 검증 완료가 아니다. 앱 코드 변경이 없어 호스트 테스트를 반복하지 않았다.
