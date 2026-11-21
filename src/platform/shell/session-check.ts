import {appForPath} from '../app-access/model.ts';
import {appLandingPath} from '../app-access/landing.ts';
export type SessionResult={kind:'valid';remaining:number}|{kind:'unavailable'}|{kind:'redirect';path:string};
export function sessionResult(status:number,value:unknown,pathname:string,elapsed:number):SessionResult{
 if(status===401||status===403)return {kind:'redirect',path:'/anmeldung'};
 if(status!==200||!value||typeof value!=='object')return {kind:'unavailable'};
 const data=value as Record<string,unknown>;
 if(data.authenticated===false)return {kind:'redirect',path:'/anmeldung'};
 if(data.authenticated!==true||!Array.isArray(data.allowedApps)||data.allowedApps.some(app=>typeof app!=='string')||typeof data.sessionRemainingMs!=='number'||!Number.isFinite(data.sessionRemainingMs))return {kind:'unavailable'};
 const remaining=data.sessionRemainingMs-Math.max(0,elapsed);
 if(remaining<=0)return {kind:'redirect',path:'/anmeldung'};
 const app=appForPath(pathname);if(app&&!data.allowedApps.includes(app))return {kind:'redirect',path:pathname==='/'?appLandingPath(data.allowedApps):'/kein-zugriff'};
 return {kind:'valid',remaining};
}
