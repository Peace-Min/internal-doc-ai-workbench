// Consumes the page export from scripts/marker/extract.py, not arbitrary raw Marker HTML.
export function analysisContext(input) {
  if(input?.schemaVersion!==1 || !['marker','pdfplumber'].includes(input.engine) || !/^[a-f0-9]{64}$/.test(input.documentSha256) || !Array.isArray(input.pages) || !input.pages.length || input.pages.length>200)throw Error('분석 파일 형식을 확인하세요.');
  const seen=new Set();
  const pages=input.pages.map(page=>{
    if(!Number.isSafeInteger(page.page)||page.page<1||seen.has(page.page)||typeof page.text!=='string'||page.text.includes('\0'))throw Error('페이지 출처를 확인하세요.');
    seen.add(page.page);return {page:page.page,text:page.text};
  });
  const text=pages.map(page=>`[page ${page.page}]\n${page.text || '[No extracted text]'}`).join('\n\n');
  if(text.length>12000)throw Error('분석 내용이 12,000자를 초과합니다. 페이지 범위를 줄이세요.');
  return {text,sources:pages.map(page=>({page:page.page,label:`[page ${page.page}]`})),emptyPages:pages.filter(page=>!page.text.trim()).map(page=>page.page),engine:input.engine,documentSha256:input.documentSha256};
}
