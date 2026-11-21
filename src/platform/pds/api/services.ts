import {PdsProtocolError,type PdsTransport} from "./protocol.ts";
type Service={uuid:string;vorgangsNummer:string;bezeichnung?:string;vorgangStatus?:{bezeichnung?:string}};
type Incident={uuid:string;serviceAuftrag:Service;serviceAuftragEbene:{objektUUID?:string;hauptmonteurUUID?:string;auszufuehrendeArbeiten?:string}};
type DocumentMeta={uuid:string;fileName?:string};
export class PdsServices {
  private api:PdsTransport;
  constructor(api:PdsTransport){this.api=api;}
  private async incidents():Promise<Incident[]> {
    const rows:Incident[]=[];
    for(let page=0;page<1000;page++) {
      const result=await this.api.request('POST','/service/liststoerungen',{page,entriesPerPage:500}) as {totalHitCount:number;resultList:Incident[]};
      if(!Array.isArray(result?.resultList)||typeof result.totalHitCount!=='number')throw new PdsProtocolError('Ungültige PDS-Störungsliste.');
      if(result.resultList.some(row=>!row.serviceAuftrag?.uuid||!row.serviceAuftrag.vorgangsNummer||!row.serviceAuftragEbene))throw new PdsProtocolError('Unvollständiger PDS-Auftragsbezug.');
      rows.push(...result.resultList);if(rows.length>=result.totalHitCount)return rows;
      if(!result.resultList.length)throw new PdsProtocolError('PDS-Paginierung liefert keine weiteren Störungen.');
    }
    throw new PdsProtocolError('PDS-Paginierung überschreitet Sicherheitsgrenze.');
  }
  async documents(uuid:string):Promise<DocumentMeta[]> {
    const result=await this.api.request('GET',`/service/listauftragsdokumente/${encodeURIComponent(uuid)}`);
    if(!Array.isArray(result)||result.some(item=>!item||typeof item.uuid!=='string'))throw new PdsProtocolError('Ungültige PDS-Dokumentliste.');
    return result;
  }
  async list(objectId:string,query:string,offset:number,limit:number,unitId?:string) {
    const object=await this.api.request('POST','/objekt/details',{uuid:objectId}) as {uuid:string;childrenUUIDs?:string[]};
    if(object?.uuid!==objectId)throw new PdsProtocolError('Objekt nicht gefunden.');
    if(unitId&&!object.childrenUUIDs?.includes(unitId))throw new PdsProtocolError('Technische Einheit gehört nicht zum ausgewählten Objekt.');
    const ids=new Set(unitId?[unitId]:[objectId,...object.childrenUUIDs??[]]);
    const rows=(await this.incidents()).filter(row=>ids.has(row.serviceAuftragEbene.objektUUID??''));
    const grouped=new Map<string,Incident[]>();for(const row of rows)grouped.set(row.serviceAuftrag.uuid,[...grouped.get(row.serviceAuftrag.uuid)??[],row]);
    const terms=query.toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    const candidates=[...grouped.values()].map(group=>({service:group[0].serviceAuftrag,description:group.map(row=>row.serviceAuftragEbene.auszufuehrendeArbeiten??row.serviceAuftrag.bezeichnung??'').join('; '),label:`${group[0].serviceAuftrag.vorgangsNummer} · ${group.map(row=>row.serviceAuftragEbene.auszufuehrendeArbeiten??row.serviceAuftrag.bezeichnung??'').join('; ')} · ${group[0].serviceAuftrag.vorgangStatus?.bezeichnung??'Unbekannt'}${group.some(row=>row.serviceAuftragEbene.hauptmonteurUUID)?' · Techniker eingeplant':''}`})).filter(row=>terms.every(term=>row.label.toLocaleLowerCase('de').includes(term))).sort((a,b)=>a.service.vorgangsNummer.localeCompare(b.service.vorgangsNummer,'de'));
    const items=await Promise.all(candidates.slice(offset,offset+limit).map(async row=>{
      const docs=await this.documents(row.service.uuid);
      const documents=docs.map(doc=>({name:doc.fileName??'Dokument',url:`/api/pds-simulator/orders/${encodeURIComponent(row.service.vorgangsNummer)}/document?documentUUID=${encodeURIComponent(doc.uuid)}`}));
      return {id:row.service.uuid,label:row.label,number:row.service.vorgangsNummer,description:row.description,status:row.service.vorgangStatus?.bezeichnung??'Unbekannt',documents,...(documents[0]?{documentUrl:documents[0].url,documentName:documents[0].name}:{})};
    }));
    return {items,total:candidates.length};
  }
  async download(number:string,documentUUID?:string) {
    const service=(await this.incidents()).find(row=>row.serviceAuftrag.vorgangsNummer===number)?.serviceAuftrag;
    if(!service)return null;
    const detail=await this.api.request('POST','/service/details',{uuid:service.uuid}) as Service;
    if(detail?.uuid!==service.uuid || detail.vorgangsNummer!==number)throw new PdsProtocolError('Ungültige PDS-Auftragsantwort.');
    const docs=await this.documents(service.uuid);
    const doc=documentUUID ? docs.find(doc=>doc.uuid===documentUUID) : docs[0];
    if(!doc)return null; // Do not download a UUID not assigned to this service.
    const bytes=await this.api.request('GET',`/dokument/downloaddokument/${encodeURIComponent(doc.uuid)}`);
    if(!(bytes instanceof Uint8Array))throw new PdsProtocolError('Ungültige PDS-Dateiantwort.');
    return {name:doc.fileName??'Dokument',bytes};
  }
}
