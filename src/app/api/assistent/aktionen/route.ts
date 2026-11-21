import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,permitted} from '@/platform/session';
import {confirmAction,ownAction} from '@/apps/askelli/copilot/server';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'Aktion konnte nicht bestätigt werden. Bitte Status im PlanBoard prüfen; nicht erneut auslösen.'},{status:error instanceof PlatformError?error.status:503,headers});}
async function scopedGET(request:Request){try{const user=await session();if(!user||!permitted(user,'read'))throw new PlatformError('Bitte zuerst anmelden.',user?403:401);const url=new URL(request.url),epoch=url.searchParams.get('epoch')??'',turn=url.searchParams.get('turn')??'';if(![epoch,turn].every(v=>/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v)))throw new PlatformError('Ungültige Chatkennung.');return Response.json({action:await ownAction(user.id,epoch,turn)},{headers});}catch(error){return failure(error);}}
async function scopedPOST(request:Request){try{return Response.json(await confirmAction(request,await adminBody(request) as Record<string,unknown>),{headers});}catch(error){return failure(error);}}

export const GET=withRouteAccess('/api/assistent/aktionen','GET',scopedGET);

export const POST=withRouteAccess('/api/assistent/aktionen','POST',scopedPOST);
