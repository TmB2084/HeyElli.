import {DataLimitError} from '@/platform/http-safety/limits';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {serviceWorkspaceRead,ServiceReadError} from '@/apps/servicehub/akten';
const headers={'Cache-Control':'no-store'};
async function scopedGET(request:Request){try{const params=new URL(request.url).searchParams;return Response.json(await serviceWorkspaceRead(params.get('kind')??undefined,params.get('id')??undefined,params.get('part')??'base',params.get('revision')??undefined,request.signal,Number(params.get('cursor')??0),params.get('indexRevision')??''),{headers});}catch(error){return Response.json({error:error instanceof ServiceReadError||error instanceof DataLimitError?error.message:'Die Service-Daten konnten nicht geladen werden. Bitte erneut versuchen.'},{status:error instanceof ServiceReadError?error.status:error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?504:502,headers});}}

export const GET=withRouteAccess('/api/service','GET',scopedGET);
