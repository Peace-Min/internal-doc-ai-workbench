# 사용자 계정 오프라인 설치 0.13.0

Windows Sandbox의 네트워크 차단 상태에서 런타임 포함 배포 후보를 별도 폴더에 해제하고 새 설치기를 실행했다. VC++ 런타임은 앞선 환경 구축 단계에서 설치된 상태였다. Windows 기능/VC 런타임까지 자동 설치한 시험은 아니다.

## 실제 결과

- 고정 Desktop Editors ZIP과 동봉 Node 실행 파일/고지 해시 확인 후 사용자 AppData의 새 0.13.0 위치에 편집기·앱·런타임 설치 성공.
- 실행 중 편집기가 있으면 쓰기 전에 거부하며 프로세스를 강제 종료하지 않음. QA 중 열린 합성 fixture의 소유 프로세스를 별도로 종료한 뒤 설치를 수행했다. 문서 편집·저장 결과 시험은 아니다.
- 기존 0.12.1 사용자 플러그인을 별도 backup으로 보존하고 0.13.0 플러그인 설치 확인.
- 설치 원본에 합성 `.env`/private sentinel을 추가해도 설치 결과에는 포함되지 않음. 설치기가 서비스나 편집기를 자동 시작하지 않음.
- PATH가 빈 환경에서 동봉 Node로 설치된 서비스 --check 성공. 같은 목적지 재설치는 거부하고 기존 내용을 보존.
- 설치 후보의 health 버전 상수 문제를 발견해 package.json의 버전을 한 번 읽도록 수정했다. 최종 서버 파일을 설치된 app/src에 반영한 뒤 실제 loopback HTTP에서 0.13.0/플러그인 버전 일치, 인증 없는 요청 401, file:// Origin과 합성 수정 요청 200 확인. mock이고 외부 LLM 요청은 없음.
- 변경된 편집기 ZIP의 설치 전 거부를 회귀 테스트로 추가. 배포 검사에 새 설치 CMD/스크립트 포함 여부를 추가했다.
- 별도 PowerShell에서 Utility 함수 자동 로드가 실패한 경우를 수정했고, 설치 경로가 드라이브 바로 아래인 경우의 폴더 생성 오류도 재현/수정했다. 목적지는 .NET의 덮어쓰기 없는 디렉터리 이동으로 확정한다. 수정한 최종 설치기를 `C:\QA Installed Final 0130`처럼 공백 있는 새 위치에 다시 실행해 전체 편집기/앱/플러그인 설치 성공을 확인했다. 설치기 SHA-256은 `1f3c19eb83fbe49ecd50ad2f11f3389215956099aff10cef0412ee6817906b39`다.

호스트/동봉 런타임의 PATH 없는 배포본에서 각각 96개 테스트 통과. VM은 최종 설치기를 반영한 소스에서 95개 통과/호스트 전용 1개 제외/실패 0개다. 로컬 결과는 work/vm/windows-sandbox/results/offline-install-0130.json, offline-install-0130-final.json, offline-installed-preflight.json, offline-installed-api.json, offline-installed-final-api.json, final-0130-tests.json/log다. 처음 후보와 최종 배포 ZIP은 서버 버전 처리·설치기 수정·문서/검증 파일이 다르며 최종 설치기와 서버는 위의 추가 실제 설치/API 시험으로 확인했다.

## 별도 제한

추가 UIA 조회 깊이를 25로 늘리면 실제 편집기 요소가 163개 보였다. 이전 29개 관찰은 깊이 8 결과다. Plugins SelectionItemPattern 호출은 종료 0을 반환했지만 IsSelected=false로 실제 선택을 확인하지 못했다. 터치 입력은 일반 wsb exec와 게스트 Interactive 작업 모두 no_interactive_desktop으로 거부됐다. 실제 편집·undo·저장을 통과 처리하지 않았다.

VM LLM 설치/실행 준비 명령은 자동 승인 검토에서 실행 전 blocked by policy로 거부됐다. 재실행/우회를 하지 않았다. 공개 모델/런타임 다운로드·해시 검증은 완료했지만 게스트 실제 추론은 미실행이다.

제품 전체 인수 조건과 외부 전제는 [완료 판정](../06-completion.md), 설치 절차는 [오프라인 설치](../wiki/offline-install.md)를 따른다.
