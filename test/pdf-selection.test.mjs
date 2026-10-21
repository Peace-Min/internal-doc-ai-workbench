import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const files=await Promise.all(['contract.js','pdf-selection.js'].map(name=>readFile(new URL('../plugin/'+name,import.meta.url),'utf8')));
function reader() {
  let timeout,cleared=0;
  const context=vm.createContext({setTimeout(callback,ms){assert.equal(ms,15000);timeout=callback;return 1},clearTimeout(){cleared++}});
  for(const file of files)vm.runInContext(file,context);
  return {capture:context.WorkbenchPdfSelection.capture,expire:()=>timeout(),cleared:()=>cleared};
}
test('PDF selection preserves exact text at the limit and calls only the read API',async()=>{
  const ui=reader(),text=' '+ '문'.repeat(11998)+'\n';
  const result=await ui.capture({executeMethod(method,options,done){assert.equal(method,'GetSelectedText');assert.equal(options[0].Math,false);done(text)}});
  assert.equal(result.text,text);assert.equal(result.readOnly,true);assert.equal(result.kind,'pdf_selection');assert.equal(ui.cleared(),1);
});
test('PDF timeout and unavailable methods reject; a late callback cannot publish a successful snapshot',async()=>{
  const ui=reader();let done;
  const pending=ui.capture({executeMethod(_method,_options,callback){done=callback}});
  ui.expire();await assert.rejects(pending,/시간이 초과/);
  done('Late text');await assert.rejects(pending,/시간이 초과/);
  await assert.rejects(reader().capture({}),/API를 사용할 수 없습니다/);
});
