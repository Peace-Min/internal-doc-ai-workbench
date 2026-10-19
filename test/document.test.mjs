import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import '../plugin/contract.js';
const source=await readFile(new URL('../plugin/editor-command.js',import.meta.url),'utf8');
function fixture(pages) {
  let writes=0;
  const visited=[];
  const shape=(entry)=>({
    GetClassType:()=>entry.type || 'shape',
    GetContent:()=>entry.noContent ? null : ({GetAllParagraphs:()=>(entry.paragraphs || [[entry.text ?? '']]).map(parts=>({
      GetElementsCount:()=>parts.length,
      GetElement:index=>({GetClassType:()=>entry.elementType || 'run',GetText:()=>parts[index],ClearContent:()=>{writes++;throw Error('unexpected write');},AddText:()=>{writes++;throw Error('unexpected write');}})
    }))})
  });
  const context=vm.createContext({Asc:{scope:{}},Api:{
    GetSelection:()=>{throw Error('document read must not inspect selection');},
    GetPresentation:()=>({GetAllSlides:()=>pages.map((page,index)=>({GetAllDrawings:()=>{visited.push(index+1);return page.map(shape);}}))})
  }});
  vm.runInContext(source,context);
  return {invoke:payload=>{context.Asc.scope.workbenchPayload=payload;return context.workbenchEditorCommand();},writes:()=>writes,visited};
}
test('document read collects ordered slide sources, reports excluded and empty objects, and never writes',()=>{
  const f=fixture([[{paragraphs:[['제목',' 첫 장'],['조건']]},{type:'image'},{text:''}],[],[{text:'다음 슬라이드'},{elementType:'hyperlink',text:'제외 링크'},{type:'group'},{noContent:true}]]);
  const result=f.invoke({action:'inspect_document'});
  assert.equal(result.text,'[슬라이드 1 · 개체 1]\n제목 첫 장\n조건\n\n[슬라이드 3 · 개체 1]\n다음 슬라이드');
  assert.equal(result.scope,'document'); assert.equal(result.readOnly,true);
  assert.equal(result.slideCount,3); assert.equal(result.textObjectCount,2);
  assert.equal(result.skippedObjectCount,3); assert.equal(result.emptyObjectCount,2);
  assert.equal(result.sources[1].slide,3); assert.equal(result.sources[1].label,'[슬라이드 3 · 개체 1]');
  assert.equal(f.writes(),0);
  assert.ok(f.invoke({action:'apply',target:{...result,readOnly:false},proposedText:'수정 금지'}).error);
  assert.equal(f.writes(),0);
});
test('document length includes provenance and rejects oversized aggregate without partial results',()=>{
  const overhead='[슬라이드 1 · 개체 1]\n'.length;
  const exact=fixture([[{text:'x'.repeat(12000-overhead)}]]);
  assert.equal(exact.invoke({action:'inspect_document'}).text.length,12000);
  for(const pages of [[[{text:'x'.repeat(12001-overhead)}]],[[{text:'x'.repeat(6000)}],[{text:'y'.repeat(6000)}]],[[{text:'valid'},{text:'bad\u0000text'}]]]) {
    const f=fixture(pages),result=f.invoke({action:'inspect_document'});
    assert.ok(result.error);assert.equal(result.text,undefined);assert.equal(f.writes(),0);
  }
});
test('document read enforces slide and drawing limits and refuses empty or unsupported-only documents',()=>{
  for(const pages of [Array.from({length:201},()=>[]),[Array.from({length:2001},()=>({text:''}))],[],[[{type:'image'},{type:'group'}]],[[{text:'   '}]]]) {
    const f=fixture(pages),result=f.invoke({action:'inspect_document'});
    assert.ok(result.error);assert.equal(result.text,undefined);assert.equal(f.writes(),0);
  }
  const f=fixture(Array.from({length:200},(_value,index)=>index===199?[{text:'끝 장'}]:[]));
  const result=f.invoke({action:'inspect_document'});
  assert.equal(result.slideCount,200);assert.equal(result.sources[0].slide,200);
});

test('slide ranges keep original sources, visit only requested slides and count range headers toward the limit',()=>{
  const header='[분석 범위: 슬라이드 250~250 / 전체 300]\n\n[슬라이드 250 · 개체 1]\n';
  const pages=Array.from({length:300},(_value,index)=>[{text:index===249?'x'.repeat(12000-header.length):'범위 밖'}]);
  const f=fixture(pages), result=f.invoke({action:'inspect_document',startSlide:250,endSlide:250});
  assert.equal(result.text.length,12000);assert.equal(result.slideCount,1);assert.equal(result.documentSlideCount,300);
  assert.equal(result.startSlide,250);assert.equal(result.endSlide,250);assert.equal(result.sources[0].slide,250);
  assert.deepEqual(f.visited,[250]);assert.equal(f.writes(),0);
  pages[249][0].text+='x';
  const overflow=fixture(pages).invoke({action:'inspect_document',startSlide:250,endSlide:250});
  assert.ok(overflow.error);assert.equal(overflow.text,undefined);
  const tail=fixture(Array.from({length:300},()=>[{text:'짧은 본문'}]));
  const tailResult=tail.invoke({action:'inspect_document',startSlide:299});
  assert.equal(tailResult.endSlide,300);assert.deepEqual(tail.visited,[299,300]);
  const head=fixture([[{text:'첫 장'}],[{text:'끝 장'}]]).invoke({action:'inspect_document',endSlide:1});
  assert.equal(head.startSlide,1);assert.equal(head.endSlide,1);assert.match(head.text,/전체 2/);
});

test('invalid or out-of-document ranges fail before scanning and return no partial text',()=>{
  for(const range of [{startSlide:0},{startSlide:-1},{startSlide:1.5},{startSlide:'1'},{startSlide:null},{endSlide:4},{startSlide:3,endSlide:2},{startSlide:4},{endSlide:Infinity},{startSlide:NaN}]) {
    const f=fixture([[{text:'a'}],[{text:'b'}],[{text:'c'}]]),result=f.invoke({action:'inspect_document',...range});
    assert.ok(result.error);assert.equal(result.text,undefined);assert.deepEqual(f.visited,[]);assert.equal(f.writes(),0);
  }
});

test('range input parser accepts blank bounds and rejects ambiguous or invalid numbers',()=>{
  const parse=globalThis.WorkbenchContract.validateSlideRange;
  assert.deepEqual(parse('',''),{startSlide:undefined,endSlide:undefined});
  assert.deepEqual(parse(' 2 ','4'),{startSlide:2,endSlide:4});
  for(const [start,end] of [['0','1'],['-1','2'],['1.5','2'],['1e3',''],['2','1'],['NaN',''],['9007199254740992',''],['1','2/path']])assert.throws(()=>parse(start,end));
});
