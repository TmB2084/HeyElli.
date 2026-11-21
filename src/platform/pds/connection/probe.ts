import {readReturnLinks,returnViewCheckPath} from '../api/return-links.ts';
import {PdsHttpTransport,type PdsTransport} from '../api/protocol.ts';
import type {PdsConfiguration} from './configuration.ts';
export type PdsCheck={label:string;path:string;ok:boolean;message:string};
export async function probePds(config:PdsConfiguration,transport:PdsTransport=new PdsHttpTransport(config.baseUrl,config.token),returnLinkView?:string){
 const checks:PdsCheck[]=[];
 for(const [label,method,path,body] of [
  ['Terminkategorien','GET','/termin/listkategorien',undefined],
  ['Mitarbeitersuche','POST','/mitarbeiter/listmitarbeiter',{page:0,entriesPerPage:1}],
  ['Personenfunktionen','GET','/person/listfunktionen',undefined],
  ['Datenansichten-Metadaten','GET','/datenansichten/list',undefined],
 ] as const){
  try{const value=await transport.request(method,path,body);if(path==='/mitarbeiter/listmitarbeiter'){if(!value||typeof value!=='object'||!('resultList' in value)||!Array.isArray(value.resultList)||!('totalHitCount' in value)||typeof value.totalHitCount!=='number')throw Error('shape');}else if(!Array.isArray(value))throw Error('shape');checks.push({label,path,ok:true,message:'API erreichbar; Antwortstruktur geprüft. Keine Schreiboperation ausgeführt.'});}
  catch(error){const message=error instanceof Error?error.message:'';const status=message.match(/HTTP (\d{3})/)?.[1];checks.push({label,path,ok:false,message:status==='401'?'Anmeldung abgelehnt. Bearer-Token und Mandant prüfen.':status==='403'?'Zugriff verweigert. API-Rechte und PDS-Lizenz prüfen.':status==='404'?'API-Pfad nicht gefunden. Basisadresse und PDS-Version prüfen.':status?`PDS antwortet mit HTTP ${status}. Kein View-Fallback.`:message==='shape'?'Antwort passt nicht zum bereitgestellten API-Vertrag.':'Verbindung, TLS-Zertifikat oder Antwort fehlerhaft. Netzwerk und Serverprotokoll bei PDS prüfen.'});}
 }
 if(returnLinkView){try{await readReturnLinks(transport,returnLinkView);checks.push({label:'Rücklaufzuordnung',path:returnViewCheckPath,ok:true,message:'Ansichtsmetadaten und Zuordnungskennungen vollständig lesend geprüft. Keine Fachinhalte gespeichert.'});}catch{checks.push({label:'Rücklaufzuordnung',path:returnViewCheckPath,ok:false,message:'Rücklaufansicht nicht verfügbar, unvollständig oder mit abweichenden Spalten. Genau ruecklaufUUID und serviceauftragebeneUUID sowie Leserechte prüfen.'});}}
 return checks;
}
