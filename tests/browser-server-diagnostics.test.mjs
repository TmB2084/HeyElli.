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
