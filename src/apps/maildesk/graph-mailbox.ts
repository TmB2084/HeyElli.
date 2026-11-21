import {readJsonLimited} from '../../platform/http-safety/limits.ts';
import type {MailMessage} from './model.ts';
// Lesender Zugriff auf ein geteiltes Postfach über Microsoft Graph (App-Berechtigung Mail.Read, per
// Zugriffsrichtlinie auf genau dieses Postfach begrenzt). Mailtexte werden als Nur-Text angefordert
// (Prefer: outlook.body-content-type="text"), damit nie HTML aus Mails in heyelli dargestellt wird.
// Keine Schreibzugriffe auf Microsoft 365: Archiv, Markierung und Zuordnung bleiben in heyelli.
const MAX_BODY=20000,MAX_MESSAGES=100;
type Env=NodeJS.ProcessEnv;
async function token(env:Env,transport:typeof fetch){
 const response=await transport(`https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.M365_CLIENT_ID!,client_secret:env.M365_CLIENT_SECRET!,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
 if(!response.ok){if(response.body)await response.body.cancel();throw new MailboxError('Microsoft-365-Anmeldung für das Postfach abgelehnt.');}
 const value=await readJsonLimited(response,262144);if(typeof value.access_token!=='string'||!value.access_token)throw new MailboxError('Microsoft hat kein gültiges Zugriffstoken geliefert.');return value.access_token as string;
}
export class MailboxError extends Error{status:number;constructor(message:string,status=502){super(message);this.status=status;}}
const text=(value:unknown)=>typeof value==='string'?value:'';
function address(value:unknown){const mail=(value&&typeof value==='object'?(value as {emailAddress?:{name?:unknown;address?:unknown}}).emailAddress:undefined)??{};return {name:text(mail.name).slice(0,200),address:text(mail.address).slice(0,320).toLowerCase()};}
function message(row:Record<string,unknown>,attachments:MailMessage['attachments']=[]):MailMessage{
 const body=text((row.body as {content?:unknown}|undefined)?.content).slice(0,MAX_BODY);
 return {id:text(row.id),receivedAt:text(row.receivedDateTime),from:address(row.from),to:Array.isArray(row.toRecipients)?row.toRecipients.slice(0,20).map(address):[],subject:text(row.subject).slice(0,500)||'(ohne Betreff)',
  preview:text(row.bodyPreview).slice(0,255),body,unread:row.isRead===false,conversationId:text(row.conversationId),attachments};
}
// Verbindungsprüfung ohne Inhalte: Anmeldung und Lesezugriff auf den Posteingang (nur Kennung und Anzahl).
export async function testGraphMailbox(mailbox:string,env:Env,transport:typeof fetch=fetch):Promise<{ok:boolean;message:string}>{
 if(!env.M365_TENANT_ID||!env.M365_CLIENT_ID||!env.M365_CLIENT_SECRET)return {ok:false,message:'Microsoft-365-Zugangsdaten fehlen. Unter Einstellungen → Microsoft Graph einrichten.'};
 try{const access=await token(env,transport);const response=await transport(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox?$select=id,totalItemCount`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${access}`}});if(response.body)await response.body.cancel();
  if(response.ok)return {ok:true,message:'Anmeldung und Lesezugriff auf den Posteingang erfolgreich. Es wurden keine Mailinhalte gelesen.'};
  return {ok:false,message:response.status===403?'Anmeldung erfolgreich, Postfachzugriff verweigert: Anwendungsberechtigung Mail.Read und Exchange-Zugriffsrichtlinie für dieses Postfach prüfen.':response.status===404?'Anmeldung erfolgreich, Postfach nicht gefunden: Adresse prüfen.':'Postfach derzeit nicht erreichbar. Später erneut prüfen.'};}
 catch(error){return {ok:false,message:error instanceof MailboxError?error.message:'Verbindung zu Microsoft unterbrochen oder Zeitüberschreitung.'};}
}
export function graphMailbox(mailbox:string,env:Env,transport:typeof fetch=fetch){
 const base=`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`;
 async function get(path:string,access:string,limit=4*1024*1024){
  const response=await transport(base+path,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${access}`,Prefer:'outlook.body-content-type="text"'}});
  if(!response.ok){if(response.body)await response.body.cancel();throw new MailboxError(response.status===403?'Postfachzugriff verweigert: Mail.Read und Zugriffsrichtlinie prüfen.':response.status===404?'Postfach oder Nachricht nicht gefunden.':'Postfach derzeit nicht erreichbar.',response.status===404?404:502);}
  return readJsonLimited(response,limit);
 }
 return {
  async list():Promise<MailMessage[]>{const access=await token(env,transport);
   const value=await get(`/mailFolders/inbox/messages?$top=${MAX_MESSAGES}&$orderby=receivedDateTime desc&$select=id,receivedDateTime,from,toRecipients,subject,bodyPreview,body,isRead,hasAttachments,conversationId`,access,16*1024*1024);
   return (Array.isArray(value.value)?value.value as Record<string,unknown>[]:[]).map(row=>message(row)).filter(item=>item.id);},
  async read(id:string):Promise<MailMessage>{const access=await token(env,transport),path='/messages/'+encodeURIComponent(id);
   const [row,files]=await Promise.all([get(path+'?$select=id,receivedDateTime,from,toRecipients,subject,bodyPreview,body,isRead,conversationId',access),get(path+'/attachments?$select=id,name,size,contentType',access,1024*1024)]);
   const attachments=(Array.isArray(files.value)?files.value as unknown[]:[]).slice(0,50).map(item=>{const file=item as Record<string,unknown>;return {id:text(file.id),name:text(file.name).slice(0,255),size:typeof file.size==='number'?file.size:0,contentType:text(file.contentType).slice(0,100)};});
   return message(row,attachments);},
 };
}
