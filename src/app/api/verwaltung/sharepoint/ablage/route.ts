import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {sharepointDocuments} from '@/platform/sharepoint';
import {sharepointLegacyPlan,sharepointLegacyMigrate,ServiceReadError} from '@/apps/servicehub/akten';
import {PlatformError} from '@/platform/store';
// SharePoint-Ablagestruktur (nur Administratoren): Ablagetypen pflegen, Übernahme der bisherigen Hash-Ablage planen und ausführen.
const fail=(error:unknown)=>adminFailure(error instanceof ServiceReadError?new PlatformError(error.message,error.status):error);
async function scopedGET(){try{await adminRequest();return Response.json({types:await sharepointDocuments().storageTypes(true)},{headers:adminHeaders});}catch(error){return fail(error);}}
async function scopedPOST(request:Request){try{
 const {user}=await adminRequest(request),value=await adminBody(request);if(!value||typeof value!=='object'||Array.isArray(value))throw new PlatformError('Angaben fehlen.');
 const input=value as Record<string,unknown>;
 if(input.action==='types')return Response.json({types:await sharepointDocuments().saveStorageTypes(user.id,input.types)},{headers:adminHeaders});
 if(input.action==='plan')return Response.json(await sharepointLegacyPlan(request.signal),{headers:adminHeaders});
 if(input.action==='migrate'){if(input.confirm!==true)throw new PlatformError('Bitte die Übernahme ausdrücklich bestätigen.');return Response.json(await sharepointLegacyMigrate(user.id,input.scopes,request.signal),{headers:adminHeaders});}
 throw new PlatformError('Unbekannte Aktion.');
}catch(error){return fail(error);}}
export const GET=withRouteAccess('/api/verwaltung/sharepoint/ablage','GET',scopedGET);
export const POST=withRouteAccess('/api/verwaltung/sharepoint/ablage','POST',scopedPOST);
