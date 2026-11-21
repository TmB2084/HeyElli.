import {PlatformError} from '@/platform/store';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
export const headers={'Cache-Control':'no-store'};
export function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'MissionControl ist derzeit nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}
export async function body(request:Request){if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.');return input;}
