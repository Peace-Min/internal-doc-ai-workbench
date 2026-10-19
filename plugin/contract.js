(function (root) {
  "use strict";
  const MAX_TEXT = 12000;
  function validateRequest(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("요청 형식이 올바르지 않습니다.");
    for (const [key, max] of [["text", MAX_TEXT], ["instruction", 2000]]) {
      if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > max) throw new Error(`${key}: 비어 있거나 허용 길이를 초과했습니다.`);
    }
    if (!["replace_text", "ask", "summarize", "rewrite_slide"].includes(input.operation)) throw new Error("지원하지 않는 작업입니다.");
    if (/\u0000/u.test(input.text) || /\u0000/u.test(input.instruction)) throw new Error("읽을 수 없는 텍스트 형식입니다.");
    if (input.operation === "rewrite_slide") parseSlideDocument(input.text);
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
  function parseSlideDocument(text) {
    if (typeof text !== "string" || text.length > MAX_TEXT) throw new Error("페이지 내용 한도를 초과했습니다.");
    const doc = JSON.parse(text);
    if (!doc || !["segments,slideNumber","allowNumberChanges,segments,slideNumber"].includes(Object.keys(doc).sort().join()) || (doc.allowNumberChanges !== undefined && typeof doc.allowNumberChanges !== "boolean") || !Number.isSafeInteger(doc.slideNumber) || doc.slideNumber < 1 || !Array.isArray(doc.segments) || !doc.segments.length || doc.segments.length > 60) throw new Error("페이지 내용 형식을 확인하세요.");
    const ids = new Set();
    for (const segment of doc.segments) {
      if (!segment || !["id,text","id,object,paragraph,text"].includes(Object.keys(segment).sort().join()) || typeof segment.id !== "string" || !/^s[1-9][0-9]*$/.test(segment.id) || ids.has(segment.id)) throw new Error("페이지 텍스트 식별자를 확인하세요.");
      if (segment.object !== undefined && (!Number.isSafeInteger(segment.object) || segment.object < 1 || !Number.isSafeInteger(segment.paragraph) || segment.paragraph < 1)) throw new Error("페이지 문단 정보를 확인하세요.");
      ids.add(segment.id); validateProposal(segment.text);
    }
    return doc;
  }
  function validateSlidePlan(plan, doc) {
    if (!plan || Object.keys(plan).join() !== "edits" || !Array.isArray(plan.edits) || plan.edits.length !== doc.segments.length) throw new Error("페이지 수정안의 개수가 다릅니다.");
    const originals = new Map(doc.segments.map(segment => [segment.id, segment]));
    const edits = new Map(); let length = 0;
    for (const edit of plan.edits) {
      if (!edit || Object.keys(edit).sort().join() !== "id,text" || !originals.has(edit.id) || edits.has(edit.id)) throw new Error("알 수 없거나 중복된 페이지 수정 대상입니다.");
      validateProposal(edit.text);
      const before = originals.get(edit.id).text;
      const text = before.match(/^\s*/)[0] + edit.text.trim() + before.match(/\s*$/)[0];
      length += text.length;
      if (length > MAX_TEXT) throw new Error("페이지 수정안이 12,000자를 초과합니다.");
      edits.set(edit.id, {id:edit.id,text});
    }
    const result = {edits:doc.segments.map(segment => edits.get(segment.id))};
    if (!doc.allowNumberChanges) {
      const numbers = segments => JSON.stringify(segments.flatMap(segment => segment.text.match(/[+-]?\d+(?:[.,]\d+)*/g) || []).sort());
      if (numbers(doc.segments) !== numbers(result.edits)) {
        const error = new Error("숫자가 누락·추가·변경된 페이지 수정안입니다. 다시 요청하거나 숫자 변경 허용을 선택한 뒤 페이지를 다시 읽으세요.");
        error.code = "SLIDE_NUMBERS_CHANGED"; throw error;
      }
    }
    return result;
  }
  root.WorkbenchContract = { MAX_TEXT, validateRequest, validateProposal, validateAnswer, validateSlideRange, parseSlideDocument, validateSlidePlan };
})(globalThis);
