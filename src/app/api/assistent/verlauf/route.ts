import {withRouteAccess} from '@/platform/app-access/route-access';
import {elliAvailable} from '@/platform/server-operation';
import {session,permitted,sameOrigin} from '@/platform/session';
import {readChat,resetChat,saveChatDraft} from '@/apps/askelli/elli';
import {PlatformError,assistantFeedbackStore} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
async function handle(request?:Request){try{
 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte zuerst anmelden.'},{status:user?403:401,headers});
 if(!elliAvailable())return Response.json({error:'Elli ist nur in der Entwicklungsumgebung verfügbar.'},{status:503,headers});
 if(!request){const chat=await readChat(user.id),canRate=permitted(user,'admin');return Response.json({...chat,owner:user.id,canRate,feedback:canRate?await assistantFeedbackStore().own(user.id,chat.epoch):[]},{headers});}
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const reader=request.body?.getReader();if(!reader)throw new PlatformError('Chatkennung fehlt.');let size=0;const chunks:Uint8Array[]=[];while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>8000){await reader.cancel();throw new PlatformError('Eingabe zu groß.',413);}chunks.push(item.value);}
 let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new PlatformError('Ungültige Chatkennung.');}
 if(typeof value?.epoch!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(value.epoch))throw new PlatformError('Ungültige Chatkennung.');
 if(request.method==='PATCH')return Response.json(await saveChatDraft(user.id,value.epoch,value.id,value.text,value.revision),{headers});
 return Response.json(await resetChat(user.id,value.epoch),{headers});
}catch(error){return Response.json({error:error instanceof PlatformError?error.message:'Der gespeicherte Chat ist derzeit nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}}
async function scopedGET(){return handle();}
async function scopedDELETE(request:Request){return handle(request);}

async function scopedPATCH(request:Request){return handle(request);}

export const GET=withRouteAccess('/api/assistent/verlauf','GET',scopedGET);

export const DELETE=withRouteAccess('/api/assistent/verlauf','DELETE',scopedDELETE);

export const PATCH=withRouteAccess('/api/assistent/verlauf','PATCH',scopedPATCH);
