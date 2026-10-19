# Wiki

이 디렉터리를 Wiki의 원본으로 관리한다. Git clone만으로 다른 PC에 함께 전달되도록 GitHub 별도 Wiki 저장소 대신 본 저장소에 포함했다.

## 작성 상태

로컬 서비스·모의 UI 실행과 실제 Windows Desktop 개발 설치·단순 PPTX QA 절차를 [PC 설치형 PoC 설치·실행](desktop-setup.md)에 기록했다. 실제 사내 연동과 전체 폐쇄망 검증은 구분해 남겨 두었다.

- [고정 SDK 기술 조사](../06-desktop-api-research.md)
- [PoC QA 결과](../qa/2026-10-18-poc.md)
- [실제 Desktop QA 결과](../qa/2026-10-18-desktop.md)
- [사내 LLM 게이트웨이 연결](internal-llm.md)
- [Anthropic 어댑터 QA](../qa/2026-10-18-anthropic.md)
- [화면 제어 없는 LLM 진단 CLI QA](../qa/2026-10-18-diagnostics.md)
- [편집 실패 원문 복구 QA](../qa/2026-10-19-recovery.md)
- [로컬 서비스 포트 설정 QA](../qa/2026-10-19-port.md)

## 향후 문서

- 개발 환경 및 고정 버전
- 온라인 반입 패키지 준비·체크섬·라이선스 목록
- 폐쇄망 설치와 초기 기동
- ONLYOFFICE 플러그인 설치·업데이트
- 클라우디움 연동 설정 (실제 주소·자격증명 제외)
- 사내 LLM API 어댑터 설정
- Marker 모델 배치·분석 캐시·오류 처리
- 장애 진단·백업·복구·버전 업그레이드

## 갱신 규칙

기능 구현 → QA 증거 확인 → 재현 가능한 절차를 Wiki에 기록한다. 내부 전용 값은 환경 변수 이름과 예시만 기록한다.
