import {selectionOwner} from '@/apps/planboard/kalender/server';
import {privateDraftInput,privateDrafts} from '@/apps/planboard/entwuerfe/server';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,sameOrigin} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {adminFailure,adminHeaders} from '@/system/einstellungen';
async function read(request:Request){try{const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);const params=new URL(request.url).searchParams,store=privateDrafts(platformDatabase());return Response.json(params.get('key')==='1'?{...await store.key(user.id),owner:await selectionOwner(user.id)}:await store.read(user.id,params.get('after')??''),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function write(request:Request){try{const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);return Response.json(await privateDrafts(platformDatabase()).change(user.id,await privateDraftInput(request)),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/ressourcenkalender/entwuerfe','GET',read);
export const POST=withRouteAccess('/api/ressourcenkalender/entwuerfe','POST',write);
