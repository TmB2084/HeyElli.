import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserServerDiagnostics} from '../scripts/browser-server-diagnostics.mjs';

test('browser server gate detects response-state errors across process-output chunks',()=>{
 const diagnostics=browserServerDiagnostics();diagnostics.record('stderr','⨯ TypeError: Response body object should not be dis');diagnostics.record('stderr','turbed or locked\n');diagnostics.record('stdout','TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed\n');assert.deepEqual(diagnostics.snapshot(),{status:'failed',counts:{responseBodyState:1,streamControllerState:1}});assert.deepEqual(diagnostics.snapshot().counts,{responseBodyState:1,streamControllerState:1});
});
test('normal aborts and expected HTTP failures are not response-state regressions',()=>{
 const diagnostics=browserServerDiagnostics();diagnostics.record('stderr','AbortError: Fictitious cancellation\n');diagnostics.record('stdout','GET /fictitious 503\n');assert.deepEqual(diagnostics.snapshot(),{status:'passed',counts:{responseBodyState:0,streamControllerState:0}});
});
test('browser server diagnostics never retain raw logs in the report and bound unfinished lines',()=>{
 const diagnostics=browserServerDiagnostics();diagnostics.record('stdout','fictitious-cookie=private;https://example.invalid/private\n');diagnostics.record('stderr','x'.repeat(100000));diagnostics.record('stdout','TypeError: Response body object should not be disturbed or locked');const result=diagnostics.snapshot();assert.equal(result.status,'failed');assert.equal(result.counts.responseBodyState,1);assert.deepEqual(Object.keys(result),['status','counts']);assert.ok(!JSON.stringify(result).includes('private'));diagnostics.record('stdout','\n');assert.equal(diagnostics.snapshot().counts.responseBodyState,1);
});

test('browser runner drains concurrent server output throughout a long-running browser process',async()=>{
 const {spawnTestProcess,stopTestProcess,runTestProcess}=await import('../scripts/test-process.mjs');
 const server=spawnTestProcess(process.execPath,['-e',"process.stdout.write('x'.repeat(2*1024*1024),()=>process.stdout.write('drained'));setInterval(()=>{},1000)"],{stdio:['ignore','pipe','ignore']});
 let bytes=0,drained=false;server.stdout.on('data',chunk=>{bytes+=chunk.length;if(chunk.toString().includes('drained'))drained=true;});
 try{const result=await runTestProcess(process.execPath,['-e','setTimeout(()=>{},500)'],{stdio:'ignore'},5000);assert.equal(result.status,0);assert.ok(bytes>=2*1024*1024);assert.equal(drained,true);}finally{await stopTestProcess(server);}
});

test('asynchronous browser runner stops only its own process on timeout or cancellation',async()=>{
 const {runTestProcess}=await import('../scripts/test-process.mjs');
 await assert.rejects(runTestProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'},100),/Zeitbudget/);
 const controller=new AbortController(),running=runTestProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',signal:controller.signal});controller.abort();await assert.rejects(running,{name:'AbortError'});
});
