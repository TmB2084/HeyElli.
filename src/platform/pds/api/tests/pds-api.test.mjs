import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PdsHttpTransport,readApiFirst,validateRequest,contract} from '../protocol.ts';
import {PdsLookups} from '../lookups.ts';
import {SimulatedPdsApi} from '../../simulator/api.ts';
import {openOrderStore} from '../../simulator/order-store.ts';
import {serviceWorkflow} from '../workflows.ts';
test('API values always win; errors do not silently switch to views',async()=>{
 let views=0;
 assert.deepEqual(await readApiFirst(async()=>'',async()=>{views++;return 'fallback';}),{source:'api',value:''});assert.equal(views,0);
 await assert.rejects(readApiFirst(async()=>{throw Error('403');},async()=>{views++;return 'fallback';}));assert.equal(views,0);
 assert.deepEqual(await readApiFirst(async()=>undefined,async()=>{views++;return 'fallback';}),{source:'view',value:'fallback'});
});
test('real transport uses documented POST paths, bearer auth and recognizes protocol errors',async()=>{
 let captured;
 const client=new PdsHttpTransport('https://pds.example.invalid/pds/rest/api','synthetic-placeholder',async(url,options)=>{captured={url,options};return Response.json({resultList:[],totalHitCount:0});});
 await client.request('POST','/objekt/listobjekte',{page:0,entriesPerPage:500});
 assert.ok(captured.url.endsWith('/pds/rest/api/objekt/listobjekte'));assert.equal(captured.options.method,'POST');assert.equal(captured.options.redirect,'error');
 assert.throws(()=>validateRequest('POST','/service/create',{context:{},vorgangsdaten:{}}));
 assert.throws(()=>validateRequest('POST','/invented',{}));
 const denied=new PdsHttpTransport('https://pds.example.invalid','synthetic-placeholder',async()=>new Response(null,{status:403}));await assert.rejects(denied.request('GET','/person/listfunktionen'),/403/);
 assert.equal(Object.keys(contract.operations).length,193);
});
test('simulated protocol and UI gateway return objects, units, customers, contacts and technicians from API DTOs',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-contract-'));const store=openOrderStore(join(dir,'test.sqlite'));
 try {
  const api=new SimulatedPdsApi(store),gateway=new PdsLookups(api);
  const search=(resource,objectId,query='')=>gateway.search({resource,objectId,query,offset:0,limit:50});
  assert.equal((await search('objects',undefined,'Sud')).items[0].id,'sim-object-2');
  assert.equal((await search('units','sim-object-2')).total,1);
  assert.equal((await search('units','sim-object-4')).total,0);
  assert.equal((await search('customers','sim-object-1')).items[0].id,'SIM-K-100');
  assert.equal((await search('persons','sim-object-1')).total,2);
  assert.equal((await search('employees')).total,3);
  assert.equal((await search('siteManagers')).total,2);
  let viewCalls=0;
  const guarded={request:async(method,path,body)=>{if(path==='/datenansichten/listdaten'){viewCalls++;throw Error('View must not run');}return api.request(method,path,body);}};
  const apiPreferred=new PdsLookups(guarded,{projectManagerFunctions:['sim-function-project-manager']});
  assert.equal((await apiPreferred.search({resource:'siteManagers',query:'',offset:0,limit:50})).total,2);
  assert.equal(viewCalls,0);
  const calls=serviceWorkflow({customerUUID:'SIM-K-100',objectUUID:'sim-unit-3',description:'Demo',externalNumber:'',reportedAt:'2026-11-02T10:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:'2026-11-03T09:00:00Z'},'SIM-Serviceauftrag');
  assert.deepEqual(calls.map(call=>call.path),['/service/create','/service/createstoerung','/service/mobilausgeben']);
  assert.equal(calls[0].body.vorgangsdaten.personUUID,'SIM-K-100');
  assert.equal(calls[2].body.auftragspool,false);
 }finally{store.close();rmSync(dir,{recursive:true});}
});

test('personal hidden customers and object ancestry are excluded before lookup paging without hiding other branches',async()=>{
 const rows=[{uuid:'o1',typ:'OBJEKT',personUUID:'c1',bezeichnung:'A',childrenUUIDs:['u1']},{uuid:'u1',typ:'TECHNISCHE_EINHEIT',bezeichnung:'Einheit 1'},{uuid:'o2',typ:'OBJEKT',personUUID:'c2',bezeichnung:'B',childrenUUIDs:['u2','u3']},{uuid:'u2',typ:'TECHNISCHE_EINHEIT',parentUUID:'o2',bezeichnung:'Einheit 2'},{uuid:'u3',typ:'TECHNISCHE_EINHEIT',parentUUID:'o2',bezeichnung:'Einheit 3'}];
 const api={async request(method,path,input){if(path==='/objekt/listobjekte')return {totalHitCount:rows.length,resultList:rows};if(path==='/objekt/details')return rows.find(row=>row.uuid===input.uuid);if(path==='/person/listkunden')return {totalHitCount:2,resultList:[{uuid:'c1',name:'Kunde A'},{uuid:'c2',name:'Kunde B'}]};throw Error('Unexpected API');}},lookups=new PdsLookups(api),query={resource:'objects',query:'',offset:0,limit:1};
 const hiddenCustomer={customers:['c1'],objects:[]};assert.deepEqual((await lookups.search(query,'customer',hiddenCustomer)).items.map(item=>item.id),['o2']);assert.equal((await lookups.search(query,'customer',hiddenCustomer)).total,1);assert.equal((await lookups.search({...query,resource:'units',objectId:'o1'},'customer',hiddenCustomer)).total,0);
 assert.equal((await lookups.search({...query,resource:'units',objectId:'o2'},'customer',{customers:[],objects:['o2']})).total,0);
 const units=await lookups.search({...query,resource:'units',objectId:'o2'},'customer',{customers:[],objects:['u2']});assert.equal(units.total,1);assert.equal(units.items[0].id,'u3');assert.equal((await lookups.search({...query,resource:'units',objectId:'o2'})).total,2);
 assert.deepEqual((await lookups.search({...query,resource:'customers'},'customer',hiddenCustomer)).items.map(item=>item.id),['c2']);assert.equal((await lookups.search(query)).total,2);
});
