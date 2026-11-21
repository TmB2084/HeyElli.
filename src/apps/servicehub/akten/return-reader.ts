import {readReturnLinks} from '../../../platform/pds/api/return-links.ts';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readCore,ServiceReadError} from './reader.ts';
import {dispatchId,dispatchPdsDocuments} from './dispatch-reader.ts';
import {projectMaterials} from './material-reader.ts';
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceReadError('PDS liefert keinen gültigen Rücklauf.');return value as Record<string,unknown>;};
function text(value:unknown,max=400){if(value==null)return '';if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw new ServiceReadError('Rücklaufdaten überschreiten das Lesebudget oder sind ungültig.',413);return value.trim();}
export async function readReturn(api:PdsTransport,orderId:string,returnId:string){
 dispatchId(returnId);const core=await readCore(api,'order',dispatchId(orderId)),row=record(await api.request('GET','/ruecklauf/details/'+encodeURIComponent(returnId)));
 if(row.uuid!==returnId)throw new ServiceReadError('Die Rücklaufkennung stimmt nicht mit der Anfrage überein.');
 const {all,matching,materials,entries}=returnEvidence(row,new Set(core.file.incidents?.map(item=>item.id)));
 // Grunddaten belong to the whole return; Auftrag documents are scoped to its levels.
 const exclusive=matching.length===all.length,queries:[string,string,string][]=[...(exclusive?[['listdokumente','Grunddaten',returnId] as [string,string,string]]:[]),...entries.slice(0,12).map(entry=>['listauftragsdokumente','Einsatz',entry.id] as [string,string,string])];
 const documents=await dispatchPdsDocuments(api,returnId,'ruecklauf',queries);
 if(!exclusive)documents.errors.push('Grunddatendokumente dieses Rücklaufs sind nicht eindeutig auf diesen Auftrag begrenzt und werden nicht angezeigt.');
 if(entries.length>12)documents.errors.push('Dokumentbudget erreicht: Unterlagen der ersten zwölf zugeordneten Einsätze geprüft.');

 const result={id:returnId,number:text(row.vorgangsNummer,160),name:text(row.bezeichnung),status:row.vorgangStatus==null?'':text(record(row.vorgangStatus).bezeichnung),entries,materials,documents,notice:'Geprüfte Rücklaufdaten aus PDS. Der Rücklaufstatus ersetzt keine Abschlussbuchung.'};
 if(Buffer.byteLength(JSON.stringify(result))>2*1024*1024)throw new ServiceReadError('Der Rücklauf überschreitet das Lesebudget.',413);return result;
}

function returnEvidence(row:Record<string,unknown>,ids:Set<string>){
 const levels=record(row.rootEbene).ebenen;if(!Array.isArray(levels)||levels.length>100)throw new ServiceReadError('Die Einsatzliste des Rücklaufs ist ungültig oder zu groß.',413);
 const all=levels.map(record),matching=all.filter(level=>ids.has(String(level.serviceauftragebeneUUID)));
 if(!matching.length)throw new ServiceReadError('Dieser Rücklauf ist keinem Einsatz des geöffneten Auftrags zugeordnet.',404);
 const materials=projectMaterials({ebenen:matching}),seen=new Set<string>();
 const entries=matching.map(level=>{const id=dispatchId(level.uuid);if(seen.has(id))throw new ServiceReadError('Die Rücklaufzuordnung ist nicht eindeutig.');seen.add(id);const executionDate=text(level.ausfuehrDatum,10);if(executionDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(executionDate)||!Number.isFinite(Date.parse(executionDate+'T12:00:00Z'))||new Date(executionDate+'T12:00:00Z').toISOString().slice(0,10)!==executionDate))throw new ServiceReadError('Das Ausführungsdatum aus PDS ist ungültig.');return {id,incidentId:dispatchId(level.serviceauftragebeneUUID),work:text(level.ausgefuehrtenArbeiten,16000),executionDate,status:level.status==null?'':text(record(level.status).bezeichnung)};});
 return {all,matching,materials,entries};
}

export type ReturnSummary={id:string;number:string;name:string;status:string;executionDate:string;incidents:number};
export async function discoverReturns(api:PdsTransport,orderId:string,viewName?:string){
 const empty={configured:false,items:[] as ReturnSummary[],errors:[] as string[],notice:'Die automatische Rücklaufzuordnung benötigt eine freigegebene PDS-Datenansicht. Unter Einstellungen → Integrationen → PDS-Anbindung → Datenansichten einrichten.'};
 if(!viewName)return empty;
 const core=await readCore(api,'order',dispatchId(orderId)),ids=new Set(core.file.incidents?.map(item=>item.id)),links=await readReturnLinks(api,viewName),candidates=new Map<string,Set<string>>();
 for(const link of links)if(ids.has(link.serviceauftragebeneUUID)){const group=candidates.get(link.ruecklaufUUID)??new Set<string>();group.add(link.serviceauftragebeneUUID);candidates.set(link.ruecklaufUUID,group);}
 if(candidates.size>20)throw new ServiceReadError('Mehr als zwanzig Rückläufe zu diesem Auftrag. Die Zuordnungsansicht muss enger begrenzt werden.',413);
 const items:ReturnSummary[]=[],errors:string[]=[];let bytes=0;
 for(const [id,claimed]of candidates){try{const row=record(await api.request('GET','/ruecklauf/details/'+encodeURIComponent(id)));bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>8*1024*1024)throw new ServiceReadError('Das Lesebudget der Rücklaufprüfung ist erreicht.',413);if(row.uuid!==id)throw Error();const evidence=returnEvidence(row,ids),verified=new Set(evidence.entries.map(entry=>entry.incidentId));if([...claimed].some(id=>!verified.has(id)))throw Error();items.push({id,number:text(row.vorgangsNummer,160),name:text(row.bezeichnung),status:row.vorgangStatus==null?'':text(record(row.vorgangStatus).bezeichnung),executionDate:evidence.entries.map(entry=>entry.executionDate).sort().at(-1)??'',incidents:evidence.entries.length});}
 catch(error){if(error instanceof ServiceReadError&&error.status===413)throw error;errors.push('Ein Rücklauf konnte nicht mit seinem ursprünglichen Einsatz verifiziert werden. Die Zuordnung ist unvollständig; PDS-Ansicht und Verbindung prüfen.');}}
 items.sort((a,b)=>b.executionDate.localeCompare(a.executionDate)||a.number.localeCompare(b.number)||a.id.localeCompare(b.id));
 return {configured:true,items,errors,notice:'Zuordnung über die freigegebene Datenansicht; Inhalte und Auftragsbezug über die Rücklauf-API geprüft. Aktualität und Umfang hängen von der Ansicht ab.'};
}
