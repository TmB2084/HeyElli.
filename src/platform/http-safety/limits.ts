import {ResourceError} from '../resource-budgets/model.ts';
export class DataLimitError extends Error {readonly status=413;}
export const JSON_RESPONSE_BYTES=8*1024*1024;
export const DOCUMENT_BYTES=100*1024*1024;
export function checkLength(headers:Headers,limit:number){const size=headers.get('content-length');if(size&&/^\d+$/.test(size)&&Number(size)>limit)throw new DataLimitError('Datenmenge zu groß. Bitte den Umfang begrenzen.');}
export function limitedStream(stream:ReadableStream<Uint8Array>,limit:number,timeoutMs=60000,signal?:AbortSignal):ReadableStream<Uint8Array>{
 const reader=stream.getReader();let size=0,timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined;
 const clean=()=>{if(timer)clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);};
 return new ReadableStream({start(controller){
  abort=()=>{clean();void reader.cancel().catch(()=>{});controller.error(new ResourceError('Anfrage abgebrochen. Eingaben bleiben erhalten.',408));};
  timer=setTimeout(()=>{clean();void reader.cancel().catch(()=>{});controller.error(new ResourceError('Übertragung dauert zu lange. Eingaben bleiben erhalten; bitte erneut versuchen.',408));},timeoutMs);timer.unref?.();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 },async pull(controller){try{const result=await reader.read();if(result.done){clean();reader.releaseLock();controller.close();return;}size+=result.value.byteLength;if(size>limit){await reader.cancel();throw new DataLimitError('Datenmenge zu groß. Bitte den Umfang begrenzen.');}controller.enqueue(result.value);}catch(error){clean();controller.error(error);}},async cancel(reason){clean();await reader.cancel(reason);}});
}

export async function readLimited(response:Response,limit:number):Promise<Uint8Array>{
 try{checkLength(response.headers,limit);}catch(error){await response.body?.cancel();throw error;}
 if(!response.body)return new Uint8Array();
 const reader=limitedStream(response.body,limit).getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function requestLimit(path:string,contentType:string){
 if(path==='/api/service/dokumente')return 8388608;
 if(path==='/api/sicherheit/csp')return 16384;
 if(path==='/api/pds-simulator/uploads')return DOCUMENT_BYTES;
 if(path.startsWith('/api/pds/rest/')&&contentType.startsWith('multipart/form-data'))return DOCUMENT_BYTES+65536;
 if(path.startsWith('/api/pds/rest/')||path==='/api/pds-simulator/orders')return 16000;
 return 512000;
}
export function boundedRequest(request:Request,path:string){
 if(!request.body)return request;
 const limit=requestLimit(path,request.headers.get('content-type')??'');try{checkLength(request.headers,limit);}catch(error){void request.body.cancel().catch(()=>{});throw error;}
 const init:RequestInit&{duplex:'half'}={method:request.method,headers:request.headers,body:limitedStream(request.body,limit,60000,request.signal),duplex:'half',signal:request.signal};
 return new Request(request.url,init);
}
export async function readTextLimited(response:Response,limit:number){return new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(response,limit));}
export async function readJsonLimited(response:Response,limit=JSON_RESPONSE_BYTES){return JSON.parse(await readTextLimited(response,limit));}
