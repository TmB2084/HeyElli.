import {readJsonLimited} from '../../../platform/http-safety/limits.ts';
import {ollamaBaseUrl} from '../../../platform/server-operation/index.ts';
import {PlatformError} from '../../../platform/store/model.ts';
import {elliInstructions,type Functionality} from './identity.ts';
import {elliAnswerStyle,naturalAnswer} from './language.ts';
import {greetingRequest,greetingText,greetingFallback} from './greeting.ts';
import type {ChatTurn} from './conversation.ts';
type Topic={title:string;topicTitle:string;text:string};
let answering=false;
export async function ollamaAnswer(question:string,history:ChatTurn[],topics:Topic[],functionality:Functionality,transport:typeof fetch=fetch){
 if(answering)throw new PlatformError('Elli beantwortet gerade eine Frage. Bitte gleich erneut versuchen.',429);
 answering=true;try{
  const response=await transport(ollamaBaseUrl()+'/api/chat',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3:1.7b',stream:false,think:false,keep_alive:'2m',options:{temperature:.2,num_ctx:8192,num_predict:500},messages:[{role:'system',content:elliInstructions(functionality)+'\n'+elliAnswerStyle+'\nAktueller Anbieter: lokales Ollama. Copilot ist INAKTIV. Du bist ausschließlich eine Bedienungshilfe. Keine aktuellen Fachdaten, keine Aktionswerkzeuge, keine Änderungen. Erkläre bei Änderungsaufträgen die Bedienung oder verweise auf die notwendige Copilot-Freigabe. Behaupte niemals, etwas gespeichert oder ausgegeben zu haben.\nBelegte Anleitung:\n'+topics.map(t=>t.topicTitle+' → '+t.title+'\n'+t.text).join('\n\n')},...history.flatMap(t=>[{role:'user',content:t.question},{role:'assistant',content:t.answer}]),{role:'user',content:question}]})});
  if(!response.ok)throw Error();return naturalAnswer((await readJsonLimited(response,262144)).message?.content);
 }catch(error){if(error instanceof PlatformError)throw error;throw new PlatformError('Elli ist lokal gerade nicht erreichbar. Bitte Ollama und das Modell qwen3:1.7b prüfen. Deine Frage bleibt gesichert.',503);}finally{answering=false;}
}
export async function ollamaGreeting(transport:typeof fetch=fetch){try{const r=await transport(ollamaBaseUrl()+'/api/chat',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json'},body:JSON.stringify(greetingRequest())});if(!r.ok)throw Error();return greetingText((await readJsonLimited(r,262144)).message?.content);}catch{return greetingFallback;}}
