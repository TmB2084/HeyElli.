import test from 'node:test';
import assert from 'node:assert/strict';
import {draftAuthors,provenanceText,fieldValue} from '../change-provenance.ts';
import {calendarChangeAudit} from '../change-audit.ts';
const before={id:'example',title:'Vorher',notes:'Text',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['a'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]};
test('draft clock is explicitly distinguished from verified receipt time and invalid timestamps fall back',()=>{
 const received='2026-11-06T09:00:00Z';const authors=draftAuthors(['title','notes'],'Alex Beispiel',{title:'2026-11-06T08:50:00Z',notes:'2099-01-01T00:00:00Z'},received);
 assert.equal(authors.title.source,'draft');assert.equal(authors.notes.source,'received');assert.match(provenanceText(authors.title),/Alex Beispiel.*Gerätezeit/);assert.match(provenanceText(authors.notes),/Anfrage eingegangen/);assert.match(provenanceText(),/nicht nachgewiesen/);
});
test('only changed field stamps are inserted; retries do not replace original attribution',async()=>{
 const calls=[],pool={query:async(...args)=>{calls.push(args);return {rows:[]};}},audit=calendarChangeAudit(pool);
 await audit.record('verified-user',before,before);assert.equal(calls.length,0);
 await audit.record('verified-user',before,{...before,title:'Danach'});assert.equal(calls.length,1);assert.equal(calls[0][1][0],'verified-user');assert.equal(calls[0][1][2].length,1);assert.match(calls[0][1][2][0],/^calendar.field.title\.[a-f0-9]{64}$/);assert.ok(!calls[0][1][2][0].includes('Danach'));
});
test('a different current value is unknown, never attributed to an older matching actor',async()=>{
 let action;const pool={query:async(sql,args)=>{if(sql.includes('INSERT INTO platform.audit_events')){action=args[2][0];return {rows:[]};}return {rows:[{action,created_at:'2026-11-06T09:00:00Z',display_name:'Kim Muster'}]};}},audit=calendarChangeAudit(pool),after={...before,title:'Gespeichert'};
 await audit.record('verified-user',before,after);assert.equal((await audit.read(after,['title'])).title.displayName,'Kim Muster');assert.equal((await audit.read(before,['title'])).title.source,'unknown');
 assert.equal(fieldValue({...before,resourceIds:['a','b']},'resourceIds'),fieldValue({...before,resourceIds:['b','a']},'resourceIds'));
});
