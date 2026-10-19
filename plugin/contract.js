(function (root) {
  "use strict";
  const MAX_TEXT = 12000;
  function validateRequest(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("요청 형식이 올바르지 않습니다.");
    for (const [key, max] of [["text", MAX_TEXT], ["instruction", 2000]]) {
      if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > max) throw new Error(`${key}: 비어 있거나 허용 길이를 초과했습니다.`);
    }
    if (!["replace_text", "ask", "summarize"].includes(input.operation)) throw new Error("지원하지 않는 작업입니다.");
    if (/\u0000/u.test(input.text) || /\u0000/u.test(input.instruction)) throw new Error("읽을 수 없는 텍스트 형식입니다.");
    return { operation: input.operation, text: input.text, instruction: input.instruction };
  }
  function validateProposal(text) {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT || /[\r\n\u0000]/u.test(text)) throw new Error("수정안은 비어 있지 않은 한 문단이어야 하며 12,000자 이하여야 합니다.");
    return text;
  }
  function validateAnswer(text) {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT || /\u0000/u.test(text)) throw new Error("답변은 비어 있지 않은 12,000자 이하의 텍스트여야 합니다.");
    return text;
  }
  function validateSlideRange(start, end) {
    function number(value) {
      const text = String(value ?? "").trim();
      if (!text) return undefined;
      if (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error("슬라이드 번호는 1 이상의 정수로 입력하세요.");
      return Number(text);
    }
    const startSlide = number(start), endSlide = number(end);
    if (startSlide !== undefined && endSlide !== undefined && startSlide > endSlide) throw new Error("시작 슬라이드는 끝 슬라이드보다 클 수 없습니다.");
    return { startSlide, endSlide };
  }
  root.WorkbenchContract = { MAX_TEXT, validateRequest, validateProposal, validateAnswer, validateSlideRange };
})(globalThis);
