import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secureDraftStorage,donePrefix,DraftStorageLockedError,isDraftStorageLocked} from '../storage.ts';
import {encryptDraft,decryptDraft,assertDraftKey} from '../crypto.ts';
import {saveDraft,replaceDraft,listDrafts,completeDraft,writeDrafts,draftPrefix} from '../../kalender/drafts.ts';
export function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
const key={keyId:'11111111-1111-4111-8111-111111111111',key:'12'.repeat(32)},other={keyId:'22222222-2222-4222-8222-222222222222',key:'34'.repeat(32)};
const event={id:'fictional-event',title:'Fiktiver Termin',notes:'Alt',start:'2026-11-12T08:00:00Z',end:'2026-11-12T09:00:00Z',resourceIds:['one'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]};
const draft=(id,notes)=>({draftId:id,writerId:id,original:event,changed:{...event,notes},operationId:id});
test('encrypted immutable tab branches survive reload, remain independent and cannot be read by another user',()=>{
 const raw=memoryStorage(),a=secureDraftStorage(raw,{...key},'owner'),b=secureDraftStorage(raw,{...key},'owner');saveDraft(a.storage,'owner',draft('a','Nur A'));saveDraft(b.storage,'owner',draft('b','Nur B'));
 const ciphertext=Array.from({length:raw.length},(_,i)=>raw.getItem(raw.key(i))).join('');assert.ok(!ciphertext.includes('Nur A'));assert.ok(!ciphertext.includes('Fiktiver Termin'));assert.ok(!ciphertext.includes(key.key));
 replaceDraft(a.storage,'owner','a',draft('a2','Weiter A'));const reopened=secureDraftStorage(raw,{...key},'owner');assert.deepEqual(Object.keys(listDrafts(reopened.storage,'owner')).sort(),['a2','b']);assert.equal(listDrafts(reopened.storage,'owner').b.changed.notes,'Nur B');
 assert.deepEqual(listDrafts(secureDraftStorage(raw,{...other},'another-owner').storage,'another-owner'),{});assert.throws(()=>secureDraftStorage(raw,{...other},'owner').storage.getItem(draftPrefix('owner')+'a2'));
 a.lock();assert.throws(()=>a.storage.getItem(draftPrefix('owner')+'a2'),DraftStorageLockedError);assert.equal(isDraftStorageLocked(new Error('Entwurfssicherung ist gesperrt. Bitte erneut anmelden.')),true);assert.equal(isDraftStorageLocked(new Error('Beschädigt')),false);assert.equal(listDrafts(reopened.storage,'owner').a2.changed.notes,'Weiter A');
});
test('legacy drafts migrate only after encrypted writes succeed; malformed and quota-failed originals are retained',()=>{
 const raw=memoryStorage(),legacy={...draft('old','Unverloren')};writeDrafts(raw,'owner',{[event.id]:legacy});saveDraft(raw,'owner',draft('existing','Vorhanden'));
 const secured=secureDraftStorage(raw,{...key},'owner');secured.migrate();const recovered=listDrafts(secured.storage,'owner');assert.equal(Object.keys(recovered).length,2);assert.ok(Object.values(recovered).some(d=>d.changed.notes==='Unverloren'));assert.ok(!Array.from({length:raw.length},(_,i)=>raw.getItem(raw.key(i))).join('').includes('Unverloren'));
 const brokenKey='heyelli:calendar-drafts:damaged';raw.setItem(brokenKey,'{unvollständig');const broken=secureDraftStorage(raw,{...key},'damaged');broken.migrate();assert.equal(broken.storage.getItem(brokenKey),'{unvollständig');assert.notEqual(raw.getItem(brokenKey),'{unvollständig');
 const original=raw.getItem(draftPrefix('owner')+'existing');const failed={...raw,setItem(){throw Error('Quota');}};assert.throws(()=>saveDraft(secureDraftStorage(failed,{...key},'owner').storage,'owner',draft('new','Nicht verwerfen')));assert.equal(raw.getItem(draftPrefix('owner')+'existing'),original);
});
test('completion markers precede deletion and authenticated encryption rejects moved or modified records',()=>{
 const raw=memoryStorage(),secured=secureDraftStorage(raw,{...key},'owner'),entry=draft('a','Wichtig');saveDraft(secured.storage,'owner',entry);completeDraft(secured.storage,'owner',entry);assert.equal(raw.getItem(donePrefix(key.keyId)+encodeURIComponent(draftPrefix('owner')+'a')),'1');
 const encrypted=encryptDraft(key,'one','{"notes":"Geheim"}');assert.equal(decryptDraft(key,'one',encrypted),'{"notes":"Geheim"}');assert.throws(()=>decryptDraft(key,'two',encrypted));const value=JSON.parse(encrypted);value.data=(value.data.startsWith('00')?'11':'00')+value.data.slice(2);assert.throws(()=>decryptDraft(key,'one',JSON.stringify(value)));
});

test('malformed key responses never enable a plaintext storage fallback',()=>{for(const value of [null,{}, {keyId:key.keyId,key:'invalid'}, {keyId:'other',key:key.key}])assert.throws(()=>assertDraftKey(value));assertDraftKey(key);});
