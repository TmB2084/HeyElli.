import {defaultColorLayouts} from '../color-layout.ts';
const layout=(main)=>Object.fromEntries(Object.keys(defaultColorLayouts()).map(type=>[type,{main,secondary:null}]));
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {colorSettingsStore} from '../settings-store.ts';
import {eventColor,wallInstant} from '../domain.ts';
const names=['Urlaub','Krank','Projekt','fortführung Wartung','fortführung Serviceauftrag','Bereitschaft','Elternzeit','FZA','Zusatzinfo','Termin Angefragt','ÜBL','Schule'];
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-categories-'));let store=openOrderStore(join(dir,'test.sqlite'));try{await run({dir,store,reopen(){store.close();store=openOrderStore(join(dir,'test.sqlite'));return store;}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('all twelve screenshot categories come from documented API with stable IDs and unchanged whole-day flags',()=>isolated(async({store})=>{
 const api=new SimulatedPdsApi(store),calls=[];const calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
 const categories=await calendar.categories();assert.deepEqual(calls,[['GET','/termin/listkategorien']]);
 assert.deepEqual(categories.slice(0,12).map(category=>category.name),names);assert.ok(categories.slice(0,12).every(category=>category.allDay===false));assert.equal(new Set(categories.map(category=>category.id)).size,15);
 for(const id of ['sim-category-service','sim-category-meeting','sim-category-day'])assert.ok(categories.some(category=>category.id===id));
 const raw=await api.request('GET','/termin/listkategorien');assert.ok(raw.every(category=>Object.keys(category).sort().join(',')==='bezeichnung,ganzerTag,uuid'));assert.ok(!raw.some(category=>'farbe'in category));
 assert.deepEqual(await calendar.categories(),categories);
}));
test('category assignment and color survive API rename and reopening, without changing order-status precedence',()=>isolated(async({dir,store,reopen})=>{
 let calendar=new PdsCalendar(new SimulatedPdsApi(store,'category-create'));
 const category=(await calendar.categories()).find(category=>category.name==='Bereitschaft');const colors=colorSettingsStore(join(dir,'colors.json'));const rule={category:category.id,farbe:'#ff9933'};colors.write([rule],colors.read().version);
 const event=await calendar.create({title:'Fiktiver Kategorietest',notes:'',start:wallInstant('2026-11-03T08:00'),end:wallInstant('2026-11-03T09:00'),resourceIds:['sim-employee-1'],options:{categories:[category.id]}});
 assert.equal(eventColor(event,colors.read().rules,layout('category')),'#ff9933');store.apiPut('category-label:'+category.id,'category-label',{bezeichnung:'Bereitschaft umbenannt'});
 store=reopen();calendar=new PdsCalendar(new SimulatedPdsApi(store));const loaded=await calendar.list('2026-11-02','2026-11-08');const renamed=loaded.categoryOptions.find(item=>item.id===category.id);assert.equal(renamed.name,'Bereitschaft umbenannt');assert.equal(renamed.allDay,false);
 const saved=loaded.events.find(item=>item.id===event.id);assert.deepEqual(saved.categories,[category.id]);const rules=colorSettingsStore(join(dir,'colors.json')).read().rules;assert.deepEqual(rules,[rule]);assert.equal(eventColor(saved,rules,layout('category')),'#ff9933');
 assert.notEqual(eventColor({...saved,categories:['different-uuid-same-name']},rules),'#ff9933');
 const withOrder={...saved,link:{type:'SERVICEAUFTRAG'},orderStatus:{id:'order-status',name:'Offen'}};assert.equal(eventColor(withOrder,[...rules,{orderType:'SERVICEAUFTRAG',orderStatus:'order-status',farbe:'#112233'}],layout('status')),'#112233');
}));
test('invalid or duplicate category responses fail without view fallback and missing optional labels use UUID',async()=>{
 for(const values of [null,{},[{uuid:'duplicate'},{uuid:'duplicate'}],[{uuid:''}],[{uuid:1}],[{uuid:'id',bezeichnung:2}],[{uuid:'id',ganzerTag:'false'}]]){
  const calls=[];await assert.rejects(new PdsCalendar({request:async(method,path)=>{calls.push([method,path]);return values;}}).categories());assert.deepEqual(calls,[['GET','/termin/listkategorien']]);
 }
 assert.deepEqual(await new PdsCalendar({request:async()=>[{uuid:'uuid-only'}]}).categories(),[{id:'uuid-only',name:'uuid-only',allDay:false}]);
 assert.deepEqual(await new PdsCalendar({request:async()=>[]}).categories(),[]);
});
