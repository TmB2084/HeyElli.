import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openOrderStore,validateOrder} from '../order-store.ts';
import {SimulatedPdsApi} from '../api.ts';
import {PdsServices} from '../../api/services.ts';
import {PdsHttpTransport,validateRequest} from '../../api/protocol.ts';
import {createSimulatorOrder} from '../write-gateway.ts';
const base={personId:'sim-person-1',reporter:'',problem:'Fiktive Prüfung',reportedAt:'2026-11-02T10:00',channel:'Telefon',contact:'030 0000099',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',technicianId:'',appointment:'',bauleiterId:'sim-employee-4'};
test('API list and download include fixtures, historical inline files and new API uploads after reopening',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-api-reads-'));const path=join(dir,'test.sqlite');let store=openOrderStore(path);
 try{
  const legacy=store.save(validateOrder({...base,channel:'E-Mail',document:{name:'alt.txt',mime:'text/plain',base64:Buffer.from('Alte Datei').toString('base64')}}),'old','test-user');
  const upload=store.upload('00000000-0000-4000-8000-000000000099','neu.bin',Buffer.from([0,255,1,2]),'test-user');
  const modern=await createSimulatorOrder(store,validateOrder({...base,channel:'E-Mail',problem:'API-Datei',document:upload}),'modern',{id:'test-user',pdsUserUUID:'sim-employee-4'});
  store.close();store=openOrderStore(path);
  const calls=[];const transport=new SimulatedPdsApi(store);const api=new PdsServices({request:async(method,path,body)=>{calls.push(path);return transport.request(method,path,body);}});
  const list=await api.list('sim-object-1','',0,50);
  assert.equal(list.total,3);assert.ok(list.items.some(item=>item.label.includes('SIM-SA-10001')));
  assert.ok(list.items.find(item=>item.label.includes(modern.number)).documents[0].url.includes('documentUUID='));
  assert.deepEqual((await api.download(legacy.number)).bytes,Buffer.from('Alte Datei'));
  assert.deepEqual(Array.from((await api.download(modern.number)).bytes),[0,255,1,2]);
  const foreignDoc=list.items.find(item=>item.label.includes(legacy.number)).documents[0].url.split('documentUUID=')[1];
  const before=calls.filter(path=>path.startsWith('/dokument/downloaddokument/')).length;
  assert.equal(await api.download(modern.number,decodeURIComponent(foreignDoc)),null);
  assert.equal(calls.filter(path=>path.startsWith('/dokument/downloaddokument/')).length,before);
  assert.equal((await api.list('sim-object-2','',0,50)).total,0);
  assert.equal((await api.list('sim-object-1','API-Datei',0,1)).total,1);
  assert.equal((await api.list('sim-object-1','',1,1)).items.length,1);
  assert.equal(await api.download('SIM-SA-999999'),null);
  assert.ok(calls.includes('/service/liststoerungen'));assert.ok(calls.includes('/service/details'));
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('transport returns bytes for documented download path and propagates errors',async()=>{
 validateRequest('GET','/dokument/downloaddokument/fake-document');
 validateRequest('GET','/service/listauftragsdokumente/fake-order');
 const api=new PdsHttpTransport('https://pds.example.invalid','synthetic-placeholder',async()=>new Response(new Uint8Array([0,255,42])));
 assert.deepEqual(await api.request('GET','/dokument/downloaddokument/fake-document'),new Uint8Array([0,255,42]));
 const failing=new PdsServices({request:async()=>{throw Error('PDS 403');}});
 await assert.rejects(failing.list('sim-object-1','',0,20),/403/);
 await assert.rejects(failing.download('SIM-SA-10001'),/403/);
});
test('multiple incidents are grouped per order, object filter is applied before pagination',async()=>{
 const service={uuid:'service',vorgangsNummer:'SIM-SA-12345',bezeichnung:'Demo'};
 const rows=[{uuid:'a',serviceAuftrag:service,serviceAuftragEbene:{objektUUID:'unit-1',auszufuehrendeArbeiten:'Erste'}},{uuid:'b',serviceAuftrag:service,serviceAuftragEbene:{objektUUID:'unit-2',auszufuehrendeArbeiten:'Zweite'}}];
 const api=new PdsServices({request:async(_method,path)=>path==='/objekt/details'?{uuid:'object',childrenUUIDs:['unit-1','unit-2']}:path==='/service/liststoerungen'?{totalHitCount:2,resultList:rows}:[]});
 const result=await api.list('object','',0,20);assert.equal(result.total,1);assert.ok(result.items[0].label.includes('Erste; Zweite'));
});

test('service cancellation statuses persist without deleting the order or appointment',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-cancel-')),file=join(dir,'test.sqlite');let store=openOrderStore(file);
 try{
  let api=new SimulatedPdsApi(store,'cancel-test');
  await assert.rejects(new SimulatedPdsApi(store).request('POST','/service/updatestatus',{uuid:'sim-order-2',statusBezeichnung:'Storniert'}));
  for(const status of ['Mobil abgeholt','Manuell storniert','Storniert']){
   await api.request('POST','/service/updatestatus',{uuid:'sim-order-2',statusBezeichnung:status});
   const service=await api.request('POST','/service/details',{uuid:'sim-order-2'});assert.equal(service.vorgangStatus.bezeichnung,status);assert.ok(service.rootEbene.ebenen[0].startZeitpunkt);
  }
  await assert.rejects(api.request('POST','/service/updatestatus',{uuid:'sim-order-2',statusBezeichnung:'Erfundener Status'}));
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store);assert.equal((await api.request('POST','/service/details',{uuid:'sim-order-2'})).vorgangStatus.bezeichnung,'Storniert');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
