# 개발 설계 및 기술 검증

## 0.12.0 페이지 수정 파이프라인

rewrite_slide 요청의 60개 이하 구간·개체/문단 정보·전체 문맥을 두 LLM 어댑터에 전달한다. 모든 ID를 정확히 한 번 포함한 계획만 검증한다. page-command.js는 callCommand에서 독립 실행되며 페이지 캡처/전체 원문 충돌 검사/기존 run 쓰기/역순 복구를 수행한다. UI는 변경 전후를 textContent로 표시하고 명시 적용 전에는 문서를 변경하지 않는다. OpenAI 경로는 JSON schema 지원이 필요하다.

## 0.11.0 선택적 Marker 분석

scripts/marker의 Python 추출기가 PDF 해시·페이지 번호·Marker Markdown 패킷을 만든다. marker-context.mjs는 200페이지·12,000자 한도와 출처를 검증한다. evaluate-grounding.mjs는 loopback 모델만 허용하고 짝지은 합성 평가의 전체 응답과 대리 지표를 저장한다. Python 의존성은 선택 사항이며 Node 앱의 기본 실행·테스트에는 추가하지 않는다. PDF 패널 UI 통합은 후속 단계다.

## 0.10.0 실제 모델 검증 명령

local-verification.mjs와 verify-local-llm CLI를 추가했다. 기존 설정 로더·인증 브리지·응답 계약을 재사용하고 명시 loopback 주소만 허용한다. 고정 합성 자료의 질문·요약·문장 보완을 순차 요청하며 원문 대신 형식 통과·시간·길이·기초 관찰값만 보고한다. 외부 의존성과 기본 네트워크 테스트를 추가하지 않는다.

## 0.9.0 기록별 대조

app.js의 history에 sourceText 사본을 보관하고 기록 번호로 조회한다. report.js의 review는 정형 출처를 sources 목록과 비교한다. DOM은 textContent로만 표시하며 보고서 직렬화에는 원문 사본을 포함하지 않는다. 원문 사본도 최대 20건·건당 12,000자 제한과 명시적 삭제를 따른다. 추가 HTTP·편집 API·외부 의존성은 없다.

## 구성 초안

```text
폐쇄망
클라우디움 ←→ 문서 연동 모듈 ←→ ONLYOFFICE Desktop Editors (사용자 PC)
                                      ↕ 자체 플러그인
                               로컬 AI 연동 서비스 (127.0.0.1:4318)
                                 ├─ 사내 LLM API
                                 └─ Marker 분석 서비스
```

사용자 선택에 따라 PC 설치형을 우선한다. 문서 연동 모듈은 아직 미구현이다. 로컬 서비스는 Node 기본 모듈만 사용한다. 0.3.3부터 플러그인의 연결 설정에서 서비스와 같은 포트를 입력할 수 있다. 기본은 4318이며 로컬 HTTP 화면은 현재 포트를 기본값으로 사용한다. 대상 주소는 127.0.0.1로 제한하고 포트 변경 시 재연결을 요구한다.

## 역할

- ONLYOFFICE Desktop Editors: 문서 표시·선택·편집·저장 UI 후보. 10.0.0을 PoC 검증 대상으로 고정.
- 자체 플러그인: 채팅 패널, 대상 선택, LLM 요청, 수정안 미리보기와 적용.
- 내부 서버: 인증 연계, 문서 접근, LLM API 어댑터, 분석 작업 처리.
- Marker: PDF 등에서 텍스트·표·이미지 구조 추출. PPTX 개체 편집을 위한 원본 ID·서식의 대체 수단이 아니다.
- 사내 LLM: 질문 답변·요약·수정 제안. 실제 파일 변경은 검증된 편집 명령으로 수행.

## 순차 검증

| 단계 | 작업 | 산출물 |
| --- | --- | --- |
| D01 | 고정 Community 버전의 Plugin API 조사 | 선택/수정/표/이미지/PDF 지원표 |
| D02 | 합성 PPTX와 모의 LLM으로 플러그인 구현 | 채팅·선택·미리보기·적용 PoC |
| D03 | 사내 LLM 어댑터 연결 | 실제 내부 API 테스트 결과 |
| D04 | 클라우디움 열기·저장 연결 | 권한·버전 충돌 처리 |
| D05 | Marker 별도 분석 PoC | 블록 JSON·이미지·위치 검증 |
| D06 | PDF 기능 구현 | 확정된 편집 범위의 테스트 |
| D07 | 반입 패키지 생성 | 버전 목록·모델 목록·설치 절차 |

현재 D01은 고정 SDK 소스 조사 완료, D02는 실제 Desktop Editors의 단순 PPTX 기본 흐름까지 검증했다. D03은 OpenAI/Anthropic 어댑터 구현과 로컬 모의 HTTP QA 완료이며 실제 사내 서버 검증은 미완료다. D04~D07 전체 실증도 미완료다. [기술 조사](06-desktop-api-research.md), [Desktop QA](qa/2026-10-18-desktop.md), [LLM QA](qa/2026-10-18-anthropic.md)를 참고한다.

## AI 변경 데이터 초안

0.7.0 inspect_document는 선택적 정수 startSlide/endSlide를 받는다. 원본 Slides 배열에서 해당 구간의 GetAllDrawings만 호출하며 기존 텍스트 추출과 상한 검사를 재사용한다. 범위 머리말도 12,000자 한도에 포함한다. 외부 LLM 프로토콜은 변경하지 않고 범위가 표시된 텍스트를 기존 요청으로 보낸다.

0.6.0 inspect_document는 GetAllSlides/GetAllDrawings와 공통 readText로 실제 슬라이드의 지원 텍스트를 모은다. 출처 표기와 집계를 반환하며 ask/summarize 요청은 기존 API를 재사용한다. 자동 분할·자동 요청·문서 쓰기를 하지 않는다. 초과 시 캡처를 거부하며 범위 변경 시 기존 캡처를 무효화한다.

0.5.0의 실제 요청은 operation/text/instruction이며 operation은 replace_text, ask, summarize를 지원한다. 아래 변경 데이터는 설계 예시다. 질의·요약은 선택 개체의 일반 텍스트만 읽고 answer를 반환하며, 문서 변경 명령으로 변환하지 않는다. 여러 문단·run 읽기는 inspect에만 허용한다. 적용 명령과 수정안 형식은 기존 제한을 유지한다.

```json
{
  "documentVersion": "example-version",
  "target": {"slide": 3, "objectId": "example-object"},
  "operation": "replace_text",
  "originalText": "합성 문서의 기존 문장",
  "proposedText": "LLM이 제안한 수정 문장"
}
```

이 형식은 설계 예시이며 ONLYOFFICE 실제 API 형식이 아니다. 대상 ID의 안정성, 중첩 그룹·문단·run의 식별은 PoC에서 결정한다. 적용 전에 문서 버전과 기존 내용이 일치하는지 검사하고, 사용자 확인 후 적용한다. 임의 JavaScript 실행은 허용하지 않는다.

## Marker 연결 원칙

첫 AI 요청 또는 사전 분석 때 실행하고 문서 버전별 결과를 재사용한다. 수정 후에는 분석 결과를 무효화하거나 갱신한다. PDF 블록 ID/좌표를 PPTX 개체 ID/좌표로 직접 간주하지 않는다. 분석 데이터에는 원본 버전·페이지·블록 출처를 유지한다.

## 폐쇄망 패키징

0.4.0은 Windows 실행기, 사전 설정 점검, 선택적 Node 런타임 동봉을 구현했다. --runtime-dir을 지정하면 versions.json에 고정한 Node 실행 파일과 LICENSE의 SHA-256을 검사한 뒤 배포물에 넣는다. source ZIP에는 런타임 바이너리를 넣지 않는다. 서버는 포트를 점유한 뒤 연결 코드를 기록하며 기록 실패 시 서버를 닫는다. [배포 절차](wiki/portable-package.md), [실행·패키지 QA](qa/2026-10-19-portable.md)를 참고한다. 아래 전체 반입 계획과 실제 차단 환경 설치는 아직 미완료다.

ONLYOFFICE 이미지/설치물, 플러그인 정적 자산, 서버 의존성, Marker 의존성·모델·추론 런타임, 폰트를 사전 준비한다. 버전과 체크섬·라이선스를 기록한다. 외부 CDN·최초 실행 모델 다운로드·온라인 마켓플레이스를 필수 경로에서 제거하고, 깨끗한 인터넷 차단 환경에서 설치부터 검증한다.

## 세션 분석 보고서 (0.8.0)

plugin/app.js는 검증된 읽기 전용 답변만 최대 20건 누적한다. 요청 직전 유효 지시·대상 메타데이터를 복사하여 응답 대기 중 입력 변경에 영향을 받지 않는다. 기존 범위/모드 초기화와 기록 초기화를 분리했다. 20건에서 추가 질의·요약은 네트워크 전에 거부한다. plugin/report.js는 읽기/답변 UTC 시각·모의 여부·출처·제외 안내와 답변을 일반 텍스트로 구성한다. Blob 다운로드는 명시 버튼으로만 요청하며 지원되지 않으면 readonly textarea에서 직접 복사한다. 서버 저장·localStorage·추가 패키지·자동 모델 호출은 없다.

## VM 시작 전 점검

Start-WindowsSandbox.ps1 -Check는 Windows 기능·CLI·재부팅·반입 파일 존재를 JSON으로 반환하고 전제 미충족 시 1을 반환한다. 점검은 VM 시작·파일 생성·기능 설치를 하지 않는다. 일반 실행도 같은 검사를 공유한다. 입력 해시/실제 게스트 동작은 별도 단계이며 Git 동기화만으로 Windows 기능과 비공개 작업 자산이 준비되었다고 가정하지 않는다.

## 구간별 숫자 검사 (0.12.1)

validateSlidePlan은 ID로 정규화한 각 구간의 숫자 토큰 배열을 순서까지 비교한다. page-command.js는 외부 클로저가 없는 직렬화 명령이므로 같은 검사를 자체 수행하며 모든 쓰기 전에 거부한다. 오류 코드와 명시 허용은 유지했다.

## 사용자 설치기 (0.13.0)

Install-Desktop.cmd는 Windows PowerShell 설치기를 실행한다. 프로젝트/편집기/Node를 새 사용자 목적지에 배치하고 이전 플러그인을 백업한 뒤 설치한다. 소스 화이트리스트로 .env/private를 제외한다. 설치 중간 파일과 기존 설치는 자동 삭제하지 않는다. Windows PowerShell Utility 모듈을 PSHOME에서 명시 로드해 다른 PowerShell의 모듈 환경을 상속한 호출에서도 Get-FileHash를 사용할 수 있게 했다. HTTP health는 package.json 버전을 한 번 읽어 응답하며 공개 static 경로는 확대하지 않는다.
