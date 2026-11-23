import {DataLimitError} from '@/platform/http-safety/limits';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {platformDatabase} from '@/platform/store';
import {serviceVisibility} from '@/apps/servicehub/akten';
import {permitted} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
import { session } from "@/platform/session";
import { InvalidSearch, parseSearch } from "@/platform/pds/simulator";

// Every catalog query requires a verified platform session; the source factory checks real access again.
async function scopedGET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const search = parseSearch(params, "pds");
    const unitId=params.get('unitId')||undefined;
    if(unitId&&(search.resource!=='orders'||!/^[a-zA-Z0-9_-]{1,100}$/.test(unitId)))throw new InvalidSearch('Ungültige technische Einheit.');
    const user=await session();
    if(!user||!permitted(user,"read"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401});
    const scope=params.get("personScope")??"customer";
    if(scope!=="customer" && scope!=="all")return Response.json({error:"Ungültiger Suchbereich."},{status:400});
    const api=await pdsApi(),source=api.source;
    let result;
    try {
      if (source.mode === 'simulator' && search.objectId) parseSearch(params);
      const hidden=['objects','units','customers'].includes(search.resource)?await serviceVisibility(platformDatabase()).read(user.id,source.mode==='simulator'?'simulator':'pds:'+source.workspaceId):[];
      const visibility={customers:hidden.filter(item=>item.kind==='customer').map(item=>item.id),objects:hidden.filter(item=>item.kind==='object').map(item=>item.id)};
      result=search.resource==="orders" ? await api.services.list(search.objectId!,search.query,search.offset,search.limit,unitId) : await api.lookups.search(search,scope,visibility);}finally{api.close();}
    return Response.json({ source: source.mode==='simulator'?"pds-simulator":"pds-api", synthetic: source.mode==='simulator', ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if(error instanceof DataLimitError)return Response.json({error:error.message},{status:502});
    if (error instanceof InvalidSearch) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "PDS-Daten sind derzeit nicht verfügbar." }, { status: 500 });
  }
}

export const GET=withRouteAccess('/api/pds-simulator','GET',scopedGET);
