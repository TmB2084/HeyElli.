// Regression tests for the audited transport limitations; no Microsoft network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directLineUserId} from '../user-id.ts';
import {validateConfig} from '../configuration.ts';
import {copilotMessage} from '../transport.ts';

const config={botId:'fictional-portal-id',secret:'fictional-directline-secret-for-audit-only'};
const reply={type:'message',from:{id:config.botId,role:'bot'},replyToId:'sent-id',text:'{"answer":"HEYELLI_COPILOT_READY","action":null}'};
function fixture(activity){
 const calls=[];let polls=0;
 const transport=async(url,init)=>{
  calls.push({url,method:init.method});
  if(url.endsWith('/tokens/generate'))return Response.json({token:'fictional-token'});
  if(url.endsWith('/conversations'))return Response.json({conversationId:'fictional-conversation'});
  if(init.method==='POST')return Response.json({id:'sent-id'});
  // Stop promptly after the ignored response. No production timeout or network.
  return ++polls===1?Response.json({activities:[activity],watermark:'1'}):new Response('',{status:503});
 };
 return {calls,transport,polls:()=>polls};
}
test('audit baseline: a stub matching all implementation assumptions passes',async()=>{
 const f=fixture(reply);
 assert.equal((await copilotMessage(config,'fictional-user',{protocolTest:true},f.transport)).answer,'HEYELLI_COPILOT_READY');
 assert.equal(f.polls(),1);
});
test('a bot role accepts another sender ID without weakening correlation',async()=>{
 const f=fixture({...reply,from:{id:'fictional-channel-id',role:'bot'}});
 assert.equal((await copilotMessage(config,'fictional-user',{protocolTest:true},f.transport)).answer,'HEYELLI_COPILOT_READY');
 assert.equal(f.polls(),1);
});
test('unthreaded bot replies echo the per-request nonce; unrelated welcomes are ignored',async()=>{
 let nonce;
 const transport=async(url,init)=>{
  if(url.endsWith('/tokens/generate'))return Response.json({token:'fictional-token'});
  if(url.endsWith('/conversations'))return Response.json({conversationId:'fictional-conversation'});
  if(init.method==='POST'){nonce=JSON.parse(JSON.parse(init.body).text.split('\n').slice(1).join('\n')).requestId;return Response.json({id:'sent-id'});}
  return Response.json({activities:[{...reply,replyToId:undefined,text:'{"answer":"Welcome","action":null}'},{...reply,replyToId:'other-id'},{...reply,replyToId:undefined,text:JSON.stringify({answer:'Correct',action:null,requestId:nonce})}]});
 };
 assert.equal((await copilotMessage(config,'fictional-user',{},transport)).answer,'Correct');
});
test('selected regional endpoint receives all credentials; no automatic global fallback',async()=>{
 const f=fixture(reply);await copilotMessage({...config,region:'europe'},'fictional-user',{},f.transport);
 assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://europe.directline.botframework.com'));
});
test('region discovery is credential-free and uses only allowlisted Microsoft Direct Line hosts',async()=>{
 const f=fixture(reply);let discovery=false;
 const transport=async(url,init)=>{if(url.includes('regionalchannelsettings')){discovery=true;assert.equal(init.headers.Authorization,undefined);return Response.json({channelUrlsById:{directline:'https://india.directline.botframework.com/'}});}return f.transport(url,init);};
 await copilotMessage({...config,tokenEndpoint:'https://fictional.environment.api.powerplatform.com/bots/example/directline/token?api-version=2022-03-01-preview'},'fictional-user',{},transport);
 assert.ok(discovery);assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://india.directline.botframework.com'));
 const malicious=async()=>Response.json({channelUrlsById:{directline:'https://attacker.invalid/'}});
 await assert.rejects(copilotMessage({...config,tokenEndpoint:'https://fictional.environment.api.powerplatform.com/bots/example/directline/token?api-version=2022-03-01-preview'},'fictional-user',{},malicious),/Keine Zugangsdaten/);
});
test('failures identify the exact phase and HTTP status without exposing bodies',async()=>{
 for(const [suffix,phase]of [['/tokens/generate','Token-Anforderung'],['/conversations','Gesprächsstart'],['/activities','Nachrichtenversand']]){
  const f=fixture(reply);await assert.rejects(copilotMessage(config,'fictional-user',{},async(url,init)=>url.endsWith(suffix)?new Response('private-token-and-content',{status:403}):f.transport(url,init)),e=>e.message.includes(phase)&&e.message.includes('HTTP 403')&&!e.message.includes('private-token'));
 }
});

test('unrelated or mismatched request IDs cannot produce an actionable proposal',async()=>{
 for(const activity of [{...reply,replyToId:'another-request'},{...reply,replyToId:undefined,text:JSON.stringify({answer:'stale',requestId:'old-request',action:{kind:'mobile',eventId:'fake'}})},{...reply,from:{id:config.botId,role:'user'}}]){
  const f=fixture(activity);await assert.rejects(copilotMessage(config,'fictional-user',{},f.transport));assert.equal(f.polls(),2);
 }
});
test('configuration rejects arbitrary hosts, SDK URLs and credentials embedded in discovery URLs',()=>{
 for(const tokenEndpoint of ['http://127.0.0.1/directline/token?api-version=x','https://attacker.invalid/directline/token?api-version=x','https://fictional.environment.api.powerplatform.com/authenticated/bots/x/conversations?api-version=x','https://user:password@fictional.environment.api.powerplatform.com/directline/token?api-version=x','https://fictional.environment.api.powerplatform.com/directline/token?api-version=x&secret=invalid'])assert.throws(()=>validateConfig({...config,tokenEndpoint}));
 assert.throws(()=>validateConfig({...config,region:'untrusted'}));
});

test('technical user IDs fit Microsoft limits and retain the complete pseudonymous hash',async()=>{
 const owner='fictional-owner';const id=directLineUserId(owner);
 assert.equal(id.length,46);assert.match(id,/^dl_[A-Za-z0-9_-]{43}$/);assert.equal(directLineUserId(owner),id);assert.notEqual(directLineUserId('other-owner'),id);assert.ok(!id.includes(owner));
 const f=fixture(reply);await copilotMessage(config,owner,{},async(url,init)=>{if(init.method==='POST'){const body=JSON.parse(init.body);if(url.endsWith('/tokens/generate'))assert.equal(body.user.id,id);else if(url.endsWith('/activities'))assert.equal(body.from.id,id);}return f.transport(url,init);});
});
test('Microsoft environment hosts with a region shard are accepted without accepting foreign hosts',()=>{
 const tokenEndpoint='https://fictional.aa.environment.api.powerplatform.com/bots/example/directline/token?api-version=2022-03-01-preview';
 assert.equal(validateConfig({...config,tokenEndpoint}).tokenEndpoint,tokenEndpoint);
 assert.throws(()=>validateConfig({...config,tokenEndpoint:tokenEndpoint.replace('.com/','.com.attacker.invalid/')}));
});
test('BadArgument about the user ID is reported as an application request problem',async()=>{
 await assert.rejects(copilotMessage(config,'fictional-user',{},async()=>Response.json({error:{code:'BadArgument',message:'Invalid user id private'}},{status:400})),e=>e.message.includes('technische Benutzerkennung')&&!e.message.includes('private'));
});
test('Testinstanz (HEYELLI_EXTERN_SCHREIBEN=aus): keine einzige Anfrage an Microsoft, klare Meldung',async()=>{
 const f=fixture(reply);
 await assert.rejects(copilotMessage(config,'fictional-user',{protocolTest:true},f.transport,{HEYELLI_EXTERN_SCHREIBEN:'aus'}),e=>e.status===503&&/in dieser Instanz abgeschaltet/.test(e.message));
 assert.equal(f.calls.length,0);
 assert.equal((await copilotMessage(config,'fictional-user',{protocolTest:true},f.transport,{})).answer,'HEYELLI_COPILOT_READY');
});
