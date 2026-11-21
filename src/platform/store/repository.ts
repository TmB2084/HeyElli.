import {queryAudit} from './audit-query.ts';
import type {AuditFilters} from '../../system/einstellungen/audit-filter.ts';
import {allowLogin} from "./login-limits.ts";
import type {LoginAttempt} from "../accounts/index.ts";
import {auditChanges} from "./audit-changes.ts";
import {readSystemDefaults} from "./system-settings.ts";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {PlatformError,permitted,userInput,type PlatformUser} from "./model.ts";
import type {Identity} from "../accounts/index.ts";
import {activeWorkspaceSql,pdsAssignmentSatisfied} from "../accounts/core.ts";
import {verifyPassword,hashPassword,generateInitialPassword,usernameInput,upnInput} from "../accounts/password.ts";
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const userColumns='id, display_name AS "displayName", role, app_role_id AS "appRoleId", enabled, version';
const accountColumns=`u.id, u.display_name AS "displayName", u.role, u.app_role_id AS "appRoleId", u.enabled, u.version, u.username, u.microsoft_upn AS "microsoftUpn", u.microsoft_subject IS NOT NULL AS "microsoftLinked", u.microsoft_linked_at AS "microsoftLinkedAt", u.password_hash IS NOT NULL AS "hasPassword", u.password_must_change AS "passwordMustChange", m.pds_user_uuid AS "pdsUserUUID"`;
const accountJoin=`FROM platform.users u LEFT JOIN platform.pds_user_mappings m ON m.user_id=u.id AND m.workspace_id=${activeWorkspaceSql}`;
function uniqueViolation(error:unknown,message:string):never{if((error as {code?:string})?.code==="23505")throw new PlatformError(message,409);throw error;}
export function platformRepository(pool:Pool) {
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>) {
    const client=await pool.connect();
    try { await client.query("BEGIN"); const result=await work(client); await client.query("COMMIT"); return result; }
    catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function lock(client:PoolClient) { await client.query("SELECT pg_advisory_xact_lock(741963282)"); }
  async function requireAdmin(client:PoolClient,actor:string) {
    const {rows}=await client.query("SELECT role, enabled FROM platform.users WHERE id=$1 FOR SHARE",[actor]);
    if (!rows[0]?.enabled || !permitted(rows[0],"admin")) throw new PlatformError("Administratorrechte erforderlich.",403);
  }
  async function audit(client:PoolClient,actor:string,action:string,target:string,changes:unknown) {
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)",[actor,action,target,JSON.stringify(changes)]);
  }
  async function issueSession(identity:Identity,previousToken="") {
      return transaction(async client=>{
        // Rolle und PDS-Benutzer stammen immer aus der Datenbank (aktuelle Zuordnung der aktiven Quelle), nie vom Aufrufer.
        const {rows}=await client.query(`SELECT u.enabled,u.role,m.pds_user_uuid FROM platform.users u LEFT JOIN platform.pds_user_mappings m ON m.user_id=u.id AND m.workspace_id=${activeWorkspaceSql} WHERE u.id=$1 FOR SHARE OF u`,[identity.id]);
        if (!rows[0]?.enabled) throw new PlatformError("Benutzer nicht freigeschaltet.",403);
        if (!pdsAssignmentSatisfied(rows[0].role,rows[0].pds_user_uuid)) throw new PlatformError("PDS-Zuordnung fehlt.",403);
        const pdsUserUUID:string=rows[0].pds_user_uuid??"";
        let revision:number|null=null;
        if(identity.mode==='microsoft'){
          const config=(await client.query("SELECT enabled,version FROM platform.microsoft_auth WHERE id='central' FOR SHARE")).rows[0];
          if(!config?.enabled||config.version!==identity.authRevision)throw new PlatformError('Microsoft-Anmeldung wurde geändert oder deaktiviert.',403);
          revision=config.version;
        }
        const token=randomBytes(32).toString("base64url");
        // Ended sessions are retained until an explicitly confirmed privacy plan.
        // Login must not bypass retention holds or remove other users' records.
        if (previousToken) await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE token_hash=$1",[hash(previousToken)]);
        const settings=await readSystemDefaults(client);
        const saved=await client.query("INSERT INTO platform.sessions(id,token_hash,user_id,auth_mode,pds_user_uuid,expires_at,microsoft_revision) VALUES($1,$2,$3,$4,$5,now()+($6::integer * interval '1 minute'),$7) RETURNING expires_at",[randomUUID(),hash(token),identity.id,identity.mode,pdsUserUUID,settings.sessionDurationMinutes,revision]);
        return {token,expiresAt:saved.rows[0].expires_at as Date};
      });
    }
  return {
    // Konto mit aktueller Rolle, Anzeigename und PDS-Benutzer der aktiven Quelle auflösen; prüft Freischaltung und PDS-Pflicht.
    async authorize(identity:Identity):Promise<Identity> {
      const row=(await pool.query(`SELECT ${accountColumns} ${accountJoin} WHERE u.id=$1`,[identity.id])).rows[0];
      if(!row?.enabled)throw new PlatformError("Benutzer nicht freigeschaltet.",403);
      if(!pdsAssignmentSatisfied(row.role,row.pdsUserUUID))throw new PlatformError("PDS-Zuordnung fehlt.",403);
      return {...identity,role:row.role,displayName:row.displayName,pdsUserUUID:row.pdsUserUUID??undefined};
    },
    // Lokale Anmeldung mit Benutzername und Passwort (nur solange die Microsoft-Anmeldung nicht aktiv ist).
    async authenticateLocal(username:unknown,password:unknown):Promise<Identity> {
      let name="";try{name=usernameInput(username);}catch{/* gleiche Antwort wie falsches Passwort */}
      const row=name?(await pool.query(`SELECT ${accountColumns}, u.password_hash ${accountJoin} WHERE u.username=$1`,[name])).rows[0]:undefined;
      const valid=await verifyPassword(password,row?.password_hash);
      if(!row||!valid)throw new Error("Anmeldung fehlgeschlagen.");
      if(!row.enabled)throw new PlatformError("Benutzer nicht freigeschaltet.",403);
      if(!pdsAssignmentSatisfied(row.role,row.pdsUserUUID))throw new PlatformError("PDS-Zuordnung fehlt.",403);
      return {id:row.id,role:row.role,displayName:row.displayName,mode:"local",pdsUserUUID:row.pdsUserUUID??undefined,...(row.passwordMustChange?{mustChangePassword:true}:{})};
    },
    // Microsoft-Anmeldung: verknüpftes Konto, sonst einmalige Verknüpfung über die vom Admin hinterlegte Anmeldeadresse (UPN).
    async authenticateMicrosoft(subject:string,upn:string|null,revision:number):Promise<Identity> {
      return transaction(async client=>{
        let row=(await client.query(`SELECT ${accountColumns} ${accountJoin} WHERE u.microsoft_subject=$1 FOR UPDATE OF u`,[subject])).rows[0];
        if(!row&&upn){
          row=(await client.query(`SELECT ${accountColumns} ${accountJoin} WHERE u.microsoft_upn=$1 AND u.microsoft_subject IS NULL FOR UPDATE OF u`,[upn.toLowerCase()])).rows[0];
          if(row){
            await client.query("UPDATE platform.users SET microsoft_subject=$2,microsoft_linked_at=now(),version=version+1,updated_at=now() WHERE id=$1",[row.id,subject]).catch(error=>uniqueViolation(error,"Microsoft-Konto ist bereits verknüpft."));
            await audit(client,row.id,"user.microsoft.linked",row.id,[{field:"microsoft",label:"Microsoft-Konto",before:"nicht verknüpft",after:"verknüpft (Anmeldeadresse)"}]);
          }
        }
        if(!row)throw new PlatformError("Microsoft-Konto nicht verknüpft.",403);
        if(!row.enabled)throw new PlatformError("Benutzer nicht freigeschaltet.",403);
        if(!pdsAssignmentSatisfied(row.role,row.pdsUserUUID))throw new PlatformError("PDS-Zuordnung fehlt.",403);
        return {id:row.id,role:row.role,displayName:row.displayName,mode:"microsoft",authRevision:revision,pdsUserUUID:row.pdsUserUUID??undefined};
      });
    },
    // Selbst verknüpfen (Benutzerkonto) bzw. Verknüpfung des testenden Administrators.
    async linkMicrosoft(userId:string,subject:string) {
      return transaction(async client=>{
        const current=(await client.query("SELECT enabled,microsoft_subject FROM platform.users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
        if(!current?.enabled)throw new PlatformError("Benutzer nicht freigeschaltet.",403);
        if(current.microsoft_subject===subject)return;
        await client.query("UPDATE platform.users SET microsoft_subject=$2,microsoft_linked_at=now(),version=version+1,updated_at=now() WHERE id=$1",[userId,subject]).catch(error=>uniqueViolation(error,"Dieses Microsoft-Konto ist bereits mit einem anderen heyelli-Konto verknüpft."));
        await audit(client,userId,"user.microsoft.linked",userId,[{field:"microsoft",label:"Microsoft-Konto",before:current.microsoft_subject?"anderes Konto":"nicht verknüpft",after:"verknüpft"}]);
      });
    },
    async account(userId:string) {
      const row=(await pool.query(`SELECT ${accountColumns} ${accountJoin} WHERE u.id=$1`,[userId])).rows[0];
      if(!row)throw new PlatformError("Benutzer nicht gefunden.",404);
      return row;
    },
    // Eigenes Passwort ändern; weitere Sitzungen des Kontos enden, die aktuelle bleibt.
    async changePassword(userId:string,currentToken:string,currentPassword:unknown,newPassword:unknown) {
      const nextHash=await hashPassword(newPassword);
      return transaction(async client=>{
        const row=(await client.query("SELECT enabled,password_hash FROM platform.users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
        if(!row?.enabled||!await verifyPassword(currentPassword,row.password_hash))throw new PlatformError("Das bisherige Passwort ist nicht korrekt.",403);
        if(await verifyPassword(newPassword,row.password_hash))throw new PlatformError("Das neue Passwort muss sich vom bisherigen unterscheiden.");
        await client.query("UPDATE platform.users SET password_hash=$2,password_must_change=false,password_changed_at=now(),version=version+1,updated_at=now() WHERE id=$1",[userId,nextHash]);
        await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL AND token_hash<>$2",[userId,hash(currentToken)]);
        await audit(client,userId,"user.password.changed",userId,[{field:"password",label:"Passwort",before:"gesetzt",after:"geändert"}]);
      });
    },
    // Admin: Startpasswort erzeugen bzw. zurücksetzen; wird genau einmal zurückgegeben, Pflicht zur Änderung.
    async resetPassword(actor:string,userId:string) {
      const initialPassword=generateInitialPassword(),passwordHash=await hashPassword(initialPassword);
      await transaction(async client=>{
        await lock(client);await requireAdmin(client,actor);
        const row=(await client.query("SELECT username FROM platform.users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
        if(!row)throw new PlatformError("Benutzer nicht gefunden.",404);
        if(!row.username)throw new PlatformError("Bitte zuerst einen Benutzernamen vergeben.",409);
        await client.query("UPDATE platform.users SET password_hash=$2,password_must_change=true,password_changed_at=now(),version=version+1,updated_at=now() WHERE id=$1",[userId,passwordHash]);
        await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[userId]);
        await audit(client,actor,"user.password.reset",userId,[{field:"password",label:"Passwort",before:null,after:"Startpasswort (Änderung erforderlich)"}]);
      });
      return {initialPassword};
    },
    // Admin: PDS-Benutzer der aktiven Quelle zuordnen (null = Zuordnung entfernen).
    // Vorabprüfung beim Anlegen: ist der PDS-Benutzer in der aktiven Quelle noch frei? (verhindert halb eingerichtete Konten)
    async takenPdsUsers(){const workspace=(await pool.query(`SELECT ${activeWorkspaceSql} AS id`)).rows[0].id;return (await pool.query("SELECT pds_user_uuid AS id,user_id AS \"userId\" FROM platform.pds_user_mappings WHERE workspace_id=$1",[workspace])).rows as {id:string;userId:string}[];},
    async pdsUserTaken(pdsUserUUID:string,exceptUserId?:string){const workspace=(await pool.query(`SELECT ${activeWorkspaceSql} AS id`)).rows[0].id;return !!(await pool.query("SELECT 1 FROM platform.pds_user_mappings WHERE workspace_id=$1 AND pds_user_uuid=$2 AND user_id IS DISTINCT FROM $3",[workspace,pdsUserUUID,exceptUserId??null])).rowCount;},
    async setPdsUser(actor:string,userId:string,pdsUserUUID:unknown,describe:(id:string|null)=>string|null=id=>id) {
      if(pdsUserUUID!==null&&(typeof pdsUserUUID!=="string"||!pdsUserUUID||pdsUserUUID.length>200||/\s/.test(pdsUserUUID)))throw new PlatformError("Ungültiger PDS-Benutzer.");
      return transaction(async client=>{
        await lock(client);await requireAdmin(client,actor);
        const user=(await client.query("SELECT id FROM platform.users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
        if(!user)throw new PlatformError("Benutzer nicht gefunden.",404);
        if((await client.query("SELECT id FROM platform.duty_swaps WHERE status IN ('pending','accepted','executing') AND (requester_id=$1 OR partner_id=$1)",[userId])).rows.length)throw new PlatformError("Zuordnung erst nach Abschluss oder Rücknahme offener Tauschwünsche ändern.",409);
        const workspace=(await client.query(`SELECT ${activeWorkspaceSql} AS id`)).rows[0].id;
        const before=(await client.query("SELECT pds_user_uuid FROM platform.pds_user_mappings WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",[workspace,userId])).rows[0]?.pds_user_uuid??null;
        if(before===pdsUserUUID)return {pdsUserUUID:before};
        if(pdsUserUUID===null)await client.query("DELETE FROM platform.pds_user_mappings WHERE workspace_id=$1 AND user_id=$2",[workspace,userId]);
        else await client.query("INSERT INTO platform.pds_user_mappings(workspace_id,user_id,pds_user_uuid) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET pds_user_uuid=excluded.pds_user_uuid",[workspace,userId,pdsUserUUID]).catch(error=>uniqueViolation(error,"Dieser PDS-Benutzer ist bereits einem anderen Konto zugeordnet."));
        await client.query("UPDATE platform.users SET version=version+1,updated_at=now() WHERE id=$1",[userId]);
        await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[userId]);
        await audit(client,actor,"user.pds.assigned",userId,[{field:"pdsUser",label:"PDS-Benutzer",before:describe(before),after:describe(pdsUserUUID as string|null)}]);
        return {pdsUserUUID};
      });
    },
    // Admin: Microsoft-Verknüpfung lösen. Bei aktiver Microsoft-Anmeldung bleibt mindestens ein verknüpfter Administrator.
    async unlinkMicrosoft(actor:string,userId:string) {
      return transaction(async client=>{
        await lock(client);await requireAdmin(client,actor);
        const row=(await client.query("SELECT role,enabled,microsoft_subject FROM platform.users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
        if(!row)throw new PlatformError("Benutzer nicht gefunden.",404);
        if(!row.microsoft_subject)return;
        const msEnabled=(await client.query("SELECT enabled FROM platform.microsoft_auth WHERE id='central'")).rows[0]?.enabled;
        if(msEnabled&&row.enabled&&row.role==="admin"&&Number((await client.query("SELECT count(*) FROM platform.users WHERE enabled AND role='admin' AND microsoft_subject IS NOT NULL")).rows[0].count)===1)throw new PlatformError("Der letzte mit Microsoft verknüpfte Administrator muss erhalten bleiben.",409);
        await client.query("UPDATE platform.users SET microsoft_subject=NULL,microsoft_linked_at=NULL,version=version+1,updated_at=now() WHERE id=$1",[userId]);
        await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND auth_mode='microsoft' AND revoked_at IS NULL",[userId]);
        await audit(client,actor,"user.microsoft.unlinked",userId,[{field:"microsoft",label:"Microsoft-Konto",before:"verknüpft",after:"nicht verknüpft"}]);
      });
    },
    issueSession,
    async issue(identity:Identity,previousToken=""){return (await issueSession(identity,previousToken)).token;},
    async read(token:string):Promise<Identity|null> {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const {rows}=await pool.query("SELECT u.id,u.role,u.display_name,u.password_must_change,s.auth_mode,s.pds_user_uuid,s.expires_at,(SELECT m.pds_user_uuid FROM platform.pds_user_mappings m WHERE m.user_id=u.id AND m.workspace_id="+activeWorkspaceSql+") AS current_pds FROM platform.sessions s JOIN platform.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.enabled AND (s.auth_mode<>'microsoft' OR u.microsoft_subject IS NOT NULL AND EXISTS(SELECT 1 FROM platform.microsoft_auth m WHERE m.id='central' AND m.enabled AND m.version=s.microsoft_revision))",[hash(token)]);
      const row=rows[0];
      if(!row||!["local","microsoft"].includes(row.auth_mode))return null;
      // Es gilt immer die aktuelle Zuordnung der aktiven Quelle. Ohne Zuordnung (z. B. nach Quellenwechsel) endet die Sitzung,
      // Administratoren ausgenommen. Änderungen in der Benutzerverwaltung beenden Sitzungen zusätzlich ausdrücklich.
      if(!pdsAssignmentSatisfied(row.role,row.current_pds))return null;
      return {id:row.id,role:row.role,displayName:row.display_name,mode:row.auth_mode,pdsUserUUID:row.current_pds??undefined,expiresAt:new Date(row.expires_at).toISOString(),...(row.auth_mode==="local"&&row.password_must_change?{mustChangePassword:true}:{})};
    },
    async revoke(token:string) { if(token) await pool.query("UPDATE platform.sessions SET revoked_at=now() WHERE token_hash=$1",[hash(token)]); },
    allowLogin(attempt:LoginAttempt){return allowLogin(pool,attempt);},
    async overview(actor:string) {
      return transaction(async client=>{
        await requireAdmin(client,actor);
        const users=await client.query(`SELECT ${accountColumns} ${accountJoin} ORDER BY u.display_name,u.id`);
        const source=(await client.query("SELECT active_source FROM platform.pds_connection WHERE id='central'")).rows[0]?.active_source??"simulator";
        const sessions=await client.query('SELECT s.id,s.user_id AS "userId",u.display_name AS "displayName",s.created_at AS "createdAt",s.expires_at AS "expiresAt" FROM platform.sessions s JOIN platform.users u ON u.id=s.user_id WHERE s.revoked_at IS NULL AND s.expires_at>now() AND u.enabled ORDER BY s.created_at DESC LIMIT 200');
        const events=await client.query('SELECT actor_id AS "actorId",action,changes,target_id AS "targetId",created_at AS "createdAt" FROM platform.audit_events ORDER BY id DESC LIMIT 30');
        const appRoles=await client.query('SELECT id,name,base_role AS "baseRole" FROM platform.app_roles ORDER BY builtin DESC,name');
        return {users:users.rows,sessions:sessions.rows,events:events.rows,appRoles:appRoles.rows,pdsSource:source};
      });
    },
    async auditPage(actor:string,filters:AuditFilters,options:Parameters<typeof queryAudit>[2]={}) {
      return transaction(async client=>{await requireAdmin(client,actor);return queryAudit(client,filters,options);});
    },
    async saveUser(actor:string,input:unknown) {
      const user=userInput(input);
      // Benutzername optional (bestehende Konten ohne Benutzernamen bleiben bearbeitbar); für ein Startpasswort ist er Pflicht.
      const username=user.username===undefined||user.username===null||user.username===""?null:usernameInput(user.username),microsoftUpn=upnInput(user.microsoftUpn);
      if(!user.id){if(user.version!==0)throw new PlatformError("Ungültiger Versionsstand.");user.id=`konto:${randomUUID()}`;}
      return transaction(async client=>{
        await lock(client); await requireAdmin(client,actor);
        const {rows}=await client.query<PlatformUser>(`SELECT ${userColumns}, username, microsoft_upn AS "microsoftUpn" FROM platform.users WHERE id=$1 FOR UPDATE`,[user.id]);
        const current=rows[0];
        if ((current?.version??0)!==user.version) throw new PlatformError("Benutzer wurde zwischenzeitlich geändert. Bitte neu laden.",409);
        let appRoleId=user.appRoleId===undefined&&current?.role===user.role?current.appRoleId??null:user.appRoleId??null;
        if(appRoleId){const assigned=(await client.query('SELECT base_role FROM platform.app_roles WHERE id=$1 FOR SHARE',[appRoleId])).rows[0];if(!assigned)throw new PlatformError('App-Rolle nicht gefunden.',404);user.role=assigned.base_role;}
        if(user.role==='admin')appRoleId=null;
        if (current?.enabled && current.role==="admin" && (!user.enabled || user.role!=="admin")) {
          const admins=await client.query("SELECT id FROM platform.users WHERE enabled AND role='admin'");
          if (admins.rowCount===1) throw new PlatformError("Der letzte aktive Administrator muss erhalten bleiben.",409);
        }
        const result=await client.query<PlatformUser>(`INSERT INTO platform.users(id,display_name,role,enabled,app_role_id,username,microsoft_upn) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,app_role_id=excluded.app_role_id,role=excluded.role,enabled=excluded.enabled,username=excluded.username,microsoft_upn=excluded.microsoft_upn,version=platform.users.version+1,updated_at=now() RETURNING ${userColumns}, username, microsoft_upn AS "microsoftUpn"`,[user.id,user.displayName,user.role,user.enabled,appRoleId,username,microsoftUpn]).catch(error=>uniqueViolation(error,"Benutzername oder Microsoft-Anmeldeadresse ist bereits vergeben."));
        if (!user.enabled || current && (current.role!==user.role||(current.appRoleId??null)!==appRoleId)) await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[user.id]);
        await audit(client,actor,current?"user.updated":"user.created",user.id,auditChanges(current?{...current}:null,{...result.rows[0]},{displayName:"Anzeigename",username:"Benutzername",microsoftUpn:"Microsoft-Anmeldeadresse",role:"Grundberechtigung",appRoleId:"App-Rolle",enabled:"Aktiv"}));
        return result.rows[0];
      });
    },
    async revokeSession(actor:string,id:string) {
      if(!/^[0-9a-f-]{36}$/.test(id))throw new PlatformError("Ungültige Sitzung.");
      return transaction(async client=>{
        await lock(client); await requireAdmin(client,actor);
        const result=await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id",[id]);
        if (!result.rowCount) throw new PlatformError("Sitzung nicht gefunden.",404);
        await audit(client,actor,"session.revoked",id,[{field:"active",label:"Sitzung aktiv",before:true,after:false}]);
      });
    }
  };
}
