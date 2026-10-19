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
  root.WorkbenchContract = { MAX_TEXT, validateRequest, validateProposal, validateAnswer };
})(globalThis);
