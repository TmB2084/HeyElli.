import {PlatformError} from '../store/model.ts';
export const reportApps=['/','/anmeldung','/servicehub','/hilfe','/benutzerkonto','/einstellungen','/start','/casedesk','/planboard','/dutyboard','/maildesk','/taskhub','/missioncontrol'];
export const reportDirectives=new Set(['default-src','script-src','script-src-elem','script-src-attr','style-src','style-src-elem','style-src-attr','connect-src','img-src','font-src','frame-src','frame-ancestors','object-src','base-uri','form-action','worker-src','media-src','manifest-src']);
export type Report={app:string;directive:string;blockedKind:string;disposition:string};
export function normalizeReports(input:unknown,origin:string,modern:boolean):Report[]{
 const entries=modern?input:[input];if(!Array.isArray(entries)||!entries.length||entries.length>5)throw new PlatformError('Ungültige Meldungsanzahl.');
 return entries.map(entry=>{
  if(!entry||typeof entry!=='object')throw new PlatformError('Ungültige Browsermeldung.');const top=entry as Record<string,unknown>;
  if(modern&&top.type!=='csp-violation')throw new PlatformError('Unbekannte Browsermeldung.');
  const body=(modern?top.body:top['csp-report']) as Record<string,unknown>;if(!body||typeof body!=='object'||Array.isArray(body))throw new PlatformError('Ungültige Browsermeldung.');
  const directive=body[modern?'effectiveDirective':'effective-directive'],document=body[modern?'documentURL':'document-uri'],blocked=body[modern?'blockedURL':'blocked-uri'];
  if(typeof directive!=='string'||!reportDirectives.has(directive)||typeof document!=='string'||document.length>4096||typeof blocked!=='string'||blocked.length>4096)throw new PlatformError('Ungültige Browsermeldung.');
  let url;try{url=new URL(document);}catch{throw new PlatformError('Ungültiger Meldungsursprung.');}if(url.origin!==origin)throw new PlatformError('Fremder Meldungsursprung.',403);
  const app=reportApps.includes(url.pathname)?url.pathname:'other';
  let blockedKind=['inline','eval','wasm-eval'].includes(blocked)?blocked:'other';
  if(blocked.startsWith('data:'))blockedKind='data';else if(blocked.startsWith('blob:'))blockedKind='blob';else if(!['inline','eval','wasm-eval'].includes(blocked))try{blockedKind=new URL(blocked,origin).origin===origin?'same-origin':'external';}catch{/* Only the class is retained. */}
  // Never retain supplied policy, sample, source URL, query, fragment, IP or UA.
  return {app,directive,blockedKind,disposition:body.disposition==='report'?'report':'enforce'};
 });
}

export function eventReport(event:{effectiveDirective:string;blockedURI:string;disposition:string},origin:string,path:string){
 let blocked=event.blockedURI;
 if(blocked.startsWith('data:'))blocked='data:';
 else if(blocked.startsWith('blob:'))blocked='blob:'+origin+'/redacted';
 else if(!['inline','eval','wasm-eval'].includes(blocked)){try{blocked=new URL(blocked,origin).origin===origin?origin:'https://external.invalid';}catch{blocked='https://external.invalid';}}
 return {'csp-report':{'document-uri':origin+(reportApps.includes(path)?path:'/__other'),'effective-directive':event.effectiveDirective,'blocked-uri':blocked,disposition:event.disposition}};
}
