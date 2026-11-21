import type {PdsTransport} from "./protocol.ts";
import {PdsProtocolError,readApiFirst} from "./protocol.ts";
type Row={uuid:string;bezeichnung?:string;name?:string;vorname?:string;nachname?:string;typ?:string;personUUID?:string;parentUUID?:string;childrenUUIDs?:string[];personalNummer?:string;funktionUUID?:string;berufsbezeichnung?:string;abteilungUUID?:string;ressourcenplanzeit?:{von?:string;bis?:string};standort?:{strasse?:string;plz?:string;ort?:string};objektInfoFelder?:{bezeichnung:string;wert:string}[];kundenRolle?:{kundennummer?:string};ansprechpartner?:{person:{uuid:string;name:string};funktionUUID?:string;ekommunikationswege?:Phone[]}[];ekommunkationswege?:Phone[]};
type Phone={typ:string;kategorie:string;value:string};
export type LookupVisibility={customers:readonly string[];objects:readonly string[]};
export type Lookup={id:string;label:string;name?:string;address?:string;customerNumber?:string;customerNumbers?:string[];function?:string;phones?:{label:string;number:string}[]};
const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replaceAll("ß","ss");
export class PdsLookups {
  private readonly transport:PdsTransport;
  private readonly projectManagerFunctions?:string[];
  constructor(transport:PdsTransport,options:{projectManagerFunctions?:string[]}={}){this.transport=transport;this.projectManagerFunctions=options.projectManagerFunctions;}
  async list(path:string):Promise<Row[]> {
    const rows:Row[]=[];
    for(let page=0;page<1000;page++) {
      const value=await this.transport.request("POST",path,{page,entriesPerPage:500});
      if(!value||typeof value!=="object"||!("resultList" in value)||!Array.isArray(value.resultList)||!("totalHitCount" in value)||typeof value.totalHitCount!=="number")throw new PdsProtocolError("Ungültige PDS-Listenantwort.");
      rows.push(...value.resultList);if(rows.length>=value.totalHitCount)return rows;
      if(!value.resultList.length)throw new PdsProtocolError("PDS-Paginierung liefert keine weiteren Datensätze.");
    }
    throw new PdsProtocolError("PDS-Paginierung überschreitet Sicherheitsgrenze.");
  }
  async detail(path:string,uuid:string):Promise<Row> {
    const value=await this.transport.request("POST",path,{uuid});
    if(!value || typeof value!=="object" || !("uuid" in value) || value.uuid!==uuid)throw new PdsProtocolError("Ungültige PDS-Detailantwort.");return value as Row;
  }
  async search(input:{resource:string;query:string;objectId?:string;offset:number;limit:number},scope="customer",visibility:LookupVisibility={customers:[],objects:[]}) {
    let items:Lookup[]=[];const info=(row:Row,name:string)=>row.objektInfoFelder?.find(field=>field.bezeichnung===name)?.wert??"";
    if(input.resource==="objects"||input.resource==="units") {
      let rows=await this.list("/objekt/listobjekte");
      const byId=new Map(rows.map(row=>[row.uuid,row])),parents=new Map<string,string>(),hiddenCustomers=new Set(visibility.customers),hiddenObjects=new Set(visibility.objects);
      for(const row of rows)for(const child of row.childrenUUIDs??[])parents.set(child,row.uuid);
      const visible=(row:Row)=>{const seen=new Set<string>();let current:Row|undefined=row;while(current&&!seen.has(current.uuid)){seen.add(current.uuid);if(hiddenObjects.has(current.uuid)||current.personUUID&&hiddenCustomers.has(current.personUUID))return false;current=byId.get(current.parentUUID??parents.get(current.uuid)??"");}return true;};
      rows=rows.filter(visible);
      if(input.resource==="units") {const parent=await this.detail("/objekt/details",input.objectId!);rows=rows.filter(row=>row.typ==="TECHNISCHE_EINHEIT" && (row.parentUUID===parent.uuid || parent.childrenUUIDs?.includes(row.uuid)));}
      else rows=rows.filter(row=>row.typ==="OBJEKT");
      items=rows.map(row=>({id:row.uuid,customerNumber:row.personUUID,label:[info(row,"Nummer"),row.bezeichnung,...(row.typ==="TECHNISCHE_EINHEIT" ? [info(row,"Standort"),info(row,"Gewerk"),info(row,"Hersteller"),info(row,"Typ")] : [row.standort?.strasse,row.standort?.plz,row.standort?.ort,row.personUUID])].filter(Boolean).join(" · "),...(row.typ==="OBJEKT"?{address:[row.standort?.strasse,row.standort?.plz,row.standort?.ort,row.bezeichnung].filter(Boolean).join(" · ")}:{})}));
    } else if(input.resource==="customers") {
      const customer=input.objectId ? (await this.detail("/objekt/details",input.objectId)).personUUID : undefined;
      items=(await this.list("/person/listkunden")).filter(row=>(!customer||row.uuid===customer)&&!visibility.customers.includes(row.uuid)).map(row=>({id:row.uuid,label:`${row.kundenRolle?.kundennummer??row.uuid} · ${row.name}`}));
    } else if(input.resource==="employees"||input.resource==="siteManagers") {
      let rows=await Promise.all((await this.list("/mitarbeiter/listmitarbeiter")).map(row=>this.detail("/mitarbeiter/details",row.uuid)));
      if(input.resource==="siteManagers") {
        // No documented employee field defines company-specific project-manager eligibility.
        const candidates=await readApiFirst<Set<string>>(async()=>this.projectManagerFunctions ? new Set(rows.filter(row=>row.funktionUUID && this.projectManagerFunctions!.includes(row.funktionUUID)).map(row=>row.uuid)) : undefined,async()=>new Set((await this.transport.request("POST","/datenansichten/listdaten",{name:"sim_site_managers",page:0,entriesPerPage:500}) as {mitarbeiterUUID:string}[]).map(row=>row.mitarbeiterUUID)));
        rows=rows.filter(row=>candidates.value.has(row.uuid));
      } else rows=rows.filter(row=>!!row.ressourcenplanzeit);
      items=rows.map(row=>({id:row.uuid,label:[row.personalNummer,`${row.vorname??""} ${row.nachname??""}`.trim(),input.resource==="siteManagers"?"Bauleiter":row.berufsbezeichnung,row.abteilungUUID].filter(Boolean).join(" · ")}));
    } else if(input.resource==="persons") {
      const object=await this.detail("/objekt/details",input.objectId!);
      const customers=await Promise.all((await this.list("/person/listkunden")).map(row=>this.detail("/person/details",row.uuid)));
      const contacts=new Map<string,Lookup>();
      for(const customer of customers)for(const contact of customer.ansprechpartner??[]) {
        const id=contact.person.uuid,existing=contacts.get(id);
        if(existing){existing.customerNumbers!.push(customer.uuid);continue;}
        const detail=await this.detail("/person/details",id);
        contacts.set(id,{id,name:detail.name,customerNumber:customer.uuid,customerNumbers:[customer.uuid],function:contact.funktionUUID,label:`${detail.name} · ${contact.funktionUUID??""} · ${customer.uuid}`,phones:(contact.ekommunikationswege??detail.ekommunkationswege??[]).filter(phone=>phone.kategorie==="GESCHAEFTLICH" && (phone.typ==="FESTNETZ"||phone.typ==="MOBIL")).map(phone=>({label:phone.typ==="MOBIL"?"Geschäftliches Mobiltelefon":"Geschäftliches Festnetz",number:phone.value}))});
      }
      items=[...contacts.values()].filter(person=>scope==="all" || person.customerNumbers?.includes(object.personUUID??""));
    }else if(input.resource==="functions") {items=(await this.transport.request("GET","/person/listfunktionen") as {uuid:string;bezeichnung:string}[]).map(row=>({id:row.uuid,label:row.bezeichnung}));}
    else throw new PdsProtocolError("Dieser Lookup ist nicht implementiert.");
    const terms=normalize(input.query).split(/\s+/).filter(Boolean);
    const matches=items.filter(item=>terms.every(term=>normalize(item.label).includes(term))).sort((a,b)=>a.label.localeCompare(b.label,"de"));
    return {items:matches.slice(input.offset,input.offset+input.limit),total:matches.length};
  }
}
