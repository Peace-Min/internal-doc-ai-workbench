/* Serialized by ONLYOFFICE callCommand. No external closure or generated code. */
function workbenchEditorCommand() {
  try {
    var payload = Asc.scope.workbenchPayload;
    var presentation = Api.GetPresentation();
    if (!presentation) return { error: "PPTX 편집기에서 실행해 주세요." };
    var shape;
    if (payload.action === "capture" || payload.action === "inspect") {
      var selection = Api.GetSelection();
      if (selection.GetType() !== "shapes") return { error: "텍스트 상자의 테두리를 클릭해 개체 한 개를 선택해 주세요." };
      var shapes = selection.GetShapes();
      if (shapes.length !== 1) return { error: "텍스트 상자 한 개만 선택해 주세요." };
      shape = shapes[0];
    } else if (payload.action === "apply") {
      if (payload.target.readOnly) return { error: "질의·요약용으로 읽은 내용은 문서에 적용할 수 없습니다. 수정 작업에서 다시 읽어 주세요." };
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
      var lines = [], length = 0;
      if (paragraphs.length > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
      for (var p = 0; p < paragraphs.length; p++) {
        var line = "";
        var count = paragraphs[p].GetElementsCount();
        if (count > 12000) return { error: "읽을 수 있는 내용은 12,000자 이하입니다." };
        for (var e = 0; e < count; e++) {
          var element = paragraphs[p].GetElement(e);
          if (!element || element.GetClassType() !== "run") return { error: "질의·요약은 일반 텍스트로 이루어진 상자만 지원합니다." };
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
      var plainText = lines.join("\n");
      if (!plainText.trim()) return { error: "읽을 텍스트가 없습니다." };
      return { objectId: shape.GetInternalId(), slideIndex: presentation.GetCurSlideIndex(), text: plainText, readOnly: true };
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
