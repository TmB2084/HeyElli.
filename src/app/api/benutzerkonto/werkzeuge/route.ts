import {appRoleStore} from '@/platform/app-access';
import {grantedTools} from '@/platform/app-access/tools';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,permitted,sameOrigin} from '@/platform/session';
import {toolPreferenceStore,PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'Die Werkzeugauswahl konnte nicht gespeichert oder geladen werden. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}
async function scopedGET(){try{
 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte zuerst anmelden.'},{status:user?403:401,headers});
 const rights=await appRoleStore().rights(user.id);
 return Response.json({...await toolPreferenceStore().read(user.id),owner:user.id,tools:grantedTools(rights.apps,rights.tools)},{headers});
}catch(error){return failure(error);}}
async function scopedPOST(request:Request){try{
 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte zuerst anmelden.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const reader=request.body?.getReader();if(!reader)throw new PlatformError('Werkzeugauswahl fehlt.');
 const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();throw new PlatformError('Eingabe zu groß.',413);}chunks.push(part.value);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PlatformError('Ungültige Eingabe.');}
 if(!body||body.owner!==user.id)throw new PlatformError('Benutzer wurde gewechselt. Bitte das Menü erneut öffnen.',409);
 return Response.json({...await toolPreferenceStore().write(user.id,body.hidden,body.version),owner:user.id},{headers});
}catch(error){return failure(error);}}

export const GET=withRouteAccess('/api/benutzerkonto/werkzeuge','GET',scopedGET);

export const POST=withRouteAccess('/api/benutzerkonto/werkzeuge','POST',scopedPOST);
