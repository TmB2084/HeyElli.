import type {Pool} from 'pg';
import {PlatformError} from './model.ts';
import {usagePaths} from '../shell/app-usage-model.ts';
export function appUsage(pool:Pool){return {
 async read(userId:string){const result=await pool.query('SELECT app_path,visits FROM platform.app_usage WHERE user_id=$1',[userId]);return Object.fromEntries(result.rows.map(row=>[row.app_path,Number(row.visits)]));},
 async record(userId:string,path:unknown){if(typeof path!=='string'||!usagePaths.includes(path))throw new PlatformError('Ungültige App.');await pool.query('INSERT INTO platform.app_usage(user_id,app_path) VALUES($1,$2) ON CONFLICT(user_id,app_path) DO UPDATE SET visits=platform.app_usage.visits+1',[userId,path]);}
};}
