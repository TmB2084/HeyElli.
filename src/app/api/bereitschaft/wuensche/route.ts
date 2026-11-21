import {withRouteAccess} from '@/platform/app-access/route-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,permitted,sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {CalendarError} from '@/apps/planboard/kalender/domain';
import {PlatformError} from '@/platform/store';
import {dutyWishes,changeDutyWish} from '@/apps/dutyboard/wishes-server';
const headers={'Cache-Control':'no-store'};
function yearValue(value:unknown){const year=Number(value);if(!Number.isInteger(year)||year<2000||year>2100)throw new CalendarError('Ungültiges Planungsjahr.');return year;}
function failure(error:unknown){const known=error instanceof CalendarError||error instanceof PlatformError;return Response.json({error:known?error.message:'Anfrage konnte nicht abgeschlossen werden. Bitte den aktuellen Stand laden und gegebenenfalls fortsetzen.'},{status:known?error.status:409,headers});}
async function scopedGET(request:Request){try{await requireSimulatorWrites();}catch{return Response.json({error:"Bereitschaftsplanung und Mitarbeiterzuordnungen sind für diese Quelle noch nicht freigegeben."},{status:409});}const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte anmelden.'},{status:user?403:401,headers});try{return Response.json(await dutyWishes(user,yearValue(new URL(request.url).searchParams.get('year'))),{headers});}catch(error){return failure(error);}}
async function scopedPOST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}
const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte anmelden.'},{status:user?403:401,headers});if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});try{const body=await adminBody(request);if(!body||typeof body!=='object'||Array.isArray(body))throw new CalendarError('Ungültige Anfrage.');const data=body as Record<string,unknown>;return Response.json(await changeDutyWish(user,yearValue(data.year),data),{headers});}catch(error){return failure(error);}}

export const GET=withRouteAccess('/api/bereitschaft/wuensche','GET',scopedGET);

export const POST=withRouteAccess('/api/bereitschaft/wuensche','POST',scopedPOST);
