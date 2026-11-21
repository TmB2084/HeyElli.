import {assignBearbeiter,type PdsActor} from "./bearbeiter.ts";
import {validateRequest,PdsProtocolError} from "./protocol.ts";
export type ServicePosition={id:string;articleId:string;name:string;type:"ARTIKEL"|"ARTIKEL_INKL_LOHN";number:string;quantity:number};
export type ApiCall={method:"POST"|"GET";path:string;body?:unknown};
export function serviceWorkflow(input:{customerUUID:string;objectUUID:string;description:string;externalNumber:string;reportedAt:string;technicianId:string;companions:string[];mobileIssue?:boolean;start?:string;end?:string;positions?:ServicePosition[]},template:string,actor?:PdsActor) {
  if(input.mobileIssue===true&&!input.technicianId)throw new PdsProtocolError("Mobile Ausgabe benötigt einen Haupttechniker.");
  const data={personUUID:input.customerUUID,externeNummer:input.externalNumber,belegDatum:input.reportedAt.slice(0,10),texte:{technischeVormerkung:input.description}};
  const calls:ApiCall[]=[{method:"POST",path:"/service/create",body:{context:{vorgangsVorlageName:template},vorgangsdaten:actor ? assignBearbeiter(data,actor) : data}},
    {method:"POST",path:"/service/createstoerung",body:{serviceauftragUUID:"$service.uuid",objektUUID:input.objectUUID,auszufuehrendeArbeiten:input.description,...(input.technicianId ? {hauptmonteurUUID:input.technicianId,weiteremonteureUUIDs:input.companions,startZeitpunkt:input.start,...(input.end?{endZeitpunkt:input.end}:{})} : {})}}];
  for(const position of input.positions??[])calls.push({method:"POST",path:"/service/createposition",body:{uuid:"$incident.uuid",position:{apiID:"standard:"+position.id,katalogUUID:position.articleId,name:position.name,positionsTyp:position.type,positionsArt:"NORMAL",nummer:position.number,menge:position.quantity}}});
  if(input.mobileIssue??Boolean(input.technicianId))calls.push({method:"POST",path:"/service/mobilausgeben",body:{uuid:"$service.uuid",auftragspool:false}});
  calls.forEach(call=>validateRequest(call.method,call.path,call.body));
  return calls;
}
export function personWorkflow(input:{name:string;customerUUID:string;phones:{label:string;number:string}[];functionUUID:string}) {
  const calls:ApiCall[]=[{method:"POST",path:"/person/create",body:{name:input.name,typ:"PRIVATPERSON"}}];
  input.phones.forEach(phone=>calls.push({method:"POST",path:"/person/createEKommunikationsweg",body:{personUUID:"$person.uuid",ekommunikationswegDaten:{typ:phone.label.toLowerCase().includes("mobil")?"MOBIL":"FESTNETZ",kategorie:"GESCHAEFTLICH",value:phone.number}}}));
  // OpenAPI typo: required eKommunikationswege differs from property ekommunikationswege.
  // Do not invent a payload for the role write until clarified with PDS.
  calls.forEach(call=>validateRequest(call.method,call.path,call.body));
  return {calls,pendingRole:{path:"/person/addansprechpartnerrolle",ansprechpartnerBeiUUID:input.customerUUID,funktionUUID:input.functionUUID},blockedBy:"OPENAPI_ROLE_COMMUNICATION_FIELD_CASING"};
}
