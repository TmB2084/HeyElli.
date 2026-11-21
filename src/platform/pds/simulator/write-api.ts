import {createHash} from "node:crypto";
import {objects,units,employees} from "./fixtures.ts";
import type {openOrderStore} from "./order-store.ts";
import {MAX_DOCUMENT_BYTES} from "./document.ts";
import {validateRequest,type PdsTransport} from "../api/index.ts";
type Store=ReturnType<typeof openOrderStore>;
export class SimulatedWriteApi implements PdsTransport {
  constructorStore:Store;workflow:string;
  constructor(store:Store,workflow:string){this.constructorStore=store;this.workflow=workflow;}
  async request(method:"GET"|"POST",path:string,body?:unknown):Promise<unknown> {
    validateRequest(method,path,body);
    const store=this.constructorStore;
    if(path==="/dokument/listexternedokumententypen")return [{uuid:"sim-document-general",bezeichnung:"SIM-Allgemein"}];
    if(path==="/person/listfunktionen")return [...new Set([...store.allPersons().map(person=>person.function),"Hausmeister","Haustechnik","Objektverwaltung","Verwaltung","Empfang","Ansprechpartner"])].map(name=>({uuid:name,bezeichnung:name}));
    if(method!=="POST")throw Error("Schreiboperation erwartet POST.");
    let data=(body??{}) as Record<string,unknown>,bytes:Uint8Array|null=null;
    if(path==="/dokument/uploaddokument") {
      if(!(body instanceof FormData))throw Error("Multipart erwartet.");
      const file=body.get("file");if(!(file instanceof Blob)||file.size<1||file.size>MAX_DOCUMENT_BYTES)throw Error("Ungültige Datei.");
      if(body.get("referenzVorgangtypOpt")!=="SERVICEAUFTRAG"||body.get("dokumententypUUID")!=="sim-document-general")throw Error("Ungültige Dokumentreferenz.");
      bytes=new Uint8Array(await file.arrayBuffer());
      data={name:file instanceof File?file.name:"Dokument",referenzVorgangUUIDOpt:body.get("referenzVorgangUUIDOpt"),dokumententypUUID:body.get("dokumententypUUID"),sha256:createHash("sha256").update(bytes).digest("hex")};
    }
    const entity=(uuid:unknown,kind:string)=>{const found=store.apiEntity(String(uuid));if(!found||found.kind!==kind)throw Error("PDS-Referenz fehlt: "+kind);return found;};
    const step=path==="/service/createposition"?`${path}:${String((data.position as Record<string,unknown>)?.apiID)}`:path==="/person/createEKommunikationsweg"?`${path}:${String((data.ekommunikationswegDaten as Record<string,unknown>)?.typ)}`:path;
    return store.apiStep(this.workflow,step,data,()=>{
      switch(path){
        case "/person/create":return store.apiCreate("person",{name:data.name,typ:data.typ});
        case "/person/createEKommunikationsweg":entity(data.personUUID,"person");return store.apiCreate("communication",{personUUID:data.personUUID,...data.ekommunikationswegDaten as object});
        case "/person/addansprechpartnerrolle":{
          const person=entity(data.uuid,"person");
          if(!objects.some(object=>object.customerNumber===data.ansprechpartnerBeiUUID))throw Error("Kunde unbekannt.");
          const refs=data.ekommunikationswege as string[];
          if(!Array.isArray(refs)||refs.some(uuid=>entity(uuid,"communication").data.personUUID!==data.uuid))throw Error("Kommunikationsweg gehört nicht zur Person.");
          store.apiUpdate(person.uuid,{...person.data,customerUUID:data.ansprechpartnerBeiUUID,functionUUID:data.funktionUUID});
          return {uuid:person.uuid};
        }
        case "/service/create":{
          const values=data.vorgangsdaten as Record<string,unknown>;
          if(!objects.some(object=>object.customerNumber===values.personUUID))throw Error("Auftragskunde unbekannt.");
          return store.apiCreate("service",values);
        }
        case "/service/createstoerung":{
          entity(data.serviceauftragUUID,"service");
          if(![...objects,...units].some(item=>item.id===data.objektUUID))throw Error("Objekt unbekannt.");
          if(data.hauptmonteurUUID && !employees.some(item=>item.id===data.hauptmonteurUUID&&item.plannable))throw Error("Monteur ungültig.");
          const companions=data.weiteremonteureUUIDs??[];
          if(!Array.isArray(companions)||new Set(companions).size!==companions.length||companions.some(id=>id===data.hauptmonteurUUID||!employees.some(employee=>employee.id===id&&employee.plannable))||(!data.hauptmonteurUUID&&companions.length))throw Error("Begleitende Monteure ungültig.");
          if(data.startZeitpunkt && !Number.isFinite(Date.parse(String(data.startZeitpunkt))))throw Error("Ungültiger Beginn.");
          if(data.endZeitpunkt && (!data.startZeitpunkt||!Number.isFinite(Date.parse(String(data.endZeitpunkt)))||Date.parse(String(data.endZeitpunkt))<=Date.parse(String(data.startZeitpunkt))))throw Error("Ungültiges Ende.");
          return store.apiCreate("incident",data);
        }
        case "/service/createposition":{const incident=entity(data.uuid,"incident"),position=data.position as Record<string,unknown>;if(typeof position.apiID!=="string"||!position.apiID.startsWith('standard:'))throw Error("Positionskennung fehlt.");const created=store.apiCreate("service-position",{...position,incidentUUID:incident.uuid});store.apiUpdate(incident.uuid,{...incident.data,positionen:[...(Array.isArray(incident.data.positionen)?incident.data.positionen:[]),created]});return created;}
        case "/service/mobilausgeben":{const service=entity(data.uuid,"service");return store.apiUpdate(service.uuid,{...service.data,mobilAusgegeben:true,auftragspool:data.auftragspool});}
        case "/dokument/uploaddokument":entity(data.referenzVorgangUUIDOpt,"service");return store.apiCreate("document",data,bytes);
        default:throw Error("Schreibendpunkt nicht implementiert.");
      }
    });
  }
}
