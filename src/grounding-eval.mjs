const canonical=value=>String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
export function scoreAnswer(question,raw,context) {
  let parsed;try{parsed=JSON.parse(raw);}catch{}
  const match=parsed&&typeof parsed.answer==='string'&&parsed.answer.trim()&&(parsed.page===null||Number.isSafeInteger(parsed.page)&&parsed.page>0) ? [raw,parsed.answer,parsed.page===null?'NONE':String(parsed.page)] : null;
  if(!match)return {validFormat:false,correct:false,supportedCorrect:false,abstained:false,wrongAssertion:false,unsupportedAssertion:false,citationCorrect:false};
  const answer=canonical(match[1]),abstained=answer==='UNKNOWN';
  const expected=canonical(question.answer);
  const evidencePage=context.pages.find(page=>page.page===question.page);
  const available=expected!=='UNKNOWN' && !!evidencePage && new RegExp(`(?:^|[^A-Z0-9])${expected}(?:$|[^A-Z0-9])`).test(evidencePage.text.toUpperCase());
  const correct=answer===expected;
  return {validFormat:true,correct,supportedCorrect:correct&&(abstained||available),abstained,wrongAssertion:!abstained&&!correct,unsupportedAssertion:!abstained&&(!correct||!available),citationCorrect:correct&&(abstained?match[2].toUpperCase()==='NONE':available&&Number(match[2])===question.page)};
}
export function summarizeScores(records) {
  const count=key=>records.filter(record=>record.score[key]).length;
  const unknown=records.filter(record=>record.expected==='UNKNOWN');
  return {total:records.length,validFormat:count('validFormat'),correct:count('correct'),supportedCorrect:count('supportedCorrect'),wrongAssertions:count('wrongAssertion'),unsupportedAssertions:count('unsupportedAssertion'),citationCorrect:count('citationCorrect'),unanswerableTotal:unknown.length,unanswerableAbstained:unknown.filter(record=>record.score.abstained).length,requestFailures:records.filter(record=>record.requestFailed).length,formatFailures:records.filter(record=>!record.requestFailed&&!record.score.validFormat).length};
}
