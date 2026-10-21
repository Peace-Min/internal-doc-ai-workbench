import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createWorkbenchServer} from '../src/server.mjs';
import '../plugin/contract.js';
const source=await readFile(new URL('../plugin/page-command.js',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(hook) {
  const entries=[{text:'원래 제목',bold:true},{text:'첫 문단',bold:false},{text:'두 번째 문단',bold:true},{text:'예산 950만원',bold:false}];
  const state={writes:0,current:0,entries,extra:false,deleted:false};
  const runs=entries.map((entry,index)=>{
    let calls=0;
    return {GetClassType:()=> 'run',GetText:()=>entry.text,ClearContent:()=>{state.writes++;entry.text='';return true;},AddText:text=>hook ? hook(entry,index,text,++calls) : (entry.text+=text,true)};
  });
  const paragraph=items=>({GetElementsCount:()=>items.length,GetElement:index=>items[index]});
  const shape=(id,paragraphs)=>({GetInternalId:()=>id,GetClassType:()=> 'shape',GetContent:()=>({GetAllParagraphs:()=>paragraphs.map(paragraph)})});
  const first=shape('title',[[runs[0]],[runs[1],runs[2]]]);
  const second=shape('budget',[[runs[3]]]);
  const image={GetInternalId:()=> 'image',GetClassType:()=> 'image'};
  const pages=[{GetAllDrawings:()=>[first,...(state.deleted?[]:[second]),image,...(state.extra?[shape('new',[[runs[3]]])]:[])]},{GetAllDrawings:()=>[shape('other',[[{GetClassType:()=> 'run',GetText:()=> '다른 페이지'}]])]}];
  const context=vm.createContext({Asc:{scope:{}},Api:{GetPresentation:()=>({GetAllSlides:()=>pages,GetCurSlideIndex:()=>state.current})}});
  vm.runInContext(source,context);
  return {state,invoke:payload=>{context.Asc.scope.workbenchPayload=payload;return context.workbenchPageCommand();}};
}
const plan=target=>({edits:target.segments.map(segment=>({id:segment.id,text:segment.text+' 개선'}))});

test('page editing captures multiple objects, paragraphs and runs while keeping unrelated drawings',()=>{
  const f=fixture(),target=f.invoke({action:'page_capture',pageNumber:1});
  assert.equal(target.segments.length,4);assert.equal(target.excludedCount,1);assert.equal(f.state.writes,0);
  assert.deepEqual(JSON.parse(target.text).segments.map(segment=>[segment.object,segment.paragraph]),[[1,1],[1,2],[1,2],[2,1]]);
  f.state.current=1;
  const result=f.invoke({action:'page_apply',target,plan:plan(target)});
  assert.equal(result.applied,true);assert.equal(result.changedSegments,4);
  assert.deepEqual(f.state.entries.map(entry=>entry.bold),[true,false,true,false]);
  assert.ok(f.state.entries.every(entry=>entry.text.endsWith(' 개선')));
  assert.equal(f.invoke({action:'page_capture',pageNumber:2}).segments[0].text,'다른 페이지');
});
test('whole-page conflicts are detected before any write even on an unchanged plan entry',()=>{
  for(const change of ['text','deleted','added']){
    const f=fixture(),target=f.invoke({action:'page_capture'}),proposed=plan(target);
    proposed.edits[3].text=target.segments[3].text;
    if(change==='text')f.state.entries[3].text='사용자 직접 수정';
    if(change==='deleted')f.state.deleted=true;
    if(change==='added')f.state.extra=true;
    assert.ok(f.invoke({action:'page_apply',target,plan:proposed}).error);assert.equal(f.state.writes,0);
  }
});
test('unknown, duplicate, partial, multiline and oversized page plans cannot write',()=>{
  const f=fixture(),target=f.invoke({action:'page_capture'}),valid=plan(target);
  const bad=[{edits:valid.edits.slice(1)},{edits:valid.edits.map(()=>valid.edits[0])}, {...valid,code:'do not execute'}];
  for(const value of ['unknown','empty','multiline','large']){
    const p=clone(valid);if(value==='unknown')p.edits[0].id='s99';else p.edits[0].text=value==='empty'?'':value==='multiline'?'a\nb':'x'.repeat(12001);bad.push(p);
  }
  for(const p of bad){assert.ok(f.invoke({action:'page_apply',target,plan:p}).error);assert.equal(f.state.writes,0);}
});
test('a later partial write failure restores every earlier changed segment',()=>{
  const f=fixture((entry,index,text,call)=>{if(index===3&&call===1){entry.text=text.slice(0,2);throw Error('injected partial write');}entry.text+=text;return true;});
  const target=f.invoke({action:'page_capture'}),result=f.invoke({action:'page_apply',target,plan:plan(target)});
  assert.ok(result.error);assert.equal(result.recoveryFailed,false);
  assert.deepEqual(f.state.entries.map(entry=>entry.text),clone(target.segments.map(segment=>segment.text)));
});
test('unrecoverable segment is reported and other segments are still restored',()=>{
  const f=fixture((entry,index,text)=>{if(index===3)return false;entry.text+=text;return true;});
  const target=f.invoke({action:'page_capture'}),result=f.invoke({action:'page_apply',target,plan:plan(target)});
  assert.equal(result.recoveryFailed,true);assert.deepEqual(clone(result.failedSegments),['s4']);
  assert.deepEqual(f.state.entries.slice(0,3).map(entry=>entry.text),clone(target.segments.slice(0,3).map(segment=>segment.text)));
});
test('contract rejects invalid slide source and canonicalizes out-of-order edits',()=>{
  const doc={slideNumber:1,segments:[{id:'s1',text:'제목'},{id:'s2',text:'본문'}]};
  const parsed=WorkbenchContract.parseSlideDocument(JSON.stringify(doc));
  const valid=WorkbenchContract.validateSlidePlan({edits:[{id:'s2',text:'새 본문'},{id:'s1',text:'새 제목'}]},parsed);
  assert.deepEqual(valid.edits.map(edit=>edit.id),['s1','s2']);
  for(const bad of [{...doc,slideNumber:0},{...doc,segments:[doc.segments[0],doc.segments[0]]},{...doc,segments:[{id:'s1',text:'a\nb'}]}])assert.throws(()=>WorkbenchContract.parseSlideDocument(JSON.stringify(bad)));
});
test('page edits preserve run boundary whitespace and reject oversized captures before writing',()=>{
  const f=fixture();f.state.entries[0].text='  원래 제목 ';
  const target=f.invoke({action:'page_capture'}),proposed=plan(target);proposed.edits[0].text='새 제목';
  const valid=WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(target.text));
  assert.equal(valid.edits[0].text,'  새 제목 ');
  assert.equal(f.invoke({action:'page_apply',target,plan:valid}).applied,true);assert.equal(f.state.entries[0].text,'  새 제목 ');
  const large=fixture();large.state.entries[0].text='x'.repeat(12001);assert.ok(large.invoke({action:'page_capture'}).error);assert.equal(large.state.writes,0);
  assert.throws(()=>WorkbenchContract.parseSlideDocument(JSON.stringify({slideNumber:1,segments:Array.from({length:61},(_,i)=>({id:`s${i+1}`,text:'a'}))})));
});
test('numeric deletion or change is blocked at contract and editor unless explicitly allowed at capture',()=>{
  const f=fixture(),target=f.invoke({action:'page_capture'}),proposed=plan(target);
  proposed.edits[3].text='예산 1000만원';
  assert.throws(()=>WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(target.text)),/숫자/);
  assert.ok(f.invoke({action:'page_apply',target,plan:proposed}).error);assert.equal(f.state.writes,0);
  const allowed=f.invoke({action:'page_capture',allowNumberChanges:true});
  const approved=WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(allowed.text));
  assert.equal(f.invoke({action:'page_apply',target:allowed,plan:approved}).applied,true);
  assert.equal(f.state.entries[3].text,'예산 1000만원');
});
test('numeric values cannot migrate between segments or change order unless explicitly allowed',()=>{
  for(const scenario of ['swap','move','reorder']){
    const f=fixture();
    f.state.entries[0].text=scenario==='reorder'?'시작 9월 10일':'승인 950';
    f.state.entries[3].text='일정 2026';
    const target=f.invoke({action:'page_capture'}),proposed=plan(target);
    if(scenario==='swap'){
      proposed.edits[0].text='승인 2026';proposed.edits[3].text='일정 950';
    }else if(scenario==='move'){
      proposed.edits[0].text='승인';proposed.edits[1].text+=' 950';
    }else proposed.edits[0].text='시작 10월 9일';
    assert.throws(()=>WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(target.text)),/숫자/);
    assert.ok(f.invoke({action:'page_apply',target,plan:proposed}).error);
    assert.equal(f.state.writes,0);
    const allowed=f.invoke({action:'page_capture',allowNumberChanges:true});
    const approved=WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(allowed.text));
    assert.equal(f.invoke({action:'page_apply',target:allowed,plan:approved}).applied,true);
  }
});

test('preserved numeric sequences accept edited prose and arbitrary response entry order',()=>{
  const f=fixture();f.state.entries[0].text=' 시작 9월 10일, 완료 9월 10일 ';
  const target=f.invoke({action:'page_capture'}),proposed={edits:target.segments.map(segment=>({id:segment.id,text:segment.text.trim()+' 개선'}))};
  proposed.edits.reverse();
  const approved=WorkbenchContract.validateSlidePlan(proposed,WorkbenchContract.parseSlideDocument(target.text));
  assert.equal(f.invoke({action:'page_apply',target,plan:approved}).applied,true);
  assert.equal(f.state.entries[0].text,' 시작 9월 10일, 완료 9월 10일 개선 ');
  assert.equal(f.state.entries[3].text,'예산 950만원 개선');
});

test('both LLM protocols carry a whole slide and validate the structured plan over HTTP',async()=>{
  const document={slideNumber:2,segments:[{id:'s1',text:'원래 제목'},{id:'s2',text:'예산 950'}]},edits={edits:[{id:'s1',text:'개선 제목'},{id:'s2',text:'예산 950 유지'}]};
  for(const mode of ['openai-compatible','anthropic-compatible']){
    let responsePlan=edits;
    const token='synthetic-slide-edit-pairing-token';
    const server=createWorkbenchServer({token,mode,llmUrl:'http://example.invalid/v1/messages',model:'synthetic',fetch:async(url,options)=>{
      const body=JSON.parse(options.body),last=JSON.parse(body.messages.at(-1).content);
      assert.deepEqual(last.document,document);assert.equal(body.stream,false);
      assert.equal(!!body.response_format,mode==='openai-compatible');
      return new Response(JSON.stringify(mode==='openai-compatible'?{choices:[{finish_reason:'stop',message:{content:JSON.stringify(responsePlan)}}]}:{type:'message',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(responsePlan)}]}));
    }});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const request=()=>fetch(`http://127.0.0.1:${server.address().port}/api/propose`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'rewrite_slide',text:JSON.stringify(document),instruction:'페이지 전체 문장을 다듬어 주세요.'})});
    try{
      let response=await request();assert.equal(response.status,200);assert.deepEqual((await response.json()).plan,edits);
      responsePlan={edits:[edits.edits[0],edits.edits[0]]};response=await request();assert.equal(response.status,502);
      responsePlan={edits:[edits.edits[0],{id:'s2',text:'예산 1000'}]};response=await request();assert.equal(response.status,502);assert.equal((await response.json()).code,'SLIDE_NUMBERS_CHANGED');
      responsePlan={edits:[{id:'s1',text:'950 개선 제목'},{id:'s2',text:'예산 유지'}]};response=await request();assert.equal(response.status,502);assert.equal((await response.json()).code,'SLIDE_NUMBERS_CHANGED');
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  }
});
