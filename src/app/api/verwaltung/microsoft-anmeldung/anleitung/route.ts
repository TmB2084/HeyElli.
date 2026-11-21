import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminHeaders,adminFailure} from '@/system/einstellungen';
import {microsoftAuthMarkdown} from '@/system/anmeldung/microsoft/guide';
async function scopedGET(){try{await adminRequest();return new Response(microsoftAuthMarkdown,{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="heyelli-microsoft-anmeldung.md"'}});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/microsoft-anmeldung/anleitung','GET',scopedGET);
