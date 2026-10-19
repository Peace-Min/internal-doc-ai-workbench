import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../plugin/editor-command.js', import.meta.url), 'utf8');
function fixture(hooks = {}) {
  const state = { text: '원래 문장', second: '다른 개체', selected: 'one', deleted: false, runs: 1, emptyRuns: 0, paragraphs: 1, bold: true, writes: 0 };
  function shape(id) {
    const key = id === 'one' ? 'text' : 'second';
    let clears = 0, adds = 0;
    const run = {
      GetClassType:()=> 'run', GetText:()=>state[key],
      ClearContent:()=>{
        state.writes++;
        if (hooks.clear) return hooks.clear(state, key, ++clears);
        state[key]=''; return true;
      },
      AddText:text=>{
        if (hooks.add) return hooks.add(state, key, text, ++adds);
        state[key]+=text; return true;
      }
    };
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

test('failed insertion restores original after false, exception, partial write or incorrect success', () => {
  for (const failure of ['false', 'throw', 'partial-throw', 'incorrect-success']) {
    const {state,invoke}=fixture({add:(state,key,text,call)=>{
      if (call === 1) {
        if (failure === 'partial-throw') state[key] = text.slice(0, 1);
        if (failure.includes('throw')) throw new Error('synthetic insertion failure');
        return failure === 'incorrect-success';
      }
      state[key] += text; return true;
    }});
    const target=invoke({action:'capture'});
    state.selected='two';
    const result=invoke({action:'apply',target,proposedText:'수정 문장'});
    assert.ok(result.error, failure);
    assert.equal(result.applied, undefined, failure);
    assert.equal(result.recoveryFailed, false, failure);
    assert.equal(state.text, '원래 문장', failure);
    assert.equal(state.second, '다른 개체', failure);
  }
});

test('failed clear preserves or restores original without inserting proposal', () => {
  for (const failure of ['false', 'throw', 'partial-false', 'partial-throw']) {
    const inserted=[];
    const {state,invoke}=fixture({
      clear:(state,key,call)=>{
        if (call === 1) {
          if (failure.startsWith('partial')) state[key]='';
          if (failure.includes('throw')) throw new Error('synthetic clear failure');
          return false;
        }
        state[key]=''; return true;
      },
      add:(state,key,text)=>{ inserted.push(text); state[key]+=text; return true; }
    });
    const target=invoke({action:'capture'});
    const result=invoke({action:'apply',target,proposedText:'수정 문장'});
    assert.equal(result.recoveryFailed, false, failure);
    assert.equal(state.text, '원래 문장', failure);
    assert.ok(!inserted.includes('수정 문장'), failure);
  }
});

test('recovery clear failure is explicit and does not append original to partial text', () => {
  for (const failure of ['false', 'throw']) {
    let adds=0;
    const {state,invoke}=fixture({
      clear:(state,key,call)=>{
        if (call === 1) { state[key]=''; return true; }
        if (failure === 'throw') throw new Error('synthetic recovery failure');
        return false;
      },
      add:(state,key)=>{ adds++; state[key]='부분'; throw new Error('synthetic partial insertion'); }
    });
    const target=invoke({action:'capture'});
    const result=invoke({action:'apply',target,proposedText:'수정 문장'});
    assert.equal(result.recoveryFailed, true, failure);
    assert.match(result.error, /추가 편집·저장 전에/);
    assert.equal(result.applied, undefined);
    assert.equal(adds, 1);
    assert.equal(state.text, '부분');
  }
});

test('recovery insertion failure or incorrect success never claims restored original', () => {
  for (const failure of ['false', 'throw', 'incorrect-success']) {
    const {state,invoke}=fixture({add:(_state,_key,_text,call)=>{
      if (call === 1) return false;
      if (failure === 'throw') throw new Error('synthetic recovery insertion failure');
      return failure === 'incorrect-success';
    }});
    const target=invoke({action:'capture'});
    const result=invoke({action:'apply',target,proposedText:'수정 문장'});
    assert.equal(result.recoveryFailed, true, failure);
    assert.match(result.error, /복구를 확인하지 못했습니다/);
    assert.equal(result.applied, undefined);
    assert.equal(state.text, '');
  }
});
