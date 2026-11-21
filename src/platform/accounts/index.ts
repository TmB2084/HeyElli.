export {loginAttempt} from "./login-attempt.ts";
export type {LoginAttempt} from "./login-attempt.ts";
import "server-only";
import { cookies } from "next/headers";
import { PdsHttpTransport } from "../pds/api/index.ts";
import { localLoginReplaced, type Identity } from "./core.ts";
import {platformStore,permitted} from "../store/index.ts";
export type {Identity} from "./core.ts";
export {permitted} from "../store/index.ts";
const cookieName="service-session";

// heyelli-Konten: Anmeldung mit Benutzername und Passwort, bis die Microsoft-Anmeldung (Entra ID) aktiviert ist.
// Danach ersetzt Microsoft die eigene Anmeldung (localLoginReplaced); Deaktivieren stellt sie wieder her.
async function microsoftEnabled(){const {microsoftAuthStore}=await import('../../system/anmeldung/microsoft');return microsoftAuthStore().available();}
export async function localLoginAvailable(){return !localLoginReplaced("local",await microsoftEnabled());}
export async function authenticate(username:string,password:string):Promise<Identity> {
  if (!await localLoginAvailable()) throw new Error("Anmeldung erfolgt über Microsoft.");
  return platformStore().authenticateLocal(username,password);
}
export async function session():Promise<Identity|null> {return sessionFromToken((await cookies()).get(cookieName)?.value??'');}
export async function sessionToken():Promise<string> {return (await cookies()).get(cookieName)?.value??'';}
export async function requestSession(request:{cookies:{get:(name:string)=>{value:string}|undefined}}){return sessionFromToken(request.cookies.get(cookieName)?.value??'');}
async function sessionFromToken(token:string):Promise<Identity|null> {
  if (!token) return null;
  // read() prüft Ablauf, Widerruf, Freischaltung, aktuelle PDS-Zuordnung und die Microsoft-Konfigurationsversion.
  const identity=await platformStore().read(token);
  if(!identity)return null;
  if(identity.mode==="local"&&localLoginReplaced(identity.mode,await microsoftEnabled()))return null;
  return identity;
}
export async function setSession(identity:Identity|null) {
  const jar=await cookies();
  const previous=jar.get(cookieName)?.value ?? "";
  const issued=identity ? await platformStore().issueSession(identity,previous) : null;
  const token=issued?.token??"";
  if (!identity) await platformStore().revoke(previous);
  jar.set(cookieName,token,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",...(issued?{expires:issued.expiresAt}:{maxAge:0})});
}
export {isSameOrigin as sameOrigin} from "./core.ts";
// Every real transport follows the active source and its read-only capability boundary.
export async function pdsTransportForSession(){
 const identity=await session();if(!identity||!permitted(identity,"read")||identity.mode!=="microsoft")throw new Error("Microsoft-Anmeldung erforderlich.");
 const {pdsSource,sourceConfiguration}=await import('../pds/connection');const source=await pdsSource();if(source.mode!=="pds-readonly")throw new Error("Echte PDS-Verbindung nicht freigegeben.");
 const config=sourceConfiguration(source);const {ReadonlyPdsTransport}=await import('../pds/connection/readonly');return new ReadonlyPdsTransport(new PdsHttpTransport(config.baseUrl,config.token));
}
