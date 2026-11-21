import test from 'node:test';
import assert from 'node:assert/strict';
import {saveFailure,notifySaveFailure} from '../background-saving.ts';
import {recoverDraft} from '../draft-recovery.ts';
const event={id:'a',title:'Original',notes:'Alt',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['one'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]};
const initial=()=>({original:event,changed:event,authors:{},sources:[]});
const draft=(changed)=>({original:event,changed:{...event,...changed},operationId:'op',draftId:JSON.stringify(changed),displayName:'Alex Beispiel',editedAt:{title:'2026-11-06T09:00:00Z'}});
test('temporary failures stay silent; third consecutive attempt produces a notification',()=>{
 const first=saveFailure(undefined,'Network error',undefined,1000);assert.equal(notifySaveFailure(first,1000),false);
 const second=saveFailure(first,'Network error',502,16000);assert.equal(notifySaveFailure(second,16000),false);
 const third=saveFailure(second,'Network error',503,31000);assert.equal(notifySaveFailure(third,31000),true);assert.equal(third.firstAt,1000);assert.equal(third.blocked,false);
});
test('offline waiting escalates after 90 seconds and terminal responses escalate immediately',()=>{
 const pending=saveFailure(undefined,'Network error',undefined,1000);assert.equal(notifySaveFailure(pending,90999),false);assert.equal(notifySaveFailure(pending,91000),true);
 for(const status of [400,401,403,404,409,413]){const failure=saveFailure(undefined,'Nicht möglich',status,1000);assert.equal(failure.blocked,true);assert.equal(notifySaveFailure(failure,1000),true);}
 assert.equal(notifySaveFailure(undefined),false);
});
test('hidden drafts resume independent fields without a question and preserve original expected field values',()=>{
 const a=recoverDraft(initial(),draft({title:'Mein Titel'}));const b=recoverDraft(a.state,draft({notes:'Meine Beschreibung'}));assert.deepEqual(b.conflicts,[]);assert.equal(b.state.changed.title,'Mein Titel');assert.equal(b.state.changed.notes,'Meine Beschreibung');assert.equal(b.state.original.title,'Original');assert.equal(b.state.original.notes,'Alt');assert.equal(b.state.sources.length,2);
});
test('different hidden values for the same field require an explicit decision, with timestamps retained',()=>{
 const first=recoverDraft(initial(),draft({title:'Variante A'})).state,second=draft({title:'Variante B',notes:'Unabhängige Notiz'});
 assert.deepEqual(recoverDraft(first,second).conflicts,['title']);
 const resolved=recoverDraft(first,second,{title:'current'});assert.equal(resolved.state.changed.title,'Variante A');assert.equal(resolved.state.changed.notes,'Unabhängige Notiz');assert.equal(resolved.state.authors.title.displayName,'Alex Beispiel');assert.equal(resolved.state.authors.title.at,'2026-11-06T09:00:00Z');
 assert.equal(recoverDraft(first,second,{title:'mine'}).state.changed.title,'Variante B');
});
test('a later draft based on an earlier saved value is a sequential edit, not a conflict',()=>{
 const a=recoverDraft(initial(),draft({title:'A'})).state;
 const b={...draft({title:'B'}),original:{...event,title:'A'}};const result=recoverDraft(a,b);assert.deepEqual(result.conflicts,[]);assert.equal(result.state.original.title,'A');assert.equal(result.state.changed.title,'B');
});
test('a deliberately revised recovery copy supersedes its preserved ancestor without asking again',()=>{
 const first=draft({title:'Ursprünglich gesichert'}),state=recoverDraft(initial(),first).state;
 const revised={...draft({title:'Bewusst überarbeitet'}),sourceDraftId:first.draftId,sourceDraftIds:[first.draftId]};
 const result=recoverDraft(state,revised);assert.deepEqual(result.conflicts,[]);assert.equal(result.state.changed.title,'Bewusst überarbeitet');
 const unrelated={...revised,sourceDraftId:undefined,sourceDraftIds:[]};assert.deepEqual(recoverDraft(state,unrelated).conflicts,['title']);
});
