import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {openOrderStore} from '../order-store.ts';
import {uploadStorage,uploadLimits} from '../upload-storage.ts';
import {limitedStream} from '../../../http-safety/limits.ts';
import {withRequestBudget,upstreamSignal} from '../../../resource-budgets/context.ts';
import {requestClass} from '../../../resource-budgets/model.ts';
test('requests classify expensive transfers and exports independently of normal reads',()=>{assert.equal(requestClass('/api/pds-simulator/uploads'),'heavy');assert.equal(requestClass('/api/pds-simulator/orders'),'heavy');assert.equal(requestClass('/api/benutzerkonto/daten/export'),'export');assert.equal(requestClass('/api/service'),'normal');assert.equal(requestClass('/api/verwaltung/protokoll','','json'),'normal');});
test('slow or aborted body is cancelled with a bounded retryable error',async()=>{let cancelled=false;const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}});const keep=setTimeout(()=>{},1000);try{await assert.rejects(new Response(limitedStream(body,100,25)).text(),e=>e.status===408);assert.equal(cancelled,true);}finally{clearTimeout(keep);}});
test('chunked uploads enforce quotas, preserve old files, isolate failures and permit acknowledged retries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'heyelli-quota-'));const path=join(dir,'fixture.sqlite');let store;
 try{store=openOrderStore(path);const old=randomUUID();store.upload(old,'old.msg',Buffer.from('Old input'),'owner');store.close();store=null;const db=new DatabaseSync(path),limits={...uploadLimits,userBytes:600000,totalBytes:900000,reserveBytes:1},storage=uploadStorage(db,path,{limits,free:()=>10000000}),stream=bytes=>new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),id=randomUUID();
 try{
  await storage.receive(id,'new.pdf','owner',stream(Buffer.alloc(300000,65)));assert.equal(db.prepare('SELECT chunked_size,length(content) n FROM uploads WHERE id=?').get(id).n,0);assert.equal(storage.bytes(db.prepare('SELECT * FROM uploads WHERE id=?').get(id)).length,300000);
  await assert.rejects(storage.receive(randomUUID(),'too-large.pdf','owner',stream(Buffer.alloc(400000,65))),e=>e.status===507);assert.equal(db.prepare('SELECT count(*) n FROM uploads').get().n,2);assert.equal(db.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n,0);
  const full=uploadStorage(db,path,{limits:{...limits,userBytes:1,totalBytes:1},free:()=>0});assert.equal((await full.receive(id,'new.pdf','owner',stream(Buffer.alloc(300000,65)))).uploadId,id);await assert.rejects(full.receive(randomUUID(),'new.pdf','owner',stream(Buffer.from('new'))),e=>e.status===507);
  await assert.rejects(storage.receive(id,'new.pdf','other',stream(Buffer.alloc(300000,65))),e=>e.status===409);await assert.rejects(storage.receive(id,'new.pdf','owner',stream(Buffer.from('Different'))),e=>e.status===409);
  await assert.rejects(storage.receive(randomUUID(),'program.exe','owner',stream(Buffer.from('MZ executable'))),e=>e.status===415);
  let step=0;const broken=new ReadableStream({pull(c){if(step++===0)c.enqueue(Buffer.alloc(262144,66));else c.error(Error('Fictitious disconnect'));}});await assert.rejects(storage.receive(randomUUID(),'interrupted.pdf','owner',broken));assert.equal(db.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n,0);assert.equal(db.prepare('SELECT content FROM uploads WHERE id=?').get(old).content.length,9);
  const pages=db.prepare('PRAGMA page_count').get().page_count;db.exec('PRAGMA max_page_count='+pages);await assert.rejects(storage.receive(randomUUID(),'disk-full.pdf','second',stream(Buffer.alloc(500000,67))),e=>e.status===507);assert.equal(db.prepare('SELECT count(*) n FROM uploads').get().n,2);
 }finally{db.close();}
 store=openOrderStore(path);assert.equal(store.uploadBytes(id,'owner').length,300000);assert.equal(store.uploadBytes(old,'owner').toString(),'Old input');
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});

test('per-request upstream call budgets stop new work and preserve aborts',()=>{withRequestBudget('normal',undefined,()=>{for(let n=0;n<80;n++)assert.ok(upstreamSignal());assert.throws(()=>upstreamSignal(),e=>e.status===503);});const signal=AbortSignal.abort();withRequestBudget('normal',signal,()=>assert.throws(()=>upstreamSignal(),e=>e.status===503));});
