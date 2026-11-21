import {withRouteAccess,requireAppRead,requireAppWrite} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {serviceDocumentScope,ServiceReadError} from '@/apps/servicehub/akten';
import {sharepointDocuments} from '@/platform/sharepoint';
import {readLimited} from '@/platform/http-safety/limits';
import {PlatformError} from '@/platform/store';
import {adminFailure,adminHeaders} from '@/system/einstellungen';
async function target(request:Request){const url=new URL(request.url);try{return await serviceDocumentScope(url.searchParams.get('kind')??'',url.searchParams.get('id')??'',url.searchParams.get('contract')??'',request.signal);}catch(error){if(error instanceof ServiceReadError)throw new PlatformError(error.message,error.status);throw error;}}
export const GET=withRouteAccess('/api/service/dokumente','GET',async(request:Request)=>{try{await requireAppRead('/servicehub');const found=await target(request);return Response.json(await sharepointDocuments().list(found.scope,request.signal,found.location),{headers:adminHeaders});}catch(error){return adminFailure(error);}});
export const POST=withRouteAccess('/api/service/dokumente','POST',async(request:Request)=>{try{const user=await requireAppWrite('/servicehub');if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);if(request.headers.get('content-type')!=='application/octet-stream')throw new PlatformError('Datei als Binärübertragung senden.');let name;try{name=decodeURIComponent(request.headers.get('X-File-Name')??'');}catch{throw new PlatformError('Dateiname ungültig.');}const found=await target(request),bytes=await readLimited(new Response(request.body),8388608);return Response.json(await sharepointDocuments().upload(user.id,found.scope,request.headers.get('Idempotency-Key')??'',name,bytes,request.signal,{location:found.location,typeKey:request.headers.get('X-Storage-Type')??''}),{headers:adminHeaders});}catch(error){return adminFailure(error);}});
