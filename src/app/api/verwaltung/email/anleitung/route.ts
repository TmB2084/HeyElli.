import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders} from '@/system/einstellungen';
import {mailGuideMarkdown} from '@/system/einstellungen/mail-guide-markdown';
async function scopedGET(){
 try{await adminRequest();return new Response(mailGuideMarkdown,{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="heyelli-microsoft-365-anleitung.md"'}});}
 catch(error){return adminFailure(error);}
}

export const GET=withRouteAccess('/api/verwaltung/email/anleitung','GET',scopedGET);
