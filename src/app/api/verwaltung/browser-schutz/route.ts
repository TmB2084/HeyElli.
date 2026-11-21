import {withRouteAccess} from '@/platform/app-access/route-access';
import {session} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {adminFailure,adminHeaders} from '@/system/einstellungen';
import {browserReports} from '@/platform/http-safety/reports';
export const GET=withRouteAccess('/api/verwaltung/browser-schutz','GET',async()=>{
 try{const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);return Response.json(await browserReports(platformDatabase()).read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}
});
