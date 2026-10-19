# Windows 실행·배포 준비

## 사용자 실행

런타임 포함 Windows ZIP을 쓰기 가능한 폴더에 전부 풀고 Start-Workbench.cmd를 실행한다. Node를 설치할 필요가 없다. 실행기는 서비스만 시작하고 브라우저·편집기는 자동으로 열지 않는다. [처음 실행](../../FIRST-RUN.md)을 따른다.

소스에서 실행할 때는 설치된 Node 22.14.0 이상으로 `npm run launch` 또는 `npm run check`를 사용할 수 있다. check는 설정과 런타임 버전만 확인한다. 성공해도 포트 사용 가능 여부·사내 서버 연결·편집기 설치는 확인된 것이 아니다.

프로젝트 폴더의 .env를 읽으며 실행한 터미널의 현재 폴더에 의존하지 않는다. 프로세스에 이미 설정된 환경 변수가 .env보다 우선한다. 실제 Claude 설정 파일은 로컬 경로로 읽고 복사·배포하지 않는다. 실행 오류는 내부 설정 원문을 출력하지 않는다.

## 빌드

기본 `npm run package`는 플러그인·소스 ZIP·런타임 없는 Windows ZIP·SHA256SUMS.json을 생성한다. 런타임 없는 판은 사용자가 Node를 설치해야 한다.

런타임 포함판은 온라인 준비 환경에서 [Node 24.22.0 Windows x64 원본 ZIP](https://nodejs.org/dist/v24.22.0/node-v24.22.0-win-x64.zip)과 [공식 SHA-256 목록](https://nodejs.org/dist/v24.22.0/SHASUMS256.txt)을 확보한다. 내려받은 ZIP의 SHA-256이 versions.json의 archiveSha256 및 공식 목록과 같은지 확인한 후 작업 폴더에 압축 해제한다. 이번 고정값은 `f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3`이다.

```powershell
npm run package -- --runtime-dir "C:\Build\node-v24.22.0-win-x64" --output-dir "C:\Build\delivery"
```

위 경로는 예시이며 실제 작업 폴더로 바꾼다. 런타임 파일을 저장소에 복사하지 않는다. 빌더는 node.exe와 LICENSE의 해시를 versions.json과 대조하며 불일치하면 배포물 생성 전에 중단한다. 다운로드·자동 업데이트·모델 설치는 빌더에 포함하지 않는다.

## 배포물

- internal-ai-workbench.plugin: 수동 설치할 플러그인과 원본 고지.
- internal-ai-workbench-source.zip: 공개 소스, 실행기, QA·Wiki. Node 바이너리는 제외.
- internal-ai-workbench-windows.zip: 소스 ZIP의 내용, 설치용 플러그인. runtime-dir 지정 시 Node 실행 파일·원본 LICENSE·출처/체크섬 ORIGIN.json을 추가.
- SHA256SUMS.json: 위 3개 배포물의 SHA-256. 전달받은 파일의 해시와 대조한다.

기본 수집 목록에 .env·private·인증서·node_modules는 포함하지 않는다. 공개 소스 폴더인 plugin/src/scripts/docs/test에 비공개 자료를 넣으면 재귀 수집될 수 있으므로 이 폴더에는 공개 가능한 파일만 둔다. 비밀 파일은 저장소 원칙에 따라 private 또는 외부 로컬 경로로 분리한다.

루트 LICENSE와 플러그인 원본 고지를 유지한다. Node 원본 LICENSE에는 제3자 고지도 포함되어 있으므로 그대로 배포한다. Node의 고정 출처와 파일 해시는 versions.json 및 동봉 ORIGIN.json에서 확인한다.

## 운영 및 실패 처리

서비스를 쓰는 동안 실행 창을 열어 두고 종료할 때 Ctrl+C를 누른다. Windows가 배치 작업 종료 여부를 물으면 Y로 종료한다. 종료 후 runtime.json은 남을 수 있으며 실행 중인 서비스의 연결 코드만 유효하다. 재시작하면 코드를 다시 확인한다.

같은 포트에 서비스가 있으면 두 번째 실행은 실패하고 기존 runtime.json을 덮어쓰지 않는다. 다른 포트로 같은 폴더의 서비스를 여러 개 실행하는 방식은 지원 운영 절차가 아니므로 한 폴더에서는 한 서비스만 실행한다. runtime.json 기록 실패 시 새 서비스는 포트를 해제하고 중단한다.

통합 시스템 설치 프로그램, 편집기·폰트·모델 묶음, 인터넷 차단 신규 PC 설치는 후속 단계다. [이번 QA](../qa/2026-10-19-portable.md)는 포함 런타임으로 로컬 기동·테스트가 가능한 범위를 확인했다. 별도 VM/전용 테스트 PC는 아직 준비되지 않아 실제 Desktop UI는 검증하지 않았다.
