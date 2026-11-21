import type {MailMessage} from './model.ts';
// Fiktives geteiltes Postfach für Entwicklung und Tests. Ausschließlich erfundene Namen, Adressen und Inhalte.
type Seed={id:string;minutes:number;from:[string,string];subject:string;body:string;attachments?:[string,number,string][];read?:boolean};
const seeds:Seed[]=[
 {id:'sim-mail-01',minutes:38,from:['Hausverwaltung Nord','verwaltung@hv-nord.example'],subject:'Störung Heizung – KTR SIM-KTR-100',body:'Guten Morgen,\n\nim Objekt Musterweg 12 fällt seit heute Nacht der Druck der Heizungsanlage unter 1 bar, der Kessel geht regelmäßig in Störung. Die Mieter haben kein Warmwasser.\n\nBitte um einen kurzfristigen Termin, möglichst heute noch. Zugang über den Hausmeister, Schlüssel im Büro EG.\n\nFreundliche Grüße\nHausverwaltung Nord',attachments:[['Foto_Manometer.jpg',1240000,'image/jpeg'],['Fehlerprotokoll.pdf',84000,'application/pdf']]},
 {id:'sim-mail-02',minutes:65,from:['Musterwerk West · Leitstand','leitstand@musterwerk.example'],subject:'AW: SIM-SA-10002 Rückfrage Melder 12',body:'Hallo,\n\ndanke für die schnelle Hilfe gestern. Der Melder 12 im Lager hat heute früh erneut ausgelöst. Das Protokoll der Zentrale hängt an.\n\nViele Grüße\nLeitstand Musterwerk West',attachments:[['BMZ-Protokoll.txt',3200,'text/plain']]},
 {id:'sim-mail-03',minutes:82,from:['K. Beispiel','k.beispiel@mail.example'],subject:'Wasser in der Technikzentrale',body:'Hallo, bei uns steht Wasser im Keller unter dem Speicher. Objekt Testallee 3. Wer kann kommen?'},
 {id:'sim-mail-04',minutes:140,from:['Kim Muster','kim.muster@service-beispiel.example'],subject:'Arbeitsnachweis SIM-SA-10001 unterschrieben',body:'Anbei der unterschriebene Arbeitsnachweis zur Heizungsanlage. Druck wieder bei 1,6 bar, Ausdehnungsgefäß nachgefüllt.',attachments:[['Arbeitsnachweis_SIM-SA-10001.pdf',210000,'application/pdf']],read:true},
 {id:'sim-mail-05',minutes:60*20,from:['Demohaus Verwaltung','info@demohaus.example'],subject:'Wartungstermin bestätigen – Kd.-Nr. SIM-K-300',body:'Der vorgeschlagene Termin am Montag passt uns. Zugang bitte über den Hausmeister, Herrn Beispiel.',read:true},
 {id:'sim-mail-06',minutes:60*22,from:['Lieferant Beispiel GmbH','rechnung@lieferant.example'],subject:'Rechnung 2026-1180',body:'Sehr geehrte Damen und Herren,\n\nanbei unsere Rechnung für die Lieferung vom 12.11.2026.',attachments:[['Rechnung_2026-1180.pdf',96000,'application/pdf']],read:true},
 {id:'sim-mail-07',minutes:60*23,from:['Hausverwaltung Nord','verwaltung@hv-nord.example'],subject:'Angebot Speichertausch',body:'Wir bitten um ein Angebot für den Austausch des Warmwasserspeichers im Haus Beispielstraße 8.',read:true},
 {id:'sim-mail-08',minutes:60*26,from:['Musterwerk West · Leitstand','leitstand@musterwerk.example'],subject:'Termin verschieben – Kundennummer SIM-K-200',body:'Können wir den Termin für die Prüfung der Sicherheitsbeleuchtung auf nächste Woche verschieben? Am Freitag ist das Werk geschlossen.',read:true},
 {id:'sim-mail-09',minutes:60*30,from:['Fachverband Beispiel','newsletter@fachverband.example'],subject:'Einladung Fachtagung Brandschutz 2027',body:'Melden Sie sich jetzt zur Fachtagung an. Themen: Normänderungen, Prüffristen, Praxisberichte.',read:true},
];
export function simulatorMessages(now=Date.now()):MailMessage[]{
 return seeds.map(seed=>({id:seed.id,receivedAt:new Date(now-seed.minutes*60000).toISOString(),from:{name:seed.from[0],address:seed.from[1]},to:[{name:'Service',address:'service@heyelli.example'}],
  subject:seed.subject,preview:seed.body.replace(/\s+/g,' ').slice(0,180),body:seed.body,unread:!seed.read,conversationId:seed.id,
  attachments:(seed.attachments??[]).map(([name,size,contentType],index)=>({id:`${seed.id}-a${index}`,name,size,contentType}))}));
}
export const simulatorMailbox='service@heyelli.example';
