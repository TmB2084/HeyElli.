import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chronicleDate,chronicleEntries} from '../chronicle-model.ts';
import {readChronicleServices,readChronicleReports} from '../chronicle-reader.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
test('chronicle sorts real dates newest first, keeps unknown last and merges document links without duplicates',()=>{
 for(const value of ['2026-02-30','invalid','2026-02-30T12:00:00Z','2026-11-14T24:00:00Z','14.11.2026'])assert.equal(chronicleDate(value),'');assert.equal(chronicleDate('2026-11-14'),'2026-11-14');assert.equal(chronicleDate('2026-11-14T12:30:00+01:00'),'2026-11-14T12:30:00+01:00');
 const rows=chronicleEntries([{id:'missing',date:''},{id:'past',date:'2025-11-14'},{id:'new',date:'2026-11-14'},{id:'doc',date:'2026-10-15',orders:[{id:'a',number:'A'}]},{id:'doc',date:'2026-10-15',orders:[{id:'b',number:'B'}]}]);assert.deepEqual(rows.map(row=>row.id),['new','doc','past','missing']);assert.deepEqual(rows[1].orders.map(row=>row.id),['a','b']);
});
test('chronicle reads only exact unit incidents, reports and documented metadata; no bytes or writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chronicle-')),store=openOrderStore(join(dir,'fictional.sqlite'));
 try{const native=new SimulatedPdsApi(store),calls=[],api={request(...args){calls.push(args);return native.request(...args);}};const service=await readChronicleServices(api,'sim-unit-4');assert.equal(service.rows.length,1);assert.equal(service.rows[0].orderId,'sim-order-2');assert.equal(service.rows[0].dateKind,'Termin');assert.equal(service.rows[0].date,'2026-11-04T09:00:00+01:00');assert.deepEqual(service.orders,[{id:'sim-order-2',number:'SIM-SA-10002'}]);assert.equal((await readChronicleServices(api,'sim-unit-1')).rows[0].date,'');
 const reports=await readChronicleReports(api,'sim-unit-4',['sim-order-2'],'a'.repeat(64)),report=reports.rows.find(row=>row.title==='Fiktiver Wartungsbericht BMA.txt');assert.ok(report);assert.equal(report.date,'2026-10-15');assert.equal(report.dateKind,'Dokumentdatum');assert.match(report.url,/^\/api\/service\/einsatzmappe\/dokument\?/);assert.match(report.detail,/Wartungsbericht/);assert.equal(new Set(reports.rows.map(row=>row.id)).size,reports.rows.length);assert.ok(calls.every(([method,path])=>method==='GET'||/details|list/.test(path)));assert.ok(calls.every(([,path])=>!path.includes('download')));
 await assert.rejects(readChronicleReports(api,'sim-unit-1',['sim-order-2'],'a'.repeat(64)),e=>e.status===403);for(const ids of [[],Array(5).fill('order'),['../escape'],['sim-order-2','sim-order-2']])await assert.rejects(readChronicleReports(api,'sim-unit-4',ids,'a'.repeat(64)));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('failed names and document sources remain explicit and never invent dates',async()=>{
 const api={async request(method,path){if(path==='/service/liststoerungen')return {totalHitCount:1,resultList:[{serviceAuftrag:{uuid:'order',vorgangsNummer:'A'},serviceAuftragEbene:{uuid:'i',objektUUID:'unit',hauptmonteurUUID:'tech',startZeitpunkt:'bad'}}]};throw Error('Untrusted provider details');}};const result=await readChronicleServices(api,'unit');assert.match(result.notice,/nicht vollständig/);assert.equal(result.rows[0].date,'');assert.ok(!JSON.stringify(result).includes('Untrusted'));
});
