import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
// Installed only into the runner's disposable source; never into the application checkout.
export async function installReturnBrowserFixture(source){
 const file=join(source,'src/apps/servicehub/akten/dispatch-server.ts'),text=await readFile(file,'utf8'),needle='api.transport.request(method,path,body,{signal:limited})';
 if(!text.includes(needle))throw Error('Rücklauf-Prüfadapter konnte nicht eingesetzt werden.');
 await writeFile(join(source,'src/apps/servicehub/akten/return-browser-fixture.ts'),`
import type {Pool} from 'pg';
import type {PdsTransport} from '../pds-api';
export async function returnBrowserFixture(pool:Pool,upstream:PdsTransport,method:'GET'|'POST',path:string,body:unknown,signal:AbortSignal){
 if(!['/datenansichten/list','/datenansichten/listdaten'].includes(path))return upstream.request(method,path,body,{signal});
 const mode=(await pool.query("SELECT mode FROM public.browser_return_fault WHERE id='central'")).rows[0]?.mode??'normal';
 if(path==='/datenansichten/list'){
  if(mode==='missing')return [];
  if(mode==='columns')return [{uuid:'fictional-view',name:'sim_service_return_links',columns:[{uuid:'fictional-column',name:'wrong_column'}]}];
 }
 if(path==='/datenansichten/listdaten'&&(body as {name?:string})?.name==='sim_service_return_links'){
  if(mode==='malformed')return {unexpected:true};
  if(mode==='unavailable')throw Error('PRIVATE-FIXTURE-DIAGNOSTIC');
  if(mode==='empty')return [];
  if(mode==='stale')return [{ruecklaufUUID:'sim-return-2',serviceauftragebeneUUID:'sim-order-1-incident'}];
  if(mode==='duplicates')return Array.from({length:3},()=>({ruecklaufUUID:'sim-return-2',serviceauftragebeneUUID:'sim-order-2-incident'}));
 }
 return upstream.request(method,path,body,{signal});
}
`);
 await writeFile(file,"import {returnBrowserFixture} from './return-browser-fixture';\n"+text.replace(needle,'returnBrowserFixture(platformDatabase(),api.transport,method,path,body,limited)'));
}
