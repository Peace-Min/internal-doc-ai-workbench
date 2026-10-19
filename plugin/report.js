(function () {
  "use strict";
  const MAX_RECORDS = 20;
  function format(records) {
    return [
      "문서 질의·요약 보고서",
      "현재 패널 세션의 개별 답변 모음입니다. 자동 통합·인용 검증 결과가 아닙니다.",
      "서로 다른 문서와 읽은 시점의 결과가 섞일 수 있습니다. 원본 문서 전체는 포함하지 않습니다.",
      "내부 정보가 포함될 수 있으므로 보관·공유 위치를 확인하세요.",
      ...records.map((record, index) => [
        `\n========== 결과 ${index + 1} ==========`,
        `답변 시각 (UTC): ${record.time}`,
        `작업: ${record.operation === "summarize" ? "요약" : "질문"}`,
        `응답: ${record.mock ? "모의 답변, 실제 분석 아님" : "AI 답변, 근거 확인 필요"}`,
        `읽은 대상: ${record.target}`,
        `읽은 시각 (UTC): ${record.capturedAt}`,
        `범위 안내: ${record.coverage}`,
        `출처: ${record.sources.length ? record.sources.join(" · ") : "선택 개체, 문서 전체 아님"}`,
        "\n질문·요청:", record.instruction,
        "\n답변:", record.answer
      ].join("\n"))
    ].join("\n");
  }
  globalThis.WorkbenchReport = Object.freeze({ MAX_RECORDS, format });
})();
