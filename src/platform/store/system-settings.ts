import {auditChanges} from "./audit-changes.ts";
import type {Pool,PoolClient} from "pg";
import {PlatformError,permitted} from "./model.ts";
export type SystemSettings={sessionDurationMinutes:number;defaultAppearance:"dark"|"light"|"system";showTechnicianBadges:boolean;limitWorkingHours:boolean;showTentative:boolean;version:number};
const columns='session_duration_minutes AS "sessionDurationMinutes",default_appearance AS "defaultAppearance",show_technician_badges AS "showTechnicianBadges",limit_working_hours AS "limitWorkingHours",show_tentative AS "showTentative",version';
function validate(input:unknown):SystemSettings {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new PlatformError("Systemeinstellungen fehlen.");
  const value=input as Record<string,unknown>;
  if(value.defaultAppearance!=="dark"&&value.defaultAppearance!=="light"&&value.defaultAppearance!=="system")throw new PlatformError("Ungültige Standarddarstellung.");
  if(typeof value.showTechnicianBadges!=="boolean"||typeof value.limitWorkingHours!=="boolean"||typeof value.showTentative!=="boolean"||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw new PlatformError("Ungültige Systemeinstellungen.");
  if(!Number.isInteger(value.sessionDurationMinutes)||Number(value.sessionDurationMinutes)<5||Number(value.sessionDurationMinutes)>1440)throw new PlatformError("Sitzungsdauer muss zwischen 5 und 1440 Minuten liegen.");
  return {sessionDurationMinutes:Number(value.sessionDurationMinutes),defaultAppearance:value.defaultAppearance,showTechnicianBadges:value.showTechnicianBadges,limitWorkingHours:value.limitWorkingHours,showTentative:value.showTentative,version:Number(value.version)};
}
export async function readSystemDefaults(client:Pool|PoolClient):Promise<SystemSettings> {
  const {rows}=await client.query<SystemSettings>(`SELECT ${columns} FROM platform.system_settings WHERE id='platform'`);
  if(!rows[0])throw new PlatformError("Zentrale Systemeinstellungen fehlen.",503);
  return rows[0];
}
export function systemSettingsRepository(pool:Pool) {
  return {read:()=>readSystemDefaults(pool),async save(actor:string,input:unknown) {
    const settings=validate(input),client=await pool.connect();
    try {
      await client.query("BEGIN");
      const {rows}=await client.query("SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE",[actor]);
      if(!rows[0]?.enabled||!permitted(rows[0],"admin"))throw new PlatformError("Administratorrechte erforderlich.",403);
      await client.query("SELECT id FROM platform.system_settings WHERE id='platform' FOR UPDATE");
      const before=await readSystemDefaults(client);
      const result=await client.query<SystemSettings>(`UPDATE platform.system_settings SET default_appearance=$1,show_technician_badges=$2,limit_working_hours=$3,show_tentative=$4,session_duration_minutes=$6,version=version+1,updated_at=now() WHERE id='platform' AND version=$5 RETURNING ${columns}`,[settings.defaultAppearance,settings.showTechnicianBadges,settings.limitWorkingHours,settings.showTentative,settings.version,settings.sessionDurationMinutes]);
      if(!result.rows[0])throw new PlatformError("Systemeinstellungen wurden zwischenzeitlich geändert. Bitte neu laden.",409);
      await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'settings.updated','platform',$2::jsonb)",[actor,JSON.stringify(auditChanges({...before},{...result.rows[0]},{sessionDurationMinutes:"Sitzungsdauer (Minuten)",defaultAppearance:"Standarddarstellung",showTechnicianBadges:"Technikerkennzeichnung",limitWorkingHours:"Arbeitszeit begrenzen",showTentative:"Vorläufige Termine anzeigen"}))]);
      await client.query("COMMIT");return result.rows[0];
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }};
}
