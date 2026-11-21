import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {dispatchPdsDocuments,dispatchRelations,dispatchId} from '../dispatch-reader.ts';
import {dispatchRefKey} from '../dispatch-repository.ts';
import {ReadonlyPdsTransport} from '../../../../platform/pds/connection/readonly.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
test('dispatch reads current related records and document metadata without downloading or writing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dispatch-')),store=openOrderStore(join(dir,'fictional.sqlite'));
 try{const api=new SimulatedPdsApi(store),calls=[],transport={request(...args){calls.push(args);return api.request(...args);}},catalog=await dispatchPdsDocuments(transport,'sim-order-1');assert.equal(catalog.items.length,1);assert.equal(catalog.errors.length,0);assert.match(catalog.items[0].origin,/Grunddaten.*Auftrag/);assert.ok(calls.every(([method,path])=>method==='GET'&&!path.includes('download')));
 const result=await dispatchRelations(transport,'sim-order-1');assert.ok(result.targets.some(row=>row.kind==='customer'));assert.ok(result.targets.some(row=>row.kind==='object'));assert.ok(result.targets.every(row=>!('url' in row)));assert.ok(calls.every(([method,path])=>method==='GET'||/details|list/.test(path)));
 const bytes=await api.request('GET','/dokument/downloaddokument/'+catalog.items[0].reference.id);assert.match(new TextDecoder().decode(bytes),/fiktiv/i);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('dispatch catalog isolates source failures, rejects oversized responses and unsafe identifiers',async()=>{
 const result=await dispatchPdsDocuments({async request(method,path){if(path.includes('listauftragsdokumente'))throw Error('secret must not escape');return [{uuid:'doc',fileName:'Bericht.pdf'}];}},'order');assert.equal(result.items.length,1);assert.equal(result.errors.length,1);assert.ok(!JSON.stringify(result).includes('secret'));
 for(const rows of [Array(501).fill({uuid:'doc',fileName:'A'}),[{uuid:'../escape',fileName:'X'}],[{uuid:'doc',fileName:'X\nY'}]])assert.equal((await dispatchPdsDocuments({async request(){return rows;}},'order')).items.length,0);
 for(const id of ['..','a/b','a?b','a#b','%2f','a\\b'])assert.throws(()=>dispatchId(id));
 const reference={provider:'sharepoint',target:'order',id:'same',library:'a'.repeat(64)};assert.notEqual(dispatchRefKey(reference),dispatchRefKey({...reference,library:'b'.repeat(64)}));assert.notEqual(dispatchRefKey(reference),dispatchRefKey({...reference,target:'customer'}));
});
test('readonly PDS permits exact document list routes and denies mutations',async()=>{
 const calls=[],api=new ReadonlyPdsTransport({async request(...args){calls.push(args);return [];}});for(const path of ['/service/listdokumente/order','/service/listauftragsdokumente/order'])await api.request('GET',path);assert.equal(calls.length,2);await assert.rejects(api.request('POST','/service/listdokumente/order',{}));await assert.rejects(api.request('POST','/service/create',{}));assert.equal(calls.length,2);
});
