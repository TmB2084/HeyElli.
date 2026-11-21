import {withRouteAccess} from '@/platform/app-access/route-access';
import {PlatformError} from '@/platform/store';
import {answerHelp} from '@/apps/askelli/elli';
async function scopedPOST(request:Request){try{return await answerHelp(request);}catch(error){if(error instanceof PlatformError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return Response.json({error:'Die Bedienungshilfe ist derzeit nicht verfügbar.'},{status:503,headers:{'Cache-Control':'no-store'}});}}

export const POST=withRouteAccess('/api/assistent','POST',scopedPOST);
