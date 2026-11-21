import {installMicrosoftAuthFixture} from './microsoft-auth-http-fixture.mjs';
import {join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
export async function installMailProviderFixture(directory){
 const modeFile=join(directory,'mail-provider-mode.json');await writeFile(modeFile,JSON.stringify({provider:'success',response:'normal'}));
 await writeFile(join(directory,'src/platform/mail/fixture-transport.ts'),`import {readFile} from 'node:fs/promises';
export async function fixtureMicrosoftFetch(url:string|URL|Request){const state=JSON.parse(await readFile(${JSON.stringify(modeFile)},'utf8'));if(state.provider==='disconnect')throw new TypeError('Controlled connection loss');if(String(url).includes('/token'))return state.provider==='reject'?Response.json({error:'invalid_client'},{status:401}):Response.json({access_token:'fictional-fixture-token'});if(String(url).endsWith('/mailboxSettings/timeZone'))return Response.json({value:'UTC'});throw new Error('Unexpected provider endpoint');}`);
 const modulePath=join(directory,'src/platform/mail/microsoft365.ts');let source=await readFile(modulePath,'utf8');source="import {fixtureMicrosoftFetch} from './fixture-transport.ts';\n"+source.replaceAll('transport:typeof fetch=fetch','transport:typeof fetch=fixtureMicrosoftFetch as typeof fetch');await writeFile(modulePath,source);
 const routePath=join(directory,'src/app/api/verwaltung/email/route.ts');let route=await readFile(routePath,'utf8');route="import {readFile} from 'node:fs/promises';\n"+route.replace('async function scopedPOST(request:Request)','async function realPost(request:Request)');route+=`\nasync function scopedPOST(request:Request){const state=JSON.parse(await readFile(${JSON.stringify(modeFile)},'utf8'));const action=(await request.clone().json()).action;if(action==='credentials'&&state.response==='disconnect')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));setTimeout(()=>controller.error(new Error('Controlled response loss')),20);}}),{headers:{'Content-Type':'application/json'}});return realPost(request);}\n`;await writeFile(routePath,route);const pds=join(directory,'src/platform/pds/connection/probe.ts');
 if((await import('node:fs')).existsSync(pds)){
  await writeFile(join(directory,'src/platform/pds/connection/fixture-transport.ts'),`import {readFile} from 'node:fs/promises';
export async function fixturePdsFetch(url:string|URL|Request){const state=JSON.parse(await readFile(${JSON.stringify(modeFile)},'utf8'));if(state.pds==='disconnect')throw new TypeError('Controlled PDS disconnect');const path=new URL(String(url)).pathname;if(path.endsWith('/mitarbeiter/listmitarbeiter')||path.endsWith('/termin/listplanung')||path.endsWith('/objekt/listobjekte')||path.endsWith('/person/listkunden'))return Response.json({resultList:[],totalHitCount:0});return Response.json([]);}`);
  const protocolPath=join(directory,'src/platform/pds/api/protocol.ts');await writeFile(protocolPath,"import {fixturePdsFetch} from '../connection/fixture-transport.ts';\n"+(await readFile(protocolPath,'utf8')).replace('fetcher:typeof fetch=fetch','fetcher:typeof fetch=fixturePdsFetch as typeof fetch'));
  await writeFile(pds,"import {fixturePdsFetch} from './fixture-transport.ts';\n"+(await readFile(pds,'utf8')).replace('new PdsHttpTransport(config.baseUrl,config.token)','new PdsHttpTransport(config.baseUrl,config.token,fixturePdsFetch as typeof fetch)'));
 }
 await installMicrosoftAuthFixture(directory,modeFile);
 return modeFile;
}
