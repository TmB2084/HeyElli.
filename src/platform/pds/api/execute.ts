import type {ServicePosition} from "./workflows.ts";
import {assignBearbeiter,type PdsActor} from "./bearbeiter.ts";
import type {PdsTransport} from "./protocol.ts";
import {PdsProtocolError} from "./protocol.ts";
function response(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||!("uuid" in value)||typeof value.uuid!=="string")throw new PdsProtocolError("PDS liefert keine gültige UUID.");return value as Record<string,unknown>;}
export async function createContact(api:PdsTransport,input:{name:string;customerUUID:string;functionName:string;landline:string;mobile:string},roleMode:"simulator-dual"|"unconfirmed"="unconfirmed") {
  if(roleMode!=="simulator-dual")throw new PdsProtocolError("PDS-Rollenfeld eKommunikationswege/ekommunikationswege vor Echtnutzung klären.");
  const functions=await api.request("GET","/person/listfunktionen") as {uuid:string;bezeichnung:string}[];
  const job=functions.find(item=>item.bezeichnung===input.functionName);if(!job)throw new PdsProtocolError("Funktion ist nicht in der PDS-Funktionsliste vorhanden.");
  const person=response(await api.request("POST","/person/create",{name:input.name,typ:"PRIVATPERSON"}));
  const communications:string[]=[];
  for(const [typ,value]of [["FESTNETZ",input.landline],["MOBIL",input.mobile]])if(value)communications.push(String(response(await api.request("POST","/person/createEKommunikationsweg",{personUUID:person.uuid,ekommunikationswegDaten:{typ,kategorie:"GESCHAEFTLICH",value}})).uuid));
  await api.request("POST","/person/addansprechpartnerrolle",{uuid:person.uuid,ansprechpartnerBeiUUID:input.customerUUID,funktionUUID:job.uuid,eKommunikationswege:communications,ekommunikationswege:communications});
  return String(person.uuid);
}
export async function createService(api:PdsTransport,input:{customerUUID:string;objectUUID:string;description:string;externalNumber:string;reportedAt:string;technicianId:string;companions:string[];mobileIssue?:boolean;start?:string;end?:string;positions?:ServicePosition[]},template:string,actor:PdsActor,document?:{name:string;bytes:Uint8Array;typeUUID:string}) {
  if(input.mobileIssue===true&&!input.technicianId)throw new PdsProtocolError("Mobile Ausgabe benötigt einen Haupttechniker.");
  const service=response(await api.request("POST","/service/create",{context:{vorgangsVorlageName:template},vorgangsdaten:assignBearbeiter({personUUID:input.customerUUID,externeNummer:input.externalNumber,belegDatum:input.reportedAt.slice(0,10),texte:{technischeVormerkung:input.description}},actor)}));
  if(typeof service.vorgangsNummer!=="string" || !service.vorgangsNummer)throw new PdsProtocolError("PDS liefert keine Serviceauftragsnummer.");
  const incident=response(await api.request("POST","/service/createstoerung",{serviceauftragUUID:service.uuid,objektUUID:input.objectUUID,auszufuehrendeArbeiten:input.description,...(input.technicianId?{hauptmonteurUUID:input.technicianId,weiteremonteureUUIDs:input.companions,startZeitpunkt:input.start,...(input.end?{endZeitpunkt:input.end}:{})}:{})}));
  for(const position of input.positions??[])response(await api.request("POST","/service/createposition",{uuid:incident.uuid,position:{apiID:"standard:"+position.id,katalogUUID:position.articleId,name:position.name,positionsTyp:position.type,positionsArt:"NORMAL",nummer:position.number,menge:position.quantity}}));
  let documentUUID:string|undefined;
  if(document){
    const form=new FormData();form.set("file",new Blob([new Uint8Array(document.bytes)]),document.name);form.set("dokumententypUUID",document.typeUUID);form.set("referenzVorgangUUIDOpt",String(service.uuid));form.set("referenzVorgangtypOpt","SERVICEAUFTRAG");
    documentUUID=String(response(await api.request("POST","/dokument/uploaddokument",form)).uuid);
  }
  if(input.mobileIssue??Boolean(input.technicianId))await api.request("POST","/service/mobilausgeben",{uuid:service.uuid,auftragspool:false});
  return {uuid:String(service.uuid),number:service.vorgangsNummer,stoerungUUID:String(incident.uuid),...(documentUUID?{documentUUID}:{})};
}
