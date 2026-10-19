# 개발 설계 및 기술 검증

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
