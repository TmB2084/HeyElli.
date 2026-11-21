import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure} from '@/system/einstellungen';
import {copilotGuide} from '@/apps/askelli/copilot/server';
import {guideMarkdown} from '@/system/einstellungen/integration-guide-data';
async function scopedGET(){try{await adminRequest();return new Response(guideMarkdown(copilotGuide),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="HeyElli-Copilot-Einrichtung.md"','Cache-Control':'no-store'}});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/copilot/anleitung','GET',scopedGET);
