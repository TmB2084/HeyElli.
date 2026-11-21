import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders,pdsGuideMarkdown} from '@/system/einstellungen';
async function scopedGET(){
 try{await adminRequest();return new Response(pdsGuideMarkdown,{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="heyelli-pds-anleitung.md"'}});}
 catch(error){return adminFailure(error);}
}

export const GET=withRouteAccess('/api/verwaltung/pds/anleitung','GET',scopedGET);
