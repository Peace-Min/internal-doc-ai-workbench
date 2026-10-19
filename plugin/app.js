(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(location.hostname)) $("port").value = location.port || "80";
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  let ready = false, connected = false, busy = false, target = null, controller = null, proposalOperation = null;
  $("operation").value = "replace_text";
  function clearResult() {
    proposalOperation = null;
    $("proposal-section").hidden = true; $("proposal").value = "";
    $("answer-section").hidden = true; $("answer").textContent = "";
  }
  function status(message, error = false) { $("status").textContent = message; $("status").dataset.error = String(error); }
  function controls() {
    $("capture").disabled = !ready || busy;
    $("send").disabled = !ready || !connected || !target || busy;
    $("connect").disabled = busy;
    $("port").disabled = busy;
    $("token").disabled = busy;
    $("operation").disabled = busy;
    $("apply").disabled = busy || !target || $("operation").value !== "replace_text" || proposalOperation !== "replace_text" || !$("proposal").value.trim();
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
      const timer = setTimeout(() => reject(new Error("편집기 응답 시간이 초과되었습니다. 적용 여부를 문서에서 확인하세요.")), 15000);
      window.Asc.scope.workbenchPayload = payload;
      window.Asc.plugin.callCommand(window.workbenchEditorCommand, false, payload.action === "apply", function (result) {
        clearTimeout(timer);
        if (!result || result.error) reject(new Error(result?.error || "편집기 응답이 없습니다."));
        else resolve(result);
      });
    });
  }
  let capture = (readOnly) => command({ action: readOnly ? "inspect" : "capture" });
  let apply = (snapshot, text) => command({ action: "apply", target: snapshot, proposedText: text });
  if (demo) {
    const section = document.createElement("section");
    section.innerHTML = '<h2>모의 편집기 · 실제 PPTX 아님</h2><label for="demo-object">선택 개체</label><select id="demo-object"><option value="one">본문 A</option><option value="two">본문 B</option></select><label for="demo-text">문서 내용 (직접 변경 가능)</label><textarea id="demo-text" rows="3"></textarea>';
    document.querySelector("header").after(section);
    const objects = { one: "문서 편집 중 사내 AI를 활용해 내용을 보완합니다.", two: "다른 개체의 내용은 유지되어야 합니다." };
    const select = $("demo-object"), text = $("demo-text");
    text.value = objects.one;
    select.onchange = () => { text.value = objects[select.value]; };
    text.oninput = () => { objects[select.value] = text.value; };
    capture = async (readOnly) => {
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
    $("source").textContent = "작업을 바꿨습니다. 개체를 다시 읽어 주세요.";
    $("target").textContent = "텍스트 상자 한 개를 선택하세요.";
    const operation = $("operation").value;
    $("instruction-label").textContent = operation === "ask" ? "읽은 내용에 대해 무엇이 궁금한가요?" : operation === "summarize" ? "요약 방향 (비워 두면 핵심 요약)" : "어떻게 다듬을까요?";
    $("instruction").placeholder = operation === "ask" ? "이 내용에서 확인할 수 있는 핵심 조건은 무엇인가요?" : operation === "summarize" ? "핵심 사실과 조건을 짧게 요약해 주세요." : "핵심을 유지하면서 보고용 문장으로 다듬어 주세요.";
    $("send").textContent = operation === "replace_text" ? "수정안 요청" : operation === "ask" ? "질문하기" : "요약하기";
    status("작업 대상을 다시 읽어 주세요. 질의·요약은 읽은 내용만 사용하며 문서를 변경하지 않습니다.");
    controls();
  };
  $("capture").onclick = async () => {
    if (busy) return;
    busy = true; target = null; clearResult(); controls();
    try {
      const operation = $("operation").value;
      const snapshot = await capture(operation !== "replace_text");
      WorkbenchContract.validateRequest({ operation, text: snapshot.text, instruction: "capture" });
      target = Object.freeze(snapshot);
      $("target").textContent = `슬라이드 ${snapshot.slideIndex + 1} · 개체 ${snapshot.objectId}`;
      $("source").textContent = snapshot.text;
      status(operation === "replace_text" ? "요청 내용을 입력하세요. 텍스트 상자 전체를 대상으로 합니다." : "읽은 시점의 내용을 질의·요약합니다. 문서가 바뀌면 다시 읽어 주세요. 원문은 변경하지 않습니다.");
    } catch (error) { $("source").textContent = "다시 선택해 주세요."; status(error.message, true); }
    finally { busy = false; controls(); }
  };
  $("request").onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !target || !connected) return;
    clearResult();
    const operation = $("operation").value;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 35000);
    busy = true; controls(); status(operation === "replace_text" ? "수정안을 작성하고 있습니다…" : "읽은 내용을 바탕으로 답변을 작성하고 있습니다…");
    try {
      const instruction = operation === "summarize" && !$("instruction").value.trim() ? "핵심 사실과 조건을 간결하게 요약해 주세요." : $("instruction").value;
      const body = WorkbenchContract.validateRequest({ operation, text: target.text, instruction });
      const result = await api("/api/propose", body);
      if (result.operation !== operation) throw new Error("응답 작업이 요청과 다릅니다. 다시 요청해 주세요.");
      if (operation === "replace_text") {
        $("proposal").value = WorkbenchContract.validateProposal(result.proposedText);
        proposalOperation = operation; $("proposal-section").hidden = false;
        status(result.mode === "mock" ? "모의 수정안입니다. 확인 후 적용하세요." : "수정안을 확인한 뒤 적용하세요.");
      } else {
        $("answer").textContent = WorkbenchContract.validateAnswer(result.answer);
        $("answer-section").hidden = false;
        status(result.mode === "mock" ? "모의 답변입니다. 실제 질의·요약 결과가 아닙니다." : "읽은 내용에 대한 답변입니다. 근거와 내용을 확인하세요. 문서는 변경하지 않았습니다.");
      }
    } catch (error) { status(error.name === "AbortError" ? "요청을 취소했거나 시간이 초과되었습니다." : error.message, true); }
    finally { clearTimeout(timeout); controller = null; busy = false; controls(); }
  };
  $("cancel").onclick = () => controller?.abort();
  $("proposal").oninput = controls;
  $("apply").onclick = async () => {
    if (busy || !target || $("operation").value !== "replace_text" || proposalOperation !== "replace_text" || target.readOnly) return;
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
