import "server-only";
import {session,sameOrigin,permitted} from "../../platform/accounts/index.ts";
import {platformStore,PlatformError} from "../../platform/store/index.ts";
export const adminHeaders={"Cache-Control":"no-store"};
export async function adminRequest(request?:Request) {
  const user=await session();
  if (!user) throw new PlatformError("Bitte zuerst anmelden.",401);
  if (!permitted(user,"admin")) throw new PlatformError("Administratorrechte erforderlich.",403);
  if (request && !sameOrigin(request)) throw new PlatformError("Unzulässiger Ursprung.",403);
  return {user,store:platformStore()};
}
export async function adminBody(request:Request):Promise<unknown> {
  const reader=request.body?.getReader();
  if (!reader) throw new PlatformError("Eingabe fehlt.");
  const chunks:Uint8Array[]=[];let size=0;
  while (true) {
    const {value,done}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>8192){await reader.cancel();throw new PlatformError("Eingabe zu groß.",413);}
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new PlatformError("Ungültige Eingabe."); }
}
export function adminFailure(error:unknown) {
  return Response.json({error:error instanceof PlatformError?error.message:"Die Einstellungen sind derzeit nicht verfügbar. Datenbankverbindung prüfen lassen."},{status:error instanceof PlatformError?error.status:503,headers:adminHeaders});
}
