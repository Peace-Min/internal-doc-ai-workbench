import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../plugin/editor-command.js', import.meta.url), 'utf8');
function fixture() {
  const state = { text: '원래 문장', second: '다른 개체', selected: 'one', deleted: false, runs: 1, emptyRuns: 0, paragraphs: 1, bold: true, writes: 0 };
  function shape(id) {
    const key = id === 'one' ? 'text' : 'second';
    const run = { GetClassType:()=> 'run', GetText:()=>state[key], ClearContent:()=>{state[key]='';state.writes++;return true;}, AddText:text=>{state[key]+=text;return true;} };
    const paragraph = { GetElementsCount:()=>state.runs+state.emptyRuns, GetElement:(i)=>i<state.emptyRuns?{GetClassType:()=> 'run',GetText:()=>''}:run };
    return { GetInternalId:()=>id, GetClassType:()=> 'shape', GetContent:()=>({GetAllParagraphs:()=>Array(state.paragraphs).fill(paragraph)}) };
  }
  const context = vm.createContext({ Asc: { scope: {} }, Api: {
    GetSelection:()=>({GetType:()=> 'shapes',GetShapes:()=>[shape(state.selected)]}),
    GetPresentation:()=>({GetCurSlideIndex:()=>0,GetAllShapes:()=>state.deleted?[shape('two')]:[shape('one'),shape('two')]})
  }});
  vm.runInContext(source, context);
  const invoke = payload => { context.Asc.scope.workbenchPayload = payload; return context.workbenchEditorCommand(); };
  return { state, invoke };
}
test('capture, selection change, then apply modifies original ID only', () => {
  const {state,invoke}=fixture(); const target=invoke({action:'capture'});
  state.selected='two';
  assert.equal(invoke({action:'apply',target,proposedText:'수정 문장'}).applied,true);
  assert.equal(state.text,'수정 문장'); assert.equal(state.second,'다른 개체');
});
test('changed or deleted original is rejected with no mutation', () => {
  for (const change of ['edited','deleted']) {
    const {state,invoke}=fixture(); const target=invoke({action:'capture'});
    if(change==='edited')state.text='직접 편집'; else state.deleted=true;
    assert.ok(invoke({action:'apply',target,proposedText:'수정 문장'}).error); assert.equal(state.writes,0);
  }
});
test('multi-run/multi-paragraph content fails closed', () => {
  for(const property of ['runs','paragraphs']) {
    const {state,invoke}=fixture(); state[property]=2;
    assert.ok(invoke({action:'capture'}).error); assert.equal(state.writes,0);
  }
});
test('empty formatting runs do not prevent editing the single nonempty run', () => {
  const {state,invoke}=fixture(); state.emptyRuns=2;
  const target=invoke({action:'capture'});
  assert.equal(target.text,'원래 문장');
  assert.equal(invoke({action:'apply',target,proposedText:'수정 문장'}).applied,true);
  assert.equal(state.text,'수정 문장');
});
test('invalid proposal cannot clear the original', () => {
  for(const text of ['', 'two\nlines', 'x'.repeat(12001), null]) {
    const {state,invoke}=fixture(); const target=invoke({action:'capture'});
    assert.ok(invoke({action:'apply',target,proposedText:text}).error); assert.equal(state.writes,0);
  }
});
