import {readTextLimited} from '../../../platform/http-safety/limits.ts';
import {MicrosoftAuthError} from './errors.ts';
import {createLocalJWKSet,jwtVerify,type JSONWebKeySet} from 'jose';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {PlatformError} from '../../../platform/store/model.ts';
import {isUUID,type MicrosoftAuthConfig} from './configuration.ts';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const random=()=>randomBytes(32).toString('base64url');
const equal=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export const authority=(config:MicrosoftAuthConfig)=>`https://login.microsoftonline.com/${config.tenantId}`;
async function json(url:string,init:RequestInit,transport:typeof fetch){
 let response:Response;
 try{response=await transport(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new MicrosoftAuthError('Verbindung zu Microsoft unterbrochen oder Zeitüberschreitung. Netzwerk und TLS prüfen und erneut versuchen. Bisherige Zugangsdaten bleiben erhalten.',503,'connection');}
 let value;
 try{const text=await readTextLimited(response,262144);value=JSON.parse(text);}catch{throw new MicrosoftAuthError('Microsoft-Antwort unvollständig oder ungültig. Bitte erneut versuchen. Bisherige Zugangsdaten bleiben erhalten.',503,'connection');}
 if(!response.ok){
  if([401,403].includes(response.status)||['invalid_client','unauthorized_client','invalid_tenant'].includes(value?.error))throw new MicrosoftAuthError('Microsoft lehnt die Zugangsdaten ab. Tenant-ID, Client-ID und Secret-Wert bzw. dessen Gültigkeit prüfen lassen. Bisherige Zugangsdaten bleiben erhalten.',422,'credentials');
  throw new MicrosoftAuthError('Microsoft-Anfrage fehlgeschlagen. Rücksprungadresse, App-Zuweisung und Entra-Protokoll prüfen; bisherige Zugangsdaten bleiben erhalten.',422,'response');
 }
 return value;
}
export async function discovery(config:MicrosoftAuthConfig,transport:typeof fetch=fetch){
 const base=authority(config),metadata=await json(base+'/v2.0/.well-known/openid-configuration',{},transport);
 if(metadata.issuer!==base+'/v2.0'||metadata.authorization_endpoint!==base+'/oauth2/v2.0/authorize'||metadata.token_endpoint!==base+'/oauth2/v2.0/token'||!Array.isArray(metadata.id_token_signing_alg_values_supported)||!metadata.id_token_signing_alg_values_supported.includes('RS256'))throw new PlatformError('Microsoft-Metadaten passen nicht zum festgelegten Mandanten.',422);
 return {issuer:metadata.issuer as string};
}
export function authorization(config:MicrosoftAuthConfig,flow:{state:string;nonce:string;verifier:string}){const url=new URL(authority(config)+'/oauth2/v2.0/authorize');url.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:config.redirectUri,response_mode:'query',scope:'openid profile',state:flow.state,nonce:flow.nonce,code_challenge:createHash('sha256').update(flow.verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();return url.href;}
export async function verifyIdToken(token:string,config:MicrosoftAuthConfig,nonce:string,jwks:JSONWebKeySet){
 try{if(typeof token!=='string'||token.length>32000)throw Error();const {payload}=await jwtVerify(token,createLocalJWKSet(jwks),{issuer:authority(config)+'/v2.0',audience:config.clientId,algorithms:['RS256'],clockTolerance:30,requiredClaims:['exp','iat','nbf','nonce','tid','oid','sub'],maxTokenAge:'10m'});
 if(payload.ver!=='2.0'||payload.tid!==config.tenantId||!isUUID(payload.oid)||typeof payload.nonce!=='string'||!equal(payload.nonce,nonce))throw Error();
 // preferred_username dient nur der einmaligen Verknüpfung über die vom Admin hinterlegte Anmeldeadresse; dauerhaft gilt die oid.
 const upn=typeof payload.preferred_username==='string'&&/^[^\s@]{1,200}@[^\s@]{1,200}$/.test(payload.preferred_username)?payload.preferred_username.toLowerCase():null;
 return {id:`entra:${config.tenantId}:${payload.oid.toLowerCase()}`,upn};
 }catch{throw new PlatformError('Microsoft-Anmeldung konnte nicht sicher bestätigt werden. Bitte neu starten.',401);}
}
export async function exchange(config:MicrosoftAuthConfig,code:string,flow:{verifier:string;nonce:string},transport:typeof fetch=fetch){
 const token=await json(authority(config)+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,client_secret:config.secret,code,redirect_uri:config.redirectUri,code_verifier:flow.verifier,scope:'openid profile'})},transport);
 const keys=await json(authority(config)+'/discovery/v2.0/keys',{},transport);if(!keys||!Array.isArray(keys.keys))throw new PlatformError('Microsoft-Signaturschlüssel derzeit nicht verfügbar.',503);
 return verifyIdToken(token.id_token,config,flow.nonce,keys);
}
