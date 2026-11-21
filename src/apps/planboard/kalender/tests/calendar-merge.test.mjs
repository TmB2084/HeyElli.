import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCalendarEvents} from '../merge.ts';
import {readDrafts,writeDrafts} from '../drafts.ts';
const base={id:'a',title:'Original',notes:'Beschreibung',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['one'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]};
test('independent changes merge; unchanged submitted fields preserve newer values',()=>{
 const result=mergeCalendarEvents(base,{...base,notes:'Meine Notiz'},{...base,title:'Neuer Titel',start:'2026-11-06T08:15:00Z'});
 assert.deepEqual(result.conflicts,[]);assert.equal(result.merged.title,'Neuer Titel');assert.equal(result.merged.notes,'Meine Notiz');assert.equal(result.merged.start,'2026-11-06T08:15:00Z');
});
test('only divergent same-field changes require explicit choices',()=>{
 const mine={...base,title:'Mein Titel',notes:'Meine Notiz'},current={...base,title:'Anderer Titel',pimSync:true};
 const result=mergeCalendarEvents(base,mine,current);assert.deepEqual(result.conflicts,['title']);
 assert.equal(mergeCalendarEvents(base,mine,current,{title:'current'}).merged.title,'Anderer Titel');
 const resolved=mergeCalendarEvents(base,mine,current,{title:'mine'});assert.equal(resolved.merged.title,'Mein Titel');assert.equal(resolved.merged.notes,'Meine Notiz');assert.equal(resolved.merged.pimSync,true);
});
test('already saved values and reordered sets are not conflicts',()=>{
 const mine={...base,resourceIds:['two','one'],categories:['b','a']};assert.deepEqual(mergeCalendarEvents(base,mine,{...mine,resourceIds:['one','two'],categories:['a','b']}).conflicts,[]);
});
test('drafts survive reopening storage and stay isolated by verified owner',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 const draft={original:base,changed:{...base,notes:'Offline'},operationId:'test',auto:true};writeDrafts(storage,'alice',{a:draft});assert.deepEqual(readDrafts(storage,'alice'),{a:draft});assert.deepEqual(readDrafts(storage,'bob'),{});
 writeDrafts(storage,'alice',{});assert.deepEqual(readDrafts(storage,'alice'),{});storage.setItem('heyelli:calendar-drafts:alice','{broken');assert.deepEqual(readDrafts(storage,'alice'),{});
});
test('independent options merge individually and equal concurrent edits are accepted',()=>{
 const result=mergeCalendarEvents(base,{...base,status:'FREI',pimSync:true},{...base,categories:['meeting'],pimSync:true});assert.deepEqual(result.conflicts,[]);assert.equal(result.merged.status,'FREI');assert.equal(result.merged.pimSync,true);assert.deepEqual(result.merged.categories,['meeting']);
});
