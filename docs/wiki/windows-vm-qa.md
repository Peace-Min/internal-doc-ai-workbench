# Windows VM에서 앱 검증 준비

사용자 선택은 Windows 우선이다. 현재 PC에서는 Windows Sandbox를 검증용 VM으로 사용한다. 별도 설치 ISO 없이 Windows 게스트를 만들 수 있으며, **종료하면 게스트 상태가 사라진다**. 장기 보존 VM이 필요하면 Hyper-V 등 별도 구성이 필요하다. 호스트 화면·입력 장치를 점유하는 앱 QA는 수행하지 않는다.

## 현재 상태 (2026-10-20)

이전 실행 환경에서는 기능 활성화·반입 준비 후 재부팅 대기까지 확인했다. 그러나 Git의 기록과 로컬 Windows 기능·비공개 반입 파일은 함께 이동하지 않는다. 이번 세션의 현재 환경에서는 기능 비활성·CLI 부재·기존 반입 파일 부재를 확인했다. **VM 첫 부팅·게스트 설치·실제 Desktop UI QA는 아직 미실행**이다. 세션을 이어갈 때 다음 점검부터 실행한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/vm/Start-WindowsSandbox.ps1 -ConfigFile ../work/vm/windows-sandbox/Workbench-QA.wsb -Check
```

`-Check`는 기능 설치·재부팅·VM 시작·설정 파일 생성을 하지 않는다. JSON의 `configExists`, `inputFilesPresent`, `featureEnabled`, `cliAvailable`, `restartRequired`, `environmentReadFailed`로 준비 상태를 구분하고 전제 미충족 시 종료 코드 1, 충족 시 0을 반환한다. `ready`는 시작 전제만 뜻하며 입력 해시·게스트 부팅·실제 앱 QA 성공을 보장하지 않는다. 해시는 준비기와 게스트가 별도로 검사한다. `restartRequired:false`라도 기능이 비활성이면 활성화부터 필요하며, 관리자 설치 후 반환된 재부팅 필요 여부를 다시 확인한다.

## 반입 패키지 준비

`versions.json`에 고정된 ONLYOFFICE Desktop Editors ZIP과 Windows x64 Node 디렉터리(node.exe와 LICENSE)를 준비한다. 내부 문서·설정 대신 합성 PPTX를 선택적으로 반입한다.

```powershell
npm test
npm run package
node scripts/vm/prepare-sandbox.mjs --desktop-zip C:\QAAssets\DesktopEditors_x64.zip --node-dir C:\QAAssets\node-v24.22.0-win-x64 --fixture C:\QAAssets\synthetic.pptx
```

기본 출력은 Git에서 제외되는 `private/vm-sandbox`다. `--output-dir`로 다른 전용 경로를 지정할 수 있다. 준비기는 고정된 실행 파일·고지의 SHA-256을 먼저 확인하고 원본 편집기 ZIP·소스 ZIP·게스트 스크립트와 manifest를 만든다. VM이나 Windows 기능은 시작하지 않는다.

## Windows 기능 활성화와 실행

관리자 PowerShell에서 다음을 실행한다. Windows 기능 설치는 관리자 권한이 필요하다. 결과의 `restartNeeded`가 참이면 저장 중인 작업을 정리하고 재부팅한다. 스크립트는 자동 재부팅하지 않는다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/vm/Enable-WindowsSandbox.ps1 -ResultFile "$PWD\private\vm-sandbox\enable-result.json"
```

재부팅 후 일반 PowerShell에서 실행한다. Windows 11 24H2 이상에서 제공되는 `wsb.exe` CLI가 필요하다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/vm/Start-WindowsSandbox.ps1 -ConfigFile private/vm-sandbox/Workbench-QA.wsb
```

이 실행기는 `wsb start`와 System 컨텍스트의 `wsb exec`로 준비하며 `wsb connect`를 호출하지 않는다. 호스트에 게스트 화면 창을 열지 않는다. CLI 시작·게스트 실행 자체는 현재 재부팅 대기 때문에 실검증 전이다. 시작 후 실패하면 `wsb list --raw`와 `host-state.json`을 확인하고 중복 VM부터 만들지 않는다. 종료 시 해당 ID만 `wsb stop --id <ID>`로 중지한다.

## 격리와 준비 결과

- 메모리 4GB, vGPU·네트워크·클립보드·오디오/영상 입력·프린터 공유를 끈다.
- 전용 input 폴더만 읽기 전용으로 공유하고 results 폴더만 쓰기 허용한다. 사용자 홈·사내 설정·모델은 공유하지 않는다.
- 게스트는 입력 해시 확인 후 `C:\QAWorkbench`에 앱, `C:\QAEditors`에 편집기를 압축 해제하고 게스트 사용자에 플러그인을 배치한다. 게스트 표시 폴더/사용자 검사와 중복 준비 잠금을 사용한다.
- 게스트 Node 테스트 결과는 `results/node-tests.log`, 준비 결과는 `results/bootstrap.json`에 기록한다. VM ID는 게스트 쓰기 폴더 밖 `host-state.json`에 보관한다.
- 준비 성공도 실제 앱 실행·UI 검증 성공을 뜻하지 않는다. 보고서의 `actualAppQATested`는 false다.

다음 단계는 게스트 준비 보고서를 확인한 뒤 VM 내부에서 페이지 수정·충돌·undo/redo·저장/재열기·레이아웃을 검증하는 것이다. 현재 네트워크를 차단했으므로 호스트 로컬 LLM도 연결되지 않는다. 실제 추론 QA에는 게스트 내부 모델/실행기를 별도로 준비하거나 명시적으로 제한된 통신 구성을 설계해야 한다.

공식 근거: [Sandbox 설치](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install), [CLI](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-cli), [WSB 설정](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file).
