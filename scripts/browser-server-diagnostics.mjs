// Consume process output only in memory. Persist fixed counters, never raw text.
export function browserServerDiagnostics(){
 const tails=new Map(),counts={responseBodyState:0,streamControllerState:0};
 function classify(value){
  const text=value.replace(/\u001b\[[0-9;]*m/g,'');
  if(/^\s*(?:⨯\s*)?TypeError:\s*Response body object should not be disturbed or locked/.test(text))return 'responseBodyState';
  if(/^\s*(?:⨯\s*)?TypeError(?:\s*\[ERR_INVALID_STATE\])?:\s*Invalid state: Controller is already closed/.test(text))return 'streamControllerState';
 }
 return {
  record(channel,chunk){const lines=((tails.get(channel)??'')+chunk.toString()).split(/\r?\n/);tails.set(channel,lines.pop().slice(-2048));for(const value of lines){const kind=classify(value);if(kind)counts[kind]++;}},
  snapshot(){const result={...counts};for(const value of tails.values()){const kind=classify(value);if(kind)result[kind]++;}return {status:Object.values(result).some(value=>value>0)?'failed':'passed',counts:result};},
 };
}
