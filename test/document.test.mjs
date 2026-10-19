import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../plugin/editor-command.js',import.meta.url),'utf8');
function fixture(pages) {
  let writes=0;
  const shape=(entry)=>({
    GetClassType:()=>entry.type || 'shape',
    GetContent:()=>entry.noContent ? null : ({GetAllParagraphs:()=>(entry.paragraphs || [[entry.text ?? '']]).map(parts=>({
      GetElementsCount:()=>parts.length,
      GetElement:index=>({GetClassType:()=>entry.elementType || 'run',GetText:()=>parts[index],ClearContent:()=>{writes++;throw Error('unexpected write');},AddText:()=>{writes++;throw Error('unexpected write');}})
    }))})
  });
  const context=vm.createContext({Asc:{scope:{}},Api:{
    GetSelection:()=>{throw Error('document read must not inspect selection');},
    GetPresentation:()=>({GetAllSlides:()=>pages.map(page=>({GetAllDrawings:()=>page.map(shape)}))})
  }});
  vm.runInContext(source,context);
  return {invoke:payload=>{context.Asc.scope.workbenchPayload=payload;return context.workbenchEditorCommand();},writes:()=>writes};
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
