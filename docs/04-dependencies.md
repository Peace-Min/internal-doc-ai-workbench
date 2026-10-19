# 오픈소스 역할 및 라이선스

## 2026-10-20 선택적 분석 실험

실제 Marker 2.0.0(Apache-2.0)과 Surya 0.22.1을 별도 Python 환경에서 사용했다. 인식 모델은 코드와 별도 조건이며 실험 모델/리비전은 docs/qa/assets/marker-benchmark/environment.json에 기록했다. 모델 가중치·Python wheel·추론 바이너리는 공개 저장소/프로젝트 ZIP에 포함하지 않았다. [Marker 2.0.0 코드 고지](https://github.com/datalab-to/marker/blob/v2.0.0/LICENSE)와 [모델 조건](https://github.com/datalab-to/marker/blob/v2.0.0/MODEL_LICENSE)은 도입 환경별로 확인한다. 전체 Python 설치 버전은 scripts/marker/requirements.lock이다.

확인 기준일: 2026-10-18. 아래는 후보 조사이며 실제 도입 버전의 LICENSE·NOTICE·파일 헤더·모델 카드와 전이 의존성을 다시 확인한다.

| 후보 | 역할 | 라이선스 | 판단 |
| --- | --- | --- | --- |
| ONLYOFFICE Docs Community | PPTX/PDF 주 편집기 | AGPL-3.0 | 우선 PoC 후보. Community 플러그인 사용, 유료 Automation API 의존 금지 |
| ONLYOFFICE Desktop Editors 10.0.0 | PC 설치형 Office 편집기 | AGPL-3.0, 파일별 추가 고지 확인 | 사용자 선택에 따라 현재 PoC 대상. 실행 바이너리는 이 저장소에 포함하지 않음 |
| ONLYOFFICE plugins.js | 로컬 플러그인 부트스트랩 | AGPL-3.0 및 원본 헤더 추가 고지 | 고정 커밋 파일을 vendor로 포함. SHA-256과 원문 고지 보존 |
| Collabora Online/CODE | Office 웹 편집기 대안 | 주요 소스 MPL-2.0, 구성요소별 별도 | ONLYOFFICE 대체 후보. WOPI 연동 및 배포 형태 조사 필요 |
| PDF.js | PDF 렌더링·뷰어 | Apache-2.0 | 자체 PDF UI가 필요할 때 검토 |
| pdf-lib | PDF 페이지/추가 콘텐츠/양식 조작 | MIT | 기존 일반 본문 텍스트 수정 API 없음 |
| PyMuPDF | PDF 추출·렌더링·조작 | AGPL-3.0 또는 상용 | 선택적 서버 라이브러리, 전체 의존성 확인 |
| Marker 코드 | 문서 구조 분석 파이프라인 | Apache-2.0 | 선택적 분석 서비스 |
| Marker 모델 | OCR·문서 인식 | Modified AI Pubs Open RAIL-M | 코드와 별도 조건. 기업 사용 적합성 확인 전 확정하지 않음 |
| 사내 LLM | 요약·질의·수정안 | 사용 모델별 별도 | 기존 내부 모델명·라이선스 미확인 |

## 중요 구분

사용자는 공개 소스 개발과 고지 유지에 동의했다. 그러나 공개한다고 해서 모든 의존성의 사용 제한이 해소되는 것은 아니다.

- MIT/Apache: 배포 시 고지 등 조건 유지. 일반적으로 자체 소스 공개 의무 없음.
- MPL: 배포 시 해당 파일과 수정분의 소스 제공 등 조건 확인.
- AGPL: 배포 및 수정본의 원격 네트워크 제공 시 대응 소스 제공 조건 확인. 결합한 코드의 범위는 구조에 따라 판단.
- Marker MODEL_LICENSE는 회사의 전년도 매출 또는 누적 투자금 500만 달러 초과 시 개인/연구 예외 외 사용 제한과 경쟁 제품·서비스 제한을 명시한다. Attribution 및 Output 관련 Share-a-Like 조항도 있으므로 실제 모델별 적용 조건을 검토한다.
- 인터넷 차단 가능성과 라이선스 적합성은 별개다. 사내 LLM 연결이 Marker 인식 모델 조건을 대체하지 않는다.
- 프로젝트 자체 코드는 0.1.0부터 AGPL-3.0-only로 공개한다. 포함 SDK의 추가 고지는 plugin/THIRD_PARTY_NOTICES.md와 원본 헤더를 유지한다.

## 공식 근거

- [ONLYOFFICE 소스·에디션](https://github.com/ONLYOFFICE/DocumentServer)
- [Desktop Editors 10.0.0 소스](https://github.com/ONLYOFFICE/DesktopEditors/tree/v10.0.0)
- [ONLYOFFICE 플러그인](https://api.onlyoffice.com/docs/plugins/get-started/overview)
- [로컬 AI 연결](https://api.onlyoffice.com/docs/ai/more-information/faq)
- [플러그인 수동 설치](https://helpcenter.onlyoffice.com/docs/installation/docs-add-plugin.aspx)
- [Collabora 소스 위치 안내](https://github.com/CollaboraOnline/online)
- [Collabora MPL 고지](https://github.com/CollaboraOnline/online/blob/master/COPYING)
- [Collabora 연동](https://www.collaboraonline.com/faqs/)
- [PDF.js](https://github.com/mozilla/pdf.js)
- [pdf-lib 기능·제한](https://github.com/Hopding/pdf-lib)
- [PyMuPDF](https://github.com/pymupdf/PyMuPDF)
- [Marker](https://github.com/datalab-to/marker)
- [Marker 모델 조건](https://github.com/datalab-to/marker/blob/master/MODEL_LICENSE)
- [Marker PPTX 처리](https://github.com/datalab-to/marker/blob/master/marker/providers/powerpoint.py)
