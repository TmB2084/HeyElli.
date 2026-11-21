import {resetFixtureBudget} from './budget-reset.mjs';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {platformRepository} from '../../src/platform/store/repository.ts';
import {assignPds} from '../support/pds-assignment.mjs';
export const fixture=JSON.parse(await readFile(process.env.HEYELLI_BROWSER_FIXTURE_FILE,'utf8'));
export async function sql(query,values=[]){const pool=new Pool({connectionString:fixture.database});try{return await pool.query(query,values);}finally{await pool.end();}}
export async function authenticate(context,actor=fixture.admin){const pool=new Pool({connectionString:fixture.database});try{await assignPds(pool,actor,(await pool.query('SELECT pds_user_uuid FROM platform.pds_user_mappings WHERE user_id=$1',[actor])).rows[0]?.pds_user_uuid);const token=await platformRepository(pool).issue({id:actor,role:(await pool.query('SELECT role FROM platform.users WHERE id=$1',[actor])).rows[0].role,mode:'local'});await context.addCookies([{name:'service-session',value:token,url:fixture.base,httpOnly:true,sameSite:'Strict'}]);}finally{await pool.end();}}

// Browser scenarios share fictional records, but not the previous scenario's
// minute counters. Active leases and all business/draft data remain untouched.
export async function resetBrowserBudget(){const pool=new Pool({connectionString:fixture.database});try{await resetFixtureBudget(pool);}finally{await pool.end();}}
