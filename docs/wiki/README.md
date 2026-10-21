# Wiki

이 디렉터리를 Wiki의 원본으로 관리한다. Git clone만으로 다른 PC에 함께 전달되도록 GitHub 별도 Wiki 저장소 대신 본 저장소에 포함했다.

## 작성 상태

- [Windows VM 준비·재개](windows-vm-qa.md)
- [VM 내부 백그라운드 제어·재개](background-vm.md)
- [Windows 오프라인 사용자 설치](offline-install.md)
- [최종 완료 기준과 외부 전제](../06-completion.md)
- [백그라운드 VM 실제 실행 QA](../qa/2026-10-21-background-vm.md)
- [VM 준비 QA와 재부팅 대기 상태](../qa/2026-10-20-vm.md)

- [PPTX 페이지 단위 수정](page-editing.md)
- [페이지 수정 QA](../qa/2026-10-20-page-edit.md)

- [Marker 추출과 할루시네이션 대리 지표 비교](marker-evaluation.md)
- [실제 Marker 평가 QA](../qa/2026-10-20-marker.md)

- [실제 로컬 추론 통합 QA](../qa/2026-10-19-local-llm.md)

- [기록별 원문·출처 대조](analysis-report.md)
- [대조 기능 QA](../qa/2026-10-19-review.md)
- [현재 PC 로컬 LLM 준비](local-llm.md)

- [Windows 처음 실행](../../FIRST-RUN.md)
- [실행·배포물 준비](portable-package.md)
- [실행·배포 QA](../qa/2026-10-19-portable.md)
- [선택 텍스트 질의·요약](read-only-ai.md)
- [읽기 전용 AI QA](../qa/2026-10-19-read-only.md)
- [문서 범위 질문·요약](document-ai.md)
- [문서 범위 QA](../qa/2026-10-19-document.md)
- [긴 문서 구간별 읽기](slide-ranges.md)
- [슬라이드 범위 QA](../qa/2026-10-19-ranges.md)

로컬 서비스·모의 UI 실행과 실제 Windows Desktop 개발 설치·단순 PPTX QA 절차를 [PC 설치형 PoC 설치·실행](desktop-setup.md)에 기록했다. 실제 사내 연동과 전체 폐쇄망 검증은 구분해 남겨 두었다.

- [고정 SDK 기술 조사](../06-desktop-api-research.md)
- [PoC QA 결과](../qa/2026-10-18-poc.md)
- [실제 Desktop QA 결과](../qa/2026-10-18-desktop.md)
- [사내 LLM 게이트웨이 연결](internal-llm.md)
- [Anthropic 어댑터 QA](../qa/2026-10-18-anthropic.md)
- [화면 제어 없는 LLM 진단 CLI QA](../qa/2026-10-18-diagnostics.md)
- [편집 실패 원문 복구 QA](../qa/2026-10-19-recovery.md)
- [로컬 서비스 포트 설정 QA](../qa/2026-10-19-port.md)
- [LLM 출력 토큰 제한 QA](../qa/2026-10-19-token-limit.md)

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

- [세션 이동 후 VM 준비 상태 재검증](../qa/2026-10-20-vm-resume.md)

기능 구현 → QA 증거 확인 → 재현 가능한 절차를 Wiki에 기록한다. 내부 전용 값은 환경 변수 이름과 예시만 기록한다.

## 분석 기록

- [질문·요약 결과 보관과 보고서](analysis-report.md)
- [분석 기록·보고서 QA](../qa/2026-10-19-report.md)

- [실제 Sandbox 게스트 준비 결과](../qa/2026-10-21-sandbox-guest.md)

- [실제 페이지 수정 인수 검증 절차](page-edit-acceptance.md)
- [합성 문서·비교 도구 점검과 실행 제한](../qa/2026-10-21-page-fixture.md)

- [구간별 숫자·순서 보존 QA](../qa/2026-10-21-numeric-guard.md)
