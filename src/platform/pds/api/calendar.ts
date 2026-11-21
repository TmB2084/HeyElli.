import type {CalendarWrite} from '../../../apps/planboard/kalender/model.ts';
import {mergeCalendarEvents,CalendarConflictError} from "../../../apps/planboard/kalender/domain.ts";
import {readWorkingTime} from "./working-time.ts";
import {enrichVacationApprovals} from "./vacation-view.ts";
import type {PdsTransport} from "./protocol.ts";
import {PdsProtocolError} from "./protocol.ts";
import {readContinuation,continuationNotes,planningWarnings,applyOptions,contractFilterValues,contractMembership,incidentKey,type ContractFilter,statusScopeLabels,type StatusCatalog,type StatusScope,transactionTypes,berlinWall,CalendarError,checkChange,checkCreate,checkDeletion,checkRange,fallbackColors,readLegacyColorRules,checkOptions,eventOptions,optionKey,nativeOptions,type CalendarCategory,type CalendarReference,type CalendarOptions,type CalendarData,type CalendarEvent,type ResourceGroup,type Resource} from "../../../apps/planboard/kalender/domain.ts";
type RecordData=Record<string,unknown>;
function row(value:unknown):RecordData{if(!value||typeof value!=="object")throw new PdsProtocolError("Ungültige Kalenderantwort.");return value as RecordData;}
function orderStatus(value:unknown){
 if(value===undefined||value===null)return undefined;
 const status=row(value);if(typeof status.uuid!=="string"||!status.uuid||status.uuid.length>120||status.bezeichnung!==undefined&&typeof status.bezeichnung!=="string")throw new PdsProtocolError("Status-UUID fehlt in den Vorgangsdetails.");
 return {id:status.uuid,name:typeof status.bezeichnung==="string"?status.bezeichnung:status.uuid};
}
function event(value:unknown):CalendarEvent {
  const data=row(value);
  if(typeof data.uuid!=="string"||typeof data.startZeitpunkt!=="string"||typeof data.endZeitpunkt!=="string"||!Number.isFinite(Date.parse(data.startZeitpunkt))||!Number.isFinite(Date.parse(data.endZeitpunkt))||Date.parse(data.endZeitpunkt)<=Date.parse(data.startZeitpunkt)||!Array.isArray(data.mitarbeiterUUIDs)||data.mitarbeiterUUIDs.some(id=>typeof id!=="string")||!["GEPLANT","VORGEMERKT","FREI"].includes(String(data.status)))throw new PdsProtocolError("Unvollständige PDS-Termindaten.");
  const addressData=data.anschrift as RecordData|undefined,origin=addressData?.urPostkommunikationsweg as RecordData|undefined;
  const address=origin&&typeof origin.uuid==="string"?checkOptions({address:{...addressData,urPostkommunikationswegUUID:origin.uuid}}).address:undefined;
  const continuation=readContinuation(typeof data.text==="string"?data.text:"");
  return {id:data.uuid,...(continuation.link?{continuation:continuation.link}:{}),...(data.typ==="SERVICEAUFTRAGEBENE"?{contractService:"UNBEKANNT" as const}:{}),addressText:addressData?[addressData.name,addressData.strasse,addressData.plz,addressData.ort,addressData.land,addressData.zusatz].filter(Boolean).join(" · "):undefined,title:data.typ==="PRIVATE_ABWESENHEIT"?"Private Abwesenheit":String(data.bezeichnung??"Termin"),start:data.startZeitpunkt,end:data.endZeitpunkt,resourceIds:data.mitarbeiterUUIDs as string[],status:data.status as CalendarEvent["status"],type:continuation.link?.serviceCopy?"SERVICEAUFTRAGEBENE":String(data.typ??"FREIER"),pimSync:data.pimSynchronisation===true,objectId:typeof data.objektUUID==="string"?data.objektUUID:undefined,...(address?{address}:{}),notes:typeof data.text==="string"?continuation.notes:undefined,fixed:data.fix===true,allDay:data.ganzerTag===true,categories:Array.isArray(data.kategorien)?data.kategorien.filter((id):id is string=>typeof id==="string"):[]};
}
const locks=new Map<string,Promise<void>>();
async function exclusive<T>(key:string,run:()=>Promise<T>):Promise<T>{const previous=locks.get(key)??Promise.resolve();let release!:()=>void;const current=new Promise<void>(resolve=>{release=resolve;});locks.set(key,current);await previous;try{return await run();}finally{release();if(locks.get(key)===current)locks.delete(key);}}
export class PdsCalendar {
  private beforeSave?:(event:CalendarWrite,previous?:CalendarEvent)=>Promise<void>;
  private onSaved?:(before:CalendarEvent,after:CalendarEvent)=>Promise<void>;private api:PdsTransport;private colorView?:string;private vacationApprovalView?:string;private workingTimeView?:string;private simulatedColors:boolean;
  constructor(api:PdsTransport,options:{workingTimeView?:string;vacationApprovalView?:string;colorView?:string;simulatedColors?:boolean;beforeSave?:(event:CalendarWrite,previous?:CalendarEvent)=>Promise<void>;onSaved?:(before:CalendarEvent,after:CalendarEvent)=>Promise<void>}={}){this.api=api;this.beforeSave=options.beforeSave;this.onSaved=options.onSaved;this.workingTimeView=options.workingTimeView;this.vacationApprovalView=options.vacationApprovalView;this.colorView=options.colorView;this.simulatedColors=options.simulatedColors??false;}
  private async paged(path:string,body:RecordData,maximum=Infinity){
    const all:RecordData[]=[];
    for(let page=0;page<1000;page++){const data=row(await this.api.request("POST",path,{...body,page,entriesPerPage:500}));if(!Array.isArray(data.resultList)||typeof data.totalHitCount!=="number"||!Number.isSafeInteger(data.totalHitCount)||data.totalHitCount<0)throw new PdsProtocolError("Ungültige Kalender-Paginierung.");if(data.totalHitCount>maximum||all.length+data.resultList.length>maximum)throw new PdsProtocolError("Datenumfang der Kalenderprüfung überschritten.");all.push(...data.resultList.map(row));if(all.length>=data.totalHitCount)return all;if(!data.resultList.length)throw new PdsProtocolError("Unvollständige Kalender-Paginierung.");}
    throw new PdsProtocolError("Zu viele Kalenderseiten.");
  }
  // Calendar DTOs contain participants, but no reliable main/companion ordering.
  // Resolve the service level through the documented appointment lookup instead.
  private async withRoles(records:RecordData[]):Promise<CalendarEvent[]> {
    const events=records.map(event);
    for(const appointment of events.filter(value=>value.continuation?.serviceCopy)){
      const reference=appointment.continuation!;if(!reference.serviceId||!reference.incidentId||!reference.mainId||!appointment.resourceIds.includes(reference.mainId))throw new PdsProtocolError("Ungültige Service-Fortsetzungsreferenz.");
      const service=row(await this.api.request("POST","/service/details",{uuid:reference.serviceId})),root=row(service.rootEbene);
      if(!Array.isArray(root.ebenen)||!root.ebenen.some(value=>value.uuid===reference.incidentId))throw new PdsProtocolError("Störungsebene der Fortsetzung wurde nicht gefunden.");
      appointment.link={id:reference.serviceId,type:"SERVICEAUFTRAG",number:String(service.vorgangsNummer??""),name:String(service.bezeichnung??"")};appointment.orderStatus=orderStatus(service.vorgangStatus);appointment.serviceIncidentId=reference.incidentId;appointment.mainTechnicianId=reference.mainId;appointment.companionTechnicianIds=appointment.resourceIds.filter(id=>id!==reference.mainId);
      if(typeof service.personUUID==="string")appointment.customer={id:service.personUUID,name:service.personUUID};
    }
    const serviceIds=[...new Set(records.filter(record=>(record.typ==="SERVICEAUFTRAGEBENE"||record.vorgangstyp==="SERVICEAUFTRAG")&&typeof record.vorgangUUID==="string").map(record=>record.vorgangUUID as string))];
    for(const uuid of serviceIds){
      const service=row(await this.api.request("POST","/service/details",{uuid}));
      for(const appointment of events.filter(item=>records.some(record=>record.uuid===item.id&&record.vorgangUUID===uuid))){
        appointment.link={id:uuid,type:"SERVICEAUFTRAG",name:String(service.bezeichnung??"Serviceauftrag"),number:String(service.vorgangsNummer??"")};
        appointment.orderStatus=orderStatus(service.vorgangStatus);
        if(typeof service.personUUID==="string")appointment.customer={id:service.personUUID,name:service.personUUID};
      }
      const root=row(service.rootEbene);
      if(!Array.isArray(root.ebenen))throw new PdsProtocolError("Service-Störungsebenen fehlen für die Technikerrollen.");
      for(const value of root.ebenen){
        const incident=row(value);
        if(typeof incident.hauptmonteurUUID!=="string"||!incident.startZeitpunkt)continue;
        if(typeof incident.uuid!=="string"||!Array.isArray(incident.weiteremonteureUUIDs??[])||(incident.weiteremonteureUUIDs as unknown[]|undefined)?.some(id=>typeof id!=="string"))throw new PdsProtocolError("Ungültige Technikerrollen im Serviceauftrag.");
        const linked=row(await this.api.request("POST","/service/findstoerungtermin",{uuid:incident.uuid}));
        const appointment=events.find(item=>item.id===linked.uuid);
        if(!appointment)continue;
        appointment.serviceIncidentId=incident.uuid;
        if(appointment.resourceIds.includes(incident.hauptmonteurUUID))appointment.mainTechnicianId=incident.hauptmonteurUUID;
        appointment.companionTechnicianIds=((incident.weiteremonteureUUIDs??[]) as string[]).filter(id=>id!==appointment.mainTechnicianId&&appointment.resourceIds.includes(id));
      }
    }
    const planned=events.filter(appointment=>appointment.type==="SERVICEAUFTRAGEBENE"&&appointment.serviceIncidentId&&appointment.link?.type==="SERVICEAUFTRAG");
    if(planned.length){
      const memberships=new Map<string,Set<ContractFilter>>();
      for(const filter of contractFilterValues){
        const rows=await this.paged("/service/liststoerungen",{vertragsleistung:filter});
        for(const value of rows){const service=row(value.serviceAuftrag),incident=row(value.serviceAuftragEbene);if(typeof value.uuid!=="string"||typeof service.uuid!=="string"||typeof incident.uuid!=="string"||!service.uuid||!incident.uuid)throw new PdsProtocolError("Ungültiger Vertragsleistungsbezug.");const key=incidentKey(service.uuid,incident.uuid),set=memberships.get(key)??new Set<ContractFilter>();set.add(filter);memberships.set(key,set);}
      }
      for(const appointment of planned)appointment.contractService=contractMembership(memberships.get(incidentKey(appointment.link!.id,appointment.serviceIncidentId!))??new Set());
    }
    const cache=new Map<string,RecordData>();
    const get=async(path:string,body:RecordData)=>{const key=path+JSON.stringify(body);if(!cache.has(key)){const value=row(await this.api.request("POST",path,body));if(body.uuid&&value.uuid!==body.uuid)throw new PdsProtocolError("PDS-Referenz nicht gefunden.");cache.set(key,value);}return cache.get(key)!;};
    for(const appointment of events){
      const data=records.find(record=>record.uuid===appointment.id)!;
      if(!appointment.link&&typeof data.vorgangUUID==="string"&&typeof data.vorgangstyp==="string"&&Object.hasOwn(transactionTypes,data.vorgangstyp)){
        const detail=await get("/vorgang/details",{uuid:data.vorgangUUID,vorgangstyp:data.vorgangstyp});
        appointment.link={id:data.vorgangUUID,type:data.vorgangstyp,name:String(detail.bezeichnung??"Vorgang"),number:String(detail.vorgangsNummer??"")};
        appointment.orderStatus=orderStatus(detail.vorgangStatus);
        if(typeof detail.personUUID==="string")appointment.customer={id:detail.personUUID,name:detail.personUUID};
      }
      const projectId=typeof data.projektUUID==="string"?data.projektUUID:data.vorgangstyp==="PROJEKT"&&typeof data.vorgangUUID==="string"?data.vorgangUUID:undefined;
      if(!appointment.link&&projectId){
        const detail=await get("/projektakte/details",{uuid:projectId});
        appointment.link={id:projectId,type:"PROJEKT",name:String(detail.bezeichnung??"Projektakte"),number:String(detail.nummer??"")};
        appointment.orderStatus=orderStatus(detail.vorgangStatus);
        const person=detail.geschaeftspartner as RecordData|undefined;if(person&&typeof person.uuid==="string")appointment.customer={id:person.uuid,name:String(person.name??person.uuid)};
      }
      if(!appointment.link&&typeof data.vorgangUUID==="string")appointment.link={id:data.vorgangUUID,type:String(data.vorgangstyp??"UNBEKANNT"),name:"Vorgang (Details nicht dokumentiert)"};
      if(appointment.objectId){const object=await get("/objekt/details",{uuid:appointment.objectId});appointment.location=String(object.bezeichnung??appointment.objectId);if(!appointment.customer&&typeof object.personUUID==="string")appointment.customer={id:object.personUUID,name:object.personUUID};const address=object.standort as RecordData|undefined;if(address)appointment.location+=" · "+[address.strasse,address.plz,address.ort].filter(Boolean).join(" ");}
      if(appointment.customer){const person=await get("/person/details",{uuid:appointment.customer.id});appointment.customer.name=String(person.name??appointment.customer.name);}
    }
    if(this.vacationApprovalView)await enrichVacationApprovals(this.api,this.vacationApprovalView,events);
    return events;
  }
  async statusCatalogs():Promise<StatusCatalog[]>{
    return Promise.all(Object.entries(statusScopeLabels).map(async([type,name])=>{
      const path=type==="SERVICEAUFTRAG"?"/service/liststatus":type==="PROJEKT"?"/projektakte/liststatus":type==="RUECKLAUF"?"/ruecklauf/liststatus":type==="ZAEHLLISTE"?"/lager/listzaehllistenstatus":"/vorgang/liststatus";
      const values=await this.api.request(path==="/vorgang/liststatus"?"POST":"GET",path,path==="/vorgang/liststatus"?{vorgangstyp:type}:undefined);
      if(!Array.isArray(values))throw new PdsProtocolError("Statuskatalog fehlt: "+name);
      const seen=new Set<string>();
      const statuses=values.map(value=>{const item=row(value);if(typeof item.uuid!=="string"||!item.uuid||item.uuid.length>120||seen.has(item.uuid)||item.bezeichnung!==undefined&&typeof item.bezeichnung!=="string"||item.kategorie!==undefined&&typeof item.kategorie!=="string")throw new PdsProtocolError("Ungültiger Statuskatalog: "+name);seen.add(item.uuid);return {id:item.uuid,name:typeof item.bezeichnung==="string"?item.bezeichnung:item.uuid,...(typeof item.kategorie==="string"?{category:item.kategorie}:{})};});
      return {type:type as StatusScope,name,statuses};
    }));
  }
  async categories():Promise<CalendarCategory[]>{
    const values=await this.api.request("GET","/termin/listkategorien");if(!Array.isArray(values))throw new PdsProtocolError("Kategorien fehlen.");
    const seen=new Set<string>();return values.map(value=>{const data=row(value);if(typeof data.uuid!=="string"||!data.uuid||data.uuid.length>100||seen.has(data.uuid)||data.bezeichnung!==undefined&&typeof data.bezeichnung!=="string"||data.ganzerTag!==undefined&&typeof data.ganzerTag!=="boolean")throw new PdsProtocolError("Ungültige Kategorie.");seen.add(data.uuid);return {id:data.uuid,name:typeof data.bezeichnung==="string"?data.bezeichnung:data.uuid,allDay:data.ganzerTag===true};});
  }
  async references(kind:string,query:string):Promise<CalendarReference[]>{
    if(query.length>100)throw new CalendarError("Suchbegriff maximal 100 Zeichen.");
    const paths:Record<string,string>={OBJEKT:"/objekt/listobjekte",PROJEKT:"/projektakte/listprojektakten",AUFTRAG:"/vorgang/listauftraege",ANGEBOT:"/vorgang/listangebote",BEDARFSMELDUNG:"/vorgang/listbedarfsmeldungen",RECHNUNG:"/vorgang/listrechnungen",LIEFERSCHEIN:"/vorgang/listlieferscheine",BESTELLUNG:"/vorgang/listbestellungen",WARENEINGANG:"/vorgang/listwareneingaenge",RUECKNAHME:"/vorgang/listruecknahmen",ANSCHRIFT:"/person/listkunden"};
    if(["ABRUFAUFTRAG","GUTSCHRIFT"].includes(kind)){if(query.trim().length<10)return [];const value=row(await this.api.request("POST","/vorgang/details",{uuid:query.trim(),vorgangstyp:kind}));if(value.uuid!==query.trim())throw new CalendarError("PDS-UUID wurde nicht gefunden.");return [{id:String(value.uuid),label:[value.vorgangsNummer,value.bezeichnung].filter(Boolean).join(" · ")}];}
    if(!paths[kind]||query.trim().length<3||query.length>100)throw new CalendarError("Bitte mindestens drei Zeichen und eine gültige Suche angeben.");
    // List only documented families; two types require an exact UUID lookup.
    const rows=await this.paged(paths[kind],{suchwort:query.trim()});
    if(kind==="ANSCHRIFT"){
      const result:CalendarReference[]=[];
      for(const person of rows.slice(0,50)){const detail=row(await this.api.request("POST","/person/details",{uuid:person.uuid}));for(const value of Array.isArray(detail.postKommunikationswege)?detail.postKommunikationswege:[]){const address=row(value);if(typeof address.uuid!=="string")continue;result.push({id:address.uuid,label:[detail.name,address.strasse,address.plz,address.ort].filter(Boolean).join(" · "),address:checkOptions({address:{urPostkommunikationswegUUID:address.uuid,name:String(detail.name??""),strasse:String(address.strasse??""),plz:String(address.plz??""),ort:String(address.ort??""),land:String(address.land??"")}}).address});}}return result.slice(0,50);
    }
    return rows.filter(value=>!value.vorgangstyp||value.vorgangstyp===kind||kind==="OBJEKT"||kind==="PROJEKT").slice(0,50).map(value=>({id:String(value.uuid),label:[value.vorgangsNummer,value.nummer,value.bezeichnung].filter(Boolean).join(" · ")}));
  }
  private async dutyOptions(options:CalendarOptions):Promise<CalendarOptions>{
    if(!options.categories?.length)return options;
    const categories=await this.categories();
    return categories.some(category=>options.categories!.includes(category.id)&&category.name.trim().toLocaleLowerCase('de')==='bereitschaft')?{...options,status:'FREI'}:options;
  }
  private async validateOptions(options:CalendarOptions,start:string,end:string){
    if(options.allDay&&(berlinWall(start).slice(11)!=="00:00"||berlinWall(end).slice(11)!=="00:00"||Date.parse(start)%60000!==0||Date.parse(end)%60000!==0))throw new CalendarError("Ganztägige Termine benötigen ganze Tage mit Beginn und Ende um 00:00 Uhr.");
    if(options.categories){const categories=await this.categories();if(options.categories.some(id=>!categories.some(category=>category.id===id)))throw new CalendarError("Unbekannte PDS-Kategorie.");}
    if(options.objectId){const object=row(await this.api.request("POST","/objekt/details",{uuid:options.objectId}));if(object.uuid!==options.objectId)throw new CalendarError("Unbekanntes PDS-Objekt.");}
    if(options.address){const customers=await this.paged("/person/listkunden",{});let found=false;for(const customer of customers){const detail=row(await this.api.request("POST","/person/details",{uuid:customer.uuid}));if(Array.isArray(detail.postKommunikationswege)&&detail.postKommunikationswege.some(value=>value.uuid===options.address!.urPostkommunikationswegUUID)){found=true;break;}}if(!found)throw new CalendarError("Die PDS-Anschriftenreferenz wurde nicht gefunden.");}
  }
  async resourceGroups():Promise<ResourceGroup[]>{
    const values=await this.api.request("GET","/administration/listressourcengruppen");if(!Array.isArray(values))throw new PdsProtocolError("Ressourcengruppen fehlen.");
    const seen=new Set<string>();return values.map(value=>{const data=row(value);if(typeof data.uuid!=="string"||!data.uuid||data.uuid.length>120||seen.has(data.uuid)||data.bezeichnung!==undefined&&typeof data.bezeichnung!=="string")throw new PdsProtocolError("Ungültige Ressourcengruppe.");seen.add(data.uuid);return {id:data.uuid,name:typeof data.bezeichnung==="string"&&data.bezeichnung?data.bezeichnung:data.uuid};});
  }
  async resources(from:string,to:string,knownGroups?:ResourceGroup[],includeUnavailable=false,maximum=Infinity):Promise<Resource[]> {
    const staff=await this.paged("/mitarbeiter/listmitarbeiter",{},maximum);
    const details:RecordData[]=[];
    for(let i=0;i<staff.length;i+=500){const batch=await this.api.request("POST","/mitarbeiter/detailsbatch",{uuids:staff.slice(i,i+500).map(item=>item.uuid)});if(!Array.isArray(batch))throw new PdsProtocolError("Mitarbeiterdetails fehlen.");details.push(...batch.map(row));}
    const groups=knownGroups??await this.resourceGroups();
    for(const data of details)if(data.ressourcengruppenUUIDs!==undefined&&(!Array.isArray(data.ressourcengruppenUUIDs)||data.ressourcengruppenUUIDs.some(id=>typeof id!=="string"||!id||id.length>120)||new Set(data.ressourcengruppenUUIDs).size!==data.ressourcengruppenUUIDs.length))throw new PdsProtocolError("Ungültige Ressourcengruppen-Zuordnung.");
    const available=(data:RecordData)=>{const time=data.ressourcenplanzeit as {vonDatum?:string;bisDatum?:string}|undefined;return !!time&&(!time.vonDatum||time.vonDatum<=to)&&(!time.bisDatum||time.bisDatum>=from);};
    return details.filter(data=>includeUnavailable||available(data)).map(data=>({...includeUnavailable?{planningAvailable:available(data)}:{},id:String(data.uuid),name:`${data.vorname??""} ${data.nachname??""}`.trim(),number:String(data.personalNummer??""),planningFrom:(data.ressourcenplanzeit as {vonDatum?:string})?.vonDatum,planningTo:(data.ressourcenplanzeit as {bisDatum?:string})?.bisDatum,groupIds:(data.ressourcengruppenUUIDs??[]) as string[],group:groups.filter(group=>Array.isArray(data.ressourcengruppenUUIDs)&&data.ressourcengruppenUUIDs.includes(group.id)).map(group=>group.name).join(" · ")||String(data.berufsbezeichnung??"Ressource")}));
  }
  // Planning suggestions need occupancy only, never order/customer enrichment or colors.
  async availability(from:string,to:string){
    checkRange(from,to);const resources=await this.resources(from,to,undefined,false,300);
    if(!resources.length)return {resources,events:[] as CalendarEvent[],workingTime:undefined};
    if(resources.length>300)throw new PdsProtocolError("Zu viele Mitarbeiter für die Verfügbarkeitsprüfung.");
    const plans=await this.paged("/termin/listplanung",{mitarbeiterUUIDs:resources.map(item=>item.id),zeitraum:{vonDatum:from,bisDatum:to}},10000);
    if(plans.some(plan=>typeof plan.uuid!=="string"))throw new PdsProtocolError("Terminreferenz fehlt.");
    const ids=[...new Set(plans.map(plan=>String(plan.uuid)))];
    if(ids.length>10000)throw new PdsProtocolError("Zu viele Termine für die Verfügbarkeitsprüfung.");
    const events:CalendarEvent[]=[];
    for(let i=0;i<ids.length;i+=500){const batch=await this.api.request("POST","/termin/detailsbatch",{uuids:ids.slice(i,i+500)});if(!Array.isArray(batch)||batch.length!==ids.slice(i,i+500).length)throw new PdsProtocolError("Unvollständige Termindetails.");const expected=ids.slice(i,i+500),received=batch.map(row);if(new Set(received.map(value=>value.uuid)).size!==expected.length||received.some(value=>!expected.includes(String(value.uuid))))throw new PdsProtocolError("Unvollständige Termindetails.");events.push(...received.map(event));}
    if(this.vacationApprovalView)await enrichVacationApprovals(this.api,this.vacationApprovalView,events);
    return {resources,events,workingTime:this.workingTimeView?await readWorkingTime(this.api,this.workingTimeView,resources,from,to):undefined};
  }
  async list(from:string,to:string):Promise<CalendarData>{
    checkRange(from,to);const resourceGroups=await this.resourceGroups(),resources=await this.resources(from,to,resourceGroups);const ids:string[]=[];
    for(let i=0;i<resources.length;i+=500){const plans=await this.paged("/termin/listplanung",{mitarbeiterUUIDs:resources.slice(i,i+500).map(item=>item.id),zeitraum:{vonDatum:from,bisDatum:to}});for(const plan of plans){if(typeof plan.uuid!=="string")throw new PdsProtocolError("Terminreferenz fehlt.");if(!ids.includes(plan.uuid))ids.push(plan.uuid);}}
    const records:RecordData[]=[];
    for(let i=0;i<ids.length;i+=500){const batch=await this.api.request("POST","/termin/detailsbatch",{uuids:ids.slice(i,i+500)});if(!Array.isArray(batch)||batch.length!==ids.slice(i,i+500).length)throw new PdsProtocolError("Unvollständige Termindetails.");records.push(...batch.map(row));}
    let colors=fallbackColors,colorSource:CalendarData["colorSource"]="fallback";
    if(this.colorView){
      const views=await this.api.request("GET","/datenansichten/list");if(!Array.isArray(views))throw new PdsProtocolError("Ungültige Datenansichten.");
      if(!views.some(view=>view.name===this.colorView))throw new PdsProtocolError("Die konfigurierte Kalenderfarben-Datenansicht fehlt. Kein Fallback.");
      if(views.some(view=>view.name===this.colorView)){
        const result=await this.api.request("POST","/datenansichten/listdaten",{name:this.colorView,page:0,entriesPerPage:500});
        if(!Array.isArray(result)||!result.length)throw new PdsProtocolError("Ungültige Kalender-Farbzuordnung.");
        colors=readLegacyColorRules(result);colorSource=this.simulatedColors?"simulation":"view";
      }
    }
    return {resources,resourceGroups,...(this.workingTimeView?{workingTime:await readWorkingTime(this.api,this.workingTimeView,resources,from,to)}:{}),vacationApprovalSource:this.vacationApprovalView?"view":"unavailable",events:await this.withRoles(records),colors,colorSource,categoryOptions:await this.categories()};
  }
  async details(uuid:string){return (await this.withRoles([row(await this.api.request("POST","/termin/details",{uuid}))]))[0];}
  async planningWarnings(raw:unknown,creation=false){
    let proposed:CalendarEvent;
    if(creation){const input=checkCreate(raw);proposed=applyOptions({id:"planning-preview",title:input.title,start:input.start,end:input.end,resourceIds:input.resourceIds,status:"GEPLANT",type:input.type??"FREIER",fixed:false,allDay:false,categories:[]},input.options??{});}
    else{const input=checkChange(raw),record=row(await this.api.request("POST","/termin/details",{uuid:input.id})),previous=(await this.withRoles([record]))[0];
      const sameResources=[...previous.resourceIds].sort().join("|")===[...input.resourceIds].sort().join("|");
      if(Date.parse(previous.start)===Date.parse(input.start)&&Date.parse(previous.end)===Date.parse(input.end)&&sameResources&&(input.options?.status??previous.status)===previous.status)return [];
      proposed={...applyOptions(previous,input.options??{}),start:input.start,end:input.end,resourceIds:input.resourceIds};
    }
    const from=berlinWall(proposed.start).slice(0,10),to=berlinWall(new Date(Date.parse(proposed.end)-1).toISOString()).slice(0,10),data=await this.list(from,to);
    if(proposed.resourceIds.some(id=>!data.resources.some(resource=>resource.id===id)))throw new CalendarError("Bitte eine verfügbare PDS-Ressource auswählen.");
    return planningWarnings(data,proposed);
  }
  async checkWriteAvailability(raw:unknown,creation=false){
    if(!this.beforeSave)return;
    if(creation){const input=checkCreate(raw);await this.beforeSave({start:input.start,end:input.end,resourceIds:input.resourceIds,categories:input.options?.categories??[]});}
    else{const input=checkChange(raw),previous=await this.details(input.id);await this.beforeSave({...applyOptions(previous,input.options??{}),start:input.start,end:input.end,resourceIds:input.resourceIds},previous);}
  }
  async create(raw:unknown){
    const input=checkCreate(raw);
    const resources=await this.resources(berlinWall(input.start).slice(0,10),berlinWall(input.end).slice(0,10));
    if(input.resourceIds.some(id=>!resources.some(resource=>resource.id===id)))throw new CalendarError("Bitte eine verfügbare PDS-Ressource auswählen.");
    const options=await this.dutyOptions(input.options??{});await this.validateOptions(options,input.start,input.end);
    await this.beforeSave?.({start:input.start,end:input.end,resourceIds:input.resourceIds,categories:options.categories??[]});
    const type=input.type??"FREIER";
    if(type==="VORGANG"){const detail=row(await this.api.request("POST","/vorgang/details",{uuid:input.referenceId,vorgangstyp:input.referenceType}));if(detail.uuid!==input.referenceId)throw new CalendarError("Vorgang nicht gefunden.");}
    if(type==="PROJEKT"){const detail=row(await this.api.request("POST","/projektakte/details",{uuid:input.referenceId}));if(detail.uuid!==input.referenceId)throw new CalendarError("Projektakte nicht gefunden.");}
    const saved=row(await this.api.request("POST","/termin/create",{bezeichnung:input.title,typ:type,status:"GEPLANT",startZeitpunkt:input.start,endZeitpunkt:input.end,mitarbeiterUUIDs:input.resourceIds,text:input.notes,ganzerTag:false,fix:false,...nativeOptions(options),...(type==="VORGANG"?{vorgangUUID:input.referenceId,vorgangtyp:input.referenceType}:{}),...(type==="PROJEKT"?{projektUUID:input.referenceId}:{})}));
    return (await this.withRoles([saved]))[0];
  }
  async remove(raw:unknown){
    const input=checkDeletion(raw);
    return exclusive(input.id,async()=>{
      const previous=event(await this.api.request("POST","/termin/details",{uuid:input.id}));
      if(previous.fixed)throw new CalendarError("Dieser Termin ist in PDS fixiert und kann nicht gelöscht werden.",409);
      const same=(left:string[],right:string[])=>[...left].sort().join("|")===[...right].sort().join("|");
      if(Date.parse(previous.start)!==Date.parse(input.expected.start)||Date.parse(previous.end)!==Date.parse(input.expected.end)||!same(previous.resourceIds,input.expected.resourceIds))throw new CalendarError("Der Termin wurde zwischenzeitlich geändert. Bitte vor dem Löschen neu laden.",409);
      await this.api.request("POST","/termin/delete",{uuid:input.id});
      return {id:input.id};
    });
  }
  async update(raw:unknown){
    let input=checkChange(raw);
    return exclusive(input.id,async()=>{
      const previousRecord=row(await this.api.request("POST","/termin/details",{uuid:input.id}));
      const previous=(await this.withRoles([previousRecord]))[0];
      const result=await (async()=>{
      const base={...previous,...input.expected,...(input.expected.options??{}),...(input.companionTechnicianIds!==undefined?{companionTechnicianIds:input.expected.resourceIds.filter(id=>id!==input.expected.mainTechnicianId)}:{})};
      const desired={...base,...input,...(input.options??{}),...(input.companionTechnicianIds!==undefined?{mainTechnicianId:input.mainTechnicianId??input.expected.mainTechnicianId}: {})};
      const {merged,conflicts}=mergeCalendarEvents(base,desired,previous);
      if(conflicts.length)throw new CalendarConflictError((await this.withRoles([previousRecord]))[0],conflicts);
      input={...input,start:merged.start,end:merged.end,resourceIds:merged.resourceIds,...(input.title!==undefined?{title:merged.title}:{}),...(input.notes!==undefined?{notes:merged.notes??''}:{}),...(input.options?{options:Object.fromEntries(Object.keys(input.options).map(key=>[key,eventOptions(merged)[key as keyof CalendarOptions]]))}:{}),...(input.companionTechnicianIds!==undefined?{mainTechnicianId:merged.mainTechnicianId,companionTechnicianIds:merged.companionTechnicianIds}:{}),expected:{start:previous.start,end:previous.end,resourceIds:previous.resourceIds,title:previous.title,notes:previous.notes??'',options:eventOptions(previous),mainTechnicianId:previous.mainTechnicianId}};
      if(!previous.fixed){const options=await this.dutyOptions({...eventOptions(previous),...input.options});if(options.status!==({...eventOptions(previous),...input.options}).status)input.options={...input.options,status:options.status};}
      const sorted=(value:string[])=>[...value].sort().join("|");
      // A lost response can leave the client's expected state behind an already
      // committed write. Acknowledge only a fully matching target, without writing
      // again or rebasing a stale change onto newer data.
      const requestedNotes=input.notes===undefined?undefined:readContinuation(input.notes);
      const targetMatches=Date.parse(previous.start)===Date.parse(input.start)&&Date.parse(previous.end)===Date.parse(input.end)
        &&sorted(previous.resourceIds)===sorted(input.resourceIds)
        &&(input.title===undefined||previous.title===input.title)
        &&(!requestedNotes||((previous.notes??"")===requestedNotes.notes&&(!requestedNotes.link||JSON.stringify(requestedNotes.link)===JSON.stringify(previous.continuation))))
        &&(!input.options||optionKey(eventOptions(previous))===optionKey(eventOptions(applyOptions(previous,input.options))))
        &&(input.companionTechnicianIds===undefined||(previous.mainTechnicianId===(input.mainTechnicianId??input.expected.mainTechnicianId)&&sorted(previous.companionTechnicianIds??[])===sorted(input.companionTechnicianIds)));
      if(targetMatches)return (await this.withRoles([previousRecord]))[0];
      const unlocking=previous.fixed&&input.options?.fixed===false;
      if(previous.fixed&&!unlocking)throw new CalendarError("Dieser Termin ist in PDS fixiert und kann nicht geändert werden.",409);
      if(input.options&&optionKey(eventOptions(previous))!==optionKey(checkOptions(input.expected.options)))throw new CalendarError("Terminoptionen wurden zwischenzeitlich geändert. Bitte neu laden.",409);
      if(Date.parse(previous.start)!==Date.parse(input.expected.start)||Date.parse(previous.end)!==Date.parse(input.expected.end)||sorted(previous.resourceIds)!==sorted(input.expected.resourceIds))throw new CalendarError("Der Termin wurde zwischenzeitlich geändert. Bitte die Planung neu laden.",409);
      if(unlocking){if(Object.keys(input.options!).some(key=>key!=="fixed")||input.title!==undefined||input.notes!==undefined||input.companionTechnicianIds!==undefined||Date.parse(input.start)!==Date.parse(previous.start)||Date.parse(input.end)!==Date.parse(previous.end)||JSON.stringify([...input.resourceIds].sort())!==JSON.stringify([...previous.resourceIds].sort()))throw new CalendarError("Bitte zuerst ausschließlich die Fixierung aufheben.");return (await this.withRoles([row(await this.api.request("POST","/termin/update",{uuid:input.id,fix:false}))]))[0];}
      if((input.title!==undefined&&previous.title!==input.expected.title)||(input.notes!==undefined&&(previous.notes??"")!==input.expected.notes))throw new CalendarError("Titel oder Beschreibung wurden zwischenzeitlich geändert. Bitte neu laden.",409);
      const texts={...nativeOptions(input.options??{}),...(input.title!==undefined?{bezeichnung:input.title}:{}),...(input.notes!==undefined?{text:previous.continuation&&!readContinuation(input.notes).link?continuationNotes(input.notes,previous.continuation):input.notes}:{})};
      await this.validateOptions({...eventOptions(previous),...input.options},input.start,input.end);
      if((input.options?.allDay??previous.allDay)&&(berlinWall(input.start).slice(11)!=="00:00"||berlinWall(input.end).slice(11)!=="00:00"))throw new CalendarError("Ganztägige Termine müssen an Tagesgrenzen beginnen und enden.");
      const resources=await this.resources(berlinWall(input.start).slice(0,10),berlinWall(input.end).slice(0,10));
      if(input.resourceIds.some(id=>!resources.some(resource=>resource.id===id)))throw new CalendarError("Bitte eine verfügbare PDS-Ressource auswählen.");
      await this.beforeSave?.({...applyOptions(previous,input.options??{}),start:input.start,end:input.end,resourceIds:input.resourceIds},previous);
      if(input.companionTechnicianIds!==undefined){
        if(previous.type!=="SERVICEAUFTRAGEBENE"||!previous.mainTechnicianId||!previous.serviceIncidentId)throw new CalendarError("Für diesen Termin ist keine Service-Technikerzuordnung verfügbar.");
        if(previous.mainTechnicianId!==input.expected.mainTechnicianId)throw new CalendarError("Der Haupttechniker wurde zwischenzeitlich geändert. Bitte neu laden.",409);
        const main=input.mainTechnicianId??previous.mainTechnicianId;
        const team=[main,...input.companionTechnicianIds];
        if(input.companionTechnicianIds.includes(main)||sorted(team)!==sorted(input.resourceIds))throw new CalendarError("Haupttechniker und Begleiter müssen eindeutig zugeordnet sein.");
        const planningChanged=Date.parse(previous.start)!==Date.parse(input.start)||Date.parse(previous.end)!==Date.parse(input.end)||sorted(previous.resourceIds)!==sorted(input.resourceIds)||main!==previous.mainTechnicianId;
        let saved=previousRecord;
        if(previous.continuation?.serviceCopy){
          const reference=readContinuation(input.notes??"").link??previous.continuation;
          const saved=row(await this.api.request("POST","/termin/update",{uuid:input.id,startZeitpunkt:input.start,endZeitpunkt:input.end,mitarbeiterUUIDs:team,...texts,text:continuationNotes(input.notes??previous.notes??"",{...reference,mainId:main})}));
          return (await this.withRoles([saved]))[0];
        }
        if(planningChanged){
          await this.api.request("POST","/service/updatestoerung",{uuid:previous.serviceIncidentId,startZeitpunkt:input.start,endZeitpunkt:input.end,hauptmonteurUUID:main,weiteremonteureUUIDs:input.companionTechnicianIds});
          saved=row(await this.api.request("POST","/service/findstoerungtermin",{uuid:previous.serviceIncidentId}));
        }
        if(Object.keys(texts).length){
          try{saved=row(await this.api.request("POST","/termin/update",{uuid:input.id,...texts}));}
          catch(error){if(planningChanged)throw new CalendarError("Die Einsatzplanung wurde gespeichert; Terminoptionen oder Texte konnten nicht gespeichert werden. Bitte neu laden.",502);throw error;}
        }
        return (await this.withRoles([saved]))[0];
      }
      const saved=row(await this.api.request("POST","/termin/update",{uuid:input.id,startZeitpunkt:input.start,endZeitpunkt:input.end,mitarbeiterUUIDs:input.resourceIds,...texts}));
      return (await this.withRoles([saved]))[0];
      })();
      await this.onSaved?.(previous,result);
      return result;
    });
  }
}
