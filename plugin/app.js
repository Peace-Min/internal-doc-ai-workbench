(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(location.hostname)) $("port").value = location.port || "80";
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  let ready = false, connected = false, busy = false, target = null, controller = null, proposalOperation = null;
  const history = [];
  let capturedAt = "";
  let pagePlan = null;
  function renderReview(index) {
    const record = history[index];
    $("review-section").hidden = !record;
    $("review-source").textContent = record ? record.sourceText : "";
    $("review-answer").textContent = record ? record.answer : "";
    $("review-meta").textContent = record ? `결과 ${index + 1} · ${record.mock ? "모의 답변" : "AI 답변"} · ${record.target} · 읽은 시각 ${record.capturedAt}\n질문·요청: ${record.instruction}` : "";
    const result = record && WorkbenchReport.review(record);
    $("review-check").textContent = result ? `${result.summary}${result.unknown.length ? "\n미확인: " + result.unknown.join(" · ") : ""}` : "";
  }
  function renderHistory() {
    $("history-section").hidden = history.length === 0;
    $("history-count").textContent = `${history.length} / ${WorkbenchReport.MAX_RECORDS}건 · 구간별 답변 모음`;
    $("report").value = history.length ? WorkbenchReport.format(history) : "";
    $("review-number").max = String(history.length);
  }
  $("operation").value = "replace_text";
  $("scope").value = "selected";
  $("slide-start").value = ""; $("slide-end").value = "";
  function clearResult() {
    pagePlan = null; $("page-proposal-section").hidden = true; $("page-diff").textContent = "";
    proposalOperation = null;
    $("proposal-section").hidden = true; $("proposal").value = "";
    $("answer-section").hidden = true; $("answer").textContent = "";
  }
  function status(message, error = false) { $("status").textContent = message; $("status").dataset.error = String(error); }
  function controls() {
    $("capture").disabled = !ready || busy;
    $("send").disabled = !ready || !connected || !target || busy || (["ask","summarize"].includes($("operation").value) && history.length >= WorkbenchReport.MAX_RECORDS);
    $("export-report").disabled = busy || history.length === 0;
    $("clear-history").disabled = busy || history.length === 0;
    $("review-open").disabled = busy || history.length === 0;
    $("review-number").disabled = busy || history.length === 0;
    $("connect").disabled = busy;
    $("port").disabled = busy;
    $("token").disabled = busy;
    $("operation").disabled = busy;
    $("scope").disabled = busy || ["replace_text","rewrite_slide"].includes($("operation").value);
    $("page-edit-settings").hidden = $("operation").value !== "rewrite_slide";
    $("page-number").disabled = busy;
    $("page-allow-numbers").disabled = busy;
    $("page-apply").disabled = busy || !target || !pagePlan || $("operation").value !== "rewrite_slide" || !pagePlan.edits.some((edit,index)=>edit.text!==target.segments[index].text);
    $("slide-range").hidden = $("scope").value !== "document";
    $("slide-start").disabled = busy; $("slide-end").disabled = busy;
    $("capture").textContent = $("operation").value === "rewrite_slide" ? "페이지 읽기" : $("scope").value === "document" ? "문서 텍스트 읽기" : "선택 개체 읽기";
    $("apply").disabled = busy || !target || $("operation").value !== "replace_text" || $("scope").value !== "selected" || proposalOperation !== "replace_text" || !$("proposal").value.trim();
    $("cancel").hidden = !busy || !controller;
  }
  async function api(path, body) {
    const port = $("port").value.trim();
    if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) throw new Error("서비스 포트는 1~65535의 정수로 입력하세요.");
    const base = `http://127.0.0.1:${port}`;
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Authorization": `Bearer ${$("token").value.trim()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller?.signal || AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "로컬 서비스 요청에 실패했습니다.");
    return data;
  }
  function command(payload) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(["apply","page_apply"].includes(payload.action) ? "편집기 응답 시간이 초과되었습니다. 적용 여부를 문서에서 확인하세요." : "문서 읽기 시간이 초과되었습니다. 범위를 줄여 다시 읽어 주세요.")), 15000);
      window.Asc.scope.workbenchPayload = payload;
      window.Asc.plugin.callCommand(payload.action.startsWith("page_") ? window.workbenchPageCommand : window.workbenchEditorCommand, false, ["apply","page_apply"].includes(payload.action), function (result) {
        clearTimeout(timer);
        if (!result || result.error) reject(new Error(result?.error || "편집기 응답이 없습니다."));
        else resolve(result);
      });
    });
  }
  let capture = (readOnly, scope, range) => command({ action: readOnly && scope === "document" ? "inspect_document" : readOnly ? "inspect" : "capture", ...range });
  let apply = (snapshot, text) => command({ action: "apply", target: snapshot, proposedText: text });
  let capturePage = pageNumber => command({action:"page_capture",pageNumber,allowNumberChanges:$("page-allow-numbers").checked===true});
  let applyPage = (snapshot,plan) => command({action:"page_apply",target:snapshot,plan});
  if (demo) {
    const section = document.createElement("section");
    section.innerHTML = '<h2>모의 편집기 · 실제 PPTX 아님</h2><label for="demo-object">선택 개체</label><select id="demo-object"><option value="one">본문 A</option><option value="two">본문 B</option></select><label for="demo-text">문서 내용 (직접 변경 가능)</label><textarea id="demo-text" rows="3"></textarea>';
    document.querySelector("header").after(section);
    const objects = { one: "문서 편집 중 사내 AI를 활용해 내용을 보완합니다.", two: "다른 개체의 내용은 유지되어야 합니다." };
    const select = $("demo-object"), text = $("demo-text");
    text.value = objects.one;
    select.onchange = () => { text.value = objects[select.value]; };
    text.oninput = () => { objects[select.value] = text.value; };
    const pageTitles = ["문서 AI 활용", "편집 범위 확인"];
    capturePage = async pageNumber => {
      const number = pageNumber ?? (select.value === "one" ? 1 : 2);
      if (![1,2].includes(number)) throw new Error("페이지 번호를 확인하세요. 모의 문서는 2페이지입니다.");
      const segments = [{id:"s1",text:pageTitles[number-1]},{id:"s2",text:objects[number===1?"one":"two"]}];
      const allowNumberChanges=$("page-allow-numbers").checked===true;
      const snapshot = {scope:"slide_edit",slideNumber:number,slideIndex:number-1,allowNumberChanges,segments,excludedCount:0,emptyCount:0,text:JSON.stringify({slideNumber:number,allowNumberChanges,segments:segments.map((segment,index)=>({...segment,object:index+1,paragraph:1}))})};
      WorkbenchContract.parseSlideDocument(snapshot.text); return snapshot;
    };
    applyPage = async (snapshot,plan) => {
      const current = await capturePage(snapshot.slideNumber);
      if (JSON.stringify(current)!==JSON.stringify(snapshot)) throw new Error("페이지 원문이 변경되었습니다. 다시 읽어 주세요.");
      const valid = WorkbenchContract.validateSlidePlan(plan, WorkbenchContract.parseSlideDocument(snapshot.text));
      pageTitles[snapshot.slideNumber-1] = valid.edits[0].text;
      objects[snapshot.slideNumber===1?"one":"two"] = valid.edits[1].text;
      text.value=objects[select.value];
      return {applied:true,changedSegments:valid.edits.filter((edit,index)=>edit.text!==snapshot.segments[index].text).length};
    };
    capture = async (readOnly, scope, range) => {
      if (readOnly && scope === "document") {
        const first = range.startSlide ?? 1, last = range.endSlide ?? 2;
        if (first < 1 || last < first || last > 2) throw new Error("실제 문서 안의 유효한 시작·끝 슬라이드를 지정하세요. 전체 슬라이드: 2");
        const sections = Object.values(objects).map((value, index) => ({ value, source: { slide: index + 1, object: 1, label: `[슬라이드 ${index + 1} · 개체 1]` } })).filter(section => section.source.slide >= first && section.source.slide <= last && section.value.trim());
        if (!sections.length) throw new Error("분석할 일반 텍스트가 없습니다.");
        const header = first > 1 || last < 2 ? `[분석 범위: 슬라이드 ${first}~${last} / 전체 2]\n\n` : "";
        const documentText = header + sections.map(section => `${section.source.label}\n${section.value}`).join("\n\n");
        if (documentText.length > 12000) throw new Error("문서 텍스트가 범위·출처 표기 포함 12,000자를 초과합니다. 내용을 자르지 않았습니다. 슬라이드 범위를 줄여 주세요.");
        return { scope: "document", readOnly: true, text: documentText, sources: sections.map(section => section.source), slideCount: last - first + 1, documentSlideCount: 2, startSlide: first, endSlide: last, textObjectCount: sections.length, skippedObjectCount: 0, emptyObjectCount: last - first + 1 - sections.length };
      }
      if (!readOnly && /[\r\n\u0000]/.test(objects[select.value])) throw new Error("수정은 한 문단만 지원합니다. 질의·요약 모드에서 읽어 주세요.");
      return { objectId: select.value, slideIndex: 0, text: objects[select.value], readOnly };
    };
    apply = async (snapshot, value) => {
      if (objects[snapshot.objectId] !== snapshot.text) throw new Error("원문이 변경되었습니다. 다시 읽고 요청해 주세요.");
      objects[snapshot.objectId] = value;
      text.value = objects[select.value];
      return { applied: true };
    };
    ready = true;
    $("mode").textContent = "모의 편집기 · 로컬 서비스 연결 시험";
    controls();
  } else {
    window.Asc.plugin.init = function () {
      ready = window.Asc.plugin.info.editorType === "slide";
      $("mode").textContent = ready ? "PPTX · 텍스트 보완과 질의·요약" : "PPTX 편집기에서 열어 주세요.";
      controls();
    };
    window.Asc.plugin.button = function () { window.Asc.plugin.executeCommand("close", ""); };
  }
  $("connect").onclick = async () => {
    if (busy) return;
    connected = false; busy = true; controls();
    try {
      const health = await api("/api/health");
      connected = true;
      status(health.mode === "mock" ? "모의 AI 연결 완료. 실제 LLM 응답이 아닙니다." : "사내 LLM 연동 서비스에 연결했습니다.");
      $("connection").open = false;
    } catch (error) { status(error.message, true); }
    finally { busy = false; controls(); }
  };
  $("token").oninput = () => { connected = false; controls(); };
  $("port").oninput = () => { connected = false; controls(); };
  $("operation").onchange = () => {
    if (busy) return;
    target = null; clearResult(); $("instruction").value = "";
    $("coverage").textContent = "";
    $("source").textContent = "작업을 바꿨습니다. 개체를 다시 읽어 주세요.";
    $("target").textContent = "텍스트 상자 한 개를 선택하세요.";
    const operation = $("operation").value;
    if (operation === "replace_text") $("scope").value = "selected";
    else if (operation === "rewrite_slide") $("scope").value = "slide_edit";
    else if ($("scope").value === "slide_edit") $("scope").value = "selected";
    $("instruction-label").textContent = operation === "ask" ? "읽은 내용에 대해 무엇이 궁금한가요?" : operation === "summarize" ? "요약 방향 (비워 두면 핵심 요약)" : "어떻게 다듬을까요?";
    $("instruction").placeholder = operation === "ask" ? "이 내용에서 확인할 수 있는 핵심 조건은 무엇인가요?" : operation === "summarize" ? "핵심 사실과 조건을 짧게 요약해 주세요." : "핵심을 유지하면서 보고용 문장으로 다듬어 주세요.";
    $("send").textContent = operation === "rewrite_slide" ? "페이지 수정안 요청" : operation === "replace_text" ? "수정안 요청" : operation === "ask" ? "질문하기" : "요약하기";
    status(operation === "rewrite_slide" ? "페이지를 읽은 뒤 전체 텍스트를 어떻게 수정할지 요청하세요. 검토 후 일괄 적용합니다." : "작업 대상을 다시 읽어 주세요. 질의·요약은 문서를 변경하지 않습니다.");
    controls();
  };
  $("scope").onchange = () => {
    if (busy) return;
    target = null; clearResult(); $("coverage").textContent = "";
    $("source").textContent = "분석 범위를 바꿨습니다. 내용을 다시 읽어 주세요.";
    $("target").textContent = "아직 읽은 내용이 없습니다.";
    status("범위를 확인한 뒤 내용을 읽고, 전송할 텍스트와 제외 항목을 확인하세요.");
    controls();
  };
  $("slide-start").oninput = $("scope").onchange;
  $("slide-end").oninput = $("scope").onchange;
  $("page-number").oninput = $("scope").onchange;
  $("page-allow-numbers").onchange = $("scope").onchange;
  $("capture").onclick = async () => {
    if (busy) return;
    busy = true; target = null; clearResult(); $("coverage").textContent = ""; controls();
    try {
      const operation = $("operation").value;
      const range = $("scope").value === "document" ? WorkbenchContract.validateSlideRange($("slide-start").value, $("slide-end").value) : {};
      const snapshot = operation === "rewrite_slide" ? await capturePage(WorkbenchContract.validateSlideRange($("page-number").value, "").startSlide) : await capture(operation !== "replace_text", $("scope").value, range);
      WorkbenchContract.validateRequest({ operation, text: snapshot.text, instruction: "capture" });
      target = Object.freeze(snapshot);
      capturedAt = new Date().toISOString();
      if (operation === "rewrite_slide") {
        $("target").textContent = `페이지 ${snapshot.slideNumber} · 수정 가능한 텍스트 ${snapshot.segments.length}구간`;
        $("coverage").textContent = `제외 개체 ${snapshot.excludedCount}개 · 빈 개체 ${snapshot.emptyCount}개. 여러 텍스트 상자·문단을 함께 수정하며 서식 구간을 유지합니다. 이미지·표·그룹·특수 필드는 수정하지 않습니다.`;
        $("source").textContent = snapshot.segments.map((segment,index)=>`텍스트 ${index+1}\n${segment.text}`).join("\n\n");
        status("페이지 전체 텍스트의 수정 방향을 입력하세요. 사실·수치와 문맥을 확인한 뒤 일괄 적용하세요."); return;
      }
      $("target").textContent = snapshot.scope === "document" ? `읽은 ${snapshot.slideCount}슬라이드 · 텍스트 ${snapshot.textObjectCount}개` : `슬라이드 ${snapshot.slideIndex + 1} · 개체 ${snapshot.objectId}`;
      if (snapshot.scope === "document" && snapshot.startSlide !== undefined) $("target").textContent += ` · 읽은 범위 ${snapshot.startSlide}~${snapshot.endSlide} / 전체 ${snapshot.documentSlideCount}슬라이드`;
      $("coverage").textContent = snapshot.scope === "document" ? `제외 개체 ${snapshot.skippedObjectCount}개 · 빈 개체 ${snapshot.emptyObjectCount}개. 이미지·표·그룹·노트·마스터는 분석하지 않습니다. 범위·출처 표기 포함 최대 12,000자이며 내용은 자동으로 자르지 않습니다.` : "선택한 텍스트 상자 한 개만 읽었습니다.";
      $("source").textContent = snapshot.text;
      status(operation === "replace_text" ? "요청 내용을 입력하세요. 텍스트 상자 전체를 대상으로 합니다." : "읽은 시점의 내용을 질의·요약합니다. 문서가 바뀌면 다시 읽어 주세요. 원문은 변경하지 않습니다.");
    } catch (error) { $("source").textContent = "범위를 확인하고 다시 읽어 주세요."; $("target").textContent = "읽은 내용이 없습니다."; status(error.message, true); }
    finally { busy = false; controls(); }
  };
  $("request").onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !target || !connected) return;
    if (["ask","summarize"].includes($("operation").value) && history.length >= WorkbenchReport.MAX_RECORDS) {
      status("기록이 20건입니다. 보고서를 내려받고 기록을 지운 뒤 계속하세요.", true); return;
    }
    clearResult();
    const operation = $("operation").value;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 35000);
    busy = true; controls(); status(operation === "replace_text" ? "수정안을 작성하고 있습니다…" : "읽은 내용을 바탕으로 답변을 작성하고 있습니다…");
    try {
      const instruction = operation === "summarize" && !$("instruction").value.trim() ? "핵심 사실과 조건을 간결하게 요약해 주세요." : $("instruction").value;
      const body = WorkbenchContract.validateRequest({ operation, text: target.text, instruction });
      const provenance = { capturedAt, target: $("target").textContent, coverage: $("coverage").textContent, sources: (target.sources || []).map(source => source.label), sourceText: target.text };
      const result = await api("/api/propose", body);
      if (result.operation !== operation) throw new Error("응답 작업이 요청과 다릅니다. 다시 요청해 주세요.");
      if (operation === "rewrite_slide") {
        pagePlan = WorkbenchContract.validateSlidePlan(result.plan,WorkbenchContract.parseSlideDocument(target.text));
        const changes = pagePlan.edits.map((edit,index)=>({index,before:target.segments[index].text,after:edit.text})).filter(change=>change.before!==change.after);
        $("page-diff").textContent = changes.length ? changes.map(change=>`텍스트 ${change.index+1}\n변경 전: ${change.before}\n변경 후: ${change.after}`).join("\n\n") : "변경 사항이 없습니다.";
        $("page-proposal-section").hidden = false;
        status(`${result.mode === "mock" ? "모의 페이지 수정안" : "페이지 수정안"} · 변경 ${changes.length}구간. 확인 후 페이지에 일괄 적용하세요.`);
      } else if (operation === "replace_text") {
        $("proposal").value = WorkbenchContract.validateProposal(result.proposedText);
        proposalOperation = operation; $("proposal-section").hidden = false;
        status(result.mode === "mock" ? "모의 수정안입니다. 확인 후 적용하세요." : "수정안을 확인한 뒤 적용하세요.");
      } else {
        $("answer").textContent = WorkbenchContract.validateAnswer(result.answer);
        $("answer-section").hidden = false;
        history.push({ ...provenance, time: new Date().toISOString(), operation, instruction: body.instruction, answer: $("answer").textContent, mock: result.mode === "mock" });
        renderHistory();
        $("review-number").value = String(history.length); renderReview(history.length - 1);
        status(result.mode === "mock" ? "모의 답변입니다. 실제 질의·요약 결과가 아닙니다." : "읽은 내용에 대한 답변입니다. 근거와 내용을 확인하세요. 문서는 변경하지 않았습니다.");
        if (history.length === WorkbenchReport.MAX_RECORDS) status("기록 20건을 채웠습니다. 보고서를 내려받고 기록을 지운 뒤 다음 질의·요약을 진행하세요.");
      }
    } catch (error) { status(error.name === "AbortError" ? "요청을 취소했거나 시간이 초과되었습니다." : error.message, true); }
    finally { clearTimeout(timeout); controller = null; busy = false; controls(); }
  };
  $("cancel").onclick = () => controller?.abort();
  $("page-apply").onclick = async () => {
    if (busy || !target || !pagePlan || $("operation").value !== "rewrite_slide") return;
    busy=true; controls();
    try {
      const plan=WorkbenchContract.validateSlidePlan(pagePlan,WorkbenchContract.parseSlideDocument(target.text));
      const result=await applyPage(target,plan);
      if (!result.applied) throw new Error("페이지 적용 결과를 확인할 수 없습니다.");
      status(`페이지에 ${result.changedSegments}구간을 적용했습니다. 줄 넘침과 문맥을 확인하고 편집기에서 저장하세요. 다음 요청 전 페이지를 다시 읽어 주세요.`);
    } catch(error) { status(error.message,true); }
    finally { target=null;clearResult();busy=false;controls(); }
  };
  $("review-open").onclick = () => {
    if (busy) return;
    const value = $("review-number").value.trim();
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > history.length) {
      renderReview(-1); status("분석 기록에 있는 번호를 입력하세요.", true); return;
    }
    renderReview(Number(value) - 1);
  };
  $("clear-history").onclick = () => {
    if (busy) return;
    history.length = 0; renderHistory(); renderReview(-1); $("review-number").value = ""; controls();
    status("분석 기록을 지웠습니다. 이미 내려받은 파일은 유지됩니다.");
  };
  $("export-report").onclick = () => {
    if (busy || !history.length) return;
    let url;
    try {
      url = URL.createObjectURL(new Blob(["\ufeff", WorkbenchReport.format(history)], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "workbench-report.txt";
      document.body.appendChild(link); link.click(); link.remove();
      status("파일 저장을 요청했습니다. 저장되지 않으면 보고서 내용 보기에서 직접 복사하세요. 기록은 유지됩니다.");
    } catch {
      status("파일 저장을 지원하지 않는 환경입니다. 보고서 내용 보기에서 직접 복사하세요.", true);
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  $("proposal").oninput = controls;
  $("apply").onclick = async () => {
    if (busy || !target || $("operation").value !== "replace_text" || $("scope").value !== "selected" || proposalOperation !== "replace_text" || target.readOnly) return;
    busy = true; controls();
    try {
      const proposed = WorkbenchContract.validateProposal($("proposal").value);
      const result = await apply(target, proposed);
      if (!result.applied) throw new Error("수정 결과를 확인할 수 없습니다.");
      target = null; $("proposal-section").hidden = true;
      status("원래 개체에 적용했습니다. 문서를 확인하고 편집기에서 저장하세요.");
    } catch (error) { target = null; status(error.message, true); }
    finally { busy = false; controls(); }
  };
})();
