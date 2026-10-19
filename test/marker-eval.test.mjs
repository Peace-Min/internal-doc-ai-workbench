import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisContext} from '../src/marker-context.mjs';
import {scoreAnswer,summarizeScores} from '../src/grounding-eval.mjs';
const data={schemaVersion:1,engine:'marker',documentSha256:'a'.repeat(64),pages:[{page:1,text:'ORBIT approved budget 950 USD.'},{page:2,text:''}]};
test('page context preserves source and empty pages without silently truncating',()=>{
  const context=analysisContext(data);assert.match(context.text,/\[page 1\]\nORBIT/);assert.deepEqual(context.emptyPages,[2]);
  for(const input of [{...data,pages:[...data.pages,{page:1,text:'duplicate'}]},{...data,pages:[{page:1,text:'a'.repeat(12001)}]},{...data,engine:'unknown'},{...data,documentSha256:'bad'}])assert.throws(()=>analysisContext(input));
});
test('rubric separates factual accuracy, evidence availability, abstention and citation',()=>{
  const question={answer:'950',page:1};
  const score=scoreAnswer(question,'{"answer":"950","page":1}',data);
  assert.equal(score.correct,true);assert.equal(score.citationCorrect,true);assert.equal(score.supportedCorrect,true);
  const wrong=scoreAnswer(question,'{"answer":"1200","page":1}',data);assert.equal(wrong.wrongAssertion,true);
  const guessed=scoreAnswer({answer:'437',page:2},'{"answer":"437","page":2}',data);
  assert.equal(guessed.correct,true);assert.equal(guessed.supportedCorrect,false);assert.equal(guessed.unsupportedAssertion,true);
  const unknown=scoreAnswer({answer:'UNKNOWN',page:null},'{"answer":"UNKNOWN","page":null}',data);
  assert.equal(unknown.correct,true);assert.equal(unknown.abstained,true);assert.equal(unknown.citationCorrect,true);
  const citation=scoreAnswer(question,'{"answer":"950","page":2}',data);assert.equal(citation.correct,true);assert.equal(citation.citationCorrect,false);
});
test('format and request failures remain visible instead of looking like safe answers',()=>{
  const invalid=scoreAnswer({answer:'950',page:1},'answer omitted',data);
  const summary=summarizeScores([{expected:'950',score:invalid,requestFailed:false},{expected:'UNKNOWN',score:invalid,requestFailed:true}]);
  assert.equal(summary.formatFailures,1);assert.equal(summary.requestFailures,1);assert.equal(summary.correct,0);assert.equal(summary.unanswerableAbstained,0);
});
