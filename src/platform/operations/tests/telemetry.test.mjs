import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeResponse} from '../telemetry.ts';
function metrics(t){const previous=globalThis.heyelliTelemetry,calls=[];globalThis.heyelliTelemetry={pool:{query:async(...args)=>{calls.push(args);}},pending:0};t.after(()=>{if(previous===undefined)delete globalThis.heyelliTelemetry;else globalThis.heyelliTelemetry=previous;});return calls;}
const observe=(response,signal)=>observeResponse('/api/service','GET',response,performance.now(),signal);

test('telemetry preserves response and stream identity, metadata and body',async t=>{
 const calls=metrics(t),response=new Response('Fictitious business body',{status:201,headers:{'Cache-Control':'no-store','X-Fictional':'kept'}}),body=response.body;
 assert.equal(observe(response),response);assert.equal(response.body,body);assert.equal(response.bodyUsed,false);assert.match(response.headers.get('x-heyelli-request-id'),/^[a-f0-9-]{36}$/);assert.equal(response.status,201);assert.equal(response.headers.get('x-fictional'),'kept');assert.equal(await response.text(),'Fictitious business body');assert.equal(calls.length,1);
});

test('telemetry does not rewrap locked, consumed or cancelled response streams',async t=>{
 metrics(t);const locked=new Response('Locked'),reader=locked.body.getReader();assert.equal(observe(locked),locked);assert.equal(new TextDecoder().decode((await reader.read()).value),'Locked');await reader.cancel();
 const consumed=new Response('Consumed');await consumed.text();assert.equal(observe(consumed),consumed);
 const cancelled=new Response('Cancelled');await cancelled.body.cancel();assert.equal(observe(cancelled),cancelled);
});

test('immutable response headers never make telemetry fail or replace the response',t=>{
 metrics(t);const response=Response.redirect('https://example.invalid/fictitious',302);assert.throws(()=>response.headers.set('x-test','no'));assert.equal(observe(response),response);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://example.invalid/fictitious');
});

test('already aborted requests do not emit false outage logs or metrics',t=>{
 const calls=metrics(t),log=t.mock.method(console,'error',()=>{}),abort=new AbortController();abort.abort();const response=new Response('Fictitious aborted error',{status:502});assert.equal(observe(response,abort.signal),response);assert.equal(calls.length,0);assert.equal(log.mock.callCount(),0);
});

test('real server failures remain observable without exposing payloads, URLs or caller secrets',t=>{
 const calls=metrics(t),log=t.mock.method(console,'error',()=>{}),response=new Response('fictitious-private-body',{status:503});
 observeResponse('/api/service?token=fictitious-secret','GET',response,performance.now());assert.equal(calls.length,1);assert.equal(log.mock.callCount(),1);const output=log.mock.calls[0].arguments[0],data=JSON.parse(output);assert.equal(data.status,503);assert.equal(data.area,'service');assert.deepEqual(Object.keys(data).sort(),['area','at','durationMs','id','kind','method','status']);assert.ok(!output.includes('fictitious'));assert.ok(!JSON.stringify(calls).includes('fictitious'));
});

test('unavailable metrics never alter successful responses or leak rejected promises',async t=>{
 metrics(t);globalThis.heyelliTelemetry.pool.query=()=>Promise.reject(new Error('Fictitious unavailable metrics'));const response=new Response('Unchanged');assert.equal(observe(response),response);assert.equal(await response.text(),'Unchanged');await new Promise(resolve=>setImmediate(resolve));assert.equal(globalThis.heyelliTelemetry.pending,0);
});
