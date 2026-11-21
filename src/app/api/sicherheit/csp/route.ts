import {browserOrigin} from '@/platform/http-safety/headers';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {adminFailure} from '@/system/einstellungen';
import {browserReports,normalizeReports} from '@/platform/http-safety/reports';
export const POST=withRouteAccess('/api/sicherheit/csp','POST',async(request:Request)=>{
 try{
  const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);
  const origin=browserOrigin(request),from=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if(from&&from!==origin||site&&site!=='same-origin')throw new PlatformError('Fremder Meldungsursprung.',403);
  const type=request.headers.get('content-type')?.split(';')[0].trim();if(type!=='application/csp-report'&&type!=='application/reports+json')throw new PlatformError('Ungültiger Meldungstyp.',415);
  let input;try{input=await request.json();}catch{throw new PlatformError('Ungültige Browsermeldung.');}
  await browserReports(platformDatabase()).record(user.id,normalizeReports(input,origin,type==='application/reports+json'));
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }catch(error){return adminFailure(error);}
});
