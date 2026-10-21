(function () {
  "use strict";
  function capture(plugin) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PDF 선택 텍스트 읽기 시간이 초과되었습니다. 다시 선택하고 읽어 주세요.")), 15000);
      try {
        plugin.executeMethod("GetSelectedText", [{Numbering:false,Math:false,ParaSeparator:"\n",NewLineSeparator:"\n",TabSymbol:"\t"}], text => {
          clearTimeout(timer);
          try {
            if (typeof text !== "string" || !text.trim()) throw new Error("PDF에서 분석할 텍스트를 먼저 선택하세요. 스캔 이미지는 텍스트 선택으로 읽을 수 없습니다.");
            WorkbenchContract.validateRequest({operation:"ask",text,instruction:"capture"});
            resolve({kind:"pdf_selection",scope:"selected",readOnly:true,text,sources:[]});
          } catch (error) { reject(error); }
        });
      } catch { clearTimeout(timer); reject(new Error("PDF 선택 텍스트 API를 사용할 수 없습니다. 편집기 버전과 선택 영역을 확인하세요.")); }
    });
  }
  globalThis.WorkbenchPdfSelection = Object.freeze({capture});
})();
