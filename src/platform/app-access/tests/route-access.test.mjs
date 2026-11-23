import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {apiPolicy,requirePolicy,requireAppRight} from '../access-policy.ts';
const mixed={id:'fictional',role:'dispatcher'},can=async(id,app,right)=>right==='read'?['/servicehub','/planboard'].includes(app):app==='/servicehub';
test('mixed rights and direct server policy calls cannot borrow writes from another app',async()=>{
 await requirePolicy(mixed,'/api/service/planung','POST',can);
 await requirePolicy(mixed,'/api/ressourcenkalender','GET',can);
 await assert.rejects(requirePolicy(mixed,'/api/ressourcenkalender','POST',can),e=>e.status===403);
 await assert.rejects(requirePolicy(mixed,'/api/pds/rest/api/[...segments]','POST',can,'/api/pds/rest/api/termin/update'),e=>e.status===403);
 await requirePolicy(mixed,'/api/pds/rest/api/[...segments]','POST',can,'/api/pds/rest/api/termin/listplanung');
 await assert.rejects(requireAppRight(mixed,['/hilfe'],'read',can),e=>e.status===403);
 await assert.rejects(requirePolicy(null,'/api/einstellungen','GET',can),e=>e.status===401);
 await requirePolicy(mixed,'/api/einstellungen','POST',async()=>false);
 await assert.rejects(requirePolicy(mixed,'/api/verwaltung','GET',async()=>true),e=>e.status===403);
 await assert.rejects(requirePolicy(mixed,'/api/new-route','GET',can),e=>e.status===403);
});
test('every API route has an explicit scope and every protected export uses server-side guard',async()=>{
 async function scan(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=directory+'/'+entry.name;if(entry.isDirectory())await scan(path);else if(entry.name==='route.ts'){const route='/'+directory.slice('src/app/'.length);assert.ok(apiPolicy(route),route);const code=await readFile(path,'utf8');if(apiPolicy(route)!=='public'){assert.match(code,/withRouteAccess/,route);assert.doesNotMatch(code,/export async function (GET|POST|PUT|PATCH|DELETE)/,route);for(const line of code.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\s*=([^;]+);/g))assert.match(line[2],/withRouteAccess/,route);}}}}
 await scan('src/app/api');
});

test('personal Service visibility requires app read access but no business write permission',async()=>{
 await requirePolicy(mixed,'/api/service/sichtbarkeit','POST',async(id,app,right)=>app==='/servicehub'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/service/sichtbarkeit','GET',async()=>false),e=>e.status===403);
 await assert.rejects(requirePolicy(null,'/api/service/sichtbarkeit','POST',async()=>true),e=>e.status===401);
 await requirePolicy(mixed,'/api/service/angeheftet','POST',async(id,app,right)=>app==='/servicehub'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/service/angeheftet','GET',async()=>false),e=>e.status===403);
 await assert.rejects(requirePolicy(null,'/api/service/angeheftet','POST',async()=>true),e=>e.status===401);
 await requirePolicy(mixed,'/api/service/markierungen','POST',async(id,app,right)=>app==='/servicehub'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/service/markierungen','GET',async()=>false),e=>e.status===403);
 await assert.rejects(requirePolicy(null,'/api/service/markierungen','POST',async()=>true),e=>e.status===401);
 await requirePolicy(mixed,'/api/maildesk','GET',async(id,app,right)=>app==='/maildesk'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/maildesk/aktion','POST',async(id,app,right)=>app==='/maildesk'&&right==='read'),e=>e.status===403);
 await requirePolicy(mixed,'/api/maildesk/antwort','POST',async(id,app)=>app==='/maildesk');
 await assert.rejects(requirePolicy(null,'/api/maildesk/nachricht','GET',async()=>true),e=>e.status===401);
 await assert.rejects(requirePolicy(mixed,'/api/verwaltung/maildesk','GET',async(id,app)=>app==='/maildesk'),e=>e.status===403);
 await requirePolicy(mixed,'/api/aufgaben','GET',async(id,app,right)=>app==='/taskhub'&&right==='read');
 await requirePolicy(mixed,'/api/aufgaben/aufgabe','GET',async(id,app,right)=>app==='/taskhub'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/aufgaben/aktion','POST',async(id,app,right)=>app==='/taskhub'&&right==='read'),e=>e.status===403);
 await assert.rejects(requirePolicy(mixed,'/api/aufgaben/neu','POST',async(id,app,right)=>app==='/taskhub'&&right==='read'),e=>e.status===403);
 await requirePolicy(mixed,'/api/aufgaben/neu','POST',async(id,app)=>app==='/taskhub');
 await assert.rejects(requirePolicy(null,'/api/aufgaben/vorlage','GET',async()=>true),e=>e.status===401);
 await assert.rejects(requirePolicy(mixed,'/api/aufgaben','GET',async(id,app)=>app==='/maildesk'),e=>e.status===403);
 await requirePolicy(mixed,'/api/service/kunde360','GET',async(id,app,right)=>app==='/servicehub'&&right==='read');
 await assert.rejects(requirePolicy(mixed,'/api/service/kunde360/notiz','POST',async(id,app,right)=>app==='/servicehub'&&right==='read'),e=>e.status===403);
 await requirePolicy(mixed,'/api/service/kunde360/notiz','POST',async(id,app)=>app==='/servicehub');
 await requirePolicy(mixed,'/api/missioncontrol','GET',async(id,app,right)=>app==='/missioncontrol'&&right==='read');
 await requirePolicy(mixed,'/api/missioncontrol/notizen','GET',async(id,app,right)=>app==='/missioncontrol'&&right==='read');
 for(const path of ['/api/missioncontrol/plan','/api/missioncontrol/fokus','/api/missioncontrol/notizen','/api/missioncontrol/erledigt','/api/missioncontrol/kalender','/api/missioncontrol/ziele'])await assert.rejects(requirePolicy(mixed,path,'POST',async(id,app,right)=>app==='/missioncontrol'&&right==='read'),e=>e.status===403);
 await requirePolicy(mixed,'/api/missioncontrol/fokus','POST',async(id,app)=>app==='/missioncontrol');
 await requirePolicy(mixed,'/api/missioncontrol/ziele','GET',async(id,app,right)=>app==='/missioncontrol'&&right==='read');
 await requirePolicy(mixed,'/api/missioncontrol/rueckblick','GET',async(id,app,right)=>app==='/missioncontrol'&&right==='read');
});

test('customer confirmation preview and commit both require Service write and never admin-mail permissions',async()=>{
 await requirePolicy(mixed,'/api/service/terminbestaetigung','POST',can);
 await assert.rejects(requirePolicy(mixed,'/api/service/terminbestaetigung','POST',async(id,app,right)=>app==='/servicehub'&&right==='read'),e=>e.status===403);
 await assert.rejects(requirePolicy(null,'/api/service/terminbestaetigung','POST',can),e=>e.status===401);
 await assert.rejects(requirePolicy(mixed,'/api/verwaltung/email','POST',can),e=>e.status===403);
});

test('technical unit chronicle is Service read only and rejects anonymous or unrelated app access',async()=>{
 await requirePolicy(mixed,'/api/service/chronik','GET',async(id,app,right)=>app==='/servicehub'&&right==='read');
 await assert.rejects(requirePolicy(null,'/api/service/chronik','GET',can),e=>e.status===401);
 await assert.rejects(requirePolicy(mixed,'/api/service/chronik','GET',async(id,app)=>app==='/planboard'),e=>e.status===403);
});
