import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedAssistantProvider} from '../provider-policy.ts';
import {reconcileLocalAssistant} from '../../../../../scripts/assistant-runtime-state.mjs';
import {ollamaAnswer,ollamaGreeting} from '../ollama.ts';
import {readableFunctionality} from '../identity.ts';
test('inactive Copilot selects Ollama; active Copilot selects Copilot; unknown state never silently falls back',()=>{
 assert.equal(selectedAssistantProvider(false),'ollama');assert.equal(selectedAssistantProvider(true),'copilot');for(const value of [undefined,null,'false'])assert.throws(()=>selectedAssistantProvider(value));
});
test('Testinstanz ohne externe Schreibzugriffe wählt nie Copilot, auch bei aktivem Schalter',()=>{
 const blocked={HEYELLI_EXTERN_SCHREIBEN:'aus'};
 assert.equal(selectedAssistantProvider(true,blocked),'ollama');assert.equal(selectedAssistantProvider(false,blocked),'ollama');
 assert.equal(selectedAssistantProvider(true,{HEYELLI_EXTERN_SCHREIBEN:'AUS '}),'ollama');
 assert.equal(selectedAssistantProvider(true,{}),'copilot');assert.throws(()=>selectedAssistantProvider(undefined,blocked));
});
test('runtime starts local Ollama, stops only its own child on activation, and starts it again on deactivation',async()=>{
 const owned={pid:'fictional'},calls=[];const io={reachable:async()=>false,start:()=>{calls.push('start');return owned;},stop:child=>{assert.equal(child,owned);calls.push('stop');}};
 let child=await reconcileLocalAssistant('ollama',null,io);assert.equal(child,owned);child=await reconcileLocalAssistant('ollama',child,io);assert.deepEqual(calls,['start']);child=await reconcileLocalAssistant('copilot',child,io);assert.equal(child,null);child=await reconcileLocalAssistant('ollama',child,io);assert.equal(child,owned);assert.deepEqual(calls,['start','stop','start']);
});
test('an already running external Ollama service is preserved and never stopped by Copilot activation',async()=>{
 const io={reachable:async()=>true,start:()=>assert.fail('must not spawn'),stop:()=>assert.fail('must not stop external service')};assert.equal(await reconcileLocalAssistant('ollama',null,io),null);assert.equal(await reconcileLocalAssistant('copilot',null,io),null);
});
test('Ollama answers use only loopback with a read-only instruction and no action tools',async()=>{
 let request;const answer=await ollamaAnswer('Bedienungsfrage',[],[{title:'Bedienung',topicTitle:'Hilfe',text:'Mit Doppelklick öffnen.'}],readableFunctionality(()=>true),async(url,init)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');request=JSON.parse(init.body);return Response.json({message:{content:'Öffne den Termin mit einem Doppelklick.'}});});assert.match(answer,/Doppelklick/);assert.match(request.messages[0].content,/Copilot ist INAKTIV/);assert.match(request.messages[0].content,/keine Aktionswerkzeuge/i);assert.equal(request.tools,undefined);
});
test('Ollama failure remains a local error and greeting has a bounded local fallback',async()=>{
 await assert.rejects(ollamaAnswer('Frage',[],[],readableFunctionality(()=>true),async()=>{throw Error('offline');}),e=>e.status===503&&/Ollama/.test(e.message));const greeting=await ollamaGreeting(async()=>{throw Error('offline');});assert.match(greeting,/Elli/);
});
