# Desktop Editors API 조사

기준일: 2026-10-18. 문서의 최신 API를 그대로 가정하지 않고 DesktopEditors `v10.0.0`의 gitlink가 가리키는 sdkjs `72b0421c0bbf9d01eed9cf14834ae47eb2df1b50` 소스를 확인했다. 후속으로 [실제 엔진의 단순 PPTX 기본 흐름](qa/2026-10-18-desktop.md)을 검증했다. 아래 소스 조사와 후속 실행 결과를 구분한다.

| 작업 | 고정 SDK 확인 결과 | PoC 적용 |
| --- | --- | --- |
| 개체 선택 | `Api.GetSelection().GetType()/GetShapes()` 존재 | 테두리를 선택한 단일 shape만 읽기 |
| 개체 식별 | `ApiDrawing.GetInternalId()` 존재 | 현재 편집 세션 내 원래 대상 ID 기록 |
| 원래 개체 조회 | `ApiPresentation.GetAllShapes()` 존재 | 현재 선택과 무관하게 ID 검색 |
| 텍스트 읽기 | `ApiShape.GetContent()` + `GetAllParagraphs()` + `GetElement()` + run `GetText()` | 한 문단·한 nonempty run에 한정. 빈 run 보존. 실제 읽기 확인 |
| 텍스트 변경 | run `ClearContent()` + `AddText()` 존재 | 기존 run 재사용. 단순 합성 PPTX의 서식·undo/redo·저장·재열기 확인 |
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

0.5.0 inspect는 위에서 확인한 GetAllParagraphs/GetElementsCount/GetElement/run.GetText를 순회하여 여러 문단·run을 읽는다. 새 쓰기 API는 사용하지 않는다. 모의 API의 쓰기 호출 0회 및 헤드리스 데모를 검증했으며 실제 Desktop에서 새 읽기 범위를 실행한 것은 아니다. [질의·요약 QA](qa/2026-10-19-read-only.md)를 참고한다.

패널 활성화 시 선택 개체 유지, callCommand 콜백, Origin/localhost 통신, ClearContent+AddText의 단일 undo/redo, 저장·재열기는 단순 합성 PPTX로 확인했다. 실제 Origin은 `file://`였다. run/shape 서식 XML은 보존되었고 저장 시 drawing ID는 변경되었다. 내부 ID는 영구 문서 식별자로 취급하지 않는다. 복잡한 문서·그룹·다중 nonempty run·동시 편집 등은 추가 검증한다.
