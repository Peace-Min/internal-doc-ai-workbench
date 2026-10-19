# Marker 추출과 LLM 근거성 비교 — 0.11.0

## 결론

이 시험에서는 **OCR로 읽을 수 있는 정보는 늘었지만, 전체 할루시네이션 감소는 확인하지 못했다.** Marker는 모델 자체의 추론·답변 거부 능력을 개선하는 도구가 아니다. 추출 오류와 작은 모델의 해석 오류가 함께 결과에 영향을 주었다.

| 조건 | 전체 정답 / 22 | 잘못된 단정 / 22 | 자료에 없는 질문 거부 / 6 | 스캔 정답 / 2 |
| --- | --- | --- | --- | --- |
| 실험 A: pdfplumber | 13 | 8 | 4 | 0 |
| 실험 A: Marker fast, OCR 끔 | 14 | 8 | 4 | 0 |
| 실험 B: pdfplumber | 14 | 7 | 4 | 0 |
| 실험 B: Marker fast, OCR 켬 | 13 | 9 | 2 | 2 |

Marker OCR은 이미지의 RAVEN/437 정보를 정확히 복원했다. 그러나 모델은 다른 질문에서 더 자주 잘못 단정했고, OCR로 얻은 정답 두 건에도 페이지 인용을 빠뜨렸다. 표의 잘못된 단정은 고정 정답과 비교한 **대리 지표**이며 모든 종류의 의미적 할루시네이션을 측정하지 않는다.

한 PDF·한 경량 모델·영문 단답 22문항의 탐색 시험이다. 한국어 업무 문서·복잡한 표·실제 사내 모델로 일반화하거나 통계적으로 유의한 개선이라고 주장하지 않는다. 동일한 baseline도 두 실험에서 1문항 차이가 났다. seed/temperature를 고정해도 실행기 수치 연산·캐시 등에 따른 차이가 있을 수 있으며, 원인은 분리하지 않았다.

## 구현 범위

`scripts/marker/extract.py`는 Marker 2.0.0으로 PDF를 로컬 분석하고 원본 JSON·Markdown과 페이지별 텍스트 패킷을 만든다. 비교용 pdfplumber 패킷도 같은 PDF에서 만든다. 문서 SHA-256과 페이지 출처를 보존한다. `use_llm=False`로 외부 LLM 보정은 사용하지 않으며, OCR을 켠 경우에는 Surya의 로컬 VLM을 사용한다.

`src/marker-context.mjs`는 페이지 패킷의 형식·중복 출처·200페이지/12,000자 한도를 검사한다. 초과 시 자동으로 자르지 않는다. 이는 선택적 분석 CLI 연동이다. 현재 ONLYOFFICE 패널에 PDF 열기·Marker 실행·추출 파일 가져오기 UI를 연결한 것은 아니다. PPTX 편집·재조립도 Marker로 수행하지 않는다.

## 재현

1. Python 3.12 환경을 별도로 만들고 `scripts/marker/requirements.lock`의 버전을 설치한다. 이 파일은 설치 버전 목록이며 wheel 해시와 모델 파일을 포함한 완전한 폐쇄망 잠금 파일은 아니다.
2. llama.cpp와 모델을 준비한다. 질문 모델은 기존 [로컬 LLM 절차](local-llm.md)의 Qwen2.5 1.5B Q4_K_M / CPU 2스레드 / 4,096 컨텍스트다. Marker OCR용 Surya VLM은 별도 모델이다. 최초 준비에는 모델 다운로드가 필요하다.
3. 캐시를 프로젝트 비공개 작업 폴더로 지정한다. 시스템 환경 변수에 영구 등록하지 않는다.

```powershell
$env:HF_HOME=Join-Path $PWD 'private/marker-hf'
$env:MODEL_CACHE_DIR=Join-Path $PWD 'private/marker-models'
$env:TORCH_HOME=Join-Path $PWD 'private/marker-torch'
$env:TORCH_DEVICE='cpu'
$env:OMP_NUM_THREADS='2'
$env:SURYA_INFERENCE_BACKEND='llamacpp'
```

4. 준비한 Python 환경에서 합성 PDF와 추출 파일을 생성한다. `--ocr`를 생략하면 OCR을 끈다.

```sh
python scripts/marker/create_fixture.py private/marker-fixture
python scripts/marker/extract.py private/marker-fixture/fixture.pdf private/marker-extracted --ocr
```

5. 로컬 모델 서버를 실행하고 `WB_MODE=openai-compatible`, `WB_LLM_URL`, `WB_LLM_MODEL`, `WB_LLM_AUTH=none`을 설정한다. 평가기는 명시적인 127.0.0.1/::1 주소만 허용한다.

```sh
node scripts/evaluate-grounding.mjs --baseline private/marker-extracted/baseline.json --marker private/marker-extracted/marker.json --questions private/marker-fixture/questions.json --output private/marker-report.json
```

질문별로 두 추출 조건의 실행 순서를 교대한다. 모델·질문·system prompt·temperature=0·seed=42·max_tokens=128·JSON schema는 동일하다. 답변을 보고 문항이나 추출 내용을 고치지 않는다. 직접 PDF 텍스트 추출과의 비교이며 ONLYOFFICE PPTX 개체 추출과의 비교는 아니다.

설정·입력 오류는 종료 코드 2, 요청/형식 실패는 3이다. 정답이 틀려도 실험 결과 자체는 정상 수집될 수 있으므로 종료 코드 0이 품질 합격을 뜻하지 않는다. 보고서는 합성 문항의 답변을 포함한다. 사내 문서를 넣어 공개 결과물로 저장하지 않는다.

## 채점과 한계

- 정답: JSON의 짧은 answer를 고정 정답과 비교한다. 페이지 인용 정확성은 별도 집계한다.
- 근거 있는 정답: 정답 토큰이 해당 추출 페이지에도 있는지 추가 확인한다. 문자열 존재 검사이며 문장 의미를 인증하지 않는다.
- 답변 거부: 원본에도 답이 없는 6문항에서 UNKNOWN 여부를 확인한다.
- 잘못된/근거 없는 단정: 틀린 값을 답하거나 추출 자료에 없는 값을 단정하는 경우를 센다. 출력 형식 실패·요청 실패는 따로 공개한다.
- 예비 시험에서는 단답/출처 형식 준수가 낮았다. 이후 JSON schema를 양쪽 조건에 동일 적용한 본시험을 수행했다. 이 출력 제어의 효과를 Marker의 효과로 계산하지 않았다.

원본·정답·추출 결과·전체 응답은 [공개 합성 평가 자료](../qa/assets/marker-benchmark/)에 보관한다. 모델 가중치·사내 데이터는 포함하지 않는다. 다음 개선은 페이지/블록 단위 근거 선택, 답변 근거 검증·거부 처리, 더 강한 한국어 모델 비교를 각각 별도 조건으로 추가하는 것이다. 어느 개선이 효과를 냈는지 분리해서 평가해야 한다.
