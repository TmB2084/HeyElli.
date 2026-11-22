import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseResponse} from '../response-lifecycle.ts';
const bytes=value=>new TextEncoder().encode(value);

test('a client already gone cancels its body, releases once and returns a reusable empty response',async()=>{
 let cancellations=0,releases=0;const abort=new AbortController();abort.abort();
 const original=new Response(new ReadableStream({start(c){c.enqueue(bytes('fictitious'));},cancel(){cancellations++;}}),{status:202,headers:{'Content-Length':'10','Content-Encoding':'gzip','Cache-Control':'no-store'}});
 const response=await releaseResponse(original,async()=>{releases++;},abort.signal);
 assert.equal(cancellations,1);assert.equal(releases,1);assert.equal(original.bodyUsed,true);assert.equal(response.status,202);assert.equal(await response.text(),'');assert.equal(response.headers.has('content-length'),false);assert.equal(response.headers.has('content-encoding'),false);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('normal streaming retains payload, status and headers and releases exactly once at EOF',async()=>{
 let releases=0;const abort=new AbortController();
 const source=new ReadableStream({start(c){c.enqueue(bytes('one'));c.enqueue(bytes('two'));c.close();}});
 const response=await releaseResponse(new Response(source,{status:206,headers:{'X-Fictional':'kept'}}),async()=>{releases++;},abort.signal);
 assert.equal(releases,0);assert.equal(response.status,206);assert.equal(response.headers.get('x-fictional'),'kept');assert.equal(await response.text(),'onetwo');assert.equal(releases,1);abort.abort();assert.equal(releases,1);
});

test('consumer cancellation cancels upstream and releases once',async()=>{
 let releases=0,cancellations=0;const abort=new AbortController();
 const response=await releaseResponse(new Response(new ReadableStream({start(c){c.enqueue(bytes('one'));},cancel(){cancellations++;}})),async()=>{releases++;},abort.signal);
 const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'one');await reader.cancel();abort.abort();assert.equal(releases,1);assert.equal(cancellations,1);
});

test('request abort interrupts a pending read even without consumer cancellation and releases once',async()=>{
 let releases=0,cancellations=0;const abort=new AbortController();
 const response=await releaseResponse(new Response(new ReadableStream({cancel(){cancellations++;}})),async()=>{releases++;},abort.signal);
 const reader=response.body.getReader(),pending=reader.read();const rejected=assert.rejects(pending,error=>error.name==='AbortError');abort.abort();await rejected;await reader.cancel().catch(()=>{});assert.equal(releases,1);assert.equal(cancellations,1);
});

test('admission is released even while upstream cancellation is stalled',async()=>{
 let releases=0,resolveCancel;const cancelled=new Promise(resolve=>{resolveCancel=resolve;}),abort=new AbortController();
 const response=await releaseResponse(new Response(new ReadableStream({cancel(){return cancelled;}})),async()=>{releases++;},abort.signal);
 abort.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(releases,1);resolveCancel();await response.body.cancel().catch(()=>{});assert.equal(releases,1);
});

test('source errors remain visible and release the lease without retrying the source',async()=>{
 let releases=0,pulls=0;const failure=new Error('Fictitious stream failure');
 const response=await releaseResponse(new Response(new ReadableStream({pull(){pulls++;throw failure;}})),async()=>{releases++;});
 await assert.rejects(response.text(),error=>error===failure);assert.equal(releases,1);assert.equal(pulls,1);
});

test('bodyless responses and failing lease cleanup do not change the business result',async()=>{
 let releases=0;const original=new Response(null,{status:204});assert.equal(await releaseResponse(original,async()=>{releases++;throw new Error('Fictitious cleanup failure');}),original);assert.equal(releases,1);
});

test('an already aborted response returns even when upstream cancellation never resolves',async()=>{
 let releases=0,resolveCancel;const pending=new Promise(resolve=>{resolveCancel=resolve;}),abort=new AbortController();abort.abort();
 try{const response=await releaseResponse(new Response(new ReadableStream({cancel(){return pending;}})),async()=>{releases++;},abort.signal);assert.equal(response.body,null);assert.equal(releases,1);}finally{resolveCancel();}
});
