// Read-only credential/region diagnosis. Never prints credentials or service bodies.
import nextEnv from '@next/env';
import {Pool} from 'pg';
import {copilotMessage} from '../src/apps/askelli/copilot/transport.ts';
import {missingCopilotCredits} from '../src/apps/askelli/copilot/credits.ts';
import {protocolVersion} from '../src/apps/askelli/copilot/protocol.ts';
import {directLineUserId} from '../src/apps/askelli/copilot/user-id.ts';
import {databaseConfig} from '../src/platform/store/config.ts';
import {readConfig} from '../src/apps/askelli/copilot/configuration.ts';
import {directLineEndpoints,allowedDirectLine} from '../src/apps/askelli/copilot/endpoints.ts';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
if(process.env.APP_ENV&&process.env.APP_ENV!=='development')throw Error('Nur lokale Entwicklung.');
const pool=new Pool(databaseConfig(process.env));pool.on('error',()=>{});
try{
 const row=(await pool.query("SELECT enabled,config_id FROM platform.copilot_settings WHERE id='central'")).rows[0];
 if(!row||row.enabled||!row.config_id)throw Error('Deaktivierte hinterlegte Konfiguration erforderlich.');
 const config=readConfig(row.config_id);
 console.log(JSON.stringify({copilotEnabled:false,configuredRegion:config.region??'global',configuredDiscovery:!!config.tokenEndpoint,credentialLooksLikeJwt:/^[^.]+\.[^.]+\.[^.]+$/.test(config.secret)&&config.secret.startsWith('eyJ'),credentialLooksLikeUrl:/^https?:/.test(config.secret),credentialLooksLikeJson:config.secret.startsWith('{')}));
 let endpoint=directLineEndpoints[config.region??'global'];
 const environment=process.argv.slice(2).find(v=>!v.startsWith('--'))??(config.tokenEndpoint?new URL(config.tokenEndpoint).origin:undefined);
 if(environment){const url=new URL(environment);if(url.protocol!=='https:'||!/^[-a-z0-9]+(?:\.[-a-z0-9]+)?\.environment\.api\.powerplatform\.com$/.test(url.hostname)||url.username||url.password||url.port||url.hash||url.search||url.pathname!=='/')throw Error('Ungültige Microsoft-Umgebungsadresse.');
  const discovery=new URL('/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview',url);
  const r=await fetch(discovery,{redirect:'error',signal:AbortSignal.timeout(15000)});const data=await r.json().catch(()=>({}));
  let region='unknown';if(r.ok){endpoint=allowedDirectLine(data.channelUrlsById?.directline);region=Object.entries(directLineEndpoints).find(([,value])=>value===endpoint)?.[0]??'unknown';}
  console.log(JSON.stringify({discoveryStatus:r.status,discoveredRegion:region}));
 }
 const r=await fetch(endpoint+'/tokens/generate',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({user:{id:directLineUserId('heyelli-technical-diagnosis')}})});
 const body=await r.text();let data;try{data=JSON.parse(body);}catch{}
 const code=data?.error?.code??data?.code;
 const known=['BadArgument','Unauthorized','Forbidden','InvalidToken','InvalidSecret','TokenExpired','MissingProperty','DataBoundaryViolation','BotNotFound','InvalidBotId','InvalidCredentials','BadRequest'];
 const lower=body.toLowerCase();
 console.log(JSON.stringify({phase:'token',httpStatus:r.status,errorCode:known.includes(code)?code:'not-in-safe-list',responseJson:!!data,receivedToken:typeof data?.token==='string',hints:{region:/databoundary|data boundary|regional|geographical/.test(lower),expired:/expired|expiration/.test(lower),authorizationHeader:/authorization|bearer/.test(lower),user:/user/.test(lower),origin:/origin/.test(lower),bot:/bot/.test(lower),token:/token/.test(lower),secret:/secret/.test(lower),argument:/argument|parameter|property/.test(lower)}}));
 if(process.argv.includes('--full')&&r.ok){
  const shape={botMessages:0,jsonReplies:0,jsonInsideText:0,signInCards:0,signInText:false,creditMessageSeen:false};
  try{const answer=await copilotMessage({...config,region:Object.entries(directLineEndpoints).find(([,v])=>v===endpoint)?.[0]??config.region},'heyelli-technical-diagnosis',{protocol:protocolVersion,protocolTest:true},async(url,init)=>{
   const response=await fetch(url,init);if(url.includes('/activities')&&init.method==='GET'){
    const data=await response.clone().json().catch(()=>({}));for(const a of data.activities??[]){if(a.type!=='message'||a.from?.role==='user')continue;shape.botMessages++;shape.creditMessageSeen ||= missingCopilotCredits(a.text);try{JSON.parse(a.text);shape.jsonReplies++;}catch{}if(typeof a.text==='string'){shape.jsonInsideText ||= /[\{][\s\S]*"answer"/.test(a.text)?1:0;shape.signInText ||= /sign.?in|log.?in|anmeld|authenticate|authentication/.test(a.text.toLowerCase());}shape.signInCards+=(a.attachments??[]).filter(v=>/oauth|signin/.test(v.contentType??'')).length;}
   }return response;
  });console.log(JSON.stringify({fullProtocolPassed:answer.answer==='HEYELLI_COPILOT_READY'&&!answer.action}));}catch(error){console.log(JSON.stringify({fullProtocolPassed:false,safeError:error.message}));}
  console.log(JSON.stringify({replyShape:shape}));
 }
 const after=(await pool.query("SELECT enabled FROM platform.copilot_settings WHERE id='central'")).rows[0];console.log(JSON.stringify({copilotStillDisabled:after.enabled===false}));
}catch{console.error('Diagnose nicht vollständig ausführbar; Konfiguration, Datenbank oder Netzwerk nicht erreichbar. Keine vertraulichen Details ausgegeben.');process.exitCode=1;}finally{await pool.end();}
