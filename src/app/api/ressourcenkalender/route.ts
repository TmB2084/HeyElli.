import {withRouteAccess} from '@/platform/app-access/route-access';
import {GET as scopedGET,POST as scopedPOST} from "@/apps/planboard/kalender/calendar-http";

export const GET=withRouteAccess('/api/ressourcenkalender','GET',scopedGET);

export const POST=withRouteAccess('/api/ressourcenkalender','POST',scopedPOST);
