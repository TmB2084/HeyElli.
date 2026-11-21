import {defaultColorLayouts} from '../color-layout.ts';
const layout=(main)=>Object.fromEntries(Object.keys(defaultColorLayouts()).map(type=>[type,{main,secondary:null}]));
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {colorSettingsStore} from '../settings-store.ts';
import {statusScopeLabels,defaultColorsForCatalogs,resolveStatusRules,checkColorRules,colorRuleIdentity,eventColor,wallInstant} from '../domain.ts';
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-status-'));let store=openOrderStore(join(dir,'test.sqlite'));try{await run({dir,store,reopen(){store.close();store=openOrderStore(join(dir,'test.sqlite'));return store;}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('complete API catalogs cover all 14 documented families, use exact request methods and expose unused statuses',()=>isolated(async({store})=>{
 const api=new SimulatedPdsApi(store);const calls=[];const calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
 const catalogs=await calendar.statusCatalogs();assert.equal(catalogs.length,14);assert.deepEqual(catalogs.map(c=>c.type),Object.keys(statusScopeLabels));assert.equal(calls.length,14);
 for(const path of ['/service/liststatus','/projektakte/liststatus','/ruecklauf/liststatus','/lager/listzaehllistenstatus'])assert.deepEqual(calls.find(call=>call[1]===path),['GET',path,undefined]);
 assert.equal(calls.filter(call=>call[1]==='/vorgang/liststatus').length,10);for(const call of calls.filter(call=>call[1]==='/vorgang/liststatus')){assert.equal(call[0],'POST');assert.deepEqual(Object.keys(call[2]),['vorgangstyp']);}
 const service=catalogs.find(c=>c.type==='SERVICEAUFTRAG');const names=service.statuses.map(s=>s.name);
 for(const name of ['Auftragspool','Ausgegeben','Ausgegeben Mobil','Erledigt','Geplant','Manuell storniert','Material ausstehend','Mobil abgeholt','Mobil storniert','Offen','Storniert','Teilerledigt','zur Löschung vorgesehen'])assert.ok(names.includes(name),name);
 assert.ok(names.includes('Demo: Rücksprache erforderlich'));assert.equal(service.statuses.length,14);
 const events=(await calendar.list('2026-11-02','2026-11-08')).events;assert.ok(!events.some(event=>event.orderStatus?.id==='sim-service-custom-status'));
 const raw=await api.request('GET','/service/liststatus');assert.ok(raw.every(row=>!('evidence'in row)));assert.equal(new Set(raw.map(row=>row.uuid)).size,raw.length);
}));
test('saved scoped UUID colors and API details survive a status rename, restart and an unrelated family with the same UUID',()=>isolated(async({store,dir,reopen})=>{
 let api=new SimulatedPdsApi(store,'status-event');let calendar=new PdsCalendar(api);
 const event=await calendar.create({title:'Status-Persistenz',notes:'',start:wallInstant('2026-11-03T08:00'),end:wallInstant('2026-11-03T09:00'),resourceIds:['sim-employee-1'],type:'VORGANG',referenceId:'sim-transaction-auftrag',referenceType:'AUFTRAG'});
 const settings=colorSettingsStore(join(dir,'colors.json'));let initial=settings.readWithCatalogs(await calendar.statusCatalogs());
 const chosen={orderType:'AUFTRAG',orderStatus:'sim-order-open',farbe:'#e52b42'};
 settings.write([chosen,...initial.rules.filter(rule=>colorRuleIdentity(rule)!==colorRuleIdentity(chosen))],initial.version);
 assert.equal(eventColor(event,settings.read().rules,layout('status')),'#e52b42');
 store.apiPut('status-label:AUFTRAG:sim-order-open','status-label',{bezeichnung:'Umbenannter Auftragsstatus'});
 store=reopen();api=new SimulatedPdsApi(store);calendar=new PdsCalendar(api);const catalogs=await calendar.statusCatalogs();
 assert.equal(catalogs.find(c=>c.type==='AUFTRAG').statuses.find(s=>s.id==='sim-order-open').name,'Umbenannter Auftragsstatus');
 assert.equal(catalogs.find(c=>c.type==='ANGEBOT').statuses.find(s=>s.id==='sim-order-open').name,'Offen');
 const loaded=(await calendar.list('2026-11-02','2026-11-08')).events.find(row=>row.id===event.id);assert.equal(loaded.orderStatus.name,'Umbenannter Auftragsstatus');
 const persisted=colorSettingsStore(join(dir,'colors.json')).readWithCatalogs(catalogs);assert.equal(eventColor(loaded,persisted.rules,layout('status')),'#e52b42');assert.notEqual(eventColor({...loaded,link:{...loaded.link,type:'ANGEBOT'}},persisted.rules,layout('status')),'#e52b42');
 assert.deepEqual(persisted.rules.find(rule=>rule.orderType==='AUFTRAG'&&rule.orderStatus==='sim-order-open'),chosen);
}));
test('service rename keeps its UUID in both catalog and details',()=>isolated(async({store})=>{
 const api=new SimulatedPdsApi(store),calendar=new PdsCalendar(api);const before=(await calendar.list('2026-11-02','2026-11-08')).events.find(row=>row.orderStatus);
 store.apiPut(`status-label:SERVICEAUFTRAG:${before.orderStatus.id}`,'status-label',{bezeichnung:'Umbenannter Servicestatus'});
 const after=(await calendar.list('2026-11-02','2026-11-08')).events.find(row=>row.id===before.id);assert.equal(after.orderStatus.id,before.orderStatus.id);assert.equal(after.orderStatus.name,'Umbenannter Servicestatus');
 assert.equal((await calendar.statusCatalogs()).find(c=>c.type==='SERVICEAUFTRAG').statuses.find(s=>s.id===before.orderStatus.id).name,after.orderStatus.name);
 const detailsVariant=modifier=>new PdsCalendar({request:async(...args)=>{const value=await api.request(...args);return args[1]==='/service/details'?{...value,vorgangStatus:modifier(value.vorgangStatus)}:value;}});
 const uuidOnly=(await detailsVariant(status=>({uuid:status.uuid})).list('2026-11-02','2026-11-08')).events.find(row=>row.id===before.id);assert.equal(uuidOnly.orderStatus.id,before.orderStatus.id);assert.equal(uuidOnly.orderStatus.name,before.orderStatus.id);
 await assert.rejects(detailsVariant(()=>({bezeichnung:'Name ist keine Identität'})).list('2026-11-02','2026-11-08'),/Status-UUID/);

}));
test('legacy names and global UUIDs migrate persistently, scoped assignments win and removed IDs remain intact',()=>isolated(async({store,dir})=>{
 const catalogs=await new PdsCalendar(new SimulatedPdsApi(store)).statusCatalogs(),settings=colorSettingsStore(join(dir,'colors.json'));
 const old=[{orderStatusName:'Offen',farbe:'#111111'},{orderStatus:'sim-order-open',farbe:'#222222'},{orderType:'AUFTRAG',orderStatus:'sim-order-open',farbe:'#333333'},{orderStatus:'sim-status-offen',farbe:'#444444'},{orderType:'AUFTRAG',orderStatus:'removed-status',farbe:'#555555'},{orderStatusName:'Not in catalog',farbe:'#666666'}];
 writeFileSync(join(dir,'colors.json'),JSON.stringify(old));const migrated=settings.readWithCatalogs(catalogs);
 assert.ok(!migrated.rules.some(rule=>rule.orderStatusName==='Offen'));assert.ok(!migrated.rules.some(rule=>rule.orderStatusName==='Not in catalog'));
 assert.equal(migrated.rules.find(rule=>rule.orderType==='AUFTRAG'&&rule.orderStatus==='sim-order-open').farbe,'#333333');assert.ok(migrated.rules.some(rule=>rule.orderStatus==='removed-status'));
 assert.deepEqual(settings.readWithCatalogs(catalogs),migrated);assert.deepEqual(colorSettingsStore(join(dir,'colors.json')).read(),migrated);
 const idOnly=resolveStatusRules([{orderStatus:'sim-status-offen',farbe:'#444444'}],catalogs);assert.deepEqual(idOnly,[{orderType:'SERVICEAUFTRAG',orderStatus:'sim-open',farbe:'#444444'}]);
 assert.equal(new Set(migrated.rules.map(colorRuleIdentity)).size,migrated.rules.length);assert.ok(defaultColorsForCatalogs(catalogs).some(rule=>rule.orderType==='PROJEKT'));
}));
test('catalog errors fail explicitly and never use a view; malformed or duplicate IDs are rejected',async()=>{
 for(const result of [null,{},[{uuid:'x'},{uuid:'x'}],[{uuid:1}],[{uuid:'x',bezeichnung:3}],[{uuid:'x',kategorie:false}]]){
  const calls=[];const calendar=new PdsCalendar({request:async(method,path)=>{calls.push(path);return result;}});await assert.rejects(calendar.statusCatalogs());assert.ok(calls.every(path=>!path.startsWith('/datenansichten/')));
 }
 const empty=await new PdsCalendar({request:async()=>[]}).statusCatalogs();assert.ok(empty.every(catalog=>catalog.statuses.length===0));
 const uuidOnly=await new PdsCalendar({request:async()=>[{uuid:'only-id'}]}).statusCatalogs();assert.ok(uuidOnly.every(catalog=>catalog.statuses[0].name==='only-id'));
});
test('scoped color validation allows shared UUIDs in different families but rejects duplicate or ambiguous keys',()=>{
 const rules=checkColorRules([{orderType:'AUFTRAG',orderStatus:'x',farbe:'#112233'},{orderType:'ANGEBOT',orderStatus:'x',farbe:'#334455'}]);assert.equal(rules.length,2);
 assert.throws(()=>checkColorRules([...rules,rules[0]]),/Doppelte/);assert.throws(()=>checkColorRules([{orderType:'AUFTRAG',orderStatusName:'Offen',farbe:'#112233'}]),/Status-UUID/);assert.throws(()=>checkColorRules([{orderType:'<script>',orderStatus:'x',farbe:'#112233'}]));
 const event={status:'FREI',type:'FREIER',categories:[],link:{type:'AUFTRAG'},orderStatus:{id:'x',name:'Changed'}};assert.equal(eventColor(event,rules,layout('status')),'#112233');assert.equal(eventColor({...event,link:{type:'ANGEBOT'}},rules,layout('status')),'#334455');
});
