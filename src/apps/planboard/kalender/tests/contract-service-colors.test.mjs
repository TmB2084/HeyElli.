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
import {SimulatedWriteApi} from '../../../../platform/pds/simulator/write-api.ts';
import {createService} from '../../../../platform/pds/api/execute.ts';
import {colorSettingsStore} from '../settings-store.ts';
import {contractMembership,contractFilterValues,eventColor,checkColorRules,wallInstant} from '../domain.ts';
const from='2026-11-02',to='2026-11-08';
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-contract-'));let store=openOrderStore(join(dir,'test.sqlite'));try{await run({dir,store,reopen(){store.close();store=openOrderStore(join(dir,'test.sqlite'));return store;}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
async function create(store,key='none'){return createService(new SimulatedWriteApi(store,key),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Fiktiver Vertragsleistungstest',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-03T08:00'),end:wallInstant('2026-11-03T09:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});}
test('simulated contract filter returns distinct incident memberships before pagination and never leaks internal mode',()=>isolated(async({store})=>{
 const receipt=await create(store);const api=new SimulatedPdsApi(store);store.apiPut('service-contract:'+receipt.stoerungUUID,'service-contract',{mode:'WARTUNGSVORGANG',wartungsvertragUUID:'sim-maintenance-contract-2'});
 const lists={};for(const filter of contractFilterValues)lists[filter]=await api.request('POST','/service/liststoerungen',{vertragsleistung:filter,page:0,entriesPerPage:1});
 assert.equal(lists.KEIN.totalHitCount,1);assert.equal(lists.INTERVALL.totalHitCount,1);assert.equal(lists.WARTUNGSVORGANG.totalHitCount,1);
 assert.equal(lists.KEIN.resultList[0].uuid,'sim-order-1-incident');assert.equal(lists.INTERVALL.resultList[0].uuid,'sim-order-2-incident');assert.equal(lists.WARTUNGSVORGANG.resultList[0].uuid,receipt.stoerungUUID);
 assert.equal(lists.WARTUNGSVORGANG.resultList[0].serviceAuftragEbene.wartungsvertragUUID,'sim-maintenance-contract-2');assert.equal(lists.WARTUNGSVORGANG.resultList[0].serviceAuftragEbene.mode,undefined);
 assert.equal((await api.request('POST','/service/liststoerungen',{page:0,entriesPerPage:500})).totalHitCount,3);
 assert.equal((await api.request('POST','/service/liststoerungen',{vertragsleistung:'WARTUNGSVORGANG',page:1,entriesPerPage:1})).resultList.length,0);
 assert.equal((await api.request('POST','/service/liststoerungen',{vertragsleistung:'INTERVALL',stoerungStatusUUIDs:['non-matching']})).totalHitCount,0);
 await assert.rejects(api.request('POST','/service/liststoerungen',{vertragsleistung:'INVALID'}));
}));
test('calendar resolves all three filters by service and incident UUID; mixed levels are never classified by order alone',()=>isolated(async({store})=>{
 const receipt=await create(store),extra=await new SimulatedWriteApi(store,'second-level').request('POST','/service/createstoerung',{serviceauftragUUID:receipt.uuid,objektUUID:'sim-unit-2',auszufuehrendeArbeiten:'Zweite Ebene',hauptmonteurUUID:'sim-employee-1',startZeitpunkt:wallInstant('2026-11-03T10:00'),endZeitpunkt:wallInstant('2026-11-03T11:00')});
 store.apiPut('service-contract:'+extra.uuid,'service-contract',{mode:'WARTUNGSVORGANG'});
 const api=new SimulatedPdsApi(store),calls=[];const data=await new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}}).list(from,to);
 const one=data.events.find(event=>event.serviceIncidentId===receipt.stoerungUUID),two=data.events.find(event=>event.serviceIncidentId===extra.uuid);
 assert.equal(one.contractService,'OHNE');assert.equal(two.contractService,'MIT');assert.equal(one.link.id,two.link.id);assert.equal(data.events.find(event=>event.serviceIncidentId==='sim-order-2-incident').contractService,'MIT');
 assert.deepEqual(calls.filter(call=>call[1]==='/service/liststoerungen').map(call=>call[2]),contractFilterValues.map(vertragsleistung=>({vertragsleistung,page:0,entriesPerPage:500})));
 assert.ok(data.events.filter(event=>event.type!=='SERVICEAUFTRAGEBENE').every(event=>event.contractService===undefined));
}));
test('unmatched, overlapping or ignored filters stay unknown; HTTP errors never become without-contract or view fallback',()=>isolated(async({store})=>{
 const api=new SimulatedPdsApi(store);for(const mode of ['empty','overlap']){
  const calendar=new PdsCalendar({request:async(method,path,body)=>{if(path==='/service/liststoerungen'){if(mode==='empty')return {resultList:[],totalHitCount:0};return api.request(method,path,{...body,vertragsleistung:undefined});}return api.request(method,path,body);}});
  const event=(await calendar.list(from,to)).events.find(event=>event.type==='SERVICEAUFTRAGEBENE');assert.equal(event.contractService,'UNBEKANNT');
 }
 const paths=[];const fail=new PdsCalendar({request:async(method,path,body)=>{paths.push(path);if(path==='/service/liststoerungen')throw Error('PDS 403');return api.request(method,path,body);}});
 await assert.rejects(fail.list(from,to),/PDS 403/);assert.ok(!paths.some(path=>path.startsWith('/datenansichten/')));
 for(const filters of [[],['KEIN','INTERVALL'],['KEIN','WARTUNGSVORGANG']])assert.equal(contractMembership(new Set(filters)),'UNBEKANNT');
 assert.equal(contractMembership(new Set(['INTERVALL','WARTUNGSVORGANG'])),'MIT');
}));
test('historical contract service remains classified by filter even after current contract references are absent, and colors persist',()=>isolated(async({dir,store,reopen})=>{
 const receipt=await create(store);store.apiPut('service-contract:'+receipt.stoerungUUID,'service-contract',{mode:'INTERVALL'});
 const settings=colorSettingsStore(join(dir,'colors.json')),rules=[{contractService:'MIT',farbe:'#123456'},{contractService:'OHNE',farbe:'#654321'}];settings.write(rules,settings.read().version);
 store=reopen();const api=new SimulatedPdsApi(store);const detail=await api.request('POST','/service/details',{uuid:receipt.uuid});assert.equal(detail.rootEbene.ebenen[0].wartungsvertragUUID,undefined);
 const event=(await new PdsCalendar(api).list(from,to)).events.find(event=>event.serviceIncidentId===receipt.stoerungUUID);assert.equal(event.contractService,'MIT');assert.equal(eventColor(event,colorSettingsStore(join(dir,'colors.json')).read().rules),'#123456');
}));
test('every membership page is read and malformed pagination or links fail explicitly',()=>isolated(async({store})=>{
 const receipt=await create(store),api=new SimulatedPdsApi(store),calls=[];
 const calendar=new PdsCalendar({request:async(method,path,body)=>{
  if(path!=='/service/liststoerungen')return api.request(method,path,body);calls.push(body);
  if(body.vertragsleistung!=='INTERVALL')return {totalHitCount:0,resultList:[]};
  return {totalHitCount:501,resultList:body.page===0?Array.from({length:500},(_,i)=>({uuid:'row-'+i,serviceAuftrag:{uuid:'unrelated'},serviceAuftragEbene:{uuid:'level-'+i}})):[{uuid:'wrapper-id-is-not-level-id',serviceAuftrag:{uuid:receipt.uuid},serviceAuftragEbene:{uuid:receipt.stoerungUUID}}]};
 }});
 assert.equal((await calendar.list(from,to)).events.find(event=>event.serviceIncidentId===receipt.stoerungUUID).contractService,'MIT');assert.ok(calls.some(body=>body.page===1&&body.vertragsleistung==='INTERVALL'));
 for(const response of [{totalHitCount:1,resultList:[]},{totalHitCount:Infinity,resultList:[]},{totalHitCount:1,resultList:[{uuid:'x',serviceAuftrag:{uuid:'x'},serviceAuftragEbene:{}}]}]){
  await assert.rejects(new PdsCalendar({request:async(method,path,body)=>path==='/service/liststoerungen'?response:api.request(method,path,body)}).list(from,to));
 }
}));
test('explicit status, category and type selections; unknown is never silently without-contract',()=>{
 const event={type:'SERVICEAUFTRAGEBENE',contractService:'MIT',status:'GEPLANT',categories:['cat'],link:{type:'SERVICEAUFTRAG'},orderStatus:{id:'open',name:'Offen'}};
 const rules=[{contractService:'MIT',farbe:'#123456'},{contractService:'OHNE',farbe:'#654321'},{typ:'SERVICEAUFTRAGEBENE',farbe:'#101010'},{category:'cat',farbe:'#222222'},{orderType:'SERVICEAUFTRAG',orderStatus:'open',farbe:'#333333'},{orderStatus:'*',farbe:'#444444'}];
 assert.equal(eventColor(event,rules,layout('status')),'#333333');assert.equal(eventColor({...event,orderStatus:{id:'unconfigured',name:'Other'}},rules,layout('category')),'#222222');assert.equal(eventColor({...event,orderStatus:undefined,categories:[]},rules),'#123456');
 assert.equal(eventColor({...event,orderStatus:undefined,categories:[],contractService:'OHNE'},rules),'#654321');assert.equal(eventColor({...event,orderStatus:undefined,categories:[],contractService:'UNBEKANNT'},rules),'#101010');
 assert.equal(eventColor({...event,orderStatus:undefined,categories:[],contractService:'UNBEKANNT'},rules.filter(rule=>rule.typ!=='SERVICEAUFTRAGEBENE')),'#cad0db');
 assert.equal(eventColor({...event,categories:[],orderStatus:undefined},[]),'#99ccff');assert.equal(eventColor({...event,categories:[],orderStatus:undefined,contractService:'OHNE'},[]),'#ccffcc');
 assert.throws(()=>checkColorRules([{contractService:'UNKNOWN',farbe:'#112233'}]));assert.throws(()=>checkColorRules([{contractService:'MIT',typ:'SERVICEAUFTRAGEBENE',farbe:'#112233'}]));assert.throws(()=>checkColorRules([rules[0],rules[0]]));
});
