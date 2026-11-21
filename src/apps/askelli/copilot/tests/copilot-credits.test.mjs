import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missingCopilotCredits,missingCreditsMessage} from '../credits.ts';
import {copilotMessage} from '../transport.ts';
const config={botId:'fictional-bot',secret:'fictional-secret-for-credits-tests-only'};
const notice='You need credits to continue. Learn more at https://private.invalid/secret';
function service(activities){return async(url,init)=>{
 if(url.endsWith('/tokens/generate'))return Response.json({token:'fictional-token'});
 if(url.endsWith('/conversations'))return Response.json({conversationId:'fictional-conversation'});
 if(init.method==='POST')return Response.json({id:'request-id'});
 return Response.json({activities});
};}
test('recognizes the explicit Microsoft credit notice, including formatting and safe JSON envelopes',()=>{
 for(const value of [notice,'  YOU NEED CREDITS TO CONTINUE','**You need credits to continue.**\nLearn more',JSON.stringify({answer:notice,action:null}),JSON.stringify({error:{message:notice}})])assert.equal(missingCopilotCredits(value),true);
});
test('does not classify ordinary questions, quotes, unrelated errors or credit explanations as missing credits',()=>{
 for(const value of [null,{},'What does "You need credits to continue" mean?','Copilot credits are used for responses.','You need credits to continueX','HTTP 429: too many requests','{"question":"You need credits to continue"}','"You need credits to continue"'])assert.equal(missingCopilotCredits(value),false);
});
test('an authenticated bot credit notice replaces the format error without returning raw contents',async()=>{
 for(const replyToId of [undefined,'request-id']){
  let calls=0;const transport=service([{type:'message',from:{id:'another-channel-id',role:'bot'},replyToId,text:notice}]);
  await assert.rejects(copilotMessage(config,'fictional-owner',{protocolTest:true},async(...args)=>{calls++;return transport(...args);}),e=>e.status===503&&e.message===missingCreditsMessage&&!e.message.includes('private.invalid')&&!e.message.includes('Antwortformat'));
  assert.equal(calls,4,'fail promptly instead of polling or generating any action');
 }
});
test('credit notices in HTTP errors receive the same safe diagnosis',async()=>{
 await assert.rejects(copilotMessage(config,'fictional-owner',{},async()=>Response.json({error:{message:notice}},{status:403})),e=>e.status===503&&e.message.includes('Copilot Credits')&&!e.message.includes('private.invalid'));
});
test('user echoes and explicitly unrelated bot replies do not trigger a credit diagnosis',async()=>{
 const transport=service([{type:'message',from:{id:'user',role:'user'},text:notice},{type:'message',from:{id:config.botId,role:'bot'},replyToId:'other-request',text:notice},{type:'message',from:{id:config.botId,role:'bot'},replyToId:'request-id',text:'{"answer":"Correct","action":null}'}]);
 assert.equal((await copilotMessage(config,'fictional-owner',{},transport)).answer,'Correct');
});
