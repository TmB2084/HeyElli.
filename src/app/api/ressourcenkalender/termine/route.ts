import {withRouteAccess} from '@/platform/app-access/route-access';
import {POST as scopedPOST} from "@/apps/planboard/kalender/create-http";

export const POST=withRouteAccess('/api/ressourcenkalender/termine','POST',scopedPOST);
