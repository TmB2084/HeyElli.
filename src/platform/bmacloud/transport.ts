import type {BmaConfig} from './configuration.ts';
import {PlatformError} from '../store/model.ts';
export type BmaPlant={aid:number;nr:string;name:string};
export async function plants(config:BmaConfig,number:string|undefined,transport:typeof fetch=fetch,signal?:AbortSignal):Promise<BmaPlant[]>{
 const url=new URL('api/v2/anlagen',config.baseUrl);if(number!==undefined)url.searchParams.set('nr',number);
 let response:Response;try{response=await transport(url,{headers:{Authorization:`Bearer ${config.token}`,Accept:'application/json'},cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});}catch{throw new PlatformError('BMACloud nicht erreichbar oder Zeitüberschreitung. Adresse, Netzwerk und Zertifikat prüfen.',502);}
 if(!response.ok){await response.body?.cancel();throw new PlatformError(response.status===401?'BMACloud lehnt das API-Token ab (HTTP 401).':response.status===403?'Keine BMACloud-Berechtigung für Anlagen (HTTP 403).':`BMACloud-Anlagen konnten nicht geladen werden (HTTP ${response.status}).`,502);}
 const reader=response.body?.getReader();if(!reader)throw new PlatformError('BMACloud liefert keine Anlagendaten.',502);
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();throw new PlatformError('BMACloud-Antwort zu groß. Anlagenfilter mit dem Anbieter prüfen.',502);}chunks.push(value);}}catch(error){if(error instanceof PlatformError)throw error;throw new PlatformError('BMACloud-Verbindung beim Laden der Anlagen unterbrochen. Bitte erneut prüfen.',502);}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PlatformError('BMACloud liefert kein gültiges Anlagen-JSON. API-Adresse prüfen.',502);}
 if(!Array.isArray(data)||data.length>20000)throw new PlatformError('BMACloud liefert eine ungültige Anlagenliste.',502);
 return data.map(value=>{if(!value||typeof value!=='object'||!Number.isSafeInteger(value.aid)||value.aid<1||typeof value.nr!=='string')throw new PlatformError('BMACloud-Anlagen enthalten ungültige Kennungen.',502);return {aid:value.aid,nr:value.nr,name:typeof value.anlagenort==='string'?value.anlagenort:''};}).filter(value=>number===undefined||value.nr===number);
}
export function plantLinks(config:Pick<BmaConfig,'baseUrl'>,values:BmaPlant[]){return [...new Map(values.map(value=>[value.aid,value])).values()].map(value=>{const url=new URL('portal.php',config.baseUrl);url.searchParams.set('action','anlagen_add');url.searchParams.set('aid',String(value.aid));return {aid:value.aid,number:value.nr,name:value.name,url:url.href};});}
