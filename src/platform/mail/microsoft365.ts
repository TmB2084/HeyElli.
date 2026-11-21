import {readJsonLimited} from '../http-safety/limits.ts';
import {microsoft365Environment} from './configuration.ts';
const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function microsoft365Configuration(env:NodeJS.ProcessEnv=microsoft365Environment()){
 const configured=!!(guid.test(env.M365_TENANT_ID??'')&&guid.test(env.M365_CLIENT_ID??'')&&env.M365_CLIENT_SECRET);
 return {configured,mode:'test' as const};
}
export async function testMicrosoft365(sender:string,env:NodeJS.ProcessEnv=microsoft365Environment(),transport:typeof fetch=fetch){
 const base={mode:'test' as const,sender,at:new Date().toISOString(),sendPermission:'not-tested' as const};
 if(!microsoft365Configuration(env).configured)return {...base,authentication:false,mailbox:false,message:'Microsoft-365-Konfiguration fehlt. Tenant-ID, Client-ID und Client-Secret unter Einstellungen → E-Mail → Absender einrichten.'};
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender)||sender.endsWith('.invalid'))return {...base,authentication:false,mailbox:false,message:'Bitte zuerst ein gültiges Microsoft-365-Absenderpostfach speichern.'};
 let authenticated=false;
 try{
  const tokenResponse=await transport(`https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.M365_CLIENT_ID!,client_secret:env.M365_CLIENT_SECRET!,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
  if(!tokenResponse.ok)return {...base,authentication:false,mailbox:false,message:'Microsoft-365-Anmeldung abgelehnt. App-Konfiguration und Gültigkeit der Anmeldedaten prüfen.'};
  const token=await readJsonLimited(tokenResponse,262144);
  if(typeof token.access_token!=='string'||!token.access_token)return {...base,authentication:false,mailbox:false,message:'Microsoft hat kein gültiges Zugriffstoken geliefert.'};
  authenticated=true;
  const mailbox=await transport(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/mailboxSettings/timeZone`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token.access_token}`}});
  // Never expose provider response bodies, tokens or mailbox settings to the client or logs.
  if(mailbox.body)await mailbox.body.cancel();
  return {...base,authentication:true,mailbox:mailbox.ok,message:mailbox.ok?'Anmeldung und Postfachzugriff erfolgreich. Kein Versand ausgeführt.':mailbox.status===403?'Anmeldung erfolgreich. Postfachzugriff verweigert: MailboxSettings.Read und Postfachbegrenzung prüfen.':mailbox.status===404?'Anmeldung erfolgreich. Postfach nicht gefunden; Absenderadresse bzw. Benutzerprinzipalname prüfen.':'Anmeldung erfolgreich. Postfachprüfung derzeit fehlgeschlagen; später erneut versuchen.'};
 }catch{return {...base,authentication:authenticated,mailbox:false,message:'Verbindung zu Microsoft unterbrochen oder Zeitüberschreitung. Bitte erneut versuchen.'};}
}

export type DeliveryResult={status:'accepted'|'retry'|'failed'|'unknown';error:string|null;delay?:number};
export async function sendMicrosoft365(mail:{sender:string;recipient:string;subject:string;body:string},env:NodeJS.ProcessEnv=microsoft365Environment(),transport:typeof fetch=fetch):Promise<DeliveryResult>{
 if(!microsoft365Configuration(env).configured)return {status:'failed',error:'Microsoft-365-Konfiguration fehlt.'};
 let token:string;
 try{
  const response=await transport(`https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.M365_CLIENT_ID!,client_secret:env.M365_CLIENT_SECRET!,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
  if(!response.ok)return {status:response.status===429||response.status>=500?'retry':'failed',error:'Microsoft-365-Anmeldung fehlgeschlagen.'};
  const result=await readJsonLimited(response,262144);if(typeof result.access_token!=='string'||!result.access_token)return {status:'failed',error:'Microsoft-Token fehlt.'};token=result.access_token;
 }catch{return {status:'retry',error:'Anmeldung derzeit nicht erreichbar.'};}
 try{
  const response=await transport(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mail.sender)}/sendMail`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:mail.subject,body:{contentType:'Text',content:mail.body},toRecipients:[{emailAddress:{address:mail.recipient}}]},saveToSentItems:true})});
  const status=response.status,retry=response.headers.get('Retry-After');if(response.body)await response.body.cancel();
  if(status===202)return {status:'accepted',error:null};
  if(status===429){const delay=retry?(Number.isFinite(Number(retry))?Number(retry):Math.ceil((Date.parse(retry)-Date.now())/1000)):60;return {status:'retry',error:'Microsoft begrenzt die Anfragerate.',delay:Number.isFinite(delay)?Math.max(60,delay):60};}
  if([400,401,403,404,405,413,422].includes(status))return {status:'failed',error:`Microsoft hat den Versand abgelehnt (HTTP ${status}).`};
  return {status:'unknown',error:'Versandergebnis unklar. Vor erneutem Versand in Exchange prüfen.'};
 }catch{return {status:'unknown',error:'Verbindung beim Versand abgebrochen. Annahme durch Microsoft unklar; keine automatische Wiederholung.'};}
}
