import {withRouteAccess} from '@/platform/app-access/route-access';
import {elliAvailable} from '@/platform/server-operation';
import {session,permitted,sameOrigin} from '@/platform/session';
import {assistantFeedbackStore,PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
async function handle(request:Request){try{
 const user=await session();if(!user)return Response.json({error:'Bitte zuerst anmelden.'},{status:401,headers});
 if(!permitted(user,'admin'))throw new PlatformError('Bewertungen sind ausschließlich für Administratoren verfügbar.',403);
 if(!elliAvailable())throw new PlatformError('Elli ist nur in der Entwicklungsumgebung verfügbar.',503);
 const store=assistantFeedbackStore(),url=new URL(request.url);
 if(request.method==='GET'){
  if(url.searchParams.get('review')==='1')return Response.json({...await store.review(user.id,Number(url.searchParams.get('page')??0)),ownUserId:user.id},{headers});
  const epoch=url.searchParams.get('epoch');if(!epoch||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(epoch))throw new PlatformError('Ungültige Chatkennung.');
  return Response.json({items:await store.own(user.id,epoch)},{headers});
 }
 if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 const reader=request.body?.getReader();if(!reader)throw new PlatformError('Bewertung fehlt.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>5000){await reader.cancel();throw new PlatformError('Bewertung zu groß.',413);}chunks.push(item.value);}
 let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new PlatformError('Ungültige Bewertung.');}
 return Response.json(request.method==='DELETE'?await store.remove(user.id,input):await store.save(user.id,input),{headers});
}catch(error){return Response.json({error:error instanceof PlatformError?error.message:'Die Bewertung konnte nicht verarbeitet werden. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}}
async function scopedGET(request:Request){return handle(request);}
async function scopedPOST(request:Request){return handle(request);}
async function scopedDELETE(request:Request){return handle(request);}

export const GET=withRouteAccess('/api/assistent/bewertungen','GET',scopedGET);

export const POST=withRouteAccess('/api/assistent/bewertungen','POST',scopedPOST);

export const DELETE=withRouteAccess('/api/assistent/bewertungen','DELETE',scopedDELETE);
