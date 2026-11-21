import {withRouteAccess} from '@/platform/app-access/route-access';
import {generateGreeting} from '@/apps/askelli/elli';
async function scopedPOST(request: Request) {
  try {return await generateGreeting(request);}
  catch {return Response.json({error: 'Elli kann gerade keine Begrüßung formulieren.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});}
}

export const POST=withRouteAccess('/api/assistent/begruessung','POST',scopedPOST);
