import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {openOrderStore,validateOrder,berlinInstant} from '../order-store.ts';
const input={reporter:'Demo',personId:'sim-person-1',problem:'Fiktive Störung',location:'Demostadt',reportedAt:'2026-11-01T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'SIM-EXT-9',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',appointment:'2026-11-04T09:00'};
test('persists orders and planning, assigns SA atomically, reopens migration safely and prevents duplicates',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-order-test-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  const value=validateOrder(input);const first=store.save(value,'key-1','test-user');
  assert.equal(first.number,'SIM-SA-10003');assert.equal(first.bauleiterId,'sim-employee-4');assert.equal(first.plannedFrom,'2026-11-04T08:00:00.000Z');
  assert.equal(store.save(value,'key-1','test-user').number,first.number);
  assert.throws(()=>store.save({...value,problem:'different'},'key-1','test-user'));
  assert.throws(()=>store.save(value,'key-1','different-user'));
  store.close();store=openOrderStore(path);
  assert.equal(store.list('sim-object-1').length,1);assert.equal(store.list('sim-object-2').length,0);
  assert.equal(store.save(value,'key-2','test-user').number,'SIM-SA-10004');
 } finally {store.close();rmSync(directory,{recursive:true});}
});
test('rejects invalid foreign references, incomplete planning, invalid dates and ambiguous DST',()=>{
 for(const patch of [{personId:'missing'},{contact:''},{bauleiterId:'sim-employee-1'},{bauleiterId:''},{bauleiterId:undefined},{objectId:'wrong'},{objectId:'sim-object-2'},{technicianId:'sim-employee-4'},{appointment:''},{reportedAt:'2026-02-30T10:00'},{appointment:'2026-10-25T02:30'},{appointment:'2026-03-29T02:30'}]) assert.throws(()=>validateOrder({...input,...patch}));
 assert.equal(berlinInstant('2026-07-01T10:00'),'2026-07-01T08:00:00.000Z');
 assert.doesNotThrow(()=>validateOrder({...input,technicianId:'',appointment:''}));
});

test('stores companions and derives mobility recipient only from the main technician',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-companion-test-')); const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  const value=validateOrder({...input,companionTechnicianIds:['sim-employee-2','sim-employee-3'],mobilityTechnicianId:'sim-employee-4'});
  assert.equal(value.mobilityTechnicianId,'sim-employee-1');
  const saved=store.save(value,'team-key','test-user');
  store.close();store=openOrderStore(path);
  assert.deepEqual(store.save(value,'team-key','test-user').companionTechnicianIds,saved.companionTechnicianIds);
  for(const patch of [{companionTechnicianIds:['sim-employee-1']},{companionTechnicianIds:['sim-employee-2','sim-employee-2']},{companionTechnicianIds:['sim-employee-4']},{companionTechnicianIds:['missing']},{companionTechnicianIds:'bad'},{technicianId:'',appointment:'',companionTechnicianIds:['sim-employee-2']}]) assert.throws(()=>validateOrder({...input,...patch}));
 } finally {store.close();rmSync(directory,{recursive:true});}
});


test('validates reporting channel and customer contacts, persists email document in Grunddaten',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-document-test-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 const document={name:'beispiel.txt',mime:'text/plain',base64:Buffer.from('Erfundene E-Mail-Meldung').toString('base64')};
 try {
  const value=validateOrder({...input,channel:'E-Mail',contact:'',document});
  assert.equal(value.reporter,'Andrea Beispiel');
  const saved=store.save(value,'doc-key','test-user');store.close();store=openOrderStore(path);
  assert.deepEqual(store.document(saved.number).bytes,Buffer.from(document.base64,'base64'));assert.equal(store.document(saved.number).category,'Grunddaten');
  assert.doesNotThrow(()=>validateOrder({...input,channel:'an Techniker vor Ort'}));
  for(const patch of [{channel:'Persönlich'},{channel:'Sonstiges'},{channel:'E-Mail'},{personId:'sim-person-3'},{channel:'an Techniker vor Ort',contact:''},{channel:'E-Mail',document:{...document,name:'../unsafe.txt'}},{channel:'E-Mail',document:{...document,base64:'!invalid!'}}]) assert.throws(()=>validateOrder({...input,...patch}));
 } finally {store.close();rmSync(directory,{recursive:true});}
});

test('external reporter requires explicit global scope; linked contacts are valid in customer scope',()=>{
 assert.throws(()=>validateOrder({...input,personId:'sim-person-3'}));
 assert.equal(validateOrder({...input,personId:'sim-person-3',personScope:'all'}).reporter,'Charlie Demo');
 assert.throws(()=>validateOrder({...input,personScope:'untrusted'}));
 assert.throws(()=>validateOrder({...input,personId:'missing',personScope:'all'}));
 const directory=mkdtempSync(join(tmpdir(),'pds-linked-order-'));const path=join(directory,'test.sqlite');const store=openOrderStore(path);
 try {
  store.assignPerson('sim-person-3','SIM-K-100','test-user');
  const value=validateOrder({...input,personId:'sim-person-3'},store.persons('sim-object-1'));
  assert.equal(value.personScope,'customer');
  assert.equal(store.save(value,'linked-order','test-user').reporter,'Charlie Demo');
 }finally{store.close();rmSync(directory,{recursive:true});}
});
