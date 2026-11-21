import {selectionOwner} from '@/apps/planboard/kalender/server';
import {privateDraftInput,privateDrafts} from '@/apps/planboard/entwuerfe/server';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,sameOrigin} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {adminFailure,adminHeaders} from '@/system/einstellungen';
async function read(request:Request){try{const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);const params=new URL(request.url).searchParams,store=privateDrafts(platformDatabase()),owner=await selectionOwner(user.id);if(params.get('key')==='1')return Response.json({...await store.key(user.id),owner},{headers:adminHeaders});const result=await store.read(user.id,params.get('after')??'');return Response.json({...result,records:result.records.filter(row=>row.key.startsWith('heyelli:incident-draft:v1:'+owner+':'))},{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function write(request:Request){try{const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const value=await privateDraftInput(request),owner=await selectionOwner(user.id);if(typeof value.key!=='string'||!value.key.startsWith('heyelli:incident-draft:v1:'+owner+':'))throw new PlatformError('Entwurf gehört nicht zum aktuellen Benutzer und Arbeitsbereich.',403);return Response.json(await privateDrafts(platformDatabase()).change(user.id,value),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/benutzerkonto/auftragsentwuerfe','GET',read);
export const POST=withRouteAccess('/api/benutzerkonto/auftragsentwuerfe','POST',write);
