import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders} from '@/system/einstellungen';
import {bmaGuide} from '@/platform/bmacloud/guide';
import {guideMarkdown} from '@/system/einstellungen/integration-guide-data';
async function scopedGET(){try{await adminRequest();return new Response(guideMarkdown(bmaGuide),{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="HeyElli-BMACloud-Anleitung.md"'}});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/bmacloud/anleitung','GET',scopedGET);
