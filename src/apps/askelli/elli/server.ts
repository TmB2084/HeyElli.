import {grantedTools} from '@/platform/app-access/tools';
import {requireAppRead} from '@/platform/app-access/route-access';
import {appForPath} from '@/platform/app-access/model';
import 'server-only';
import {appRoleStore,appPermission} from '@/platform/app-access';
import {createHash} from 'node:crypto';
import {helpTopics} from './knowledge';
const knowledgeVersion=createHash('sha256').update(JSON.stringify(helpTopics)).digest('hex');
import {permitted,sameOrigin} from '@/platform/session';
import {recentConversation} from './conversation';
import {assistantProvider} from './provider';
import {ollamaAnswer} from './ollama';
import {groundedHelpAnswer} from './help-search';
import {readableFunctionality} from './identity';
import {copilotStore,copilotMessage,protocolVersion,actionContext,prepareAction} from '@/apps/askelli/copilot/server';
import {assistantChatStore as chatStore} from '@/platform/store';

export async function readChat(userId:string){return chatStore().read(userId);}
export async function saveChatDraft(userId:string,epoch:string,id:string,text:string,revision:number){return chatStore().draft(userId,epoch,id,text,revision);}
export async function resetChat(userId:string,epoch:string){return chatStore().change(userId,epoch);}

import {scopeNotice} from './knowledge';
import {retrieveHelp} from './help-search';

export async function answerHelp(request:Request){
 const headers={'Cache-Control':'no-store'};const failure=(error:string,status:number)=>Response.json({error},{status,headers});
 const user=await requireAppRead('/');if(!user||!permitted(user,'read'))return failure('Bitte mit einem freigeschalteten Konto anmelden.',user?403:401);

 if(!sameOrigin(request))return failure('Unzulässiger Ursprung.',403);
 const reader=request.body?.getReader();if(!reader)return failure('Bitte eine Frage eingeben.',400);let size=0;const chunks:Uint8Array[]=[];while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>65536){await reader.cancel();return failure('Frage und Gesprächsverlauf sind zu lang.',413);}chunks.push(item.value);}
 let question:string;let epoch:string,id:string,draft:{id:string;revision:number}|undefined;try{const input=JSON.parse(Buffer.concat(chunks).toString());if(typeof input.question!=='string'||!input.question.trim()||input.question.length>1500)throw Error();question=input.question.trim();if(typeof input.epoch!=='string'||typeof input.id!=='string'||![input.epoch,input.id].every(value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)))throw Error();epoch=input.epoch;id=input.id;if(input.draft!==undefined){if(typeof input.draft?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.draft.id)||!Number.isSafeInteger(input.draft.revision)||input.draft.revision<1)throw Error();draft={id:input.draft.id,revision:input.draft.revision};}}catch{return failure('Bitte eine Frage mit höchstens 1500 Zeichen und einen gültigen Gesprächsverlauf übermitteln.',400);}
 const store=chatStore(),chat=await store.read(user.id);
 if(chat.epoch!==epoch)return failure('Der Chat wurde neu begonnen. Bitte den gespeicherten Chat erneut laden.',409);
 const previous=chat.turns.find(turn=>turn.id===id);if(previous){if(previous.question!==question)return failure('Diese Anfragekennung wurde bereits verwendet.',409);return Response.json({...previous,chat},{headers});}
 await store.enqueue(user.id,epoch,{id,question,...(draft?{draft}:{})});
 const history=recentConversation(chat.turns);
 async function persist(answer:string,sources:{title:string;href:string}[],hasAction=false){const turn={id,question,answer,sources,knowledgeVersion,...(hasAction?{hasAction:true}:{})};const saved=await store.change(user!.id,epoch,turn);return Response.json({...saved.turns.find(item=>item.id===id),chat:saved},{headers});}
 const selected=await assistantProvider();
 const notice=scopeNotice(question,selected.name==='copilot');if(notice)return persist(notice,[{title:'Elli und ihre Grenzen',href:'/hilfe#hilfe'}]);
 const allowedApps=await appRoleStore().allowed(user.id);
 const rights=await appRoleStore().rights(user.id);const functionality=readableFunctionality(permission=>permission==='write'?false:permitted(user,permission));functionality.apps=functionality.apps.filter(app=>allowedApps.includes(app.href));functionality.role=rights.roleName;functionality.permissions=['Rechte gelten je App. Schreibrechte bestehen für: '+(functionality.apps.filter(app=>rights.writeApps.includes(app.href)).map(app=>app.name).join(', ')||'keine App')+'.','Andere freigegebene Apps dürfen gelesen werden. Eigene Anzeigeeinstellungen, Sperrzeiten und Tauschwünsche behalten ihre persönlichen Regeln.','Freigegebene Menüleisten-Werkzeuge: '+(grantedTools(rights.apps,rights.tools).map(tool=>tool.name).join(', ')||'keine')+'.'];
 const topics=retrieveHelp(question,history.at(-1)?.question);
 if(selected.name==='ollama'){
  const grounded=groundedHelpAnswer(question,topics,permitted(user,'admin'),await appPermission(user,appForPath(topics[0]?.route?.split('?')[0]??'')??'/planboard'));
  const answer=grounded??(!topics.length?'Dazu finde ich keine belegte Funktion in meiner Anleitung. Welche App oder welchen Bedienweg meinst du?':await ollamaAnswer(question,history,topics,functionality));
  const current=await assistantProvider();if(current.name!=='ollama'||current.version!==selected.version)return failure('Der KI-Anbieter wurde geändert. Bitte erneut versuchen.',409);
  return persist(answer,topics.map(t=>({title:t.topicTitle+' · '+t.title,href:'/hilfe#'+t.id})));
 }
 const provider=selected;
 const canWrite=await appPermission(user,'/')&&await appPermission(user,'/planboard');
 const wantsAction=/^(?:bitte\s+)?(?:lege|erstelle|verschiebe|plane|gib|buche|verlege)\b|\b(?:kannst|könntest|würdest) du\b/iu.test(question)||(!/^(?:wie|wo|warum|was|welche|erkläre)\b/iu.test(question)&&/^(?:bitte\s+)?(?:lege|erstelle|verschiebe|plane|gib|buche|verlege)\b/iu.test(history.at(-1)?.question??''));
 const context=canWrite&&wantsAction?await actionContext([history.at(-1)?.question,question].filter(Boolean).join(' ')):{resources:[],events:[]};
 const answer=await copilotMessage(provider.config,user.id,{protocol:protocolVersion,now:new Date().toISOString(),timeZone:'Europe/Berlin',question,history:history.slice(-4).map(t=>({question:t.question.slice(0,1000),answer:t.answer.slice(0,1500)})),functionality,canWrite,knowledge:topics.map(t=>({title:t.title,text:t.text})).slice(0,4),context});
 const current=await copilotStore().active();if(current.settings.version!==provider.settings.version)return failure('Copilot-Freigabe wurde geändert. Bitte erneut versuchen.',409);
 if(answer.action){await prepareAction(user.id,epoch,id,provider.settings.version,answer.action,context);return persist('Ich habe einen Vorschlag vorbereitet. Prüfe die Angaben und bestätige die Aktion unten.',[],true);}
 return persist(answer.answer,topics.map(topic=>({title:topic.topicTitle+' · '+topic.title,href:'/hilfe#'+topic.id})));
}
