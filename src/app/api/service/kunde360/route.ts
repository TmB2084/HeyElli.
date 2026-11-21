import {withRouteAccess} from '@/platform/app-access/route-access';
import {customerOverview} from '@/apps/servicehub/kunde360';
import {PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
export const GET=withRouteAccess('/api/service/kunde360','GET',async(request:Request)=>{try{return Response.json(await customerOverview(new URL(request.url).searchParams.get('id')),{headers});}catch(error){return Response.json({error:error instanceof PlatformError?error.message:'Die Kundenübersicht ist derzeit nicht erreichbar.'},{status:error instanceof PlatformError?error.status:503,headers});}});
