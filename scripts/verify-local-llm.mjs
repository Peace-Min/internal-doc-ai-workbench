import { verifyLocalLlm } from '../src/local-verification.mjs';
const report=process.argv.length===2 ? await verifyLocalLlm() : {ok:false,stage:'config',code:'CLI_ARGUMENTS',networkRequestAttempted:false};
console.log(JSON.stringify(report,null,2));
process.exitCode=report.ok?0:report.stage==='config'?2:3;
