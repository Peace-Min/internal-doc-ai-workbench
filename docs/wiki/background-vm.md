# 사용자 작업을 방해하지 않는 VM 자동화

호스트는 `wsb exec`로 요청만 전달하고, Microsoft winapp CLI 0.7.1은 게스트 안에서 실행한다. 호스트 UI로 대체 실행하거나 VM 창을 자동 연결·활성화하지 않는다. 현재 실행 중인 Sandbox를 재사용한다.

## 확인된 범위

- 게스트 UIA 조회, 합성 WinForms 입력란의 값 변경/재조회, 게스트 창 최소화/복원, 실제 편집기 합성 PPTX 열기와 화면 캡처.
- 편집기는 `DesktopEditors.exe`가 실행한 **editors.exe** 프로세스를 조회한다. 실행기 PID만으로 준비 완료를 판단하지 않는다.
- ONLYOFFICE의 UIA 조회 깊이 8에서는 29개, 추가 깊이 25에서는 탭/버튼을 포함한 163개 요소가 보였다. 하지만 Plugins 선택 호출의 실제 변경은 확인하지 못했고 실제 입력은 no_interactive_desktop으로 거부됐다. 슬라이드 캔버스와 플러그인 수정·undo·저장은 아직 미실행이다.
- 게스트 앱 최소화 시 시험 입력란이 UIA 트리에서 사라졌고, 복원 후 값 변경/조회에 성공했다. 호스트 Sandbox 클라이언트를 최소화한 상태의 동작은 별도로 검증하지 않았다.

현재는 VM 창을 다른 창 뒤에 둔 채 작업할 수 있다. 클라이언트 최소화 상태의 모든 입력/캡처를 보장하지 않는다. Microsoft도 실제 입력/녹화에는 연결된 비최소화 클라이언트를 요구한다. 자동화 중 `wsb stop`이나 VM 종료는 하지 않는다. `wsb start`로 만든 VM은 클라이언트 창 닫기와 VM 종료가 다를 수 있으므로 생존 여부는 `wsb list --raw`로 판단한다.

## 고정 도구 준비

호스트에 설치하지 않고 다운로드한 파일을 기존 stage의 `input`에 둔다. 게스트 네트워크는 계속 차단한다. 프로젝트 배포물에는 이 바이너리를 동봉하지 않는다.

- [winapp CLI v0.7.1 ZIP](https://github.com/microsoft/winappCli/releases/download/v0.7.1/winappcli-x64.zip), SHA-256 `d925d1e32cdc320b6d271f653fd2cd3c05b5d7558deb20d1b548bead77900fcf`. 입력 이름 `winappcli-x64-0.7.1.zip`.
- [Microsoft VC++ x64 런타임](https://aka.ms/vc14/vc_redist.x64.exe), 이번 검증 버전 14.51.36247.0, SHA-256 `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c`. 입력 이름 `vc_redist.x64.exe`. 이 URL은 갱신되므로 해시가 다르면 중단하고 새 버전/서명을 별도로 검토한다.

`scripts/vm/Prepare-BackgroundGuest.ps1`, `Start-BackgroundEditor.ps1`도 input으로 복사한다. 다음 `$id`는 stage의 host-state.json과 실제 `wsb list --raw`를 대조한 ID다. 예제는 저장소 루트에서 실행한다.

```powershell
$stage='../work/vm/windows-sandbox'
$id=(Get-Content "$stage/host-state.json" -Raw | ConvertFrom-Json).id
wsb.exe list --raw
wsb.exe exec --id $id -r System -c 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\QAInput\Prepare-BackgroundGuest.ps1'
Get-Content "$stage/results/background-prepared.json"
```

준비 스크립트는 입력 해시와 Microsoft 서명을 검사하고 게스트에만 VC 런타임을 설치한다. 코드 3010은 게스트 재시작 필요다. 자동 재시작하지 않으며 현재 Sandbox를 종료하면 준비 상태가 사라진다. telemetry opt-out은 CLI 실행마다 설정한다.

## 게스트 편집기 실행과 조회

이미 editors/DesktopEditors 프로세스나 QA 실행 작업이 있으면 새로 시작하지 않는다. `Start-BackgroundEditor.ps1`는 기존 상태를 덮어쓰지 않고 중단한다. VM이 새로 만들어졌다면 이전 프로세스·설치 경로·서비스는 사라진다. 현재 목록을 확인하고 새 게스트에서만 준비/시작한다. 종료된 VM의 성공 보고서를 현재 준비 완료로 사용하지 않는다.

```powershell
wsb.exe exec --id $id -r ExistingLogin -c 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\QAInput\Start-BackgroundEditor.ps1 -Document C:\QAWorkbench\synthetic.pptx'
./scripts/vm/Invoke-SandboxUI.ps1 -StageDirectory $stage -SandboxId $id -UiArguments @('list-windows','-a','editors','--json')
```

게스트 로그인 세션에서 `Workbench-QA-Editor` 작업을 사용한다. wsb exec 자식으로 직접 실행했을 때 창을 관찰하지 못했던 경로와 구분한다. 디버깅 포트를 열지 않는다. 실행 요청 성공과 실제 문서 창 열림은 별도 확인한다.

조회 결과의 현재 PID 또는 HWND로 대상을 고정한다. 예전 VM/PID를 다음 실행에 복사하지 않는다.

```powershell
./scripts/vm/Invoke-SandboxUI.ps1 -StageDirectory $stage -SandboxId $id -UiArguments @('inspect','-a','<현재 PID>','--depth','25','--json')
./scripts/vm/Invoke-SandboxUI.ps1 -StageDirectory $stage -SandboxId $id -UiArguments @('screenshot','-a','<현재 PID>','-o','C:\QAResults\editor.png','--json')
```

래퍼는 요청별 JSON과 stdout/stderr/result를 stage에 보관한다. CLI 오류/로그인 부재는 실패로 보고하며 호스트 입력으로 우회하지 않는다. 인수·캡처에는 합성 데이터만 사용하고 연결 토큰을 넣지 않는다. UIA `set-value`/`invoke`를 우선 사용하며 클릭 등 실제 입력은 게스트의 대상/최신 화면을 확인한 뒤 별도로 검증한다.

공식 근거: [UI Automation](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/ui-automation), [Sandbox 실행](https://github.com/microsoft/winappCli/blob/v0.7.1/docs/sandbox-execution.md), [VC++ 런타임](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). 최신 문서의 기능을 추정하지 않고 설치한 0.7.1의 `--help`와 실제 결과를 기준으로 삼았다.

## 새 VM의 상태 보고와 로그인

준비 보고서는 UTC startedAt와 stage=preparing/prepared/failed를 기록한다. 시작 시 과거 ok=true를 즉시 지우며 해시/서명/설치 실패는 ok=false로 남긴다. 실행 종료 코드와 새 startedAt를 함께 확인하고 과거 보고서만으로 현재 성공을 판정하지 않는다.

새 VM에서 System 준비가 성공해도 ExistingLogin이 가능하다는 뜻은 아니다. 0x80070520은 게스트 로그온 세션이 없다는 뜻이며 실제 편집기 시작 성공으로 기록하지 않는다. 허용된 게스트 로그인 환경이 준비된 뒤 재조회한다. 호스트 화면 연결이나 자격증명/잠금 우회를 자동 대안으로 사용하지 않는다.
