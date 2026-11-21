import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {enrichVacationApprovals} from '../../../../platform/pds/api/vacation-view.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {eventColors,eventOptions} from '../domain.ts';
const name='sim_calendar_vacation_approvals';
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'vacation-view-'));let store=openOrderStore(join(dir,'test.sqlite'));try{await run({store,reopen(){store.close();store=openOrderStore(join(dir,'test.sqlite'));return store;}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('simulated view exposes both approvals, joins UUIDs and selects separate colors without extending appointment DTOs',()=>isolated(async({store,reopen})=>{
 let api=new SimulatedPdsApi(store,'vacation-test');const views=await api.request('GET','/datenansichten/list');assert.ok(views.some(view=>view.name===name));
 const first=await api.request('POST','/datenansichten/listdaten',{name,page:0,entriesPerPage:1}),second=await api.request('POST','/datenansichten/listdaten',{name,page:1,entriesPerPage:1});assert.equal(first.length,1);assert.equal(second.length,1);assert.notEqual(first[0].terminUUID,second[0].terminUUID);assert.deepEqual(new Set([first[0].genehmigungsstatus,second[0].genehmigungsstatus]),new Set(['BEANTRAGT','GENEHMIGT']));
 let calendar=new PdsCalendar(api,{vacationApprovalView:name});const data=await calendar.list('2026-11-02','2026-11-08'),vacations=data.events.filter(event=>event.type==='URLAUB');assert.equal(vacations.length,2);assert.equal(data.vacationApprovalSource,'view');
 const colors=[{vacationApproval:'BEANTRAGT',farbe:'#ff9900'},{vacationApproval:'GENEHMIGT',farbe:'#00aa66'}];
 for(const event of vacations){assert.equal(event.status,'GEPLANT');assert.equal(eventColors(event,colors).main,event.vacationApproval==='BEANTRAGT'?'#ff9900':'#00aa66');const raw=await api.request('POST','/termin/details',{uuid:event.id});assert.equal(raw.vacationApproval,undefined);assert.equal(raw.genehmigungsstatus,undefined);}
 const old=vacations.find(event=>event.vacationApproval==='BEANTRAGT');const changed=await calendar.update({id:old.id,start:old.start,end:old.end,resourceIds:old.resourceIds,title:'Umbenannter Urlaub',expected:{start:old.start,end:old.end,resourceIds:old.resourceIds,title:old.title,options:eventOptions(old)}});assert.equal(changed.vacationApproval,'BEANTRAGT');
 api=new SimulatedPdsApi(reopen());calendar=new PdsCalendar(api,{vacationApprovalView:name});const loaded=(await calendar.list('2026-11-02','2026-11-08')).events.find(event=>event.id===old.id);assert.equal(loaded.title,'Umbenannter Urlaub');assert.equal(loaded.vacationApproval,'BEANTRAGT');
 const without=(await new PdsCalendar(api).list('2026-11-02','2026-11-08')).events.filter(event=>event.type==='URLAUB');assert.ok(without.every(event=>event.vacationApproval===undefined));
}));
test('configured missing view, malformed responses and API failures are explicit errors',async()=>{
 const events=[{id:'x',type:'URLAUB',status:'GEPLANT'}];
 await assert.rejects(enrichVacationApprovals({request:async()=>[]},name,events),/nicht verfügbar/);
 for(const values of [null,{},[{terminUUID:'x',genehmigungsstatus:'GEPLANT'}],[{terminUUID:'x',genehmigungsstatus:'BEANTRAGT'},{terminUUID:'x',genehmigungsstatus:'GENEHMIGT'}]])await assert.rejects(enrichVacationApprovals({request:async(method,path)=>path.endsWith('/list')?[{name}]:values},name,events));
 await assert.rejects(enrichVacationApprovals({request:async()=>{throw Error('API denied');}},name,events),/API denied/);assert.equal(events[0].vacationApproval,undefined);
});
test('view pages join only vacation UUIDs; no requested/approved inference from appointment status',async()=>{
 const events=[{id:'target',type:'URLAUB',status:'GEPLANT'},{id:'missing',type:'URLAUB',status:'VORGEMERKT'},{id:'non-vacation',type:'FREIER'}],calls=[];
 const api={request:async(method,path,input)=>{if(path.endsWith('/list'))return [{name}];calls.push(input.page);return input.page===0?Array.from({length:500},(_,i)=>({terminUUID:`other-${i}`,genehmigungsstatus:'BEANTRAGT'})):[{terminUUID:'target',genehmigungsstatus:'GENEHMIGT'},{terminUUID:'non-vacation',genehmigungsstatus:'BEANTRAGT'}];}};
 await enrichVacationApprovals(api,name,events);assert.deepEqual(calls,[0,1]);assert.equal(events[0].vacationApproval,'GENEHMIGT');assert.equal(events[1].vacationApproval,undefined);assert.equal(events[2].vacationApproval,undefined);
});
