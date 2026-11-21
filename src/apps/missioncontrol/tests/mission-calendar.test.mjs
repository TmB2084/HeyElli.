import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addMinutes,freeSlot,graphCalendar,sampleEvents,CATEGORY} from '../calendar.ts';
import {guardExternalWrites} from '../../../platform/server-operation/index.ts';
// Outlook-Kalender über Microsoft Graph: freie Plätze, Lesen (privat ohne Betreff), Anlegen mit transactionId, Verschieben,
// Löschen und Schreibsperre der Testinstanz (HEYELLI_EXTERN_SCHREIBEN=aus). Fiktive Daten, kein echter Tenant.
const env={M365_TENANT_ID:'00000000-0000-4000-8000-000000000001',M365_CLIENT_ID:'00000000-0000-4000-8000-000000000002',M365_CLIENT_SECRET:'beispiel'};
function fakeGraph(){
 const calls=[];
 const transport=async(url,init={})=>{const method=init.method??'GET';calls.push({method,url:String(url),body:typeof init.body==='string'&&init.body.startsWith('{')?JSON.parse(init.body):undefined,prefer:init.headers?.Prefer});
  if(String(url).includes('login.microsoftonline.com'))return Response.json({access_token:'t'});
  if(method==='GET')return Response.json({value:[{id:'e1',subject:'Teambesprechung',start:{dateTime:'2026-11-23T09:00:00.0000000'},end:{dateTime:'2026-11-23T09:45:00.0000000'},showAs:'busy',categories:[]},{id:'e2',subject:'Arzt',sensitivity:'private',start:{dateTime:'2026-11-23T11:00:00'},end:{dateTime:'2026-11-23T12:00:00'},showAs:'oof'},{id:'e3',subject:'Fokus: Angebot',start:{dateTime:'2026-11-23T13:00:00'},end:{dateTime:'2026-11-23T13:30:00'},showAs:'busy',categories:[CATEGORY]}]});
  if(method==='POST')return Response.json({id:'neu-1'});
  if(method==='DELETE')return new Response(null,{status:204});
  return new Response(null,{status:200});};
 return {calls,transport};
}
test('freie Plätze im 15-Minuten-Raster zwischen 8 und 17 Uhr',()=>{
 assert.equal(addMinutes('09:45',30),'10:15');
 const busy=[{start:'2026-11-23T08:00',end:'2026-11-23T09:00'},{start:'2026-11-23T09:15',end:'2026-11-23T10:00'},{start:'2026-11-24T08:00',end:'2026-11-24T17:00'}];
 assert.equal(freeSlot('2026-11-23',15,busy),'09:00');
 assert.equal(freeSlot('2026-11-23',30,busy),'10:00');
 assert.equal(freeSlot('2026-11-23',30,busy,'10:20'),'10:20');
 assert.equal(freeSlot('2026-11-24',30,busy),null);
 assert.equal(freeSlot('2026-11-25',600,[]),null,'länger als der Arbeitstag');
 assert.ok(sampleEvents(['2026-11-23']).some(event=>event.subject==='Teambesprechung'));
});
test('Graph: lesen mit Berliner Zeitzone, private Termine ohne Betreff, eigene Blöcke erkannt',async()=>{
 const {calls,transport}=fakeGraph(),calendar=graphCalendar('kim.muster@beispiel.example',env,transport);
 const events=await calendar.events('2026-11-23','2026-11-27');
 assert.deepEqual(events.map(event=>[event.id,event.subject,event.start,event.busy,event.own]),[['e1','Teambesprechung','2026-11-23T09:00',true,false],['e2','Privater Termin','2026-11-23T11:00',true,false],['e3','Fokus: Angebot','2026-11-23T13:00',true,true]]);
 const read=calls.find(call=>call.url.includes('/calendarView'));assert.match(read.url,/users\/kim\.muster%40beispiel\.example\/calendarView/);assert.equal(read.prefer,'outlook.timezone="Europe/Berlin"');
});
test('Graph: anlegen mit transactionId, verschieben per PATCH, löschen',async()=>{
 const {calls,transport}=fakeGraph(),calendar=graphCalendar('kim.muster@beispiel.example',env,transport);
 const id=await calendar.save(null,'user|simulator|pds:t1','Angebot Speichertausch',{day:'2026-11-23',time:'10:00',minutes:45});
 assert.equal(id,'neu-1');const created=calls.find(call=>call.method==='POST'&&call.url.endsWith('/events'));
 assert.equal(created.body.subject,'Fokus: Angebot Speichertausch');assert.deepEqual(created.body.start,{dateTime:'2026-11-23T10:00:00',timeZone:'Europe/Berlin'});assert.equal(created.body.end.dateTime,'2026-11-23T10:45:00');
 assert.deepEqual(created.body.categories,[CATEGORY]);assert.equal(created.body.showAs,'busy');assert.equal(created.body.transactionId.length,40);
 await calendar.save('neu-1','user|simulator|pds:t1','Angebot Speichertausch',{day:'2026-11-24',time:'08:00',minutes:45});
 assert.ok(calls.some(call=>call.method==='PATCH'&&call.url.endsWith('/events/neu-1')&&call.body.start.dateTime==='2026-11-24T08:00:00'));
 await calendar.remove('neu-1');assert.ok(calls.some(call=>call.method==='DELETE'&&call.url.endsWith('/events/neu-1')));
});
test('Testinstanz: Schreibsperre verhindert Einträge, Lesen bleibt möglich',async()=>{
 const {transport}=fakeGraph(),guarded=guardExternalWrites(transport,{HEYELLI_EXTERN_SCHREIBEN:'aus'}),calendar=graphCalendar('kim.muster@beispiel.example',env,guarded);
 assert.equal((await calendar.events('2026-11-23','2026-11-23')).length,3);
 await assert.rejects(calendar.save(null,'k','Titel',{day:'2026-11-23',time:'10:00',minutes:30}),/abgeschaltet/);
});
test('Graph-Fehler werden verständlich gemeldet',async()=>{
 const transport=async url=>String(url).includes('login')?Response.json({access_token:'t'}):new Response(null,{status:403});
 await assert.rejects(graphCalendar('a@b.example',env,transport).events('2026-11-23','2026-11-23'),/Calendars\.ReadWrite/);
});
