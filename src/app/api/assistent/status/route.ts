import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {session,permitted} from '@/platform/session';
import {assistantProvider} from '@/apps/askelli/elli/provider-server';
async function scopedGET(){const user=await session(),headers={'Cache-Control':'no-store'};if(!user||!permitted(user,'read'))return Response.json({error:'Bitte zuerst anmelden.'},{status:user?403:401,headers});try{const provider=await assistantProvider();return Response.json({provider:provider.name,enabled:true,canWrite:provider.name==='copilot'&&await appPermission(user,'/')&&await appPermission(user,'/planboard')},{headers});}catch{return Response.json({provider:'unavailable',enabled:false,canWrite:false,error:'Ellis Anbieterstatus ist derzeit nicht verfügbar.'},{status:503,headers});}}

export const GET=withRouteAccess('/api/assistent/status','GET',scopedGET);
