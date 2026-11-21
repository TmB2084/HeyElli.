import 'server-only';
import {session,permitted,sameOrigin} from '@/platform/session';
import {assistantChatStore,PlatformError} from '@/platform/store';
import {copilotMessage,protocolVersion} from '@/apps/askelli/copilot';
import {assistantProvider} from './provider';
import {ollamaGreeting} from './ollama';
import {greetingFallback} from './greeting';
const greetings=new Map<string,Promise<string>>();
export async function generateGreeting(request:Request){
 const headers={'Cache-Control':'no-store'},fail=(error:string,status:number)=>Response.json({error},{status,headers});
 const user=await session();if(!user||!permitted(user,'read'))return fail('Bitte zuerst anmelden.',user?403:401);if(!sameOrigin(request))return fail('Unzulässiger Ursprung.',403);
 const reader=request.body?.getReader();if(!reader)return fail('Chatkennung fehlt.',400);let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>200){await reader.cancel();return fail('Eingabe zu groß.',413);}chunks.push(part.value);}const raw=Buffer.concat(chunks).toString('utf8');let epoch:string;try{epoch=JSON.parse(raw).epoch;if(typeof epoch!=='string'||!/^[a-f0-9-]{36}$/i.test(epoch))throw Error();}catch{return fail('Ungültige Chatkennung.',400);}
 const store=assistantChatStore();if((await store.read(user.id)).epoch!==epoch)return fail('Der Chat wurde neu begonnen.',409);
 try{const provider=await assistantProvider(),key=user.id+':'+epoch+':'+provider.name+':'+provider.version;let pending=greetings.get(key);if(!pending){pending=provider.name==='ollama'?ollamaGreeting():copilotMessage(provider.config,user.id,{protocol:protocolVersion,greeting:true,question:'Stelle dich kurz als Elli vor und lade zu einer Frage ein.',canWrite:false}).then(reply=>reply.answer.length<=360?reply.answer:greetingFallback);greetings.set(key,pending);if(greetings.size>100)greetings.delete(greetings.keys().next().value!);void pending.catch(()=>greetings.delete(key));}const greeting=await pending;if((await store.read(user.id)).epoch!==epoch)return fail('Der Chat wurde neu begonnen.',409);return Response.json({epoch,greeting},{headers});}catch(error){return fail(error instanceof PlatformError?error.message:'Begrüßung derzeit nicht verfügbar.',503);}
}
