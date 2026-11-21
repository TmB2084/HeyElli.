// Isolierte Prüfumgebungen: macht das fiktive Konto „local-service-user“ (Benutzername „service“) zum Administrator
// mit dem übergebenen, je Lauf zufällig erzeugten Passwort. Nur für getrennte Testdatenbanken, nie für Entwicklung oder Server.
import {hashPassword} from '../src/platform/accounts/password.ts';
export const TEST_ADMIN={id:'local-service-user',username:'service'};
export async function prepareTestAdmin(pool,password){
 const hash=await hashPassword(password);
 await pool.query("UPDATE platform.users SET role='admin',enabled=true,app_role_id=NULL,username=$2,password_hash=$3,password_must_change=false,version=version+1 WHERE id=$1",[TEST_ADMIN.id,TEST_ADMIN.username,hash]);
}
