import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {mailStore,testMicrosoft365,validateMicrosoft365Configuration} from '@/platform/mail';
async function scopedGET(){try{const {user}=await adminRequest();return Response.json(await mailStore().read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request);const input=await adminBody(request);if(input&&typeof input==='object'&&'action' in input&&input.action==='credentials'){
// Persist the safe state before publishing credentials. File or DB failures cannot leave live delivery enabled.
const url=new URL(request.url);if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new PlatformError('Zugangsdaten nur über HTTPS oder lokal einrichten.',403);const store=mailStore();await store.change(user.id,{action:'credentials.prepare',version:'version' in input?input.version:null});try{const candidate=validateMicrosoft365Configuration(input),current=await store.read(user.id),verification=await testMicrosoft365(current.settings.sender,candidate);if(!verification.authentication||!verification.mailbox)throw new PlatformError(verification.message+' Vorhandene Zugangsdaten wurden nicht ersetzt. MS365-Graph Testbetrieb bleibt aktiv.',422);await store.publishConfiguration(user.id,Number('version' in input?input.version:0)+1,input);}catch(error){if(error instanceof PlatformError)throw error;throw new PlatformError('Zugangsdaten konnten nicht sicher gespeichert werden. Dateirechte prüfen lassen.',503);}return Response.json({ok:true},{headers:adminHeaders});}
if(input&&typeof input==='object'&&'action' in input&&input.action==='connect'){const store=mailStore(),current=await store.read(user.id),result=current.settings.enabled?await testMicrosoft365(current.settings.sender,await store.environment(user.id)):null;if(!result)throw new PlatformError('Mail-Modul ist deaktiviert.',409);await store.recordConnection(user.id,result,current.settings.version);return Response.json(result,{headers:adminHeaders});}return Response.json(await mailStore().change(user.id,input),{headers:adminHeaders});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/email','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/email','POST',scopedPOST);
