import {DataLimitError,DOCUMENT_BYTES} from '@/platform/http-safety/limits';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission,writeAppsForRequest} from '@/platform/app-access';
import {session,permitted,sameOrigin} from '@/platform/session';
import {timingSafeEqual,createHash} from "node:crypto";
import {simulatorApi} from "@/platform/pds/simulator/api-entry";
import {PdsProtocolError} from "@/platform/pds/api";
async function handle(request:Request,context:{params:Promise<{segments:string[]}>}) {
  const user=await session();if(!user)return Response.json({errorCode:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
  const {segments}=await context.params;const path='/'+segments.join('/');
  const read=request.method==='GET'||/^\/[^/]+\/(?:list[a-z]*|details(?:batch)?|findstoerungtermin)$/i.test(path);
  if(read?!permitted(user,'read'):!(await Promise.all(writeAppsForRequest(new URL(request.url).pathname,request.method).map(app=>appPermission(user,app)))).some(Boolean))return Response.json({errorCode:'FORBIDDEN'},{status:403});
  if(!read&&!sameOrigin(request))return Response.json({errorCode:'FORBIDDEN'},{status:403});
  const expected=process.env.SIMULATOR_API_TOKEN;
  if(!expected)return Response.json({errorCode:"NOT_CONFIGURED"},{status:503});
  const token=request.headers.get("authorization")??"";
  if(!timingSafeEqual(createHash("sha256").update(token).digest(),createHash("sha256").update(`Bearer ${expected}`).digest()))return Response.json({errorCode:"UNAUTHORIZED"},{status:401});
  const step=request.headers.get("X-Simulator-Workflow");
  if(step && !/^[a-f0-9-]{36}$/.test(step))return Response.json({errorCode:"INVALID_WORKFLOW"},{status:400});
  const api=simulatorApi(step ? "raw:"+step : undefined);
  try {const multipart=request.headers.get("content-type")?.startsWith("multipart/form-data");const text=request.method==="POST"&&!multipart?await request.text():"";if(text.length>16000)return new Response(null,{status:413});const form=multipart?await request.formData():undefined;if(form)for(const value of form.values())if(value instanceof File&&value.size>DOCUMENT_BYTES)throw new DataLimitError('Datei zu groß. Maximal 100 MB.');const result=await api.transport.request(request.method as "GET"|"POST",path,multipart?form:text?JSON.parse(text):undefined);if(result instanceof Uint8Array)return new Response(new Uint8Array(result).buffer,{headers:{"Content-Type":"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});return Response.json(result,{headers:{"Cache-Control":"no-store"}});}
  catch(error){return Response.json({errorCode:"UNEXPECTED",message:error instanceof PdsProtocolError||error instanceof DataLimitError?error.message:"Endpunkt nicht implementiert oder Anfrage fehlgeschlagen."},{status:error instanceof DataLimitError?413:error instanceof PdsProtocolError?400:501});}finally{api.close();}
}


export const GET=withRouteAccess('/api/pds/rest/api/[...segments]','GET',handle);

export const POST=withRouteAccess('/api/pds/rest/api/[...segments]','POST',handle);
