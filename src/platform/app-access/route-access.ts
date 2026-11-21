import {observeResponse} from '../operations';
import {withRequestBudget} from '../resource-budgets/context';
import {requestBudgets} from '../resource-budgets/server';
import {ResourceError,requestClass} from '../resource-budgets/model';
import 'server-only';
import {session} from '@/platform/session';
import {appRoleStore} from './index';
import {AppAccessError,requirePolicy,requireAppRight} from './access-policy';
import {boundedRequest,DataLimitError,readLimited,requestLimit} from '../http-safety/limits';
export async function requireAppRead(app:string){const user=await session();await requireAppRight(user,[app],'read',(id,root,right)=>appRoleStore().can(id,root,right));return user!;}
export async function requireAppWrite(app:string){const user=await session();await requireAppRight(user,[app],'write',(id,root,right)=>appRoleStore().can(id,root,right));return user!;}
function guardedRoute<A extends unknown[]>(path:string,method:string,handler:(...args:A)=>Promise<Response>){
 return async(...args:A):Promise<Response>=>{
  let release:(()=>Promise<void>)|undefined;
  try{
   const operationPath=path==='/api/pds/rest/api/[...segments]'&&args[0] instanceof Request?new URL(args[0].url).pathname:path;
   if(path==='/api/pds/rest/api/[...segments]'&&!operationPath.startsWith('/api/pds/rest/api/'))throw new AppAccessError('Ungültiger API-Pfad.',400);
   let rights:ReturnType<ReturnType<typeof appRoleStore>['rights']>|undefined;
   const identity=await session();
   await requirePolicy(identity,path,method,async(id,app,right)=>{const access=await (rights??=appRoleStore().rights(id));return access.apps.includes(app)&&(right==='read'||access.writeApps.includes(app));},operationPath);
   const request=args[0];
   if(identity&&path!=='/api/sicherheit/csp')release=await requestBudgets().acquire(identity.id,requestClass(operationPath,request instanceof Request?request.headers.get('content-type')??'':'',request instanceof Request?new URL(request.url).searchParams.get('format')??'':''));
   if(request instanceof Request&&request.body){
    // Small JSON bodies are checked before the handler can turn a stream error
    // into a generic domain error. Large file uploads remain streamed and capped.
    if(path!=='/api/pds-simulator/uploads'&&!request.headers.get('content-type')?.startsWith('multipart/form-data')){
     const bytes=await readLimited(new Response(request.body,{headers:request.headers}),requestLimit(path,request.headers.get('content-type')??''));
     args[0]=new Request(request.url,{method:request.method,headers:request.headers,body:new Uint8Array(bytes).buffer,signal:request.signal}) as A[0];
    }else args[0]=boundedRequest(request,path) as A[0];
   }
   const response=await withRequestBudget(requestClass(operationPath,request instanceof Request?request.headers.get('content-type')??'':'',request instanceof Request?new URL(request.url).searchParams.get('format')??'':''),request instanceof Request?request.signal:undefined,()=>handler(...args));
   if(!release)return response;if(request instanceof Request&&request.signal.aborted){await response.body?.cancel().catch(()=>{});await release();return response;}if(!response.body){await release();return response;}
   const reader=response.body.getReader(),done=release;let finished=false;
   const finish=async()=>{if(finished)return;finished=true;await done().catch(()=>{});};
   const body=new ReadableStream({async pull(controller){try{const next=await reader.read();if(next.done){await finish();controller.close();}else controller.enqueue(next.value);}catch(error){await finish();controller.error(error);}},async cancel(reason){try{await reader.cancel(reason);}finally{await finish();}}});
   return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){await release?.().catch(()=>{});const code=(error as {code?:string})?.code,budget=error instanceof ResourceError,databaseBusy=['57014','55P03','53300'].includes(code??'');
   const known=error instanceof AppAccessError||error instanceof DataLimitError||budget,status=known?error.status:503;
   return Response.json({error:known?error.message:databaseBusy?'Abfragebudget erreicht. Eingaben bleiben erhalten; bitte erneut versuchen.':'Der Zugriff kann derzeit nicht geprüft werden.'},{status,headers:{'Cache-Control':'no-store',...(status===429||status===503?{'Retry-After':'5'}:{})}});}
 };
}

export function withRouteAccess<A extends unknown[]>(path:string,method:string,handler:(...args:A)=>Promise<Response>){
 const guarded=guardedRoute(path,method,handler);
 return async(...args:A)=>{const started=performance.now();const response=await guarded(...args);return observeResponse(path,method,response,started);};
}
