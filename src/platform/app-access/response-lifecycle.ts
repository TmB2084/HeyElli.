/** Keep the admission lease until the response finishes or its client leaves. */
export async function releaseResponse(response:Response,release:()=>Promise<void>,signal?:AbortSignal):Promise<Response>{
 let finished:Promise<void>|undefined,detach=()=>{};
 const finish=()=>{if(!finished){detach();finished=Promise.resolve().then(release).catch(()=>{});}return finished;};
 if(signal?.aborted){
  // A cancelled stream is disturbed and must never be reused in another Response.
  void response.body?.cancel().catch(()=>{});
  await finish();
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');
  return new Response(null,{status:response.status,statusText:response.statusText,headers});
 }
 if(!response.body){await finish();return response;}
 const reader=response.body.getReader();let ended=false,cancellation:Promise<void>|undefined;
 const cancel=(reason?:unknown)=>{
  if(!cancellation)cancellation=(async()=>{
   // Release admission independently of an upstream cancellation that may hang.
   let upstream:Promise<void>;try{upstream=reader.cancel(reason);}catch{upstream=Promise.resolve();}
   const settled=upstream.catch(()=>{});await finish();await settled;
  })();
  return cancellation;
 };
 const body=new ReadableStream<Uint8Array>({
  start(controller){
   const abort=()=>{if(ended)return;ended=true;controller.error(new DOMException('Anfrage abgebrochen.','AbortError'));void cancel(signal?.reason);};
   signal?.addEventListener('abort',abort,{once:true});detach=()=>signal?.removeEventListener('abort',abort);
   if(signal?.aborted)abort();
  },
  async pull(controller){
   if(ended)return;
   try{const next=await reader.read();if(ended)return;if(next.done){ended=true;await finish();controller.close();}else controller.enqueue(next.value);}
   catch(error){if(ended)return;ended=true;await finish();controller.error(error);}
  },
  async cancel(reason){ended=true;await cancel(reason);},
 });
 return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
}
