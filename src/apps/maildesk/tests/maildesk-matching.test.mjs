import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categorize,matchMail,urgent} from '../matching.ts';
import {simulatorMessages} from '../simulator-mailbox.ts';
// Fiktiver Zuordnungsbestand wie im PDS-Simulator; KTR-900 ist eindeutig, KTR-100 gehört mehreren Kunden.
const context={
 customers:[{id:'K1',name:'Beispielhaus Nord, Beispielhaus Süd',number:'SIM-K-100'},{id:'K2',name:'Musterwerk West',number:'SIM-K-200'},{id:'K3',name:'Demohaus ohne technische Einheit',number:'SIM-K-300'}],
 objects:[{id:'o1',customerId:'K1',name:'Beispielhaus Nord',address:'Musterweg 12, 00000 Demostadt'},{id:'o2',customerId:'K1',name:'Beispielhaus Süd',address:'Beispielstraße 8, 00000 Demostadt'},{id:'o3',customerId:'K2',name:'Musterwerk West',address:'Testallee 3, 00000 Musterstadt'},{id:'u4',customerId:'K2',parentId:'o3',name:'Brandmeldeanlage',address:''}],
 orders:[{id:'a1',number:'SIM-SA-10001',customerId:'K1',objectId:'u1',title:'Heizung',status:'Offen'},{id:'a2',number:'SIM-SA-10002',customerId:'K2',objectId:'u4',title:'BMZ',status:'Ausgegeben'}],
 costs:[{number:'SIM-KTR-100',objectIds:['o1','o2','o3']},{number:'SIM-KTR-900',objectIds:['o3']}],senders:[]};
const mail=(subject,body='',from='x@mail.example')=>({subject,body,from});
test('eindeutiger Kostenträger im Betreff ordnet sofort zu, auch mit Objekt',()=>{
 const result=matchMail(mail('Störung – KTR SIM-KTR-900'),context);
 assert.equal(result.assignment.kind,'cost-subject');assert.equal(result.assignment.customerId,'K2');assert.equal(result.assignment.objectId,'o3');assert.equal(result.suggestion,null);
});
test('Nummern werden nur als ganze Kennung erkannt',()=>{
 assert.equal(matchMail(mail('Bezug SIM-KTR-9000'),context).assignment,null);
 assert.equal(matchMail(mail('sim-ktr-900 bitte'),context).assignment.customerId,'K2');
});
test('Auftragsnummer und Kundennummer ordnen zu, Auftragsnummer liefert Auftrag und Einheit',()=>{
 const order=matchMail(mail('AW: SIM-SA-10002 Rückfrage'),context).assignment;
 assert.deepEqual([order.kind,order.customerId,order.orderNumber,order.objectId],['order','K2','SIM-SA-10002','u4']);
 assert.equal(matchMail(mail('Termin','Kundennummer SIM-K-300'),context).assignment.kind,'customer-number');
});
test('gemeinsamer Kostenträger braucht einen zweiten Hinweis, sonst nur Vorschlag',()=>{
 const withAddress=matchMail(mail('Störung KTR SIM-KTR-100','im Objekt Musterweg 12 fällt der Druck'),context).assignment;
 assert.deepEqual([withAddress.kind,withAddress.customerId,withAddress.objectId,withAddress.score],['cost-subject','K1','o1',92]);
 const alone=matchMail(mail('Störung KTR SIM-KTR-100'),context);
 assert.equal(alone.assignment,null);assert.equal(alone.suggestion.kind,'cost-body');assert.match(alone.suggestion.reason,/mehreren Kunden/);
});
test('gemeinsamer Kostenträger mit Adresse wiegt schwerer als ein gelernter Absender',()=>{
 const result=matchMail(mail('KTR SIM-KTR-100','Objekt Musterweg 12','verwaltung@hv-nord.example'),{...context,senders:[{address:'verwaltung@hv-nord.example',customerId:'K2'}]});
 assert.deepEqual([result.assignment.kind,result.assignment.customerId],['cost-subject','K1']);
});
test('bekannter Absender ordnet zu und ergänzt das Objekt über die Adresse',()=>{
 const result=matchMail(mail('Angebot','Haus Beispielstraße 8','Verwaltung@HV-Nord.example'),{...context,senders:[{address:'verwaltung@hv-nord.example',customerId:'K1'}]});
 assert.deepEqual([result.assignment.kind,result.assignment.customerId,result.assignment.objectId],['sender','K1','o2']);
});
test('Adresse oder Kundenname ergeben nur einen Vorschlag; Unbekanntes bleibt offen',()=>{
 const address=matchMail(mail('Wasser im Keller','Objekt Testallee 3. Wer kann kommen?'),context);
 assert.equal(address.assignment,null);assert.deepEqual([address.suggestion.kind,address.suggestion.customerId,address.suggestion.objectId],['address','K2','o3']);
 assert.equal(matchMail(mail('Frage','Gruß vom Musterwerk West'),context).suggestion.kind,'name');
 assert.deepEqual(matchMail(mail('Fachtagung','Jetzt anmelden'),context),{assignment:null,suggestion:null});
});
test('Kunden außerhalb des Zuordnungsbestands werden nie vorgeschlagen',()=>{
 const result=matchMail(mail('KTR SIM-KTR-777'),{...context,costs:[{number:'SIM-KTR-777',objectIds:['fremd']}]});
 assert.deepEqual(result,{assignment:null,suggestion:null});
});
test('Einordnung und Dringlichkeit für Kennzeichen',()=>{
 assert.equal(categorize({subject:'Arbeitsnachweis SIM-SA-1',body:'unterschrieben',from:'',attachments:1}),'return');
 assert.equal(categorize({subject:'Arbeitsnachweis',body:'',from:'',attachments:0}),'other');
 assert.equal(categorize({subject:'Termin verschieben',body:'',from:'',attachments:0}),'appointment');
 assert.equal(categorize({subject:'Angebot Speichertausch',body:'',from:'',attachments:0}),'quote');
 assert.equal(categorize({subject:'Rechnung 2026-1',body:'',from:'',attachments:1}),'supplier');
 assert.equal(categorize({subject:'Heizung defekt',body:'',from:'',attachments:0}),'fault');
 assert.equal(urgent('Bitte heute noch kommen'),true);assert.equal(urgent('Nächste Woche reicht'),false);
});
test('Beispielpostfach ist fiktiv und vollständig',()=>{
 const messages=simulatorMessages(Date.parse('2026-11-20T12:00:00Z'));
 assert.equal(new Set(messages.map(item=>item.id)).size,messages.length);
 for(const item of messages){assert.match(item.from.address,/\.example$/);assert.ok(item.subject&&item.body&&Number.isFinite(Date.parse(item.receivedAt)));}
});
