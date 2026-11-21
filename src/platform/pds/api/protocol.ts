import {upstreamSignal} from '../../resource-budgets/context.ts';
import {readLimited,JSON_RESPONSE_BYTES,DOCUMENT_BYTES} from "../../http-safety/limits.ts";
import contract from "./contract.json" with {type:"json"};
type Schema={type?:string;required?:string[];properties?:Record<string,Schema>;items?:Schema;enum?:unknown[];$ref?:string;uniqueItems?:boolean};
export class PdsProtocolError extends Error {}
export function validateSchema(value:unknown,schema:Schema,path="request"):void {
  if(schema.$ref){const name=schema.$ref.split('/').pop()!;return validateSchema(value,(contract.schemas as Record<string,Schema>)[name],path);}
  if(schema.enum && !schema.enum.includes(value))throw new PdsProtocolError(`${path}: ungültiger Enum-Wert`);
  if(schema.type==="object") {
    if(!value || typeof value!=="object" || Array.isArray(value))throw new PdsProtocolError(`${path}: Objekt erwartet`);
    const record=value as Record<string,unknown>;
    for(const key of schema.required??[])if(record[key]===undefined || record[key]===null)throw new PdsProtocolError(`${path}.${key}: Pflichtfeld fehlt`);
    for(const [key,child]of Object.entries(schema.properties??{}))if(record[key]!==undefined)validateSchema(record[key],child,`${path}.${key}`);
  }else if(schema.type==="array") {
    if(!Array.isArray(value))throw new PdsProtocolError(`${path}: Liste erwartet`);
    if(schema.uniqueItems && new Set(value.map(item=>JSON.stringify(item))).size!==value.length)throw new PdsProtocolError(`${path}: doppelte Einträge`);
    for(const item of value)if(schema.items)validateSchema(item,schema.items,path+'[]');
  }else if(schema.type==="string" && typeof value!=="string")throw new PdsProtocolError(`${path}: Text erwartet`);
  else if(schema.type==="boolean" && typeof value!=="boolean")throw new PdsProtocolError(`${path}: Boolean erwartet`);
  else if(schema.type==="integer" && !Number.isInteger(value))throw new PdsProtocolError(`${path}: Ganzzahl erwartet`);
}
export function validateRequest(method:string,path:string,body?:unknown) {
  const template=Object.keys(contract.operations).find(key=>{const [verb,pattern]=key.split(" ");return verb===method && new RegExp("^"+pattern.replace(/\{[^}]+\}/g,"[^/]+")+"$").test(path);});
  const operation=(contract.operations as Record<string,{request?:Record<string,{schema?:Schema}>}>)[template??`${method} ${path}`];
  if(!operation)throw new PdsProtocolError("Nicht dokumentierte PDS-Operation.");
  const schema=operation.request?.['application/json']?.schema;
  if(schema)validateSchema(body,schema);
}
export interface PdsTransport { request(method:"GET"|"POST",path:string,body?:unknown,options?:{signal?:AbortSignal}):Promise<unknown> }
export class PdsHttpTransport implements PdsTransport {
  private readonly baseUrl:string;private readonly token:string;private readonly fetcher:typeof fetch;
  constructor(baseUrl:string,token:string,fetcher:typeof fetch=fetch) {
    this.baseUrl=baseUrl;this.token=token;this.fetcher=fetcher;
    if(new URL(baseUrl).protocol!=="https:")throw new PdsProtocolError("Echtes PDS erfordert HTTPS.");
  }
  async request(method:"GET"|"POST",path:string,body?:unknown,options?:{signal?:AbortSignal}) {
    validateRequest(method,path,body);
    const budget=upstreamSignal(options?.signal);
    const response=await this.fetcher(this.baseUrl.replace(/\/$/,"")+path,{method,headers:{Authorization:`Bearer ${this.token}`,...(body instanceof FormData ? {} : {"Content-Type":"application/json"})},body:body instanceof FormData ? body : body===undefined?undefined:JSON.stringify(body),signal:budget?AbortSignal.any([budget,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),redirect:"error",cache:"no-store"});
    if(!response.ok){await response.body?.cancel();throw new PdsProtocolError(`PDS-Aufruf fehlgeschlagen (HTTP ${response.status}); kein View-Fallback.`);}
    if(method==="GET" && path.startsWith("/dokument/downloaddokument/"))return await readLimited(response,DOCUMENT_BYTES);
    // The documented delete response has no JSON schema and may be empty.
    const text=new TextDecoder("utf-8",{fatal:true}).decode(await readLimited(response,JSON_RESPONSE_BYTES));
    const result=path==="/termin/delete" ? (text.trim()?JSON.parse(text):undefined) : JSON.parse(text);
    if(result && typeof result==="object" && "errorCode" in result)throw new PdsProtocolError("PDS meldet einen fachlichen Fehler; kein View-Fallback.");
    return result;
  }
}
export async function readApiFirst<T>(api:()=>Promise<T|undefined>,view:()=>Promise<T>):Promise<{source:"api"|"view";value:T}> {
  const value=await api(); // Errors intentionally propagate; never hide 401/403/500 with a view.
  return value===undefined ? {source:"view",value:await view()} : {source:"api",value};
}
export {contract};
