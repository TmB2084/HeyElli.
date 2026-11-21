import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLimited,boundedRequest,DataLimitError} from '../limits.ts';
import {browserHeaders,browserOrigin} from '../headers.ts';
import {PdsHttpTransport} from '../../pds/api/protocol.ts';
test('all responses enforce source restrictions and nonce scripts with development-only eval, without HSTS',()=>{
 for(const development of [false,true]){const headers=Object.fromEntries(browserHeaders(development,'A'.repeat(32)).map(h=>[h.key,h.value]));assert.equal(headers['X-Content-Type-Options'],'nosniff');assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['Referrer-Policy'],'no-referrer');assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.equal(headers['Strict-Transport-Security'],undefined);assert.equal(headers['Content-Security-Policy-Report-Only'],undefined);assert.match(headers['Content-Security-Policy'],/'nonce-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' 'strict-dynamic'/);assert.match(headers['Content-Security-Policy'],/script-src-attr 'none'/);assert.doesNotMatch(headers['Content-Security-Policy'].split(';')[1],/unsafe-inline/);assert.equal(headers['Content-Security-Policy'].includes("'unsafe-eval'"),development);}
});
test('stream limits reject declared and undeclared excess and cancel upstream',async()=>{
 let cancelled=false;
 const stream=()=>new ReadableStream({pull(c){c.enqueue(new Uint8Array(6));},cancel(){cancelled=true;}});
 await assert.rejects(readLimited(new Response(stream()),10),DataLimitError);assert.equal(cancelled,true);
 cancelled=false;await assert.rejects(readLimited(new Response(stream(),{headers:{'Content-Length':'11'}}),10),DataLimitError);assert.equal(cancelled,true);
 assert.deepEqual(await readLimited(new Response('hello'),5),new TextEncoder().encode('hello'));
 const request=new Request('https://heyelli.invalid/upload',{method:'POST',body:'x'.repeat(16001)});
 await assert.rejects(boundedRequest(request,'/api/pds/rest/api/termin/update').text(),DataLimitError);
});
test('PDS JSON and document responses use bounded readers, including chunked content',async()=>{
 const transport=new PdsHttpTransport('https://pds.invalid','fictional',async()=>new Response('x',{headers:{'Content-Length':String(9*1024*1024)}}));
 await assert.rejects(transport.request('POST','/mitarbeiter/listmitarbeiter',{page:0,entriesPerPage:1}),DataLimitError);
 const document=new PdsHttpTransport('https://pds.invalid','fictional',async()=>new Response('x',{headers:{'Content-Length':String(101*1024*1024)}}));
 await assert.rejects(document.request('GET','/dokument/downloaddokument/fictional'),DataLimitError);
});

test('PDS errors cancel unread bodies without reading or exposing service contents',async()=>{
 let cancelled=false;const body=new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('fictional-private-detail'));},cancel(){cancelled=true;}});
 const api=new PdsHttpTransport('https://pds.invalid','fictional',async()=>new Response(body,{status:403}));await assert.rejects(api.request('POST','/mitarbeiter/listmitarbeiter',{page:0,entriesPerPage:1}),e=>/403/.test(e.message)&&!e.message.includes('fictional-private-detail'));assert.equal(cancelled,true);
});

test('only the explicit tool response permits same-origin framing; scripts retain per-request nonces',()=>{
 const headers=Object.fromEntries(browserHeaders(false,'B'.repeat(32),true).map(h=>[h.key,h.value]));
 assert.equal(headers['X-Frame-Options'],'SAMEORIGIN');assert.match(headers['Content-Security-Policy'],/frame-ancestors 'self'/);assert.match(headers['Content-Security-Policy'],/frame-src 'self'/);assert.match(headers['Content-Security-Policy'],/'nonce-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' 'strict-dynamic'/);
 assert.equal(Object.fromEntries(browserHeaders(false).map(h=>[h.key,h.value]))['X-Frame-Options'],'DENY');
});
test('browser origin ignores the internal port and applies a declared public origin only to its own host',()=>{
 const request=host=>new Request('http://localhost:3000/anmeldung',{headers:{host}});
 const previous=process.env.HEYELLI_PUBLIC_ORIGIN;
 try{
  delete process.env.HEYELLI_PUBLIC_ORIGIN;
  assert.equal(browserOrigin(request('127.0.0.1:3000')),'http://127.0.0.1:3000');
  assert.equal(browserOrigin(request('heyelli.example.invalid')),'http://heyelli.example.invalid');
  assert.throws(()=>browserOrigin(request('heyelli.example.invalid/evil')));
  process.env.HEYELLI_PUBLIC_ORIGIN='https://heyelli.example.invalid';
  assert.equal(browserOrigin(request('heyelli.example.invalid')),'https://heyelli.example.invalid');
  assert.equal(browserOrigin(request('other.example.invalid')),'http://other.example.invalid');
 }finally{if(previous===undefined)delete process.env.HEYELLI_PUBLIC_ORIGIN;else process.env.HEYELLI_PUBLIC_ORIGIN=previous;}
});
