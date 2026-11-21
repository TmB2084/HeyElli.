import type {Pool,PoolClient} from 'pg';
import {PlatformError} from '../../store/model.ts';
import {readPdsConfiguration} from './configuration.ts';
export type PdsSource={mode:'simulator'|'pds-readonly';workspaceId:string|null;configId?:string|null;views:{colorView?:string;workingTimeView?:string;vacationApprovalView?:string;returnLinkView?:string}};
export async function sourceSnapshot(pool:Pool):Promise<PdsSource>{const row=(await pool.query("SELECT active_source,workspace_id,config_id,views FROM platform.pds_connection WHERE id='central'")).rows[0];if(!row)throw new PlatformError('PDS-Quellenkonfiguration fehlt.',503);return {mode:row.active_source,workspaceId:row.workspace_id,configId:row.config_id,views:row.views};}
export function workspaceSchema(id:string){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new PlatformError('Ungültiger Quellenbereich.');return 'pds_'+id.replaceAll('-','').toLowerCase();}
export async function createWorkspace(client:PoolClient,id:string){const schema=workspaceSchema(id);await client.query('INSERT INTO platform.pds_workspaces(id) VALUES($1)',[id]);await client.query(`CREATE SCHEMA "${schema}"`);for(const table of ['calendar_colors','user_preferences'])await client.query(`CREATE TABLE "${schema}".${table} (LIKE platform.${table} INCLUDING ALL)`);}
// Only local calendar preferences/colors are redirected. Identities, roles and appearance stay central.
export function calendarSourcePool(pool:Pool,id:string):Pool{
 const schema=workspaceSchema(id);
 function queryArgs(args:unknown[]){return args.map((arg,index)=>{if(index!==0)return arg;const rewrite=(sql:string)=>sql.replace(/\bplatform\.(calendar_colors|user_preferences)\b/g,`"${schema}".$1`);if(typeof arg==='string')return rewrite(arg);if(arg&&typeof arg==='object'&&'text' in arg&&typeof arg.text==='string')return {...arg,text:rewrite(arg.text)};return arg;});}
 function clientProxy(client:PoolClient){return new Proxy(client,{get(target,prop){if(prop==='query')return (...args:unknown[])=>Reflect.apply(target.query,target,queryArgs(args));const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});}
 return new Proxy(pool,{get(target,prop){if(prop==='query')return (...args:unknown[])=>Reflect.apply(target.query,target,queryArgs(args));if(prop==='connect')return async()=>clientProxy(await target.connect());const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});
}
export function sourceConfiguration(source:PdsSource){const config=readPdsConfiguration(source.configId);if(!config||!source.workspaceId||config.workspaceId!==source.workspaceId)throw new PlatformError('Aktive PDS-Konfiguration ist nicht konsistent. Simulator bewusst in den Einstellungen wählen oder Verbindung neu einrichten.',503);return config;}
