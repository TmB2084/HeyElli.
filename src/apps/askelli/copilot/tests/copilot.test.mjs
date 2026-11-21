import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseReply} from '../protocol.ts';
import {saveConfig,readConfig} from '../configuration.ts';
import {copilotMessage} from '../transport.ts';
const secret='fictional-directline-secret-for-isolated-tests';
test('Copilot accepts only allowlisted complete action intents and absolute zoned times',()=>{
 assert.equal(parseReply('{"answer":"Hallo","action":null}').answer,'Hallo');
 assert.equal(parseReply(JSON.stringify({answer:'Vorschlag',action:{kind:'create',title:'Prüftermin',resourceId:'fake-tech',start:'2026-11-16T09:00:00+01:00',end:'2026-11-16T10:00:00+01:00'}})).action.start,'2026-11-16T08:00:00.000Z');
 for(const action of [{kind:'delete',eventId:'e'},{kind:'mobile',eventId:'e',confirmed:true},{kind:'move',eventId:'e',start:'2026-11-16T09:00'},{kind:'create',title:'x',resourceId:'e',start:'2026-11-16T09:00:00Z',end:'2026-11-16T09:01:00Z'}])assert.throws(()=>parseReply(JSON.stringify({answer:'x',action})));
 assert.throws(()=>parseReply('Erledigt!'));assert.throws(()=>parseReply('{"answer":""}'));
});
test('Copilot credentials are encrypted in isolated ignored environment files, secret is not serialized in metadata',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-copilot-vault-')),old={env:process.env.APP_ENV,root:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=dir;
 try{const id=saveConfig({botId:'fixture-bot',secret});assert.deepEqual(readConfig(id),{botId:'fixture-bot',secret});const file=readdirSync(dir).find(v=>v.startsWith('.env.copilot.'));assert.ok(file);assert.ok(!readFileSync(join(dir,file),'utf8').includes(secret));assert.throws(()=>saveConfig({botId:'x',secret:'short'}));assert.deepEqual(readConfig(id),{botId:'fixture-bot',secret});}finally{if(old.env===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=old.env;if(old.root===undefined)delete process.env.HEYELLI_TEST_SETTINGS_DIR;else process.env.HEYELLI_TEST_SETTINGS_DIR=old.root;rmSync(dir,{recursive:true});}
});
test('Direct Line keeps credentials server-side, ignores welcomes and user echoes, and correlates the bot answer',async()=>{
 const calls=[];const transport=async(url,init)=>{calls.push({url,init});if(url.endsWith('/tokens/generate'))return Response.json({token:'short-lived-fixture-token'});if(url.endsWith('/conversations'))return Response.json({conversationId:'fake-conversation'});if(init.method==='POST')return Response.json({id:'request-activity'});return Response.json({activities:[{type:'message',from:{id:'fixture-bot'},text:'Welcome'},{type:'message',from:{id:'dl_user',role:'user'},replyToId:'request-activity',text:'Echo'},{type:'message',from:{id:'fixture-bot'},replyToId:'request-activity',text:'{"answer":"Hallo von Elli","action":null}'}]});};
 const reply=await copilotMessage({secret,botId:'fixture-bot'},'fictional-user',{question:'Hallo'},transport);assert.equal(reply.answer,'Hallo von Elli');assert.ok(calls.every(c=>c.url.startsWith('https://directline.botframework.com/')));assert.equal(calls[0].init.headers.Authorization,'Bearer '+secret);assert.ok(calls.slice(1).every(c=>!JSON.stringify(c).includes(secret)));assert.ok(!JSON.stringify(calls).includes('fictional-user'));
});
test('Microsoft errors do not leak response bodies or credential values',async()=>{
 await assert.rejects(copilotMessage({secret,botId:'fixture-bot'},'test',{},async()=>new Response('sensitive '+secret,{status:401})),e=>e.status===502&&!e.message.includes(secret)&&/Zugang abgewiesen/.test(e.message));
 await assert.rejects(copilotMessage({secret,botId:'fixture-bot'},'test',{},async()=>{throw Error('secret '+secret);}),e=>e.status===503&&!e.message.includes(secret));
});
