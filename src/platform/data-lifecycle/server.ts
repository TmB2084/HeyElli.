import 'server-only';
import {session,sameOrigin} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {appRoleStore} from '@/platform/app-access';
import {adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {dataLifecycle,authorize} from './repository';
import {personalExport,exportResponse} from './export';
export async function lifecycleRequest(request:Request,admin:boolean,download=false){
 try{
  const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);if(admin&&user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);
  if(request.method!=='GET'&&!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
  const url=new URL(request.url),input=request.method==='GET'?{}:await adminBody(request) as Record<string,unknown>;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.');
  if(!admin&&(url.searchParams.has('userId')||'userId' in input))throw new PlatformError('Eigene Daten werden aus der Sitzung bestimmt.',403);
  const subject=admin?(request.method==='GET'?url.searchParams.get('userId'):input.userId):user.id;if(typeof subject!=='string'||!subject||subject.length>120)throw new PlatformError('Benutzer auswählen.');
  const scope={actor:user.id,subject,admin},pool=platformDatabase();await authorize(pool,scope);
  if(download){const apps=await appRoleStore().allowed(user.id);return exportResponse(personalExport(pool,scope,{signal:request.signal,business:admin||apps.includes('/servicehub')||apps.includes('/casedesk')}),request.signal);}
  const store=dataLifecycle(pool);if(request.method==='GET')return Response.json(await store.read(scope),{headers:adminHeaders});
  if(input.action==='preview')return Response.json(await store.preview(scope,input),{headers:adminHeaders});if(input.action==='execute')return Response.json(await store.execute(scope,input),{headers:adminHeaders});if(input.action==='rule')return Response.json(await store.rule(scope,input),{headers:adminHeaders});throw new PlatformError('Unbekannte Datenaktion.');
 }catch(error){return adminFailure(error);}
}
