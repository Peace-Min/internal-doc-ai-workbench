(function () {
  "use strict";
  // Shared with the extraction CLI; imports contain page text, never executable HTML.
  function context(input, range = {}) {
    if (input?.schemaVersion !== 1 || !["marker","pdfplumber"].includes(input.engine) || !/^[a-f0-9]{64}$/.test(input.documentSha256) || !Array.isArray(input.pages) || !input.pages.length || input.pages.length > 200) throw Error("분석 파일 형식을 확인하세요.");
    const seen = new Set();
    const pages = input.pages.map(page => {
      if (!page || !Number.isSafeInteger(page.page) || page.page < 1 || seen.has(page.page) || typeof page.text !== "string" || page.text.includes("\0")) throw Error("페이지 출처를 확인하세요.");
      seen.add(page.page); return {page:page.page,text:page.text};
    }).sort((a,b)=>a.page-b.page);
    const number = value => {
      if (value === undefined || value === "") return undefined;
      if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw Error("페이지 번호는 1 이상의 정수로 입력하세요.");
      return Number(value);
    };
    const startPage = number(range.startPage) ?? pages[0].page;
    const endPage = number(range.endPage) ?? pages[pages.length-1].page;
    if (startPage > endPage || endPage-startPage >= 200) throw Error("시작·끝 페이지와 최대 200페이지 범위를 확인하세요.");
    const selected = pages.filter(page=>page.page>=startPage && page.page<=endPage);
    if (selected.length !== endPage-startPage+1) throw Error("요청한 페이지가 분석 파일에 모두 있지 않습니다. 범위를 확인하세요.");
    const text = selected.map(page=>`[page ${page.page}]\n${page.text || "[No extracted text]"}`).join("\n\n");
    if (text.length > 12000) throw Error("분석 내용이 12,000자를 초과합니다. 페이지 범위를 줄이세요.");
    return {text,sources:selected.map(page=>({page:page.page,label:`[page ${page.page}]`})),emptyPages:selected.filter(page=>!page.text.trim()).map(page=>page.page),engine:input.engine,documentSha256:input.documentSha256,startPage,endPage,extractedPages:pages.length};
  }
  globalThis.WorkbenchAnalysis = Object.freeze({context});
})();
