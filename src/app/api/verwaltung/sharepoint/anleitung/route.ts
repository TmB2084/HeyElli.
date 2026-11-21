import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders} from '@/system/einstellungen';
import {sharepointGuide} from '@/platform/sharepoint/guide';
import {guideMarkdown} from '@/system/einstellungen/integration-guide-data';
export const GET=withRouteAccess('/api/verwaltung/sharepoint/anleitung','GET',async()=>{try{await adminRequest();return new Response(guideMarkdown(sharepointGuide),{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="HeyElli-SharePoint-Anleitung.md"'}});}catch(error){return adminFailure(error);}});
