import {test} from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceDate,maintenanceState,maintenanceContext,matchesMaintenance} from '../maintenance-model.ts';
import {readMaintenancePage} from '../maintenance-reader.ts';
import {ReadonlyPdsTransport} from '../../../../platform/pds/connection/readonly.ts';
const base={id:'c:i',contractId:'c',intervalId:'i',objectId:'u',contract:'Vertrag',title:'Wartung',description:'Prüfen',due:'2026-11-14',closed:'',from:'',until:'',issue:''};
test('due dates are strict calendar dates and contract activity is separated from unknown due dates',()=>{
 assert.equal(maintenanceDate('2026-02-30'),'');assert.equal(maintenanceDate('2028-02-29'),'2028-02-29');assert.equal(maintenanceDate('2026-11-14T00:00:00Z'),'');
 for(const [row,state]of [[base,'today'],[{...base,due:'2026-11-13'},'overdue'],[{...base,due:'2026-11-15'},'future'],[{...base,due:''},'unknown'],[{...base,closed:'2026-11-13'},'inactive'],[{...base,from:'2026-11-15'},'inactive'],[{...base,issue:'Unklar'},'unknown']])assert.equal(maintenanceState(row,'2026-11-14'),state);
 const objects=[{id:'o',parentId:'',customerId:'c',name:'Haus',type:'OBJEKT',address:'Testweg'},{id:'u',parentId:'o',customerId:'',name:'Anlage',type:'TECHNISCHE_EINHEIT',address:''}],customers=[{id:'c',name:'Nord',number:'007'}];
 const context=maintenanceContext(base,objects,customers);assert.equal(context.object.id,'o');assert.equal(context.unit.id,'u');assert.equal(context.customer.id,'c');assert.equal(matchesMaintenance(base,objects,customers,'007 Testweg Anlage'),true);assert.equal(maintenanceContext({...base,objectId:'missing'},objects,customers).unit,undefined);
});
function apiFor(count=10){return {async request(method,path){if(path==='/wartungsvertrag/listvertraegebyobjekt'){assert.equal(method,'POST');return [{uuid:'c',objektUUID:'u',wartung:{bezeichnung:'Vertrag',intervalle:Array.from({length:count},(_,n)=>({uuid:'i'+n}))},rechnung:{intervalle:[{uuid:'NEVER-READ-BILLING'}]}}];}assert.equal(method,'GET');assert.match(path,/^\/wartungsvertrag\/wartungsintervalldetails\/i/);return {uuid:path.split('/').at(-1),bezeichnung:'Wartung',intervallSerie:{startDatum:'2026-01-01',naechstesDatum:'2026-11-14'}};}};}
test('maintenance intervals paginate, preserve ownership and do not read billing intervals or write',async()=>{
 const api=apiFor(),first=await readMaintenancePage(api,'u',0,'');assert.equal(first.rows.length,8);assert.equal(first.nextCursor,8);const last=await readMaintenancePage(api,'u',8,first.revision);assert.equal(last.rows.length,2);assert.equal(last.nextCursor,null);assert.equal(new Set([...first.rows,...last.rows].map(row=>row.id)).size,10);
 await assert.rejects(readMaintenancePage(apiFor(11),'u',8,first.revision),e=>e.status===409);await assert.rejects(readMaintenancePage(api,'u',1,''),e=>e.status===400);
 assert.equal((await readMaintenancePage(api,'parent',0,'')).rows.length,0);
});
test('missing or malformed due dates are visible as unknown, and foreign interval responses fail',async()=>{
 const api=apiFor(1),transport={async request(method,path,body){if(method==='POST')return api.request(method,path,body);return {uuid:'i0',intervallSerie:{naechstesDatum:'2026-02-30'}};}};
 assert.equal((await readMaintenancePage(transport,'u',0,'')).rows[0].issue,'Fälligkeit nicht hinterlegt oder ungültig.');
 await assert.rejects(readMaintenancePage({async request(method,path,body){if(method==='POST')return api.request(method,path,body);return {uuid:'foreign'};}},'u',0,''),/eindeutig/);
});
test('readonly PDS permits interval details and continues denying generation and interval changes',async()=>{
 const calls=[],readonly=new ReadonlyPdsTransport({async request(...args){calls.push(args);return {};}});await readonly.request('GET','/wartungsvertrag/wartungsintervalldetails/i');assert.equal(calls.length,1);
 for(const path of ['/service/create','/service/createstoerung','/wartungsvertrag/updatewartungssintervall'])await assert.rejects(readonly.request('POST',path,{}),/gesperrt/);assert.equal(calls.length,1);
});
test('fictional intervals obey documented API and distinguish overdue today upcoming missing and closed',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{openOrderStore}=await import('../../../../platform/pds/simulator/order-store.ts'),{SimulatedPdsApi}=await import('../../../../platform/pds/simulator/api.ts');const dir=mkdtempSync(join(tmpdir(),'maintenance-')),store=openOrderStore(join(dir,'fictional.sqlite'));
 try{const api=new SimulatedPdsApi(store),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date()),rows=[];for(const id of ['sim-object-1','sim-unit-1','sim-unit-2','sim-unit-3','sim-unit-4','sim-unit-5'])rows.push(...(await readMaintenancePage(api,id,0,'')).rows);assert.equal(rows.length,6);assert.equal(new Set(rows.map(row=>row.id)).size,6);assert.deepEqual(new Set(rows.map(row=>maintenanceState(row,today))),new Set(['overdue','today','future','unknown','inactive']));}
 finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('unsafe interval path segments and missing contract ownership are rejected before detail reads',async()=>{
 for(const id of ['..','../other','a/b','a\\b','%2e%2e','a?b']){let details=0;await assert.rejects(readMaintenancePage({async request(method){if(method==='GET'){details++;return {};}return [{uuid:'c',objektUUID:'u',wartung:{intervalle:[{uuid:id}]}}];}},'u',0,''));assert.equal(details,0);}
 await assert.rejects(readMaintenancePage({async request(){return [{uuid:'c',wartung:{intervalle:[]}}];}},'u',0,''),/Objektzuordnung/);
});

test('confirmed creation hands the existing incident to planning using current version and source; retries only read',async()=>{
 const {loadMaintenancePlanning}=await import('../maintenance-planning.ts'),created={orderId:'order-new',incidentId:'incident-new'},scope='b'.repeat(64),version='a'.repeat(64),incident={id:'incident-new',intervalId:'i',objectId:'u',work:'Wartung',start:'',end:'',technician:'',companions:[],planningVersion:'verified-version'};
 const calls=[],transport=async(url,options)=>{assert.equal(options?.method,undefined);calls.push(url);return Response.json(new URL(url,'http://local.invalid').searchParams.get('part')==='base'?{kind:'order',revision:version,sourceRevision:scope,incidents:[incident]}:{revision:version,extras:{incidents:[incident]}});};
 const actual=await loadMaintenancePlanning(created,base,scope,transport);assert.equal(actual.id,'incident-new');assert.equal(actual.planningVersion,'verified-version');assert.equal(calls.length,2);await loadMaintenancePlanning(created,base,scope,transport);assert.equal(calls.length,4);assert.ok(calls.every(url=>url.startsWith('/api/service?')));
 await assert.rejects(loadMaintenancePlanning({...created,incidentId:'foreign'},base,scope,transport),/Wartung/);await assert.rejects(loadMaintenancePlanning(created,{...base,objectId:'other'},scope,transport),/Wartung/);await assert.rejects(loadMaintenancePlanning(created,base,'c'.repeat(64),transport),/eindeutig/);
 const changed=async(url)=>Response.json(new URL(url,'http://local.invalid').searchParams.get('part')==='base'?{kind:'order',revision:version,sourceRevision:scope,incidents:[incident]}:{revision:'d'.repeat(64),extras:{incidents:[incident]}});await assert.rejects(loadMaintenancePlanning(created,base,scope,changed),/zwischenzeitlich/);
});
