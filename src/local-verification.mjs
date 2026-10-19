import { randomBytes } from 'node:crypto';
import { loadLlmConfig } from './config.mjs';
import { validateEndpoint } from './llm.mjs';
import { createWorkbenchServer } from './server.mjs';
import '../plugin/report.js';

const sources=['[슬라이드 1 · 개체 1]','[슬라이드 2 · 개체 1]'];
const documentText=`${sources[0]}\n합성 프로젝트 예산은 950만원이다.\n\n${sources[1]}\n합성 프로젝트 완료일은 11월 20일이다.`;
const cases=[
  {operation:'ask',text:documentText,instruction:'프로젝트 예산은 얼마인가요? 자료의 출처를 함께 표시하세요.'},
  {operation:'summarize',text:documentText,instruction:'예산과 완료일을 한국어 두 문장 이내로 요약하고 출처를 표시하세요.'},
  {operation:'replace_text',text:'합성 프로젝트는 계획에 따라서 진행되고 있습니다.',instruction:'뜻을 유지하여 한국어 한 문장 한 줄로 간결하게 다듬으세요.'}
];

export async function verifyLocalLlm(env=process.env) {
  let config,server;
  const token=randomBytes(24).toString('hex');
  try {
    config=await loadLlmConfig(env);
    if(config.mode==='mock')throw Error();
    const url=validateEndpoint(config.llmUrl);
    if(!['127.0.0.1','[::1]'].includes(url.hostname))throw Error();
    server=createWorkbenchServer({...config,token});
  }catch{return {ok:false,stage:'config',code:'LOCAL_CONFIG_INVALID',networkRequestAttempted:false};}
  const results=[];
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    for(const input of cases){
      const start=performance.now();
      try {
        const response=await fetch(`http://127.0.0.1:${server.address().port}/api/propose`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(35000)});
        const data=await response.json();
        if(!response.ok || data.operation!==input.operation)throw Error();
        const text=input.operation==='replace_text'?WorkbenchContract.validateProposal(data.proposedText):WorkbenchContract.validateAnswer(data.answer);
        const review=WorkbenchReport.review({sources,answer:text});
        results.push({operation:input.operation,ok:true,code:'OK',durationMs:Math.round(performance.now()-start),characters:text.length,...(input.operation==='replace_text'?{}:{observations:{mentionsBudget:text.includes('950'),knownCitationCount:review.known.length,unknownCitationCount:review.unknown.length}})});
      }catch{results.push({operation:input.operation,ok:false,code:'REQUEST_OR_RESPONSE_FAILED',durationMs:Math.round(performance.now()-start)});}
    }
    return {ok:results.every(result=>result.ok),stage:'response',protocol:config.mode,syntheticInput:true,networkRequestAttempted:true,results,qualityCertified:false,desktopEngineTested:false};
  }catch{return {ok:false,stage:'request',code:'LOCAL_BRIDGE_FAILED',networkRequestAttempted:false};}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
