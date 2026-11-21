import {PlatformError} from '../../../platform/store/model.ts';
export const directLineEndpoints={global:'https://directline.botframework.com/v3/directline',europe:'https://europe.directline.botframework.com/v3/directline',india:'https://india.directline.botframework.com/v3/directline'};
export type DirectLineRegion=keyof typeof directLineEndpoints;
export function tokenEndpoint(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new PlatformError('Direct-Line-Token-Endpunkt ist keine gültige URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!/^[-a-z0-9]+(?:\.[-a-z0-9]+)?\.environment\.api\.powerplatform\.com$/.test(url.hostname)||!url.pathname.endsWith('/directline/token')||[...url.searchParams.keys()].some(k=>k!=='api-version')||!url.searchParams.get('api-version'))throw new PlatformError('Hier wird die Direct-Line-Token-URL aus dem Kanal Mobile App benötigt. Canvas-, Webchat- und authentifizierte SDK-Gesprächs-URLs werden nicht unterstützt.');
 return url;
}
export function allowedDirectLine(value:unknown){
 if(typeof value!=='string')throw new PlatformError('Regionsermittlung: Microsoft hat keine Direct-Line-Adresse geliefert.',502);
 let url:URL;try{url=new URL(value);}catch{throw new PlatformError('Regionsermittlung: ungültige Microsoft-Adresse.',502);}
 const endpoint=Object.values(directLineEndpoints).find(v=>new URL(v).origin===url.origin);
 if(!endpoint||url.username||url.password||url.port||url.search||url.hash||!['/','/v3/directline','/v3/directline/'].includes(url.pathname))throw new PlatformError('Regionsermittlung: nicht unterstützte Direct-Line-Adresse. Keine Zugangsdaten übertragen.',502);
 return endpoint;
}
