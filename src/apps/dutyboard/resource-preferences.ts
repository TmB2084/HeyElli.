import {checkDutyHolidays,type DutyHolidayOptions} from '../planboard/kalender/duty-holidays.ts';
import type {Pool} from 'pg';
import {checkSelection} from '../planboard/kalender/preferences.ts';
import {CalendarError} from '../planboard/kalender/model.ts';
export function dutyResourcePreferences(pool:Pool){
 return {
  async readHolidays(userId:string):Promise<{holidays:DutyHolidayOptions;version:number}>{const {rows}=await pool.query('SELECT holiday_settings,holiday_version FROM platform.duty_resource_preferences WHERE user_id=$1',[userId]);return {holidays:checkDutyHolidays(rows[0]?.holiday_settings??undefined),version:rows[0]?.holiday_version??0};},
  async writeHolidays(userId:string,value:unknown,expectedVersion:unknown){
   let holidays:DutyHolidayOptions;try{if(value===undefined)throw new Error("Feiertagseinstellungen fehlen.");holidays=checkDutyHolidays(value);}catch(error){throw new CalendarError(error instanceof Error?error.message:"Ungültige Feiertagseinstellungen.");}
   if(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<0)throw new CalendarError("Ungültige Einstellungsversion.");
   const client=await pool.connect();try{await client.query("BEGIN");await client.query("INSERT INTO platform.duty_resource_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING",[userId]);const {rows}=await client.query("SELECT holiday_version FROM platform.duty_resource_preferences WHERE user_id=$1 FOR UPDATE",[userId]);if(rows[0].holiday_version!==expectedVersion)throw new CalendarError("Feiertagseinstellungen wurden in einem anderen Tab geändert. Bitte neu laden.",409);const saved=await client.query("UPDATE platform.duty_resource_preferences SET holiday_settings=$2::jsonb,holiday_version=holiday_version+1,updated_at=now() WHERE user_id=$1 RETURNING holiday_settings AS holidays,holiday_version AS version",[userId,JSON.stringify(holidays)]);await client.query("COMMIT");return saved.rows[0] as {holidays:DutyHolidayOptions;version:number};}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  },
  async read(userId:string):Promise<{selection:string[]|null;version:number}>{
   const {rows}=await pool.query('SELECT selection,version FROM platform.duty_resource_preferences WHERE user_id=$1',[userId]);
   return rows[0]??{selection:null,version:0};
  },
  async write(userId:string,value:unknown,expectedVersion:unknown){
   const selection=checkSelection(value);if(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<0)throw new CalendarError('Ungültige Auswahlversion.');
   const client=await pool.connect();
   try{await client.query('BEGIN');await client.query('INSERT INTO platform.duty_resource_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
    const {rows}=await client.query('SELECT version FROM platform.duty_resource_preferences WHERE user_id=$1 FOR UPDATE',[userId]);
    if(rows[0].version!==expectedVersion)throw new CalendarError('Die Ressourcenauswahl wurde in einem anderen Tab geändert. Bitte neu laden.',409);
    const saved=await client.query('UPDATE platform.duty_resource_preferences SET selection=$2::jsonb,version=version+1,updated_at=now() WHERE user_id=$1 RETURNING selection,version',[userId,JSON.stringify(selection)]);
    await client.query('COMMIT');return saved.rows[0] as {selection:string[]|null;version:number};
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
 };
}
