import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {maildeskSettingsRead,maildeskSettingsSave,maildeskSettingsCheck} from '@/apps/maildesk';
import {PlatformError} from '@/platform/store';
// MailDesk-Postfachquelle (Einstellungen → Microsoft Graph → MailDesk-Postfach): nur Administratoren.
async function scopedGET(){try{await adminRequest();return Response.json(await maildeskSettingsRead(),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{
 const {user}=await adminRequest(request),value=await adminBody(request);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PlatformError('Angaben fehlen.');
 const input=value as Record<string,unknown>;
 if(input.action==='check')return Response.json(await maildeskSettingsCheck(user.id,input.mailbox),{headers:adminHeaders});
 if(input.action==='save')return Response.json(await maildeskSettingsSave(user.id,input),{headers:adminHeaders});
 throw new PlatformError('Unbekannte Aktion.');
}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/verwaltung/maildesk','GET',scopedGET);
export const POST=withRouteAccess('/api/verwaltung/maildesk','POST',scopedPOST);
