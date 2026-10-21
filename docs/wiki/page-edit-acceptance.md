# 실제 페이지 수정 인수 검증

현재 상태: 합성 문서·비교 도구와 [VM 내부 백그라운드 제어](background-vm.md)를 준비했고 실제 편집기에서 합성 PPTX 열기·캡처까지 확인했다. 이전 원격 디버깅 명령은 자동 승인 검토에서 거부되어 재실행하지 않았다. 새 경로는 사용자 요청에 따른 게스트 내부 공식 UIA이며 디버깅 포트를 사용하지 않는다. 아래 수정·undo·저장 절차는 실제 편집기에서 아직 수행하지 않은 검증 계획이다.

## 합성 문서

[page-edit-fixture.pptx](../qa/assets/page-edit-fixture.pptx)는 고정 Desktop Editors ZIP의 빈 템플릿을 기반으로 만든 한 슬라이드·두 텍스트 개체·세 문단·네 run 문서다. 제목과 본문의 혼합 굵기, Budget 950의 앞뒤 공백, Delivery 2026 숫자를 포함한다. 이미지·표·그룹·필드는 없으므로 해당 유형의 지원을 검증하지 않는다.

필요할 때 Python 3.11+ 표준 라이브러리만으로 다시 만든다. 앱이나 VM에 Python을 필수 설치하는 요구가 아니다. 입력 ZIP은 versions.json의 고정 SHA-256과 대조하며 기존 출력은 덮어쓰지 않는다.

```powershell
python scripts/vm/create-page-fixture.py --desktop-zip C:\QAAssets\DesktopEditors_x64.zip --output C:\QAAssets\new-fixture.pptx
python scripts/vm/check-page-fixture.py --desktop-zip C:\QAAssets\DesktopEditors_x64.zip --fixture C:\QAAssets\new-fixture.pptx
```

## 실제 편집기에서 수행할 순서

사용자 호스트 화면을 점유하지 않는, 허용된 VM 제어 수단에서만 진행한다. 현재 VM의 읽기 전용 C:\QAInput\page-edit-fixture.pptx를 게스트 작업 폴더에 복사하여 원본과 편집 사본을 구분한다. 이번 문서는 mock/고정 수정안으로 엔진 동작을 확인하며 LLM 품질 검증과 구분한다.

1. 문서 열기와 페이지 전체 읽기. 두 개체·세 문단·네 텍스트 구간, 950/2026과 경계 공백이 캡처에 남는지 확인한다. 실제 API가 빈 run을 추가할 수 있으므로 의미 있는 텍스트와 경계도 함께 대조한다.
2. 페이지 수정안을 검토하되 적용 전 원문이 바뀌지 않는지 확인한다. 제목/본문을 함께 바꾸고 숫자와 공백을 유지한다. 굵은 구간과 일반 구간이 원래 속성을 유지해야 한다.
3. 한 번의 실행 취소로 페이지 전체 원문 복구, 한 번의 다시 실행으로 수정안 복구를 확인한다. 이 결과를 실제 엔진의 원자성 보장으로 일반화하지 않는다.
4. 캡처 이후 본문 한 구간을 직접 바꾼 뒤 이전 계획 적용을 요청한다. 전체 페이지가 쓰기 전에 거부되는지 확인한다. 거부 뒤 원문/직접 수정한 내용이 그대로인지 확인한다.
5. 복구한 원본을 다시 읽고 숫자 누락 계획을 시도한다. 기본 설정에서 거부되고 원문이 유지되어야 한다. 숫자 변경 허용은 별도 사본에서만 시험한다.
6. 변경 사본을 저장하고 닫은 뒤 다시 열어 텍스트·굵기·줄 넘침을 확인한다. 원본과 저장 사본을 호스트 결과 폴더로 복사한 뒤 비교한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/compare-pptx.ps1 -Original C:\QAResults\original.pptx -Edited C:\QAResults\saved.pptx -Output C:\QAResults\comparison.json
```

비교기는 첫 슬라이드의 단순 fixture용이다. 텍스트가 실제로 바뀌었고 run/도형 속성 및 텍스트·drawing ID 외 XML이 같은지 검사한다. 동일 파일은 textChanged=false로 거부하고 굵기 손상도 거부한다. 실제 편집기가 XML을 재구성하면 이를 검사 결과로 기록하고 원인을 확인한다. 비교 성공만으로 렌더링·전체 PPTX 패키지 보존을 확정하지 않는다.

## 결과 기록

실제 화면/저장 파일/엔진 API 결과를 얻은 항목만 통과로 기록한다. VM 준비·합성 XML 변경·브라우저 데모·모의 SDK 결과를 실제 편집기 검증으로 바꾸어 적지 않는다. 원본·수정 사본·API 읽기 결과·undo/redo 후 텍스트·저장 비교·화면 증거를 함께 보관한다.
