/* Serialized by ONLYOFFICE callCommand. No external closure or generated code. */
function workbenchEditorCommand() {
  try {
    var payload = Asc.scope.workbenchPayload;
    var presentation = Api.GetPresentation();
    if (!presentation) return { error: "PPTX 편집기에서 실행해 주세요." };
    var shape;
    if (payload.action === "capture") {
      var selection = Api.GetSelection();
      if (selection.GetType() !== "shapes") return { error: "텍스트 상자의 테두리를 클릭해 개체 한 개를 선택해 주세요." };
      var shapes = selection.GetShapes();
      if (shapes.length !== 1) return { error: "텍스트 상자 한 개만 선택해 주세요." };
      shape = shapes[0];
    } else if (payload.action === "apply") {
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
    if (run.ClearContent() !== true) return { error: "텍스트를 수정할 수 없습니다." };
    if (run.AddText(payload.proposedText) !== true) {
      run.ClearContent();
      run.AddText(text);
      return { error: "수정 실패로 원문 복구를 시도했습니다. 문서를 확인해 주세요." };
    }
    return { applied: true, objectId: shape.GetInternalId() };
  } catch (error) {
    return { error: "편집 API 호출에 실패했습니다. 엔진 버전과 지원 개체를 확인해 주세요." };
  }
}
globalThis.workbenchEditorCommand = workbenchEditorCommand;
