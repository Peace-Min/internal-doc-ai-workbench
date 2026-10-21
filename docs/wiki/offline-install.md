# Windows 오프라인 설치

0.13.0은 관리자 권한 없이 사용자 폴더에 편집기·프로젝트·Node를 배치하고 ONLYOFFICE 사용자 플러그인을 설치하는 명령을 제공한다. 기존 플러그인은 별도 폴더로 백업한다. 설치는 프로그램을 기동하거나 외부 파일을 다운로드하지 않는다.

## 반입물

인터넷이 되는 준비 PC에서 다음을 준비한다. 편집기와 Microsoft 런타임은 프로젝트 공개 ZIP에 포함하지 않는다.

1. Node 런타임 포함 `internal-ai-workbench-windows.zip`과 `SHA256SUMS.json`. [배포물 생성](portable-package.md).
2. [ONLYOFFICE Desktop Editors v10.0.0](https://github.com/ONLYOFFICE/DesktopEditors/releases/tag/v10.0.0)의 `DesktopEditors_x64.zip`. SHA-256은 `54979d04f1cdca56deb0c62e0356355a45f392cdb54f04f6b7e436b1f44c3605`다.
3. 대상 PC에 x64 VC++ 런타임이 없으면 [Microsoft 공식 런타임](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)을 별도 반입해 먼저 설치한다. 이 설치는 관리자 권한이 필요할 수 있다. 프로젝트 설치기는 자동 권한 상승·다운로드·재부팅을 하지 않는다.

해시가 다른 편집기 또는 Node는 쓰기 전에 거부한다. 다른 버전 도입은 versions.json의 검토된 고정값을 갱신하는 별도 작업이다. 다운로드 성공만으로 라이선스 고지 의무가 없어지지 않으며 공식 배포물의 고지를 보존한다.

## 설치

Windows ZIP을 작업 폴더에 해제한다. 열려 있는 ONLYOFFICE를 직접 닫은 뒤 해당 폴더에서 실행한다.

```powershell
.\Install-Desktop.cmd -EditorZip 'D:\반입\DesktopEditors_x64.zip'
```

기본 위치는 `%LOCALAPPDATA%\InternalDocAIWorkbench\<배포 버전>`이다. 다른 새 위치는 `-InstallDirectory 'D:\Workbench\0.14.0'`로 지정한다. 설치 원본 폴더의 안/상위나 기존 목적지는 거부하며 파일을 덮어쓰지 않는다. 편집기가 실행 중이면 강제 종료하지 않고 중단한다.

실행 결과 `ok=true`와 `pluginInstalled=true`를 확인한다. 편집기 백업과 달리 기존 사용자 플러그인 백업은 `%LOCALAPPDATA%\InternalDocAIWorkbench\plugin-backups\<고유 ID>`에 남고 결과 JSON의 pluginBackup에 경로가 표시된다. 실패한 임시 설치 폴더는 진단을 위해 보존한다.

설치기는 배포물의 허용된 파일/폴더만 복사한다. 작업 원본의 `.env`, `private`, 모델, 문서 폴더를 자동으로 가져오지 않는다. 기존 설정은 검토 후 설치된 `app\.env`에 별도로 옮긴다. 사내 주소와 키는 Git에 넣지 않는다.

## 실행과 업데이트

설치 위치의 `Start-Desktop.cmd`로 로컬 서비스와 편집기를 시작한다. 서비스 콘솔은 최소화되고 편집기가 열린다. 플러그인 연결 코드는 설치 위치의 `app\private\runtime.json`에 있으며 [플러그인 연결 절차](desktop-setup.md)를 따른다. 기본값은 모의 AI다. 실제 사내 모델 설정은 [사내 LLM](internal-llm.md)을 참고한다.

실행기를 여러 번 누르면 기존 서비스 포트를 중복 점유할 수 없다. 기존 연결 코드도 덮어쓰지 않지만 편집기를 여러 번 여는 효과는 엔진 동작에 따른다. 서비스 중복 실행을 종료한 뒤 기존 실행을 사용한다.

업데이트는 새 버전의 새 목적지에 설치한다. 이전 앱/설정은 자동 삭제하지 않는다. 새 플러그인이 문제를 일으키면 편집기를 닫고 현재 플러그인 폴더를 별도 보관한 후 백업을 원래 GUID 위치로 복원한다. 설치된 편집기·프로젝트 폴더를 삭제하기 전 문서와 설정을 따로 보관한다. 자동 제거기는 제공하지 않는다.

이 절차는 MSI/EXE 설치 관리자, 파일 연결 등록, 전체 PC 이미지 준비를 뜻하지 않는다. 실제 사내 접속·PDF AI/본문 편집·대규모 문서 품질은 별도 검증 대상이다.
