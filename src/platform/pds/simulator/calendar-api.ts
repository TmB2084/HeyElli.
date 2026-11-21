import references from "../../../../database/seeds/pds-simulator/calendar-references.json" with {type:"json"};
import seed from "../../../../database/seeds/pds-simulator/calendar.json" with {type:"json"};
import {serviceRecords,serviceCalendarId,planningTeam} from "./read-services.ts";
import {employees,objects,units} from "./fixtures.ts";
import {CalendarError,checkCreate,checkOptions,berlinWall,checkRange,fallbackColors} from "../../../apps/planboard/kalender/domain.ts";
import {InvalidOrder,type openOrderStore} from "./order-store.ts";
type Store=ReturnType<typeof openOrderStore>;
export function calendarRecords(store:Store){
  const rows=new Map<string,Record<string,unknown>>(seed.map(entry=>[entry.uuid,entry]));
  for(const service of serviceRecords(store))for(const incident of service.rootEbene.ebenen){
    if(!incident.hauptmonteurUUID||!incident.startZeitpunkt)continue;
    const end=incident.endZeitpunkt??new Date(Date.parse(incident.startZeitpunkt)+60*60000).toISOString();
    const companions=incident.weiteremonteureUUIDs??[];
    const uuid=serviceCalendarId(incident.uuid);
    rows.set(uuid,{uuid,bezeichnung:`${service.vorgangsNummer} · ${[...objects,...units].find(item=>item.id===incident.objektUUID)?.name??"Serviceauftrag"}${incident.endZeitpunkt?"":" · vorläufig 60 Min."}`,startZeitpunkt:incident.startZeitpunkt,endZeitpunkt:end,mitarbeiterUUIDs:[incident.hauptmonteurUUID,...companions],status:"GEPLANT",typ:"SERVICEAUFTRAGEBENE",fix:false,ganzerTag:false,kategorien:[],vorgangUUID:service.uuid,vorgangstyp:"SERVICEAUFTRAG",objektUUID:incident.objektUUID,text:`${incident.auszufuehrendeArbeiten}${incident.endZeitpunkt?"":"\nVorläufige Dauer: 60 Minuten (keine Endzeit hinterlegt)."}`});
    const textOverride=store.apiEntity(`calendar-text:${uuid}`);if(textOverride?.kind==="calendar-text")rows.set(uuid,{...rows.get(uuid),...textOverride.data});
  }
  for(const record of store.apiEntities("calendar-event")){
    if(record.data.typ==="SERVICEAUFTRAGEBENE"&&rows.has(record.uuid))continue;
    rows.set(record.uuid,{...record.data,uuid:record.uuid});
  }
  const deleted=new Set(store.apiEntities("calendar-deletion").map(record=>record.data.targetUUID));
  return [...rows.values()].filter(row=>!deleted.has(row.uuid)).map(row=>{
    const address=row.anschrift as Record<string,unknown>|undefined;
    if(!address?.urPostkommunikationswegUUID)return row;
    const {urPostkommunikationswegUUID,...fields}=address;
    return {...row,anschrift:{...fields,uuid:String(row.uuid)+"-address",urPostkommunikationsweg:{uuid:urPostkommunikationswegUUID}}};
  });
}
export function calendarRequest(store:Store,path:string,input:Record<string,unknown>,workflow?:string):unknown {
  const writable=!!workflow;
  if(path==="/termin/create"){
    if(!workflow)throw new CalendarError("Schreibzugriff erfordert einen Simulator-Workflow.",403);

    const checked=checkCreate({title:input.bezeichnung,start:input.startZeitpunkt,end:input.endZeitpunkt,resourceIds:input.mitarbeiterUUIDs,notes:input.text??"",type:input.typ,referenceId:input.typ==="PROJEKT"?input.projektUUID:input.vorgangUUID,referenceType:input.vorgangtyp,options:{status:input.status,allDay:input.ganzerTag??false,fixed:input.fix??false,pimSync:input.pimSynchronisation??false,categories:input.kategorienUUIDs??[],objectId:input.objektUUID??"",...(input.anschrift?{address:input.anschrift}:{})}});
    if(checked.resourceIds.some(id=>!employees.some(employee=>employee.id===id&&employee.plannable)))throw new CalendarError("Ungültige Ressourcen.");
    validateNativeOptions(input);
    if(input.ganzerTag===true&&(berlinWall(checked.start).slice(11)!=="00:00"||berlinWall(checked.end).slice(11)!=="00:00"||Date.parse(checked.start)%60000!==0||Date.parse(checked.end)%60000!==0))throw new CalendarError("Ganztag benötigt Tagesgrenzen.");
    if(checked.type==="PROJEKT"&&!references.projects.some(item=>item.uuid===checked.referenceId))throw new CalendarError("Projektakte nicht gefunden.");
    if(checked.type==="VORGANG"&&!references.transactions.some(item=>item.uuid===checked.referenceId&&item.vorgangstyp===checked.referenceType))throw new CalendarError("Vorgang nicht gefunden.");
    const data={bezeichnung:checked.title,startZeitpunkt:checked.start,endZeitpunkt:checked.end,mitarbeiterUUIDs:checked.resourceIds,text:checked.notes,typ:input.typ,status:input.status,fix:input.fix??false,ganzerTag:input.ganzerTag??false,pimSynchronisation:input.pimSynchronisation??false,kategorien:input.kategorienUUIDs??[],objektUUID:input.objektUUID??"",...(input.anschrift?{anschrift:input.anschrift}:{}),...(input.vorgangUUID?{vorgangUUID:input.vorgangUUID,vorgangstyp:input.vorgangtyp}:{}),...(input.projektUUID?{projektUUID:input.projektUUID}:{})};
    try{const saved=store.apiStep(workflow,path,data,()=>store.apiCreate("calendar-event",data));return calendarRecords(store).find(row=>row.uuid===(saved as Record<string,unknown>).uuid);}
    catch(error){if(error instanceof InvalidOrder)throw new CalendarError("Diese Anlageanfrage wurde bereits mit anderen Daten verwendet.",409);throw error;}
  }
  const rows=calendarRecords(store);
  const get=(uuid:unknown)=>{const found=rows.find(row=>row.uuid===uuid);if(!found)throw new CalendarError("Termin wurde nicht gefunden.",404);return found;};
  if(path==="/termin/delete"){
    if(!writable)throw new CalendarError("Schreibzugriff erfordert einen Simulator-Workflow.",403);
    const old=get(input.uuid);if(old?.fix===true)throw new CalendarError("Fixierte Termine können nicht gelöscht werden.",409);
    store.apiPut(`calendar-deleted:${String(old.uuid)}`,"calendar-deletion",{targetUUID:old.uuid});
    return null;
  }
  if(path==="/termin/details")return get(input.uuid);
  if(path==="/termin/detailsbatch"){
    if(!Array.isArray(input.uuids)||input.uuids.length>1000||input.uuids.some(id=>typeof id!=="string"))throw new CalendarError("Ungültige Terminliste.");return input.uuids.map(get);
  }
  if(path==="/termin/listkategorien")return references.categories.map(category=>{
    const label=store.apiEntity(`category-label:${category.uuid}`);
    return {...category,...(label?.kind==="category-label"?{bezeichnung:String(label.data.bezeichnung)}:{})};
  });
  if(path==="/termin/listplanung"||path==="/termin/listterminebymitarbeiter"){
    const range=input.zeitraum as {vonDatum:string;bisDatum:string};if(!range)throw new CalendarError("Zeitraum fehlt.");checkRange(range.vonDatum,range.bisDatum);
    const ids=path.endsWith("listplanung")?input.mitarbeiterUUIDs:[input.mitarbeiterUUID];if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>!employees.some(employee=>employee.id===id)))throw new CalendarError("Ungültige Ressourcen.");
    const formatter=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"});
    const matches=rows.filter(row=>(row.mitarbeiterUUIDs as string[]).some(id=>ids.includes(id))&&formatter.format(new Date(String(row.startZeitpunkt)))<=range.bisDatum&&formatter.format(new Date(Date.parse(String(row.endZeitpunkt))-1))>=range.vonDatum);
    const page=input.page??0,size=input.entriesPerPage??500;if(!Number.isInteger(page)||!Number.isInteger(size)||Number(size)<1||Number(size)>1000||Number(page)<0)throw new CalendarError("Ungültige Paginierung.");
    return {totalHitCount:matches.length,resultList:matches.slice(Number(page)*Number(size),(Number(page)+1)*Number(size))};
  }
  if(path==="/termin/update"){
    if(!writable)throw new CalendarError("Schreibzugriff erfordert einen Simulator-Workflow.",403);
    const old=get(input.uuid);if(old.fix===true&&(input.fix!==false||Object.keys(input).some(key=>!["uuid","fix"].includes(key))))throw new CalendarError("Bitte zuerst ausschließlich die Fixierung aufheben.",409);
    validateNativeOptions(input);
    if(input.bezeichnung!==undefined&&(typeof input.bezeichnung!=="string"||!input.bezeichnung.trim()||input.bezeichnung.length>200))throw new CalendarError("Ungültiger Termintitel.");
    if(input.text!==undefined&&(typeof input.text!=="string"||input.text.length>4000))throw new CalendarError("Ungültige Terminbeschreibung.");
    const updated:Record<string,unknown>={...old,...input,...(input.kategorienUUIDs!==undefined?{kategorien:input.kategorienUUIDs}:{})};
    const start=Date.parse(String(updated.startZeitpunkt)),end=Date.parse(String(updated.endZeitpunkt));
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>62*86400000)throw new CalendarError("Ungültiger Zeitraum.");
    if(updated.ganzerTag===true&&(berlinWall(String(updated.startZeitpunkt)).slice(11)!=="00:00"||berlinWall(String(updated.endZeitpunkt)).slice(11)!=="00:00"||start%60000!==0||end%60000!==0))throw new CalendarError("Ganztag benötigt Tagesgrenzen.");
    const ids=updated.mitarbeiterUUIDs;
    if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!employees.some(employee=>employee.id===id&&employee.plannable)))throw new CalendarError("Ungültige Ressourcen.");
    if(old.typ==="SERVICEAUFTRAGEBENE"&&["bezeichnung","text","status","fix","ganzerTag","pimSynchronisation","kategorienUUIDs","objektUUID","anschrift"].some(key=>input[key]!==undefined)){
      const id=`calendar-text:${String(old.uuid)}`,previous=store.apiEntity(id);
      const values=Object.fromEntries(["bezeichnung","text","status","fix","ganzerTag","pimSynchronisation","objektUUID","anschrift"].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]));
      store.apiPut(id,"calendar-text",{...(previous?.data??{}),...values,...(input.kategorienUUIDs!==undefined?{kategorien:input.kategorienUUIDs}:{})});
      if(input.startZeitpunkt===undefined&&input.endZeitpunkt===undefined&&input.mitarbeiterUUIDs===undefined)return calendarRecords(store).find(row=>row.uuid===old.uuid);
    }
    if(old.typ==="SERVICEAUFTRAGEBENE"&&String(old.uuid).startsWith("sim-service-termin-")){
      const incidentUUID=String(old.uuid).slice("sim-service-termin-".length),incident=store.apiEntity(incidentUUID);
      if(incident?.kind==="incident"){
        const team=planningTeam(incident.data.hauptmonteurUUID,incident.data.weiteremonteureUUIDs,updated);
        store.apiUpdate(incidentUUID,{...incident.data,...team,startZeitpunkt:updated.startZeitpunkt,endZeitpunkt:updated.endZeitpunkt});
        return calendarRecords(store).find(row=>row.uuid===old.uuid);
      }
    }
    store.apiPut(String(old.uuid),"calendar-event",updated);
    return calendarRecords(store).find(row=>row.uuid===old.uuid);
  }
  throw new CalendarError("Terminoperation noch nicht simuliert.",501);
}
export const calendarColorView={uuid:"sim-view-calendar-colors",name:"sim_calendar_colors",beschreibung:"Fiktive Kalender-Farbbelegung, kein bestätigter PDS-Viewname",columns:[{uuid:"sim-color-status",name:"status",typeName:"TEXT"},{uuid:"sim-color-type",name:"typ",typeName:"TEXT"},{uuid:"sim-color-value",name:"farbe",typeName:"TEXT"}]};
export const calendarColors=fallbackColors;

// Explicit service-level role write. One state change; no workflow-step cache for edits.
export function updateServicePlanning(store:Store,input:Record<string,unknown>,writable:boolean){
  if(!writable)throw new CalendarError("Schreibzugriff erfordert eine Sitzung.",403);
  if(Object.keys(input).some(key=>!["uuid","startZeitpunkt","endZeitpunkt","hauptmonteurUUID","weiteremonteureUUIDs"].includes(key)))throw new CalendarError("Dieses Störungsfeld wird noch nicht simuliert.",501);
  const incident=serviceRecords(store).flatMap(service=>service.rootEbene.ebenen).find(item=>item.uuid===input.uuid);
  if(!incident)throw new CalendarError("Störung nicht gefunden.",404);
  const old=calendarRecords(store).find(item=>item.uuid===serviceCalendarId(incident.uuid));

  if(old?.fix===true)throw new CalendarError("Termin ist fixiert.",409);
  if((input.hauptmonteurUUID!==undefined||input.weiteremonteureUUIDs!==undefined)&&(input.hauptmonteurUUID===undefined||input.weiteremonteureUUIDs===undefined))throw new CalendarError("Bei Monteuränderungen sind Hauptmonteur und weitere Monteure gemeinsam erforderlich.");
  const main=input.hauptmonteurUUID??incident.hauptmonteurUUID,companions=input.weiteremonteureUUIDs??incident.weiteremonteureUUIDs??[];
  if(typeof main!=="string"||!employees.some(item=>item.id===main&&item.plannable)||!Array.isArray(companions)||companions.length>100||new Set(companions).size!==companions.length||companions.some(id=>id===main||!employees.some(item=>item.id===id&&item.plannable)))throw new CalendarError("Ungültige Haupt-/Begleittechniker.");
  const start=input.startZeitpunkt??old?.startZeitpunkt,end=input.endZeitpunkt??old?.endZeitpunkt;
  const duration=Date.parse(String(end))-Date.parse(String(start));
  if(!Number.isFinite(duration)||duration<15*60000||duration>62*86400000)throw new CalendarError("Ungültige Einsatzzeit.");
  const entity=store.apiEntity(incident.uuid);
  if(entity?.kind==="incident")store.apiUpdate(incident.uuid,{...entity.data,hauptmonteurUUID:main,weiteremonteureUUIDs:companions,startZeitpunkt:start,endZeitpunkt:end});
  else store.apiPut(serviceCalendarId(incident.uuid),"calendar-event",{...(old??{uuid:serviceCalendarId(incident.uuid),bezeichnung:incident.auszufuehrendeArbeiten,typ:"SERVICEAUFTRAGEBENE",status:"GEPLANT",fix:false,ganzerTag:false,text:incident.auszufuehrendeArbeiten,objektUUID:incident.objektUUID}),startZeitpunkt:start,endZeitpunkt:end,hauptmonteurUUID:main,weiteremonteureUUIDs:companions,mitarbeiterUUIDs:[main,...companions]});
  return serviceRecords(store).flatMap(service=>service.rootEbene.ebenen).find(item=>item.uuid===incident.uuid);
}

function validateNativeOptions(input:Record<string,unknown>){
 const options=checkOptions({status:input.status,allDay:input.ganzerTag,fixed:input.fix,pimSync:input.pimSynchronisation,categories:input.kategorienUUIDs,objectId:input.objektUUID,...(input.anschrift?{address:input.anschrift}:{})});
 if(options.categories?.some(id=>!references.categories.some(item=>item.uuid===id)))throw new CalendarError("Kategorie nicht gefunden.");
 if(options.objectId&&![...objects,...units].some(item=>item.id===options.objectId))throw new CalendarError("Objekt nicht gefunden.");
 if(options.address&&!objects.some(item=>item.id+"-address"===options.address!.urPostkommunikationswegUUID))throw new CalendarError("Anschriftenreferenz nicht gefunden.");
}
