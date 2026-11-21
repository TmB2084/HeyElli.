import type {Pool} from 'pg';
import {PlatformError} from './model.ts';
export type LauncherView='grid'|'list';
export function launcherPreferences(pool:Pool){
 async function read(userId:string):Promise<{view:LauncherView;version:number}>{
  const {rows}=await pool.query('SELECT view_mode AS view,version FROM platform.launcher_preferences WHERE user_id=$1',[userId]);
  return rows[0]??{view:'grid',version:0};
 }
 return {read,async write(userId:string,view:unknown,version:unknown){
  if(view!=='grid'&&view!=='list')throw new PlatformError('Ungültige Menüansicht.');
  if(!Number.isSafeInteger(version)||Number(version)<0)throw new PlatformError('Ungültiger Versionsstand.');
  const result=Number(version)===0
   ?await pool.query('INSERT INTO platform.launcher_preferences(user_id,view_mode) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING view_mode AS view,version',[userId,view])
   :await pool.query('UPDATE platform.launcher_preferences SET view_mode=$1,version=version+1,updated_at=now() WHERE user_id=$2 AND version=$3 RETURNING view_mode AS view,version',[view,userId,version]);
  if(!result.rowCount)throw new PlatformError('Die Menüansicht wurde in einem anderen Fenster geändert. Bitte erneut auswählen.',409);
  return result.rows[0] as {view:LauncherView;version:number};
 }};
}
