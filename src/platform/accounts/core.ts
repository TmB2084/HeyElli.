// heyelli-Konten: gemeinsame Typen und reine Regeln (ohne Datenbank- oder Next-Abhängigkeit, damit testbar).
export type Identity = { id:string; role:"admin"|"dispatcher"|"reader"; mode:"local"|"microsoft"; displayName?:string; expiresAt?:string; authRevision?:number; pdsUserUUID?:string; mustChangePassword?:boolean };

// Fester Arbeitsbereich der Simulator-Quelle (Migration 047). Echte PDS-Quellen haben eigene Arbeitsbereiche;
// Zuordnungen zu PDS-Benutzern gelten je Arbeitsbereich, weil Simulator und echtes PDS verschiedene Kennungen haben.
export const SIMULATOR_WORKSPACE="00000000-0000-4000-8000-000000000001";
export const activeWorkspaceSql="(SELECT CASE WHEN active_source='pds-readonly' AND workspace_id IS NOT NULL THEN workspace_id ELSE '"+SIMULATOR_WORKSPACE+"'::uuid END FROM platform.pds_connection WHERE id='central')";

// Aktive Microsoft-Anmeldung (Entra ID) ersetzt die eigene Anmeldung: keine Passwortanmeldung,
// bestehende lokale Sitzungen sind gesperrt (nicht widerrufen). Deaktivieren stellt die eigene Anmeldung als Rückweg wieder her.
export function localLoginReplaced(mode:Identity["mode"]|string,microsoftEnabled:boolean){return microsoftEnabled&&mode!=="microsoft";}

// Anmeldung erfordert eine Zuordnung zu einem PDS-Benutzer der aktiven Quelle. Administratoren sind ausgenommen,
// damit Erstinstallation und Quellenwechsel möglich bleiben; PDS-Schreibaktionen verlangen die Zuordnung trotzdem.
export function pdsAssignmentSatisfied(role:Identity["role"],pdsUserUUID:string|null|undefined){return role==="admin"||!!pdsUserUUID;}

// Neue Konten erhalten eine serverseitig erzeugte Kennung; frühere Kennungen bleiben gültig (Fremdschlüssel).
export const ACCOUNT_ID=/^(heyelli-admin|konto:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|local-service-user|(?:ad|demo-ad):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|entra:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

// The browser Origin must match the actual request host, including its port.
// Next's internal URL may normalize a loopback hostname to localhost.
export function isSameOrigin(request:Request) {
  try {
    const expected=new URL(request.url),host=request.headers.get("host");
    // Clear the internal port first: assigning a Host without port would otherwise keep it (e.g. :3000).
    if(host){if(/[\s/@?#\\,]/.test(host))return false;expected.port="";expected.host=host;if(expected.host.toLowerCase()!==host.toLowerCase())return false;}
    // Behind a TLS reverse proxy the public scheme is declared explicitly, never taken from forwarded headers.
    const configured=process.env.HEYELLI_PUBLIC_ORIGIN;
    if(configured){const pub=new URL(configured);if(pub.host.toLowerCase()===expected.host.toLowerCase())return request.headers.get("origin")===pub.origin;}
    return request.headers.get("origin")===expected.origin;
  } catch {return false;}
}
