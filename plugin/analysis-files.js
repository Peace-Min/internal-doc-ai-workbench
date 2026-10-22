(function () {
  "use strict";
  const MAX_PDF = 20 * 1024 * 1024, MAX_PACKET = 2 * 1024 * 1024;
  async function bytes(file, maximum) {
    if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > maximum) throw Error("PDF는 20MiB, 분석 JSON은 2MiB 이하의 파일을 선택하세요.");
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.length !== file.size || data.length > maximum) throw Error("파일 크기가 변경되었습니다. 다시 선택하세요.");
    return data;
  }
  async function capture(pdf, packet, range) {
    const pdfBytes = await bytes(pdf, MAX_PDF), packetBytes = await bytes(packet, MAX_PACKET);
    if (String.fromCharCode(...pdfBytes.slice(0,5)) !== "%PDF-") throw Error("원본 PDF 파일을 선택하세요.");
    let input;
    try { input = JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(packetBytes)); }
    catch { throw Error("UTF-8 분석 JSON 파일 형식을 확인하세요."); }
    if (input?.engine === "marker" && (input.markerVersion !== "2.0.0" || input.useLlm !== false || typeof input.ocr !== "boolean")) throw Error("Marker 2.0.0의 LLM 보정 없는 추출 패킷을 선택하세요.");
    if (!globalThis.crypto?.subtle) throw Error("이 환경에서 PDF 해시를 확인할 수 없습니다. 파일 읽기를 중단했습니다.");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",pdfBytes))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
    if (hash !== input?.documentSha256) throw Error("원본 PDF와 분석 파일의 SHA-256이 다릅니다. 같은 파일에서 다시 추출하세요.");
    const result = WorkbenchAnalysis.context(input,range);
    if (result.emptyPages.length === result.sources.length) throw Error("선택한 페이지에 추출 텍스트가 없습니다. 추출 결과를 확인하세요.");
    return {...result,kind:"pdf_packet",scope:"pdf_packet",readOnly:true,engineLabel:input.engine === "marker" ? `Marker 2.0.0 · OCR ${input.ocr ? "켬" : "끔"}` : "pdfplumber 직접 추출"};
  }
  globalThis.WorkbenchAnalysisFiles = Object.freeze({capture});
})();
