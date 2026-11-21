import type {Pool} from 'pg';
import {PlatformError} from './model.ts';
import {toolCatalog} from '../app-access/tools.ts';
export function toolPreferences(pool:Pool){
 async function read(userId:string):Promise<{hidden:string[];version:number}>{return (await pool.query('SELECT hidden_tools AS hidden,version FROM platform.tool_preferences WHERE user_id=$1',[userId])).rows[0]??{hidden:[],version:0};}
 return {read,async write(userId:string,hidden:unknown,version:unknown){
  if(!Array.isArray(hidden)||hidden.length>toolCatalog.length||new Set(hidden).size!==hidden.length||hidden.some(id=>!toolCatalog.some(tool=>tool.id===id)))throw new PlatformError('Ungültige Werkzeugauswahl.');
  if(!Number.isSafeInteger(version)||Number(version)<0)throw new PlatformError('Ungültiger Versionsstand.');
  const result=Number(version)===0?await pool.query('INSERT INTO platform.tool_preferences(user_id,hidden_tools) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING hidden_tools AS hidden,version',[userId,JSON.stringify(hidden)]):await pool.query('UPDATE platform.tool_preferences SET hidden_tools=$1::jsonb,version=version+1,updated_at=now() WHERE user_id=$2 AND version=$3 RETURNING hidden_tools AS hidden,version',[JSON.stringify(hidden),userId,version]);
  if(!result.rowCount)throw new PlatformError('Die Werkzeugauswahl wurde in einem anderen Fenster geändert. Bitte erneut auswählen.',409);
  return result.rows[0] as {hidden:string[];version:number};
 }};
}
