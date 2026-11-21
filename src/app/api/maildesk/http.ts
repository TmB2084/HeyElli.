import {PlatformError} from '@/platform/store';
export const headers={'Cache-Control':'no-store'};
export function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'MailDesk ist derzeit nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}
