import {PdsProtocolError,type PdsTransport} from '../api/protocol.ts';
export class ReadonlyPdsTransport implements PdsTransport{
 private readonly upstream:PdsTransport;
 constructor(upstream:PdsTransport){this.upstream=upstream;}
 async request(method:'GET'|'POST',path:string,body?:unknown,options?:{signal?:AbortSignal}){
  const read=method==='GET'&&/^\/ruecklauf\/(?:details|listdokumente|listauftragsdokumente)\/[^/]+$/.test(path)||method==='GET'&&/^\/service\/(?:listdokumente|listauftragsdokumente)\/[^/]+$/.test(path)||method==='GET'&&/^\/wartungsvertrag\/wartungsintervalldetails\/[^/]+$/.test(path)||method==='POST'&&path==='/wartungsvertrag/listvertraegebyobjekt'||/^\/(administration|mitarbeiter|objekt|person|service|termin|vorgang|projekt|projektakte|datenansichten|ruecklauf|lager)\/(list[A-Za-z]*|details(?:batch)?|findstoerungtermin)$/.test(path)||method==='POST'&&/^\/crm\/(?:listaufgaben|aufgabedetails)$/.test(path)||method==='GET'&&path==='/crm/listaufgabentypen'||method==='GET'&&/^\/dokument\/downloaddokument\/[^/]+$/.test(path);
  if(!read)throw new PdsProtocolError('Echtes PDS ist nur zum Lesen freigegeben. Diese Schreibfunktion bleibt bis zur fachlichen Freigabe gesperrt.');
  return this.upstream.request(method,path,body,options);
 }
}
