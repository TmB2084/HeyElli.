// Fixtures are installed only into checkPlatformHttp's disposable source copy.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';

export async function installResponseAbortFixture(directory){
 assert.match(basename(directory),/^heyelli-http-test-/);assert.notEqual(resolve(directory),process.cwd());
 const route=join(directory,'src/app/api/benutzerkonto/daten/route.ts');
 await writeFile(join(directory,'src/app/api/benutzerkonto/daten/fixture-original.ts'),await readFile(route,'utf8'));
 await writeFile(route,`import {withRouteAccess} from '@/platform/app-access/route-access';
import {GET as actualGET,POST as actualPOST} from './fixture-original';
const state={waiting:0,completed:0,cancelled:0};
const probe=withRouteAccess('/api/benutzerkonto/daten','GET',async(request:Request)=>{
 const mode=new URL(request.url).searchParams.get('__response_abort_probe');
 if(mode==='stats')return Response.json(state);
 if(mode==='wait'){state.waiting++;if(!request.signal.aborted)await new Promise<void>(resolve=>request.signal.addEventListener('abort',()=>resolve(),{once:true}));state.waiting--;state.completed++;return Response.json({fictional:true},{status:503});}
 if(mode==='failure')return Response.json({fictional:true},{status:503});
 if(mode==='stream')return new Response(new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('fictitious-chunk'));},cancel(){state.cancelled++;}}),{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
 return new Response(null,{status:400});
});
export const GET=(request:Request)=>{
 const mode=new URL(request.url).searchParams.get('__response_abort_probe');if(!mode)return actualGET(request);
 if(process.env.APP_ENV!=='test')return new Response(null,{status:404});
 if(mode==='early'){const controller=new AbortController();return withRouteAccess('/api/benutzerkonto/daten','GET',async()=>{controller.abort();return Response.json({fictional:true},{status:503});})(new Request(request.url,{method:'GET',headers:request.headers,signal:controller.signal}));}
 return probe(request);
};
export const POST=actualPOST;
`);
}

export async function checkResponseAborts({pool,base,cookie}){
 assert.equal(new URL(base).hostname,'127.0.0.1');assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-[a-f0-9]+$/);
 const endpoint=base+'/api/benutzerkonto/daten?__response_abort_probe=',headers={cookie};
 const stats=async()=>{const response=await fetch(endpoint+'stats',{headers});assert.equal(response.status,200);return response.json();};
 const failures=async()=>Number((await pool.query('SELECT COALESCE(sum(failures),0) AS n FROM platform.operation_metrics')).rows[0].n);
 const leases=async()=>Number((await pool.query("SELECT count(*) AS n FROM platform.resource_leases WHERE user_id='local-service-user'")).rows[0].n);
 async function until(check){for(let n=0;n<100;n++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('Response cancellation did not settle within the isolated test budget.');}
 const before=await failures();
 const denied=await fetch(endpoint+'early');assert.equal(denied.status,401);await denied.arrayBuffer();
 for(let n=0;n<4;n++){const response=await fetch(endpoint+'early',{headers});assert.equal(response.status,503);assert.equal(await response.text(),'');}
 await until(async()=>await leases()===0);assert.equal(await failures(),before);
 const abort=new AbortController(),pending=fetch(endpoint+'wait',{headers,signal:abort.signal});const rejected=assert.rejects(pending,error=>error.name==='AbortError');
 await until(async()=>(await stats()).waiting===1);abort.abort();await rejected;
 await until(async()=>(await stats()).completed===1&&await leases()===0);assert.equal(await failures(),before);
 await Promise.all(Array.from({length:3},async()=>{const controller=new AbortController(),response=await fetch(endpoint+'stream',{headers,signal:controller.signal});assert.equal(response.status,200);assert.match(response.headers.get('x-heyelli-request-id'),/^[a-f0-9-]{36}$/);const reader=response.body.getReader(),first=await reader.read();assert.equal(new TextDecoder().decode(first.value),'fictitious-chunk');controller.abort();await reader.cancel().catch(()=>{});}));
 await until(async()=>(await stats()).cancelled===3&&await leases()===0);assert.equal(await failures(),before);
 const real=await fetch(endpoint+'failure',{headers});assert.equal(real.status,503);assert.match(real.headers.get('x-heyelli-request-id'),/^[a-f0-9-]{36}$/);assert.equal((await real.json()).fictional,true);
 await until(async()=>await failures()===before+1&&await leases()===0);
 console.log('RESPONSE_ABORT_REPORT '+JSON.stringify({status:'passed',earlyCancellation:true,disconnectBeforeHeaders:true,parallelStreamCancellation:true,leasesReleased:true,abortsDoNotRaiseOutageMetrics:true,realFailuresStillRecorded:true,anonymousDenied:true,existingDataUsed:false}));
}
