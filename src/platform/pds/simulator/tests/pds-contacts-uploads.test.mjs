import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openOrderStore,validateOrder} from '../order-store.ts';
import {readUpload,MAX_DOCUMENT_BYTES} from '../document.ts';

test('new contact belongs to object customer, is deduplicated and persists with a binary document',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-contact-upload-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  const person=store.createPerson('sim-object-1','Neue Demoperson','+49 30 00000999','test-user','Haustechnik','');
  assert.equal(store.createPerson('sim-object-2','Neue Demoperson','+49 30 00000999','test-user','Haustechnik','').id,person.id);
  assert.ok(store.persons('sim-object-2').some(p=>p.id===person.id));
  assert.ok(!store.persons('sim-object-3').some(p=>p.id===person.id));
  assert.throws(()=>store.createPerson('missing','Name','123','test-user','Haustechnik',''));
  assert.throws(()=>store.createPerson('sim-object-1',' ','123','test-user','Haustechnik',''));
  assert.throws(()=>store.createPerson('sim-object-1','Name','bad','test-user','Haustechnik',''));
  const content=Buffer.alloc(3*1024*1024,171); // larger than the previous limit, arbitrary binary format
  const uploadId=randomUUID();const document=store.upload(uploadId,'beispiel.xyz',content,'test-user');
  assert.equal(store.upload(uploadId,'beispiel.xyz',content,'test-user').uploadId,uploadId);
  assert.throws(()=>store.upload(uploadId,'beispiel.xyz',Buffer.from('changed'),'test-user'));
  assert.throws(()=>store.uploaded(uploadId,'other-user'));
  const input={bauleiterId:'sim-employee-4',personId:person.id,reporter:'ignored',problem:'Fiktiver Defekt',reportedAt:'2026-11-01T10:00',channel:'E-Mail',contact:'',externalOrderNumber:'',objectId:'sim-object-1',unitId:'',technicianId:'',appointment:'',document};
  const saved=store.save(validateOrder(input,store.persons('sim-object-1')),'order-key','test-user');
  assert.throws(()=>validateOrder({...input,objectId:'sim-object-3'},store.persons('sim-object-3')));
  store.close();store=openOrderStore(path);
  assert.ok(store.persons('sim-object-1').some(p=>p.id===person.id));
  assert.deepEqual(store.document(saved.number).bytes,content);
  assert.equal(store.document(saved.number).name,'beispiel.xyz');
 }finally{store.close();rmSync(directory,{recursive:true});}
});
function stream(bytes) {
 const chunk=new Uint8Array(1024*1024);let remaining=bytes;
 return new ReadableStream({pull(controller){if(!remaining){controller.close();return;}const length=Math.min(remaining,chunk.length);controller.enqueue(chunk.subarray(0,length));remaining-=length;}});
}
test('accepts exactly 100 MiB and rejects empty or oversized uploads while reading',async()=>{
 assert.equal((await readUpload(stream(MAX_DOCUMENT_BYTES))).length,MAX_DOCUMENT_BYTES);
 await assert.rejects(readUpload(stream(MAX_DOCUMENT_BYTES+1)),/100 MB/);
 await assert.rejects(readUpload(stream(0)),/leer/);
});

test('requires a function and distinguishes business landline and mobile',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-person-function-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  assert.throws(()=>store.createPerson('sim-object-1','Neue Person','123','test-user','',''));
  assert.throws(()=>store.createPerson('sim-object-1','Neue Person','','test-user','Hausverwaltung',''));
  assert.throws(()=>store.createPerson('sim-object-1','Neue Person','123','test-user','Hausverwaltung','invalid'));
  const person=store.createPerson('sim-object-1','Mobile Demoperson','','test-user','Hausverwaltung','+49 170 0000099');
  assert.deepEqual(person.phones,[{label:'Geschäftliches Mobiltelefon',number:'+49 170 0000099'}]);
  const both=store.createPerson('sim-object-1','Zwei Nummern','+49 30 0000098','test-user','Haustechnik','+49 170 0000098');
  assert.equal(both.phones.length,2);assert.equal(both.function,'Haustechnik');
  store.close();store=openOrderStore(path);
  const persisted=store.persons('sim-object-2').find(p=>p.id===both.id);
  assert.equal(persisted.function,'Haustechnik');assert.deepEqual(persisted.phones,both.phones);
 }finally{store.close();rmSync(directory,{recursive:true});}
});

test('deviating customer replaces the person assignment, persists and validates targets',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-deviating-customer-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  const created=store.createPerson('sim-object-1','Abweichende Demo','123456','test-user','Verwaltung','','SIM-K-200');
  assert.equal(created.customerNumber,'SIM-K-200');
  assert.ok(store.persons('sim-object-3').some(person=>person.id===created.id));
  assert.ok(!store.persons('sim-object-1').some(person=>person.id===created.id));
  store.assignPerson('sim-person-1','SIM-K-200','test-user');
  store.assignPerson('sim-person-1','SIM-K-200','test-user');
  assert.ok(store.persons('sim-object-3').some(person=>person.id==='sim-person-1'));
  assert.ok(!store.persons('sim-object-1').some(person=>person.id==='sim-person-1'));
  assert.deepEqual(store.allPersons().find(person=>person.id==='sim-person-1').customerNumbers,['SIM-K-200']);
  assert.throws(()=>store.assignPerson('missing','SIM-K-100','test-user'));
  assert.throws(()=>store.assignPerson(created.id,'invalid-customer','test-user'));
  assert.throws(()=>store.createPerson('sim-object-1','Invalid target','123456','test-user','Verwaltung','','invalid-customer'));
  store.close();store=openOrderStore(path);
  assert.equal(store.allPersons().find(person=>person.id==='sim-person-1').customerNumber,'SIM-K-200');
  assert.equal(store.allPersons().find(person=>person.id===created.id).customerNumber,'SIM-K-200');
 }finally{store.close();rmSync(directory,{recursive:true});}
});


test('new contact for deviating customer can be selected globally and used in a saved order after reopening',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pds-deviating-reporter-'));const path=join(directory,'test.sqlite');let store=openOrderStore(path);
 try {
  const person=store.createPerson('sim-object-1','Abweichender Testkontakt','030 0000099','test-user','Verwaltung','','SIM-K-200');
  const returned=JSON.parse(JSON.stringify(person));
  assert.equal(returned.customerNumber,'SIM-K-200');
  store.close();store=openOrderStore(path);
  assert.ok(store.allPersons().some(item=>item.id===returned.id));
  assert.ok(!store.persons('sim-object-1').some(item=>item.id===returned.id));
  const input={personId:returned.id,personScope:'all',reporter:'',problem:'Fiktive Meldung',reportedAt:'2026-11-01T10:00',channel:'Telefon',contact:returned.phones[0].number,externalOrderNumber:'',objectId:'sim-object-1',unitId:'',technicianId:'',appointment:'',bauleiterId:'sim-employee-4'};
  const saved=store.save(validateOrder(input,store.allPersons()),'deviating-reporter','test-user');
  assert.equal(saved.reporter,'Abweichender Testkontakt');
  store.close();store=openOrderStore(path);
  assert.ok(store.list('sim-object-1').some(order=>order.label.includes(saved.number)));
 }finally{store.close();rmSync(directory,{recursive:true});}
});
