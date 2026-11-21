import {readTextLimited} from '../../../platform/http-safety/limits.ts';
import {randomUUID} from 'node:crypto';
import type {CopilotConfig} from './configuration.ts';
import {parseReply,type CopilotReply} from './protocol.ts';
import {PlatformError} from '../../../platform/store/model.ts';
import {allowedDirectLine,directLineEndpoints,tokenEndpoint} from './endpoints.ts';
import {directLineUserId} from './user-id.ts';
import {missingCopilotCredits,missingCreditsMessage} from './credits.ts';
import {externalWritesBlocked} from '../../../platform/server-operation/index.ts';

export const copilotBlockedMessage='Copilot ist in dieser Instanz abgeschaltet (keine externen Schreibzugriffe, z. B. Testinstanz). Keine Anfrage an Microsoft gesendet.';
export async function copilotMessage(config:CopilotConfig,owner:string,message:unknown,transport:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env):Promise<CopilotReply>{
 if(externalWritesBlocked(env))throw new PlatformError(copilotBlockedMessage,503);
 const signal=AbortSignal.timeout(55000),userId=directLineUserId(owner),turn=randomUUID();
 let phase='Regionsermittlung',endpoint=directLineEndpoints[config.region??'global'];
 async function json(url:string,token?:string,body?:unknown){
  let response:Response;
  try{response=await transport(url,{method:body===undefined?'GET':'POST',redirect:'error',cache:'no-store',signal,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{throw new PlatformError(`${phase}: ${signal.aborted?'Zeitüberschreitung':'Microsoft ist nicht erreichbar oder die Verbindung wurde unterbrochen'}. Keine Aktion ausgeführt.`,signal.aborted?504:503);}
  if(!response.ok){
   let raw='';try{raw=await readTextLimited(response,200000);}catch{/* No service response contents in diagnostics. */}
   if(missingCopilotCredits(raw))throw new PlatformError(`${phase}: ${missingCreditsMessage}`,503);
   raw=raw.toLowerCase();let detail='';
   if(/badargument/.test(raw)&&/user/.test(raw))detail=' Microsoft meldet eine ungültige technische Benutzerkennung. HeyElli muss eine kurze dl_-Kennung senden; ein Schlüsselwechsel behebt diesen Anfragefehler nicht.';
   else if(/databoundary|data boundary|regional|geographical|region-specific/.test(raw))detail=' Microsoft meldet eine abweichende Datenregion. Direct-Line-Region auswählen oder die Token-URL für Regionsermittlung hinterlegen.';
   else if(/expired|expiration/.test(raw))detail=' Microsoft meldet ein abgelaufenes Token. Ein aktuelles Direct-Line-Token oder das dauerhafte Kanal-Secret verwenden.';
   else if(/invalid.*secret|secret.*invalid|invalid.*token|token.*invalid/.test(raw))detail=' Microsoft meldet ungültige Kanal-Zugangsdaten. Secret 1 oder Secret 2 aus der Webkanalsicherheit verwenden.';
   const hint=response.status===401||response.status===403?'Zugang abgewiesen. Direct-Line-Secret bzw. Token, Kanalschutz und gewählte Region prüfen. Ein Entra-/Graph-Token oder eine SDK-Verbindungs-URL ist hier nicht verwendbar.':response.status===429?'Microsoft-Kontingent oder Anfragelimit erreicht. Bitte später erneut versuchen.':response.status===404?'Direct-Line-Endpunkt nicht gefunden. Region und Kanal prüfen.':response.status>=500?'Microsoft meldet eine Dienststörung. Bitte später erneut versuchen.':'Microsoft hat die Anfrage abgewiesen. Kanal und Einrichtung prüfen.';
   throw new PlatformError(`${phase} (HTTP ${response.status}): ${hint}${detail}`,502);
  }
  try{const text=await readTextLimited(response,200000);return JSON.parse(text);}catch{throw new PlatformError(`${phase}: Microsoft hat keine lesbare JSON-Antwort geliefert.`,502);}
 }
 const call=(path:string,token:string,body?:unknown)=>json(endpoint+path,token,body);
 try{
  if(config.tokenEndpoint){const url=tokenEndpoint(config.tokenEndpoint);const discovery=new URL('/powervirtualagents/regionalchannelsettings',url);discovery.search=url.search;const result=await json(discovery.href);endpoint=allowedDirectLine(result.channelUrlsById?.directline);}
  phase='Token-Anforderung';
  const generated=await call('/tokens/generate',config.secret,{user:{id:userId}});if(typeof generated.token!=='string'||!generated.token)throw new PlatformError('Token-Anforderung: Microsoft hat kein Direct-Line-Token geliefert.',502);
  phase='Gesprächsstart';
  const conversation=await call('/conversations',generated.token,{});if(typeof conversation.conversationId!=='string'||!conversation.conversationId||conversation.conversationId.length>300)throw new PlatformError('Gesprächsstart: Microsoft hat keine gültige Gesprächskennung geliefert.',502);
  const path='/conversations/'+encodeURIComponent(conversation.conversationId)+'/activities';
  const credential=typeof conversation.token==='string'&&conversation.token?conversation.token:generated.token;
  const text='HEYELLI_REQUEST\n'+JSON.stringify({...message as Record<string,unknown>,requestId:turn});if(Buffer.byteLength(text)>26000)throw new PlatformError('Der Gesprächskontext ist zu groß. Bitte einen neuen Chat beginnen.',400);
  phase='Nachrichtenversand';
  const sent=await call(path,credential,{type:'message',from:{id:userId},text,channelData:{heyelliRequestId:turn}});if(typeof sent.id!=='string'||!sent.id)throw new PlatformError('Nachrichtenversand: Microsoft hat die Nachricht nicht mit einer Kennung bestätigt.',502);
  let watermark='',uncorrelated=false,otherSender=false,invalidReply:PlatformError|undefined;
  const seen=new Set<string>();
  phase='Antwortempfang';
  for(let attempt=0;attempt<45;attempt++){
   const result=await call(path+(watermark?'?watermark='+encodeURIComponent(watermark):''),credential);if(!Array.isArray(result.activities))throw new PlatformError('Antwortempfang: Microsoft hat keine gültige Nachrichtenliste geliefert.',502);
   for(const activity of result.activities){
    if(activity.type!=='message'||activity.from?.role==='user'||activity.from?.id===userId)continue;
    if(activity.from?.role!=='bot'&&(activity.from?.role||activity.from?.id!==config.botId)){otherSender=true;continue;}
    if(typeof activity.id==='string'){if(seen.has(activity.id))continue;seen.add(activity.id);}
    if(activity.replyToId&&activity.replyToId!==sent.id)continue;
    if(missingCopilotCredits(activity.text))throw new PlatformError(missingCreditsMessage,503);
    let data:Record<string,unknown>|undefined;try{data=JSON.parse(activity.text);}catch{/* No arbitrary message content in diagnostics. */}
    // Each invocation has its own conversation and nonce. Unthreaded welcome
    // messages cannot become answers or actionable proposals without this nonce.
    if(activity.replyToId!==sent.id&&data?.requestId!==turn){uncorrelated=true;continue;}
    if(data?.requestId!==undefined&&data.requestId!==turn){uncorrelated=true;continue;}
    try{return parseReply(activity.text);}catch(error){invalidReply=error instanceof PlatformError?error:new PlatformError('Ungültiges Antwortformat.',502);}
   }
   if(typeof result.watermark==='string')watermark=result.watermark;
   if(attempt<44)await new Promise(resolve=>setTimeout(resolve,800));
  }
  if(invalidReply)throw new PlatformError('Antwortformat: '+invalidReply.message,502);
  if(uncorrelated)throw new PlatformError('Antwortzuordnung: Agentennachrichten empfangen, aber nicht eindeutig zu dieser Anfrage. Agent-Anweisungen aktualisieren: requestId aus HEYELLI_REQUEST unverändert im Antwort-JSON zurückgeben. Alternativ muss replyToId zur Anfrage passen.',502);
  if(otherSender)throw new PlatformError('Antwortzuordnung: Nachrichten ohne erkannte Bot-Rolle empfangen. Bot-ID bzw. Direct-Line-Senderkennung prüfen.',502);
  throw new PlatformError('Antwortempfang: Gespräch und Versand erfolgreich, aber keine passende Agentenantwort. Veröffentlichung, Antwort-Topic und Agenten-Anmeldung prüfen.',504);
 }catch(error){if(error instanceof PlatformError)throw error;throw new PlatformError(`${phase}: Verbindung unterbrochen oder ungültige Dienstantwort. Keine Aktion ausgeführt.`,503);}
}
