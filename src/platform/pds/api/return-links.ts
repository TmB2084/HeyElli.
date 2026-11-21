import type {PdsTransport} from './protocol.ts';
export const simulatedReturnLinkView='sim_service_return_links';
export const returnViewCheckPath='/datenansichten/listdaten#return-links';
export class ReturnViewError extends Error{status=502;}
export type ReturnLink={ruecklaufUUID:string;serviceauftragebeneUUID:string};
const fail=(message:string):never=>{throw new ReturnViewError(message);};
function id(value:unknown){if(typeof value!=='string'||!value||value.length>200||value==='.'||value==='..'||/[\x00-\x1f%\\/?#]/.test(value))return fail('Die Rücklaufansicht enthält ungültige Zuordnungskennungen.');return value;}
/** Explicit two-column integration contract, not claimed to be a standard PDS view. */
export async function readReturnLinks(api:PdsTransport,name:string):Promise<ReturnLink[]>{
 if(!name||name.length>200||/[\x00-\x1f]/.test(name))fail('Die konfigurierte Rücklaufansicht ist ungültig.');
 let views:unknown;try{views=await api.request('GET','/datenansichten/list');}catch{fail('Die Rücklaufansichten konnten nicht geprüft werden. API-Rechte und Verbindung prüfen.');}
 if(!Array.isArray(views)||views.length>2000||Buffer.byteLength(JSON.stringify(views))>1024*1024)fail('Die Metadaten der Rücklaufansicht sind ungültig oder zu groß.');
 const matches=(views as Record<string,unknown>[]).filter(view=>view&&view.name===name);if(matches.length!==1)fail('Die konfigurierte Rücklaufansicht ist nicht eindeutig verfügbar. PDS-Freigabe und Ansichtsname prüfen.');
 const columns=matches[0].columns;if(!Array.isArray(columns)||columns.length!==2||!['ruecklaufUUID','serviceauftragebeneUUID'].every(name=>columns.filter(column=>column?.name===name).length===1))fail('Die Rücklaufansicht benötigt genau die Spalten ruecklaufUUID und serviceauftragebeneUUID.');
 const links=new Map<string,ReturnLink>();let bytes=0,count=0;
 for(let page=0;page<=40;page++){
  let value:unknown;try{value=await api.request('POST','/datenansichten/listdaten',{name,page,entriesPerPage:500});}catch{fail('Die Rücklaufzuordnung konnte nicht vollständig gelesen werden. API-Rechte und Verbindung prüfen.');}
  if(!Array.isArray(value)||value.length>500)fail('Die Rücklaufansicht liefert keine gültige Datenseite.');
  const rows=value as unknown[];count+=rows.length;bytes+=Buffer.byteLength(JSON.stringify(rows));if(count>20000||bytes>8*1024*1024)fail('Lesebudget der Rücklaufzuordnung erreicht. Die PDS-Ansicht muss enger begrenzt werden.');
  for(const value of rows){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['ruecklaufUUID','serviceauftragebeneUUID'].includes(key)))fail('Die Rücklaufansicht enthält unerwartete Spalten oder ungültige Zeilen.');const row=value as Record<string,unknown>,link={ruecklaufUUID:id(row.ruecklaufUUID),serviceauftragebeneUUID:id(row.serviceauftragebeneUUID)};links.set(JSON.stringify([link.ruecklaufUUID,link.serviceauftragebeneUUID]),link);}
  if(rows.length<500)return [...links.values()];
 }
 return fail('Die Rücklaufansicht konnte nicht vollständig gelesen werden.');
}
