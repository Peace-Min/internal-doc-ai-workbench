/* Serialized by ONLYOFFICE callCommand. No external closure or generated code. */
function workbenchEditorCommand() {
  try {
    var payload = Asc.scope.workbenchPayload;
    var presentation = Api.GetPresentation();
    if (!presentation) return { error: "PPTX 편집기에서 실행해 주세요." };
    function readText(content) {
      var paragraphs = content.GetAllParagraphs(), lines = [], length = 0;
      if (paragraphs.length > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
      for (var p = 0; p < paragraphs.length; p++) {
        var line = "", count = paragraphs[p].GetElementsCount();
        if (count > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
        for (var e = 0; e < count; e++) {
          var element = paragraphs[p].GetElement(e);
          if (!element || element.GetClassType() !== "run") return { error: "질의·요약은 일반 텍스트로 이루어진 상자만 지원합니다.", unsupported: true };
          var part = element.GetText();
          if (typeof part !== "string" || /\u0000/.test(part)) return { error: "읽을 수 없는 텍스트 형식입니다." };
          length += part.length;
          if (length > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
          line += part;
        }
        if (p > 0) length++;
        if (length > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
        lines.push(line);
      }
      return { text: lines.join("\n") };
    }
    if (payload.action === "inspect_document") {
      var slides = presentation.GetAllSlides(), sections = [], sources = [], skipped = 0, empty = 0, scanned = 0, total = 0;
      var first = payload.startSlide === undefined ? 1 : payload.startSlide;
      var last = payload.endSlide === undefined ? slides.length : payload.endSlide;
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > slides.length) return { error: "실제 문서 안의 유효한 시작·끝 슬라이드를 지정하세요. 전체 슬라이드: " + slides.length };
      if (last - first + 1 > 200) return { error: "한 번에 최대 200슬라이드까지 읽습니다. 시작·끝 슬라이드로 범위를 줄여 주세요." };
      var rangeHeader = first > 1 || last < slides.length ? "[분석 범위: 슬라이드 " + first + "~" + last + " / 전체 " + slides.length + "]\n\n" : "";
      total = rangeHeader.length;
      for (var s = first - 1; s < last; s++) {
        var drawings = slides[s].GetAllDrawings();
        scanned += drawings.length;
        if (scanned > 2000) return { error: "문서 읽기는 최대 2,000개 개체까지 지원합니다. 선택 개체 읽기를 이용해 주세요." };
        for (var d = 0; d < drawings.length; d++) {
          var drawing = drawings[d];
          if (!drawing || !drawing.GetClassType || drawing.GetClassType() !== "shape") { skipped++; continue; }
          var drawingContent = drawing.GetContent();
          if (!drawingContent) { empty++; continue; }
          var extracted = readText(drawingContent);
          if (extracted.unsupported) { skipped++; continue; }
          if (extracted.error) return extracted;
          if (!extracted.text.trim()) { empty++; continue; }
          var label = "[슬라이드 " + (s + 1) + " · 개체 " + (d + 1) + "]";
          var section = label + "\n" + extracted.text;
          total += section.length + (sections.length ? 2 : 0);
          if (total > 12000) return { error: "문서 텍스트가 범위·출처 표기 포함 12,000자를 초과합니다. 내용을 자르지 않았습니다. 슬라이드 범위를 줄이거나 선택 개체 읽기를 이용해 주세요." };
          sections.push(section);
          sources.push({ slide: s + 1, object: d + 1, label: label });
        }
      }
      if (!sections.length) return { error: "분석할 일반 텍스트가 없습니다. 이미지·표·그룹·노트·마스터는 분석하지 않습니다." };
      return { scope: "document", readOnly: true, text: rangeHeader + sections.join("\n\n"), sources: sources, slideCount: last - first + 1, documentSlideCount: slides.length, startSlide: first, endSlide: last, textObjectCount: sources.length, skippedObjectCount: skipped, emptyObjectCount: empty };
    }
    var shape;
    if (payload.action === "capture" || payload.action === "inspect") {
      var selection = Api.GetSelection();
      if (selection.GetType() !== "shapes") return { error: "텍스트 상자의 테두리를 클릭해 개체 한 개를 선택해 주세요." };
      var shapes = selection.GetShapes();
      if (shapes.length !== 1) return { error: "텍스트 상자 한 개만 선택해 주세요." };
      shape = shapes[0];
    } else if (payload.action === "apply") {
      if (payload.target.readOnly || payload.target.scope === "document") return { error: "질의·요약용으로 읽은 내용은 문서에 적용할 수 없습니다. 수정 작업에서 다시 읽어 주세요." };
      var all = presentation.GetAllShapes();
      for (var i = 0; i < all.length; i++) {
        if (all[i].GetInternalId() === payload.target.objectId) { shape = all[i]; break; }
      }
      if (!shape) return { error: "원래 개체가 삭제되었거나 문서가 변경되었습니다. 다시 선택해 주세요." };
    } else return { error: "지원하지 않는 작업입니다." };
    if (!shape.GetClassType || shape.GetClassType() !== "shape") return { error: "일반 텍스트 상자만 지원합니다." };
    var content = shape.GetContent();
    if (!content) return { error: "텍스트가 없는 개체입니다." };
    var paragraphs = content.GetAllParagraphs();
    if (payload.action === "inspect") {
      var result = readText(content);
      if (result.error) return result;
      if (!result.text.trim()) return { error: "읽을 텍스트가 없습니다." };
      return { objectId: shape.GetInternalId(), slideIndex: presentation.GetCurSlideIndex(), text: result.text, readOnly: true };
    }
    if (paragraphs.length !== 1) return { error: "한 문단의 텍스트 상자만 지원합니다. 문단 수: " + paragraphs.length };
    var run = null;
    var nonemptyRuns = 0;
    for (var r = 0; r < paragraphs[0].GetElementsCount(); r++) {
      var candidate = paragraphs[0].GetElement(r);
      if (!candidate || candidate.GetClassType() !== "run") return { error: "일반 텍스트만 지원합니다." };
      if (candidate.GetText().length > 0) { nonemptyRuns++; run = candidate; }
    }
    // Editors may retain empty runs around a pasted plain-text run.
    if (nonemptyRuns !== 1) return { error: "한 서식 구간의 텍스트만 지원합니다. 내용이 있는 구간 수: " + nonemptyRuns };
    var text = run.GetText();
    if (!text || !text.trim() || text.length > 12000 || /[\r\n\u0000]/.test(text)) return { error: "비어 있지 않은 한 문단(12,000자 이하)을 선택해 주세요." };
    if (payload.action === "capture") return { objectId: shape.GetInternalId(), slideIndex: presentation.GetCurSlideIndex(), text: text };
    if (text !== payload.target.text) return { error: "원문이 변경되었습니다. 다시 읽고 요청해 주세요." };
    if (typeof payload.proposedText !== "string" || !payload.proposedText.trim() || payload.proposedText.length > 12000 || /[\r\n\u0000]/.test(payload.proposedText)) return { error: "수정안 형식이 올바르지 않습니다." };
    // Reuse the existing run so its character properties remain attached.
    try {
      if (run.ClearContent() !== true) throw new Error("clear failed");
      if (run.AddText(payload.proposedText) !== true || run.GetText() !== payload.proposedText) throw new Error("insert failed");
    } catch (writeError) {
      // An API may mutate before returning false or throwing. Verify recovery too.
      var restored = false;
      try {
        if (run.GetText() === text) restored = true;
        else if (run.ClearContent() === true) restored = run.AddText(text) === true && run.GetText() === text;
      } catch (restoreError) { /* Report uncertainty instead of claiming recovery. */ }
      return {
        error: restored
          ? "수정에 실패했습니다. 원문이 유지되었거나 복구되었습니다. 문서를 확인해 주세요."
          : "수정에 실패했고 원문 복구를 확인하지 못했습니다. 추가 편집·저장 전에 문서를 확인하고 편집기의 실행 취소 또는 저장 전 사본으로 복구해 주세요.",
        recoveryFailed: !restored
      };
    }
    return { applied: true, objectId: shape.GetInternalId() };
  } catch (error) {
    return { error: "편집 API 호출에 실패했습니다. 엔진 버전과 지원 개체를 확인해 주세요." };
  }
}
globalThis.workbenchEditorCommand = workbenchEditorCommand;
