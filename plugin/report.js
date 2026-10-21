(function () {
  "use strict";
  const MAX_RECORDS = 20;
  function review(record) {
    const labels = new Set(record.sources);
    const cited = [...new Set([...record.answer.matchAll(/\[슬라이드\s+([1-9][0-9]*)\s*·\s*개체\s+([1-9][0-9]*)\]/g)].map(match => `[슬라이드 ${match[1]} · 개체 ${match[2]}]`))];
    const known = cited.filter(label => labels.has(label));
    const unknown = cited.filter(label => !labels.has(label));
    const summary = record.kind === "pdf_selection" ? "PDF 선택 텍스트 답변 · 페이지 번호·인용 정확성 자동 대조 대상 아님" : labels.size === 0 ? "선택 개체 답변 · 슬라이드 출처 자동 대조 대상 아님" : cited.length === 0 ? "정형 출처 표기 없음 · 원문과 직접 대조 필요" : `출처 표기 ${cited.length}개 · 읽은 출처에 있음 ${known.length}개 · 읽은 출처에 없음 ${unknown.length}개`;
    return { known, unknown, summary };
  }
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
        `출처: ${record.kind === "pdf_selection" ? "PDF 선택 텍스트, 전체 문서·페이지 범위 미확인" : record.sources.length ? record.sources.join(" · ") : "선택 개체, 문서 전체 아님"}`,
        `출처 대조: ${review(record).summary}`,
        `미확인 출처: ${review(record).unknown.join(" · ") || "없음 (내용의 사실성·인용 정확성 보장 아님)"}`,
        "\n질문·요청:", record.instruction,
        "\n답변:", record.answer
      ].join("\n"))
    ].join("\n");
  }
  globalThis.WorkbenchReport = Object.freeze({ MAX_RECORDS, format, review });
})();
