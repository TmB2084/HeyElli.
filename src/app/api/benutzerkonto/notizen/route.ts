import {createHash} from 'node:crypto';
import {appRoleStore} from '@/platform/app-access';
import {grantedTools} from '@/platform/app-access/tools';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,sameOrigin} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {personalNotes} from '@/apps/notizen/server';
import {privateDrafts,privateDraftInput} from '@/apps/planboard/entwuerfe/server';
import {adminFailure,adminHeaders} from '@/system/einstellungen';
async function access(){const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);const rights=await appRoleStore().rights(user.id);if(!grantedTools(rights.apps,rights.tools).some(tool=>tool.id==='notes'))throw new PlatformError('Das Notizen-Werkzeug ist für deine Rolle nicht freigegeben.',403);return {user,owner:createHash('sha256').update(user.id).digest('hex')};}
async function read(request:Request){try{const {user,owner}=await access();if(new URL(request.url).searchParams.get('key')==='1')return Response.json({...await privateDrafts(platformDatabase()).key(user.id),owner},{headers:adminHeaders});return Response.json({owner,note:await personalNotes(platformDatabase()).read(user.id)},{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function write(request:Request){try{const {user,owner}=await access();if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const body=await privateDraftInput(request);if(body.owner!==owner)throw new PlatformError('Das Benutzerkonto wurde gewechselt. Deine lokale Fassung bleibt erhalten.',409);const result=await personalNotes(platformDatabase()).write(user.id,body.body,body.version);return Response.json(result,{status:result.conflict?409:200,headers:adminHeaders});}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/benutzerkonto/notizen','GET',read);
export const POST=withRouteAccess('/api/benutzerkonto/notizen','POST',write);
