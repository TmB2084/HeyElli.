import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,permitted,sameOrigin} from '@/platform/session';
import {appUsageStore,PlatformError} from '@/platform/store';
import {adminBody} from '@/system/einstellungen';
const headers={'Cache-Control':'no-store'};
function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'App-Nutzung ist derzeit nicht erreichbar.'},{status:error instanceof PlatformError?error.status:503,headers});}
async function scopedGET(){try{const user=await session();if(!user||!permitted(user,'read'))throw new PlatformError('Bitte zuerst anmelden.',user?403:401);return Response.json({usage:await appUsageStore().read(user.id)},{headers});}catch(error){return failure(error);}}
async function scopedPOST(request:Request){try{const user=await session();if(!user||!permitted(user,'read'))throw new PlatformError('Bitte zuerst anmelden.',user?403:401);if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const input=await adminBody(request) as {path?:unknown};if(input?.path==='/einstellungen'&&!permitted(user,'admin'))throw new PlatformError('Administratorrechte erforderlich.',403);await appUsageStore().record(user.id,input?.path);return Response.json({ok:true},{headers});}catch(error){return failure(error);}}

export const GET=withRouteAccess('/api/benutzerkonto/app-nutzung','GET',scopedGET);

export const POST=withRouteAccess('/api/benutzerkonto/app-nutzung','POST',scopedPOST);
