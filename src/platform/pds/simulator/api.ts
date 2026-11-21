import catalogArticles from "../../../../database/seeds/pds-simulator/catalog-articles.json" with {type:"json"};
import {simulatedReturnLinkView} from '../api/return-links.ts';
import returnSeeds from '../../../../database/seeds/pds-simulator/returns.json' with {type:'json'};
import {simulatedMaintenance} from './maintenance.ts';
import costReferences from "../../../../database/seeds/pds-simulator/cost-carriers.json" with {type:"json"};
import resourceGroups from "../../../../database/seeds/pds-simulator/resource-groups.json" with {type:"json"};
import {workingTimeView,workingTimeRows,simulatedHolidays} from "./working-time.ts";
import {vacationApprovalView,vacationApprovalRows} from "./vacation-view.ts";
import {simulatorContractMode} from "./service-contracts.ts";
import statusSeeds from "../../../../database/seeds/pds-simulator/status-catalogs.json" with {type:"json"};
import offerSeeds from "../../../../database/seeds/pds-simulator/offers.json" with {type:"json"};
import calendarReferences from "../../../../database/seeds/pds-simulator/calendar-references.json" with {type:"json"};
import {calendarRequest,calendarRecords,updateServicePlanning,calendarColorView,calendarColors} from "./calendar-api.ts";
import {serviceRecords,serviceCalendarId,serviceDocuments,documentBytes} from "./read-services.ts";
import {SimulatedWriteApi} from "./write-api.ts";
import {crmRequest,simulatorUserId} from "./crm-api.ts";
import {objects,units,employees} from "./fixtures.ts";
import {openOrderStore} from "./order-store.ts";
import {validateRequest,type PdsTransport} from "../api/index.ts";

type Store=ReturnType<typeof openOrderStore>;
// Fachbereiche (in PDS das Gewerk einer Anlage, Handbuch „Anlagen und Bauteile erstellen“): fiktiv aus den Simulator-Einheiten.
function tradeId(trade:string){return "sim-fb-"+trade.toLowerCase().replace(/[^a-z0-9]+/g,"-");}
function trades(units:readonly {trade:string}[]){return [...new Set(units.map(unit=>unit.trade))].sort().map((bezeichnung,index)=>({uuid:tradeId(bezeichnung),dbid:900+index,bezeichnung}));}
export class SimulatedPdsApi implements PdsTransport {
  private readonly store:Store;
  private readonly workflow?:string;
  constructor(store:Store,workflow?:string){this.store=store;this.workflow=workflow;}
  async request(method:"GET"|"POST",path:string,body?:unknown):Promise<unknown> {
    validateRequest(method,path,body);
    if(method==='GET'&&path.startsWith('/wartungsvertrag/wartungsintervalldetails/')){const id=decodeURIComponent(path.slice('/wartungsvertrag/wartungsintervalldetails/'.length));const found=simulatedMaintenance().intervals.find(item=>item.uuid===id);if(!found)throw Error('Wartungsintervall nicht gefunden.');return found;}
    if(method==='GET'&&path.startsWith('/ruecklauf/')){const id=decodeURIComponent(path.split('/').pop()!),found=returnSeeds.find(row=>row.uuid===id||row.rootEbene.ebenen.some(level=>level.uuid===id));if(path.startsWith('/ruecklauf/details/')){if(!found)throw Error('Rücklauf nicht gefunden.');return found;}if(path.startsWith('/ruecklauf/listdokumente/')||path.startsWith('/ruecklauf/listauftragsdokumente/')){if(!found)throw Error('Rücklauf nicht gefunden.');return [{uuid:'sim-chronicle-report-1',fileName:'Fiktiver Wartungsbericht BMA.txt',datum:'2026-11-04',dokumententyp:{uuid:'report',bezeichnung:'Arbeitsbericht'}}];}}
    if(path==='/katalog/listartikel'){const input=(body??{}) as {page?:number;entriesPerPage?:number;suchwort?:string};const terms=String(input.suchwort??'').toLowerCase().split(/\s+/).filter(Boolean),rows=catalogArticles.filter(row=>terms.every(term=>(row.name+' '+row.kurztext).toLowerCase().includes(term))),start=(input.page??0)*(input.entriesPerPage??30);return {totalHitCount:rows.length,resultList:rows.slice(start,start+(input.entriesPerPage??30))};}
    if(path==='/katalog/details'){const row=catalogArticles.find(row=>row.uuid===(body as {uuid?:string})?.uuid);if(!row)throw Error('Katalogartikel nicht gefunden.');return row;}
    if(path.startsWith("/crm/"))return crmRequest(this.store,path,(body??{}) as Record<string,unknown>,this.workflow);
    if(path.startsWith("/termin/"))return calendarRequest(this.store,path,(body??{}) as Record<string,unknown>,this.workflow);
    const input=(body??{}) as {uuid?:string;suchwort?:string;page?:number;entriesPerPage?:number;name?:string;vorgangstyp?:string;vertragsleistung?:string;stoerungStatusUUIDs?:string[]};
    const statusScope=path==="/service/liststatus"?"SERVICEAUFTRAG":path==="/projektakte/liststatus"?"PROJEKT":path==="/ruecklauf/liststatus"?"RUECKLAUF":path==="/lager/listzaehllistenstatus"?"ZAEHLLISTE":path==="/vorgang/liststatus"?input.vorgangstyp:undefined;
    if(statusScope){
      const values=statusSeeds[statusScope as keyof typeof statusSeeds];if(!values)throw new Error("Unbekannte Status-Vorgangsart.");
      return values.map(value=>{const configured=this.store.apiEntity(`status-label:${statusScope}:${value.uuid}`);const {evidence,...data}=value;void evidence;return {...data,...(configured?.kind==="status-label"?{bezeichnung:String(configured.data.bezeichnung)}:{})};});
    }
    const withStatusLabel=(scope:string,value:unknown)=>{if(!value||typeof value!=="object")return value;const data=value as Record<string,unknown>,status=data.vorgangStatus as Record<string,unknown>|undefined;if(!status)return data;const label=this.store.apiEntity(`status-label:${scope}:${status.uuid}`);return label?.kind==="status-label"?{...data,vorgangStatus:{...status,bezeichnung:String(label.data.bezeichnung)}}:data;};
    const people=this.store.allPersons();
    const customerIds=[...new Set(objects.map(object=>object.customerNumber))];
    const field=(bezeichnung:string,wert:string)=>({bezeichnung,wert,typ:"Text"});
    const communication=(person:typeof people[number])=>person.phones.map((phone,index)=>({uuid:`${person.id}-phone-${index}`,typ:phone.label.toLowerCase().includes("mobil")?"MOBIL":"FESTNETZ",kategorie:"GESCHAEFTLICH",value:phone.number}));
    const objectRows=objects.map((object,index)=>({uuid:object.id,dbid:4001+index,bezeichnung:object.name,typ:"OBJEKT",kstKtrUUID:costReferences.costCenters[0].uuid,personUUID:object.customerNumber,childrenUUIDs:units.filter(unit=>unit.objectId===object.id).map(unit=>unit.id),standort:{uuid:object.id+'-address',strasse:object.street,plz:object.postalCode,ort:object.city},objektInfoFelder:[field("Nummer",object.number)]}));
    const unitRows=units.map((unit,index)=>({uuid:unit.id,dbid:5001+index,fachbereichUUID:tradeId(unit.trade),bezeichnung:unit.name,typ:"TECHNISCHE_EINHEIT",kstKtrUUID:costReferences.costCarriers[0].uuid,parentUUID:unit.objectId,personUUID:objects.find(object=>object.id===unit.objectId)!.customerNumber,objektInfoFelder:[field("Nummer",unit.number),field("Standort",unit.location),field("Gewerk",unit.trade),field("Hersteller",unit.manufacturer),field("Typ",unit.type)]}));
    const customerRows=customerIds.map(id=>({uuid:id,name:objects.filter(object=>object.customerNumber===id).map(object=>object.name).join(", "),form:"FIRMA",postKommunikationswege:objects.filter(object=>object.customerNumber===id).map(object=>({uuid:object.id+"-address",typ:"OBJEKTANSCHRIFT",strasse:object.street,plz:object.postalCode,ort:object.city,land:"DE"})),kundenRolle:{uuid:id+'-role',kundennummer:id},ansprechpartner:people.filter(person=>person.customerNumbers?.includes(id)).map(person=>({uuid:person.id+'-role',person:{uuid:person.id,name:person.name},funktionUUID:person.function,ekommunikationswege:communication(person)}))}));
    const personRows=people.map(person=>({uuid:person.id,name:person.name,form:"PRIVATPERSON",ansprechpartnerRolle:{uuid:person.id+'-role'},ekommunkationswege:communication(person)}));
    const employeeRows=employees.map(employee=>({uuid:employee.id,benutzerUUID:simulatorUserId(employee.id),personalNummer:employee.personnelNumber,funktionUUID:employee.siteManager?"sim-function-project-manager":"sim-function-technician",vorname:employee.firstName,nachname:employee.lastName,berufsbezeichnung:employee.specialty,abteilungUUID:employee.department,...(employee.plannable?{ressourcenplanzeit:{vonDatum:"2020-01-01",bisDatum:"2099-12-31"},ressourcengruppenUUIDs:(resourceGroups.memberships as Record<string,string[]>)[employee.id]??[]}:{})}));
    const page=(rows:unknown[])=>{
      const limit=input.entriesPerPage??500,index=input.page??0;
      if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isInteger(index)||index<0)throw new Error("Ungültige PDS-Seite.");
      const words=(input.suchwort??"").toLowerCase().split(/\s+/).filter(Boolean);
      const filtered=rows.filter(row=>words.every(word=>JSON.stringify(row).toLowerCase().includes(word)));
      return {totalHitCount:filtered.length,resultList:filtered.slice(index*limit,(index+1)*limit)};
    };
    if(path.startsWith("/service/listauftragsdokumente/") || path.startsWith("/service/listdokumente/")) {
      const uuid=decodeURIComponent(path.split('/').pop()!);
      if(!serviceRecords(this.store).some(row=>row.uuid===uuid))throw Error("Serviceauftrag nicht gefunden.");
      return serviceDocuments(this.store,uuid);
    }
    if(path.startsWith("/dokument/downloaddokument/")) {const bytes=documentBytes(this.store,decodeURIComponent(path.split('/').pop()!));if(!bytes)throw Error("Dokument nicht gefunden.");return bytes;}
    switch(path) {
      case "/administration/listkostentraeger":return page(costReferences.costCarriers);
      case "/administration/listkostenstelle":return page(costReferences.costCenters);
      case "/service/liststoerungen":{
        if(input.vertragsleistung!==undefined&&!["KEIN","INTERVALL","WARTUNGSVORGANG"].includes(input.vertragsleistung))throw new Error("Ungültiger Vertragsleistungsfilter.");
        if(input.stoerungStatusUUIDs!==undefined&&(!Array.isArray(input.stoerungStatusUUIDs)||input.stoerungStatusUUIDs.some(id=>typeof id!=="string")))throw new Error("Ungültiger Störungsstatusfilter.");
        const rows=serviceRecords(this.store).flatMap(service=>service.rootEbene.ebenen.map(incident=>({uuid:incident.uuid,serviceAuftrag:{uuid:service.uuid,vorgangsNummer:service.vorgangsNummer,bezeichnung:service.bezeichnung,personUUID:service.personUUID,vorgangStatus:service.vorgangStatus},serviceAuftragEbene:incident})));
        return page(rows.filter(row=>(input.vertragsleistung===undefined||simulatorContractMode(this.store,row.serviceAuftragEbene.uuid)===input.vertragsleistung)&&(!input.stoerungStatusUUIDs?.length||input.stoerungStatusUUIDs.includes(row.serviceAuftragEbene.status.uuid))));
      }
      case "/service/updatestoerung":return updateServicePlanning(this.store,(body??{}) as Record<string,unknown>,!!this.workflow);
      case "/service/findstoerungtermin":{
        const found=calendarRecords(this.store).find(row=>row.uuid===serviceCalendarId(String(input.uuid)));
        if(!found)throw Error("Kein Termin zur Störung gefunden.");
        return found;
      }
      case "/service/updatestatus":{
        if(!this.workflow)throw new Error("Schreibzugriff erforderlich.");
        if(!serviceRecords(this.store).some(row=>row.uuid===input.uuid))throw new Error("Serviceauftrag nicht gefunden.");
        const name=(body as {statusBezeichnung:string}).statusBezeichnung;
        const status=statusSeeds.SERVICEAUFTRAG.find(item=>item.bezeichnung===name);
        if(!status)throw new Error("Unbekannter Serviceauftragsstatus.");
        this.store.apiPut(`service-status:${input.uuid}`,"service-status",{uuid:status.uuid,bezeichnung:status.bezeichnung});return {};
      }
      case "/wartungsvertrag/listvertraegebyobjekt":{
        const ids=new Set([input.uuid,...unitRows.filter(row=>row.parentUUID===input.uuid).map(row=>row.uuid)]);
        const contracts=new Set(serviceRecords(this.store).flatMap(service=>service.rootEbene.ebenen.filter(incident=>ids.has(incident.objektUUID)&&incident.wartungsvertragUUID).map(incident=>incident.wartungsvertragUUID!)));
        return [...simulatedMaintenance().contracts.filter(item=>ids.has(item.objektUUID)),...[...contracts].map(uuid=>({uuid,objektUUID:input.uuid,wartung:{bezeichnung:'Beispiel-Wartungsvertrag',beschreibung:'Fiktiver Vertrag für die Service-Demonstration.',kstKtr:costReferences.costCarriers[1]},rechnung:{kstKtr:costReferences.costCarriers[2]}}))];
      }
      case "/service/details":return serviceRecords(this.store).find(row=>row.uuid===input.uuid)??{errorCode:"NOT_FOUND"};
      case "/projektakte/listprojektakten":return page(calendarReferences.projects);
      case "/projektakte/details":return withStatusLabel("PROJEKT",calendarReferences.projects.find(project=>project.uuid===input.uuid)??{errorCode:"NOT_FOUND"});
      case "/vorgang/details":return withStatusLabel(String(input.vorgangstyp),[...calendarReferences.transactions,...offerSeeds.offers].find(item=>item.uuid===input.uuid&&item.vorgangstyp===input.vorgangstyp)??{errorCode:"NOT_FOUND"});
      case "/vorgang/listauftraege":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="AUFTRAG"));
      case "/vorgang/listangebote":{const wanted=Array.isArray((body as {statusUUIDs?:unknown})?.statusUUIDs)&&((body as {statusUUIDs:string[]}).statusUUIDs).length?new Set((body as {statusUUIDs:string[]}).statusUUIDs):null;return page([...calendarReferences.transactions.filter(item=>item.vorgangstyp==="ANGEBOT"),...offerSeeds.offers.map(({belegDatum,...row})=>{void belegDatum;return row;})].filter(item=>!wanted||wanted.has(String((item as {vorgangStatus?:{uuid?:string}}).vorgangStatus?.uuid))));}
      case "/vorgang/listbedarfsmeldungen":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="BEDARFSMELDUNG"));
      case "/vorgang/listrechnungen":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="RECHNUNG"));
      case "/vorgang/listlieferscheine":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="LIEFERSCHEIN"));
      case "/vorgang/listbestellungen":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="BESTELLUNG"));
      case "/vorgang/listwareneingaenge":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="WARENEINGANG"));
      case "/vorgang/listruecknahmen":return page(calendarReferences.transactions.filter(item=>item.vorgangstyp==="RUECKNAHME"));
      case "/objekt/listobjekte":return page([...objectRows,...unitRows]);
      case "/objekt/detailsbatch":{const ids=(body as {uuids:string[]}).uuids;if(!Array.isArray(ids)||ids.length>1000)throw Error("Ungültige Objektliste.");return ids.map(id=>{const found=[...objectRows,...unitRows].find(row=>row.uuid===id);if(!found)throw Error("Objekt fehlt.");return found;});}
      case "/objekt/details":return [...objectRows,...unitRows].find(row=>row.uuid===input.uuid)??{errorCode:"NOT_FOUND"};
      case "/person/listkunden":return page(customerRows);
      case "/person/listpersonen":return page([...customerRows,...personRows]);
      case "/person/details":return [...customerRows,...personRows].find(row=>row.uuid===input.uuid)??{errorCode:"NOT_FOUND"};
      case "/person/listfunktionen":return new SimulatedWriteApi(this.store,this.workflow??"metadata").request(method,path,body);
      case "/mitarbeiter/listmitarbeiter":return page(employeeRows);
      case "/mitarbeiter/listfachbereiche":return trades(units);
      case "/administration/listfeiertage":return simulatedHolidays.holidays;
      case "/administration/listfeiertagsgruppen":return simulatedHolidays.groups;
      case "/administration/listressourcengruppen":return resourceGroups.groups;
      case "/mitarbeiter/detailsbatch":{const ids=(body as {uuids:string[]}).uuids;if(!Array.isArray(ids)||ids.length>1000)throw Error("Ungültige Mitarbeiterliste.");return ids.map(id=>{const found=employeeRows.find(row=>row.uuid===id);if(!found)throw Error("Mitarbeiter fehlt.");return found;});}
      case "/mitarbeiter/details":return employeeRows.find(row=>row.uuid===input.uuid)??{errorCode:"NOT_FOUND"};
      case "/datenansichten/list":return [{uuid:"sim-return-links-view",name:simulatedReturnLinkView,beschreibung:"Fiktiver Entwurf zur Rücklaufzuordnung, kein PDS-Standardname",columns:[{uuid:"sim-return-link-id",name:"ruecklaufUUID",typeName:"TEXT"},{uuid:"sim-return-link-incident",name:"serviceauftragebeneUUID",typeName:"TEXT"}]},calendarColorView,vacationApprovalView,workingTimeView,{uuid:"sim-view-project-managers",name:"sim_site_managers",beschreibung:"Fiktive betriebliche Bauleiter-Eignung; View-Entwurf, kein PDS-Standardname",columns:[{uuid:"sim-col-employee",name:"mitarbeiterUUID",typeName:"TEXT"}]}];
      case "/datenansichten/listdaten":if(input.name===simulatedReturnLinkView)return returnSeeds.flatMap(row=>row.rootEbene.ebenen.map(level=>({ruecklaufUUID:row.uuid,serviceauftragebeneUUID:level.serviceauftragebeneUUID}))).slice((input.page??0)*(input.entriesPerPage??500),((input.page??0)+1)*(input.entriesPerPage??500));if(input.name===workingTimeView.name)return workingTimeRows(input);if(input.name===vacationApprovalView.name)return vacationApprovalRows(this.store,input);if(input.name==="sim_calendar_colors")return calendarColors;if(input.name!=="sim_site_managers")throw new Error("Datenansicht nicht konfiguriert.");return employees.filter(employee=>employee.siteManager).map(employee=>({mitarbeiterUUID:employee.id}));
      default:if(this.workflow)return new SimulatedWriteApi(this.store,this.workflow).request(method,path,body);throw new Error("Dokumentierter Endpunkt im Simulator noch nicht implementiert.");
    }
  }
}
