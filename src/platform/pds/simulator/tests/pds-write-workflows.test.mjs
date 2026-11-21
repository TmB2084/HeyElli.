import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openOrderStore,validateOrder} from '../order-store.ts';
import {createSimulatorContact,createSimulatorOrder} from '../write-gateway.ts';
import {createContact,createService} from '../../api/execute.ts';
import {SimulatedPdsApi} from '../api.ts';
import {SimulatedWriteApi} from '../write-api.ts';
const contact={objectId:'sim-object-1',customerNumber:'SIM-K-200',name:'API Demo',function:'Objektverwaltung',landline:'030 00000123',mobile:'0170 00000123'};
test('API contact, communication and role persist for deviating customer; order and multipart file reference API UUIDs',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-write-'));const path=join(dir,'test.sqlite');let store=openOrderStore(path);
 try{
  const person=await createSimulatorContact(store,contact,'test-user');assert.equal(person.customerNumber,'SIM-K-200');assert.equal(person.phones.length,2);
  assert.equal((await createSimulatorContact(store,contact,'test-user')).id,person.id);
  const document=store.upload('00000000-0000-4000-8000-000000000001','beispiel.bin',Buffer.from('fiktiver Inhalt'),'test-user');
  const input=validateOrder({bearbeiterUUID:'forged-client-user',personId:person.id,personScope:'all',reporter:'ignored',problem:'Fiktiver Fehler',reportedAt:'2026-11-02T10:00',channel:'E-Mail',contact:'',externalOrderNumber:'EX-API',objectId:'sim-object-1',unitId:'sim-unit-1',technicianId:'',appointment:'',bauleiterId:'sim-employee-4',document},store.allPersons());
  const saved=await createSimulatorOrder(store,input,'test-workflow',{id:'test-user',pdsUserUUID:'sim-employee-4'});
  assert.equal(saved.bearbeiterUUID,'sim-employee-4');assert.equal(store.apiEntity(saved.pdsReceipt.uuid).data.bearbeiterUUID,'sim-employee-4');assert.equal(saved.pdsApiCalls[0].body.vorgangsdaten.bearbeiterUUID,'sim-employee-4');assert.match(saved.number,/^SIM-API-SA-/);assert.equal(store.apiEntity(saved.pdsReceipt.uuid).data.personUUID,'SIM-K-100');
  assert.equal(store.apiEntity(saved.pdsReceipt.stoerungUUID).data.serviceauftragUUID,saved.pdsReceipt.uuid);
  assert.equal(store.apiEntity(saved.pdsReceipt.documentUUID).data.referenzVorgangUUIDOpt,saved.pdsReceipt.uuid);
  assert.equal((await createSimulatorOrder(store,input,'test-workflow',{id:'test-user',pdsUserUUID:'sim-employee-4'})).number,saved.number);
  store.close();store=openOrderStore(path);
  assert.equal((await new SimulatedPdsApi(store).request('POST','/service/details',{uuid:saved.pdsReceipt.uuid})).bearbeiterUUID,'sim-employee-4');
  assert.equal(store.allPersons().find(item=>item.id===person.id).customerNumber,'SIM-K-200');
  assert.deepEqual(store.document(saved.number).bytes,Buffer.from('fiktiver Inhalt'));
  assert.ok(store.list('sim-object-1').some(item=>item.label.includes(saved.number)));
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('failed role write resumes after restart without duplicating person or phones; production ambiguity fails before writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-resume-'));const path=join(dir,'test.sqlite');let store=openOrderStore(path);
 try{
  const args={name:'Resume Demo',customerUUID:'SIM-K-100',functionName:'Objektverwaltung',landline:'030 00000124',mobile:''};
  let api=new SimulatedWriteApi(store,'resume');let personUUID;
  const interrupted={request:async(method,path,body)=>{if(path==='/person/addansprechpartnerrolle')throw Error('Simulierter Ausfall');const value=await api.request(method,path,body);if(path==='/person/create')personUUID=value.uuid;return value;}};
  await assert.rejects(createContact(interrupted,args,'simulator-dual'),/Ausfall/);
  store.close();store=openOrderStore(path);api=new SimulatedWriteApi(store,'resume');
  assert.equal(await createContact(api,args,'simulator-dual'),personUUID);
  const found=store.allPersons().filter(person=>person.name==='Resume Demo');assert.equal(found.length,1);assert.equal(found[0].phones.length,1);
  let calls=0;await assert.rejects(createContact({request:async()=>{calls++;}},args),/klären/);assert.equal(calls,0);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('mobilization occurs after incident creation and only its main technician is responsible',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pds-mobile-'));const store=openOrderStore(join(dir,'test.sqlite'));
 try{
  const api=new SimulatedWriteApi(store,'mobile');
  const result=await createService(api,{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Demo',externalNumber:'',reportedAt:'2026-11-02T10:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:'2026-11-03T09:00:00Z'},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  assert.equal(store.apiEntity(result.uuid).data.mobilAusgegeben,true);
  assert.equal(store.apiEntity(result.stoerungUUID).data.hauptmonteurUUID,'sim-employee-1');
  assert.deepEqual(store.apiEntity(result.stoerungUUID).data.weiteremonteureUUIDs,['sim-employee-2']);
 }finally{store.close();rmSync(dir,{recursive:true});}
});

test('multipart transport lets the runtime set its boundary and preserves the service reference',async()=>{
 const {PdsHttpTransport}=await import('../../api/protocol.ts');let options;
 const transport=new PdsHttpTransport('https://pds.example.invalid/pds/rest/api','synthetic-placeholder',async(_url,input)=>{options=input;return Response.json({uuid:'document-response'});});
 const form=new FormData();form.set('file',new Blob(['fiktiv']),'demo.bin');form.set('referenzVorgangUUIDOpt','service-response');form.set('referenzVorgangtypOpt','SERVICEAUFTRAG');form.set('dokumententypUUID','demo-type');
 await transport.request('POST','/dokument/uploaddokument',form);
 assert.ok(options.body instanceof FormData);assert.equal(options.headers['Content-Type'],undefined);assert.equal(options.body.get('referenzVorgangUUIDOpt'),'service-response');
});

test('missing server-side Bearbeiter rejects before the first API write',async()=>{
 let calls=0;
 const api={request:async()=>{calls++;throw Error('Must not execute');}};
 await assert.rejects(createService(api,{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Fiktiv',externalNumber:'',reportedAt:'2026-11-02T10:00',technicianId:'',companions:[]},'SIM-Serviceauftrag',{}),/Bearbeiterzuordnung/);
 assert.equal(calls,0);
});
