import type {ServiceCore,ServiceExtrasResponse} from './model.ts';
export class FileFetchError extends Error{status:number;constructor(message:string,status=0){super(message);this.status=status;}}
type Callbacks={base:(value:ServiceCore)=>void;extras:(value:ServiceExtrasResponse)=>void;error:(error:FileFetchError)=>void;extraError:(error:FileFetchError)=>void;loadingExtras:(value:boolean)=>void};
export function fileRefresh(kind:string,id:string,callbacks:Callbacks,transport:typeof fetch=fetch){
 let disposed=false,baseRequest:AbortController|null=null,extraRequest:AbortController|null=null,latest:ServiceCore|null=null,extraRevision='',extraAt=0;
 async function json(url:string,signal:AbortSignal){const response=await transport(url,{cache:'no-store',signal}),value=await response.json().catch(()=>null);if(!response.ok)throw new FileFetchError(value?.error??'Die Akte konnte nicht aktualisiert werden.',response.status);if(!value)throw new FileFetchError('Die Datenquelle liefert keine gültige Akte.');return value;}
 const failure=(error:unknown)=>error instanceof FileFetchError?error:new FileFetchError('Verbindung unterbrochen oder Zeitüberschreitung. Wir versuchen die Aktualisierung erneut.');
 async function extras(core:ServiceCore){
  extraRequest?.abort();const request=new AbortController();extraRequest=request;callbacks.loadingExtras(true);
  try{const value=await json('/api/service?'+new URLSearchParams({kind,id,part:'extras',revision:core.revision}),AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
   if(disposed||request.signal.aborted||latest?.revision!==core.revision)return;
   if(value.revision!==core.revision||!value.extras||typeof value.extras!=='object')throw new FileFetchError('Die Zusatzdaten passen nicht mehr zum Stand der Akte.');
   extraRevision=core.revision;extraAt=Date.now();callbacks.extras(value);
  }catch(error){if(!disposed&&!request.signal.aborted&&latest?.revision===core.revision)callbacks.extraError(failure(error));}
  finally{if(extraRequest===request){extraRequest=null;if(!disposed)callbacks.loadingExtras(false);}}
 }
 async function refresh(){
  if(disposed||baseRequest)return;const request=new AbortController();baseRequest=request;
  try{const value=await json('/api/service?'+new URLSearchParams({kind,id,part:'base'}),AbortSignal.any([request.signal,AbortSignal.timeout(20000)]));
   if(disposed||request.signal.aborted)return;
   if(value.kind!==kind||typeof value.revision!=='string'||!/^[a-f0-9]{64}$/.test(value.revision))throw new FileFetchError('Die Datenquelle liefert keine gültige Grundakte.');
   const changed=latest?.revision!==value.revision;if(changed){extraRequest?.abort();extraRequest=null;extraRevision='';}
   latest=value;callbacks.base(value);
   if(kind!=='customer'&&!extraRequest&&(changed||extraRevision!==value.revision||Date.now()-extraAt>=60000))void extras(value);
  }catch(error){if(!disposed&&!request.signal.aborted)callbacks.error(failure(error));}
  finally{if(baseRequest===request)baseRequest=null;}
 }
 return {refresh,dispose(){disposed=true;baseRequest?.abort();extraRequest?.abort();}};
}
