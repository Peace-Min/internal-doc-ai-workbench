# Desktop Editors API 조사

기준일: 2026-10-18. 문서의 최신 API를 그대로 가정하지 않고 DesktopEditors `v10.0.0`의 gitlink가 가리키는 sdkjs `72b0421c0bbf9d01eed9cf14834ae47eb2df1b50` 소스를 확인했다. 실행 검증과 소스 존재 확인은 구분한다.

| 작업 | 고정 SDK 확인 결과 | PoC 적용 |
| --- | --- | --- |
| 개체 선택 | `Api.GetSelection().GetType()/GetShapes()` 존재 | 테두리를 선택한 단일 shape만 읽기 |
| 개체 식별 | `ApiDrawing.GetInternalId()` 존재 | 현재 편집 세션 내 원래 대상 ID 기록 |
| 원래 개체 조회 | `ApiPresentation.GetAllShapes()` 존재 | 현재 선택과 무관하게 ID 검색 |
| 텍스트 읽기 | `ApiShape.GetContent()` + `GetAllParagraphs()` + `GetElement()` + run `GetText()` | 한 문단·한 run에 한정 |
| 텍스트 변경 | run `ClearContent()` + `AddText()` 존재 | 기존 run 재사용. 실제 서식 보존·undo는 미검증 |
| 슬라이드 번호 | `GetCurSlideIndex()` 존재 | 표시용. ID 대신 위치를 수정 키로 사용하지 않음 |
| 최신 `GetActiveShape`/`GetTextRange` | 해당 고정 slide/apiBuilder.js에 없음 | 사용하지 않음 |
| 표·이미지·다중 run | 후속 검증 필요 | 첫 버전 수정 차단 |
| PDF | 첫 PoC 밖 | config EditorsSupport에 pdf를 선언하지 않음 |

## 공식 근거

- [DesktopEditors 고정 릴리스](https://github.com/ONLYOFFICE/DesktopEditors/releases/tag/v10.0.0)
- [고정 소스와 submodule](https://github.com/ONLYOFFICE/DesktopEditors/tree/v10.0.0)
- [Presentation API 고정 소스](https://github.com/ONLYOFFICE/sdkjs/blob/72b0421c0bbf9d01eed9cf14834ae47eb2df1b50/slide/apiBuilder.js)
- [공유 문단·run API 고정 소스](https://github.com/ONLYOFFICE/sdkjs/blob/72b0421c0bbf9d01eed9cf14834ae47eb2df1b50/word/apiBuilder.js)
- [플러그인 패널과 한계](https://api.onlyoffice.com/docs/plugins/get-started/overview)
- [Desktop 수동 설치](https://api.onlyoffice.com/docs/plugins/development-workflow/installing-and-testing/desktop-editors-installation)

## 실제 엔진에서 확인할 사항

패널 활성화 시 선택 개체 유지, callCommand 콜백, Origin/localhost 통신, ClearContent+AddText의 단일 undo 처리, 텍스트 서식·문단 속성·레이아웃, 그룹 내부 개체 제한, 저장 후 ID 변경, 파일을 바꾸거나 다시 열었을 때 플러그인 상태 초기화를 확인한다. 내부 ID는 영구 문서 식별자로 취급하지 않는다.
