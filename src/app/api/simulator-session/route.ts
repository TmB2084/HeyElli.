import {createHash} from 'node:crypto';
import {appRoleStore} from '@/platform/app-access';
import { loginAttempt, authenticate, localLoginAvailable, sameOrigin, session, setSession } from "@/platform/session";
import {platformStore} from "@/platform/store";
import {logLoginRejected,loginFailureReason} from "@/platform/accounts/login-log";
// Anmeldung mit heyelli-Konto (Benutzername und Passwort). Der historische Pfad bleibt erhalten, weil Oberfläche und Tests ihn verwenden.
const headers={"Cache-Control":"no-store"};
const MODE="local";
// Abgelehnte Anmeldung: kurze Logzeile mit festem Grund (ohne personenbezogene Daten, siehe login-log.ts) und Antwort.
function rejected(reason:string,body:Record<string,unknown>,status:number,extraHeaders:Record<string,string>={}){logLoginRejected(reason,MODE,status);return Response.json(body,{status,headers:{...headers,...extraHeaders}});}
async function publicUser(user:Awaited<ReturnType<typeof session>>) {return user ? {role:user.role,roleName:(await appRoleStore().rights(user.id)).roleName,displayName:user.displayName ?? "heyelli-Benutzer"} : null;}
export async function GET() {
  try {
    const user=await session();
    return Response.json({authenticated:!!user,sessionSubject:user?createHash('sha256').update(user.id).digest('hex'):null,allowedApps:user?await appRoleStore().allowed(user.id):[],sessionRemainingMs:user?.expiresAt?Math.max(0,Date.parse(user.expiresAt)-Date.now()):0,user:await publicUser(user),mustChangePassword:!!user?.mustChangePassword,configured:await localLoginAvailable(),mode:MODE,microsoftAvailable:await (await import('@/system/anmeldung/microsoft')).microsoftAuthStore().available()},{headers});
  } catch {return Response.json({error:"Anmeldung derzeit nicht verfügbar. Datenbankverbindung prüfen lassen."},{status:503,headers});}
}
export async function POST(request:Request) {
  if (!sameOrigin(request)) return rejected("unzulässiger Ursprung",{error:"Unzulässiger Ursprung."},403);
  // Aktive Microsoft-Anmeldung ersetzt die eigene Anmeldung.
  if (!await localLoginAvailable()) return rejected("durch Microsoft ersetzt",{error:"Die Anmeldung erfolgt über Microsoft."},403);
  // Bound the streamed body too; Content-Length alone is not trustworthy.
  const reader=request.body?.getReader();
  if (!reader) return rejected("ungültige Eingabe",{error:"Anmeldung fehlgeschlagen."},400);
  const chunks:Uint8Array[]=[];let size=0;
  while (true) {
    const {value,done}=await reader.read(); if (done) break;
    size+=value.byteLength;
    if (size>8192) {await reader.cancel();return rejected("ungültige Eingabe",{error:"Eingabe zu groß."},413);}
    chunks.push(value);
  }
  let input:{username?:unknown;password?:unknown}|null;
  try {input=JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");} catch {return rejected("ungültige Eingabe",{error:"Ungültige Eingabe."},400);}
  if (typeof input?.password!=="string" || input.password.length>1024 || typeof input.username!=="string" || input.username.length>200 || /[\x00-\x1f\x7f]/.test(input.username)) return rejected("ungültige Eingabe",{error:"Anmeldung fehlgeschlagen."},401);
  try {if(!await platformStore().allowLogin(loginAttempt(request,'password',input.username.trim().toLowerCase())))return rejected("zu viele Versuche",{error:"Zu viele Anmeldeversuche. Bitte später erneut versuchen."},429,{'Retry-After':'900'});}
  catch(error) {return rejected(loginFailureReason(error)==="unbekannter Fehler"?"Anmeldequelle oder Datenbank nicht erreichbar":loginFailureReason(error),{error:"Anmeldung derzeit nicht verfügbar. Datenbankverbindung prüfen lassen."},503);}
  try {
    const identity=await authenticate(input.username,input.password);
    await setSession(identity);
    return Response.json({authenticated:true,mustChangePassword:!!identity.mustChangePassword,user:await publicUser(identity),allowedApps:await appRoleStore().allowed(identity.id)},{headers});
  } catch(error) {
    const reason=loginFailureReason(error);
    const message=reason==="PDS-Zuordnung fehlt"?"Deinem Konto ist noch kein PDS-Benutzer zugeordnet. Bitte die Administration, die Zuordnung vorzunehmen.":reason==="Benutzer nicht freigeschaltet"?"Dein Konto ist nicht freigeschaltet.":"Anmeldung fehlgeschlagen. Benutzername oder Passwort prüfen.";
    return rejected(reason,{error:message},401);
  }
}
export async function DELETE(request:Request) {
  if (!sameOrigin(request)) return new Response(null,{status:403,headers});
  try {await setSession(null); return Response.json({authenticated:false},{headers});}
  catch {return Response.json({error:"Abmeldung derzeit nicht verfügbar."},{status:503,headers});}
}
