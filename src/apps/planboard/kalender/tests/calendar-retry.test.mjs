import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {eventOptions} from '../domain.ts';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
const from='2026-11-02',to='2026-11-08';
const patch=(old,changes)=>({id:old.id,start:old.start,end:old.end,resourceIds:old.resourceIds,...changes,expected:{start:old.start,end:old.end,resourceIds:old.resourceIds,title:old.title,notes:old.notes??''}});
async function scenario(work){const dir=mkdtempSync(join(tmpdir(),'calendar-retry-')),store=openOrderStore(join(dir,'test.sqlite'));try{const api=new SimulatedPdsApi(store,'retry-test'),calendar=new PdsCalendar(api),data=await calendar.list(from,to),old=data.events.find(event=>event.title==='Wartung · Beispielhaus Nord');await work({store,api,calendar,old,ids:data.events.map(event=>event.id).sort()});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('retry after loss before persistence updates the same UUID without creating duplicates',()=>scenario(async({api,calendar,old,ids})=>{
 const input=patch(old,{title:'Wiederholter Titel',notes:'Beschreibung des Entwurfs',end:new Date(Date.parse(old.end)+15*60000).toISOString()});
 const failing=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update')throw new TypeError('Connection interrupted');return api.request(...args);}});
 await assert.rejects(failing.update(input));assert.equal((await calendar.details(old.id)).title,old.title);
 const saved=await calendar.update(input);assert.equal(saved.id,old.id);assert.equal(saved.title,input.title);assert.equal(saved.notes,input.notes);assert.equal(Date.parse(saved.end),Date.parse(input.end));assert.deepEqual((await calendar.list(from,to)).events.map(event=>event.id).sort(),ids);
}));
test('lost response after persistence is acknowledged without another write or manual reload',()=>scenario(async({api,calendar,old,ids})=>{
 const input=patch(old,{title:'Bereits gespeicherter Titel',notes:'Bereits gespeicherte Beschreibung',end:new Date(Date.parse(old.end)+15*60000).toISOString()});
 const lost=new PdsCalendar({request:async(...args)=>{const result=await api.request(...args);if(args[1]==='/termin/update')throw new TypeError('Response interrupted after commit');return result;}});
 await assert.rejects(lost.update(input));
 let writes=0;const retry=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update')writes++;return api.request(...args);}});
 const repeated=await retry.update(input);assert.equal(repeated.id,old.id);assert.equal(repeated.title,input.title);assert.equal(repeated.notes,input.notes);assert.equal(writes,0);
 const loaded=await calendar.details(old.id);assert.equal(loaded.title,input.title);assert.equal(loaded.notes,input.notes);assert.equal(Date.parse(loaded.end),Date.parse(input.end));
 const next=await calendar.update(patch(loaded,{title:'Nach erneutem Laden ergänzt',notes:input.notes+' · Ergänzung'}));assert.equal(next.id,old.id);assert.equal(next.notes,input.notes+' · Ergänzung');assert.deepEqual((await calendar.list(from,to)).events.map(event=>event.id).sort(),ids);
}));
test('retry cannot overwrite an intervening change to the same appointment or another appointment',()=>scenario(async({calendar,old,ids})=>{
 const proposal=patch(old,{title:'Veralteter eigener Entwurf',notes:'Eigene Notizen'});
 const other=(await calendar.list(from,to)).events.find(event=>!event.fixed&&event.id!==old.id);
 const savedOther=await calendar.update(patch(other,{title:'Andere Terminänderung'}));
 await calendar.update(patch(old,{title:'Zwischenzeitliche Änderung',notes:'Fremde neue Notizen'}));await assert.rejects(calendar.update(proposal),error=>error.status===409);
 assert.equal((await calendar.details(old.id)).notes,'Fremde neue Notizen');assert.equal((await calendar.details(savedOther.id)).title,'Andere Terminänderung');assert.deepEqual((await calendar.list(from,to)).events.map(event=>event.id).sort(),ids);
}));

test('an intervening edit after a lost commit is never overwritten on retry',()=>scenario(async({api,calendar,old})=>{
 const input=patch(old,{title:'Eigener gespeicherter Titel',notes:'Eigene Beschreibung'});
 const lost=new PdsCalendar({request:async(...args)=>{const result=await api.request(...args);if(args[1]==='/termin/update')throw new TypeError('Response lost');return result;}});
 await assert.rejects(lost.update(input));const committed=await calendar.details(old.id);
 await calendar.update(patch(committed,{notes:'Zwischenzeitlich ergänzte Beschreibung'}));
 await assert.rejects(calendar.update(input),error=>error.status===409);
 assert.equal((await calendar.details(old.id)).notes,'Zwischenzeitlich ergänzte Beschreibung');
}));
test('matching requested values return newer unrelated fields without rewriting them',()=>scenario(async({api,calendar,old})=>{
 const input=patch(old,{title:'Schon gespeicherter Titel'});await calendar.update(input);
 await calendar.update(patch(await calendar.details(old.id),{notes:'Neuere unabhängige Beschreibung'}));
 let writes=0;const retry=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update')writes++;return api.request(...args);}});
 const saved=await retry.update(input);assert.equal(saved.notes,'Neuere unabhängige Beschreibung');assert.equal(writes,0);
}));
test('all requested options must match, including after fixing an appointment',()=>scenario(async({api,calendar,old})=>{
 const input=patch(old,{options:{...eventOptions(old),fixed:true,pimSync:!old.pimSync}});input.expected.options=eventOptions(old);
 await calendar.update(input);
 let writes=0;const retry=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update')writes++;return api.request(...args);}});
 assert.equal((await retry.update(input)).fixed,true);assert.equal(writes,0);
 assert.equal((await retry.update({...input,options:{...input.options,pimSync:old.pimSync??false}})).pimSync,!old.pimSync);assert.equal(writes,0); // Unchanged requested value preserves the newer switch.
}));
test('service team retry acknowledges roles, but rejects an intervening main technician change',()=>scenario(async({api,calendar})=>{
 const service=await api.request('POST','/service/create',{context:{vorgangsVorlageName:'SIM-Serviceauftrag'},vorgangsdaten:{personUUID:'SIM-K-100',belegDatum:'2026-11-04',texte:{technischeVormerkung:'Fiktiver Wiederholungstest'}}});
 const incident=await api.request('POST','/service/createstoerung',{serviceauftragUUID:service.uuid,objektUUID:'sim-object-1',auszufuehrendeArbeiten:'Fiktiver Wiederholungstest',hauptmonteurUUID:'sim-employee-1',weiteremonteureUUIDs:['sim-employee-2'],startZeitpunkt:'2026-11-04T09:00:00Z',endZeitpunkt:'2026-11-04T10:00:00Z'});
 const old=(await calendar.list(from,to)).events.find(event=>event.serviceIncidentId===incident.uuid);
 assert.ok(old);const main=old.mainTechnicianId,companion=(await calendar.list(from,to)).resources.find(resource=>resource.id!==main).id;assert.ok(companion);
 const input=patch(old,{title:'Gespeicherte Teamänderung',resourceIds:[main,companion],mainTechnicianId:companion,companionTechnicianIds:[main]});input.expected.mainTechnicianId=main;
 const lost=new PdsCalendar({request:async(...args)=>{const result=await api.request(...args);if(args[1]==='/termin/update')throw new TypeError('Response lost');return result;}});
 await assert.rejects(lost.update(input));
 let writes=0;const retry=new PdsCalendar({request:async(...args)=>{if(['/termin/update','/service/updatestoerung'].includes(args[1]))writes++;return api.request(...args);}});
 assert.equal((await retry.update(input)).mainTechnicianId,companion);assert.equal(writes,0);
 const saved=await calendar.details(old.id),third='sim-employee-3',change=patch(saved,{resourceIds:[third,main,companion],mainTechnicianId:third,companionTechnicianIds:[main,companion]});change.expected.mainTechnicianId=companion;await calendar.update(change);
 await assert.rejects(retry.update(input),error=>error.status===409);assert.equal(writes,0);assert.equal((await calendar.details(old.id)).mainTechnicianId,third);
}));

test('parallel identical saves perform only one write and return the same appointment',()=>scenario(async({api,old,ids,calendar})=>{
 let writes=0;const guarded=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update'){writes++;await new Promise(resolve=>setTimeout(resolve,10));}return api.request(...args);}});
 const input=patch(old,{title:'Parallel bestätigter Titel',notes:'Gemeinsamer Entwurf'});
 const results=await Promise.all([guarded.update(input),guarded.update(input)]);
 assert.equal(writes,1);assert.deepEqual(results.map(result=>result.id),[old.id,old.id]);assert.ok(results.every(result=>result.notes===input.notes));
 assert.deepEqual((await calendar.list(from,to)).events.map(event=>event.id).sort(),ids);
}));

test('server merges a new description into a concurrently rescheduled appointment',()=>scenario(async({calendar,old})=>{
 const latest=await calendar.update(patch(old,{start:new Date(Date.parse(old.start)+15*60000).toISOString(),end:new Date(Date.parse(old.end)+15*60000).toISOString()}));
 const saved=await calendar.update(patch(old,{notes:'Unabhängige neue Beschreibung'}));assert.equal(saved.start,latest.start);assert.equal(saved.end,latest.end);assert.equal(saved.notes,'Unabhängige neue Beschreibung');
}));

test('confirmed write callback sees complete snapshots and preserves no-op attribution',()=>scenario(async({api,old})=>{
 const stamps=[];const calendar=new PdsCalendar(api,{onSaved:async(before,after)=>{if(before.title!==after.title)stamps.push({before:before.title,after:after.title});}});
 const input=patch(old,{title:'Mit Änderungsnachweis'});await calendar.update(input);await calendar.update(input);assert.deepEqual(stamps,[{before:old.title,after:input.title}]);
}));
