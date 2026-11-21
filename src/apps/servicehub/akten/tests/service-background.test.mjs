import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {readCore,readExtras} from '../reader.ts';
import {fileRefresh} from '../file-refresh.ts';
import {PdsHttpTransport} from '../../../../platform/pds/api/protocol.ts';
import {ReadonlyPdsTransport} from '../../../../platform/pds/connection/readonly.ts';
import {resolveContractLinks} from '../../../../platform/bmacloud/mapping.ts';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const core=(revision,name='Anlage')=>({kind:'object',objectId:'unit',name,revision:revision.repeat(64)});
test('core files require no cost, contract or employee lookup and remain available when extras fail',async()=>{
 const calls=[],api={async request(method,path){calls.push(path);if(path==='/objekt/details')return {uuid:'unit',bezeichnung:'Anlage',kstKtrUUID:'carrier',typ:'TECHNISCHE_EINHEIT'};throw Error('extras offline');}};
 const record=await readCore(api,'object','unit');assert.equal(record.file.name,'Anlage');assert.deepEqual(calls,['/objekt/details']);
 const extras=await readExtras(api,record);assert.match(extras.costCarrierError,/nicht aufgelöst/);assert.match(extras.contractError,/nicht geladen/);assert.equal(record.file.name,'Anlage');
 const order=await readCore({async request(method,path){assert.equal(path,'/service/details');return {uuid:'order',rootEbene:{ebenen:[{uuid:'incident',hauptmonteurUUID:'employee'}]}};}},'order','order');assert.equal(order.file.incidents[0].technicianId,'employee');assert.equal(order.file.incidents[0].technician,'Name noch nicht geladen');
});
test('slow or obsolete extras never block a base refresh or overwrite a newer revision',async()=>{
 const pending=[deferred(),deferred()];let version='a',extraCount=0;const applied=[],bases=[];
 const loader=fileRefresh('object','unit',{base:value=>bases.push(value),extras:value=>applied.push(value),error:assert.fail,extraError:assert.fail,loadingExtras:()=>{}},async url=>{
  const params=new URL(url,'https://app.example.invalid').searchParams;
  return params.get('part')==='base'?Response.json(core(version)):pending[extraCount++].promise;
 });
 await loader.refresh();assert.equal(bases.length,1);assert.equal(applied.length,0);
 version='b';await loader.refresh();assert.equal(bases.length,2);
 pending[0].resolve(Response.json({revision:'a'.repeat(64),extras:{contracts:[{name:'old'}]}}));await setImmediate();assert.equal(applied.length,0);
 pending[1].resolve(Response.json({revision:'b'.repeat(64),extras:{contracts:[{name:'new'}]}}));await setImmediate();assert.equal(applied[0].extras.contracts[0].name,'new');loader.dispose();
});
test('background failure clears loading, preserves delivered core and retries without reload',async()=>{
 let fail=true;const states=[],errors=[],applied=[];const loader=fileRefresh('object','unit',{base:value=>applied.push(value),extras:()=>{},error:assert.fail,extraError:error=>errors.push(error),loadingExtras:value=>states.push(value)},async url=>new URL(url,'https://app.example.invalid').searchParams.get('part')==='base'?Response.json(core('a')):fail?Promise.reject(new DOMException('timeout','TimeoutError')):Response.json({revision:'a'.repeat(64),extras:{contracts:[]}}));
 await loader.refresh();await setImmediate();assert.deepEqual(states,[true,false]);assert.equal(applied.length,1);assert.equal(errors.length,1);
 fail=false;await loader.refresh();await setImmediate();assert.deepEqual(states,[true,false,true,false]);loader.dispose();
});
test('disposed file requests cannot update the next file even when a transport ignores cancellation',async()=>{
 const response=deferred();let writes=0;const loader=fileRefresh('object','unit',{base:()=>writes++,extras:()=>writes++,error:()=>writes++,extraError:()=>writes++,loadingExtras:()=>writes++},async()=>response.promise);
 const task=loader.refresh();loader.dispose();response.resolve(Response.json(core('a')));await task;assert.equal(writes,0);
});
test('read-only PDS requests forward cancellation and BMA cancels remaining batches',async()=>{
 const controller=new AbortController();const api=new ReadonlyPdsTransport(new PdsHttpTransport('https://pds.example.invalid','fictional-token',async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})));
 const request=api.request('POST','/objekt/details',{uuid:'unit'},{signal:controller.signal});controller.abort();await assert.rejects(request,error=>error.name==='AbortError');
 let calls=0;const bmaAbort=new AbortController(),file={kind:'object',name:'TE',contracts:Array.from({length:9},(_,i)=>({name:String(i),maintenanceCostCarrier:{number:String(i)}}))};
 const pending=resolveContractLinks(file,{baseUrl:'https://bma.example.invalid/',token:'fictional-token'},async(url,options)=>{calls++;return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});},bmaAbort.signal);
 bmaAbort.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(calls,3);assert.ok(file.contracts.every(contract=>!contract.bma));
});
