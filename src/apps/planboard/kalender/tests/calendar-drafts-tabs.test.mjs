import test from 'node:test';
import assert from 'node:assert/strict';
import {saveDraft,replaceDraft,listDrafts,deleteDraft,writeDrafts,draftPrefix,completeDraft,removeSavedDrafts,draftIsSaved} from '../drafts.ts';
const event={id:'same-event',title:'Termin',notes:'Alt',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['one'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]};
function storage(){const map=new Map();return {get length(){return map.size;},key:index=>[...map.keys()][index]??null,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
const draft=(id,writer,notes)=>({draftId:id,writerId:writer,original:event,changed:{...event,notes},operationId:id,auto:false});
test('interleaved stale tab snapshots cannot overwrite drafts of the same owner and appointment',()=>{
 const db=storage(),a=draft('draft-a','tab-a','Text A'),b=draft('draft-b','tab-b','Text B');
 saveDraft(db,'owner',a);const staleA=listDrafts(db,'owner');saveDraft(db,'owner',b);
 replaceDraft(db,'owner','draft-a',{...staleA['draft-a'],draftId:'draft-a-new',changed:{...a.changed,notes:'Text A weiter bearbeitet'}});
 const reopened=listDrafts(db,'owner');assert.equal(Object.keys(reopened).length,2);assert.equal(reopened['draft-a-new'].changed.notes,'Text A weiter bearbeitet');assert.equal(reopened['draft-b'].changed.notes,'Text B');
 deleteDraft(db,'owner','draft-a-new');assert.deepEqual(listDrafts(db,'owner'),{'draft-b':b});assert.deepEqual(listDrafts(db,'other-owner'),{});
});
test('restoring a foreign draft into a new working copy preserves the original and its timestamps',()=>{
 const db=storage(),source={...draft('source','tab-a','Originalentwurf'),editedAt:{notes:'2026-11-06T09:00:00Z'},form:{start:'2026-11-06T09:00',end:'2026-11-06T10:00'}};saveDraft(db,'owner',source);
 const restored={...listDrafts(db,'owner').source,draftId:'restored',writerId:'tab-b',sourceDraftId:'source',auto:false};saveDraft(db,'owner',restored);replaceDraft(db,'owner','restored',{...restored,draftId:'restored-new',changed:{...restored.changed,notes:'Weiter bearbeitete Kopie'}});deleteDraft(db,'owner','restored-new');assert.deepEqual(listDrafts(db,'owner'),{source});
});
test('old aggregated drafts migrate without overwriting new records and remain recoverable after reload',()=>{
 const db=storage(),legacy={original:event,changed:{...event,notes:'Bestehender Entwurf'},operationId:'legacy-operation',auto:true,editedAt:{notes:'2026-11-06T09:00:00Z'}};
 writeDrafts(db,'owner',{'same-event':legacy});const existing=draft('new','new-tab','Neuer Entwurf');saveDraft(db,'owner',existing);
 const imported=listDrafts(db,'owner');assert.equal(Object.keys(imported).length,2);const old=Object.values(imported).find(item=>item.operationId==='legacy-operation');assert.equal(old.changed.notes,'Bestehender Entwurf');assert.equal(old.auto,true);assert.deepEqual(listDrafts(db,'owner'),imported);
 deleteDraft(db,'owner',old.draftId);assert.deepEqual(listDrafts(db,'owner'),{new:existing});
});
test('damaged independent record never deletes or hides another valid record',()=>{
 const db=storage(),a=draft('valid','tab','Intakt');saveDraft(db,'owner',a);db.setItem(draftPrefix('owner')+'broken','{broken');assert.deepEqual(listDrafts(db,'owner'),{valid:a});assert.equal(db.getItem(draftPrefix('owner')+'broken'),'{broken');
});

test('a late save response after a timeout cannot delete later edits from the original tab',()=>{
 const db=storage(),sent={...draft('sent-snapshot','tab-a','Gesendet'),auto:true};saveDraft(db,'owner',sent);
 const retrySnapshot=listDrafts(db,'owner')['sent-snapshot'];
 const newer={...sent,draftId:'newer-local-revision',changed:{...event,notes:'Nach Timeout weiterbearbeitet'},auto:false};replaceDraft(db,'owner',sent.draftId,newer);
 const retry={...retrySnapshot,draftId:'retry-snapshot'};replaceDraft(db,'owner',retrySnapshot.draftId,retry);
 deleteDraft(db,'owner',retry.draftId);assert.deepEqual(listDrafts(db,'owner'),{'newer-local-revision':newer});
 assert.throws(()=>saveDraft(db,'owner',{...newer,changed:event}));assert.equal(listDrafts(db,'owner')['newer-local-revision'].changed.notes,'Nach Timeout weiterbearbeitet');
});

test('confirmed recovered copy removes its immutable sources but preserves independent and newer drafts',()=>{
 const db=storage(),source=draft('source','old-tab','Erster Entwurf'),copy={...draft('copy','new-tab','Gespeicherte Überarbeitung'),sourceDraftId:'source',sourceDraftIds:['source']},other=draft('other','other-tab','Anderer Entwurf'),newer=draft('newer','old-tab','Spätere Eingabe');
 for(const item of [source,copy,other,newer])saveDraft(db,'owner',item);
 completeDraft(db,'owner',copy);assert.deepEqual(listDrafts(db,'owner'),{other,newer});
});
test('server read clears already fulfilled drafts and ignores unrelated newer server fields',()=>{
 const db=storage(),done=draft('done','a','Schon gespeichert'),different=draft('different','b','Noch nicht gespeichert');saveDraft(db,'owner',done);saveDraft(db,'owner',different);
 const candidates=Object.values(listDrafts(db,'owner'));const during=draft('during','c','Schon gespeichert');saveDraft(db,'owner',during);
 removeSavedDrafts(db,'owner',candidates,[{...event,title:'Zwischenzeitlich neuer Titel',notes:'Schon gespeichert'}]);assert.deepEqual(listDrafts(db,'owner'),{different,during});
});
test('incomplete raw form values and unsaved conflicts are never classified as completed',()=>{
 const raw={...draft('raw','a','Alt'),form:{start:'',end:'2026-11-06T10:00'}};assert.equal(draftIsSaved(raw,event),false);assert.equal(draftIsSaved(draft('different','b','Unabhängig noch offen'),event),false);assert.equal(draftIsSaved(draft('empty','a','Alt'),event),true);
});
test('missing intermediate source does not prevent retirement of explicitly recorded ancestors',()=>{
 const db=storage(),root=draft('root','a','Ursprung'),copy={...draft('copy','c','Bestätigt'),sourceDraftId:'missing',sourceDraftIds:['root','missing']};saveDraft(db,'owner',root);saveDraft(db,'owner',copy);completeDraft(db,'owner',copy);assert.deepEqual(listDrafts(db,'owner'),{});
});
