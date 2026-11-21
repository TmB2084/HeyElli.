import {withRouteAccess} from '@/platform/app-access/route-access';
import {POST as scopedPOST} from "@/apps/planboard/kalender/mobile-http";

export const POST=withRouteAccess('/api/ressourcenkalender/mobilausgabe','POST',scopedPOST);
