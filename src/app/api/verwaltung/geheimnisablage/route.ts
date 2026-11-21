import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {platformDatabase,PlatformError} from '@/platform/store';
import {maintainSecrets,restoreSecret,type SecretProvider} from '@/platform/secret-retention/server';
async function read(){try{const {user}=await adminRequest(),pool=platformDatabase(),items=[];for(const provider of ['bmacloud','copilot','pds','graph','sharepoint'] as const)items.push(await maintainSecrets(pool,user.id,provider));return Response.json({items},{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function write(request:Request){try{const {user}=await adminRequest(request),input=await adminBody(request) as Record<string,unknown>;if(!input||input.action!=='restore'||input.confirm!==true||!['bmacloud','copilot','pds','graph','sharepoint'].includes(String(input.provider)))throw new PlatformError('Wiederherstellung ausdrücklich bestätigen.');return Response.json(await restoreSecret(platformDatabase(),user.id,input.provider as SecretProvider,input.version),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/verwaltung/geheimnisablage','GET',read);
export const POST=withRouteAccess('/api/verwaltung/geheimnisablage','POST',write);
