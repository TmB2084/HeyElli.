import {withRouteAccess} from '@/platform/app-access/route-access';
import {permitted} from "@/platform/session";
import {session} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
async function scopedGET(request:Request, context:{params:Promise<{number:string}>}) {
  const user=await session();
  if (!user || !permitted(user,"read")) return new Response(null,{status:user?403:401});
  const {number}=await context.params;
  if (!/^SIM-(?:API-)?SA-\d+$/.test(number)) return new Response(null,{status:400});
  const api=await pdsApi();
  try {
    const file=await api.services.download(number,new URL(request.url).searchParams.get("documentUUID")??undefined);
    if (!file) return new Response(null,{status:404});
    return new Response(new Uint8Array(file.bytes).buffer,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"no-store","Content-Security-Policy":"sandbox; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"}});
  } catch {return Response.json({error:"PDS-Dokument konnte nicht geladen werden."},{status:502});} finally {api.close();}
}

export const GET=withRouteAccess('/api/pds-simulator/orders/[number]/document','GET',scopedGET);
