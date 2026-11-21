import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../store/model.ts';
import {appCatalog,writableApps} from './model.ts';
import {toolCatalog} from './tools.ts';
export function appRoleRepository(pool:Pool){
 async function rights(userId:string){const row=(await pool.query('SELECT u.role,r.name,r.apps,r.write_apps,r.tools FROM platform.users u LEFT JOIN platform.app_roles r ON r.id=COALESCE(u.app_role_id,u.role) WHERE u.id=$1 AND u.enabled',[userId])).rows[0];if(!row)return {apps:[] as string[],writeApps:[] as string[],tools:[] as string[],roleName:''};return row.role==='admin'?{apps:appCatalog.map(([path])=>path),writeApps:[...writableApps],tools:toolCatalog.map(tool=>tool.id),roleName:'Administrator'}:{apps:row.apps??[],writeApps:row.write_apps??[],tools:row.tools??[],roleName:row.name??''};}
 async function allowed(userId:string){return (await rights(userId)).apps;}
 async function can(userId:string,app:string,permission:'read'|'write'='write'){const access=await rights(userId);return access.apps.includes(app)&&(permission==='read'||access.writeApps.includes(app));}
 async function read(){return {roles:(await pool.query('SELECT * FROM platform.app_roles ORDER BY builtin DESC,name')).rows,users:(await pool.query("SELECT id,display_name,role,app_role_id,version FROM platform.users WHERE role<>'admin' ORDER BY display_name")).rows};}
 async function mutate(actor:string,input:Record<string,unknown>){if(!input||typeof input!=='object')throw new PlatformError('Eingabe fehlt.');const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(741963282)');const admin=(await client.query("SELECT id FROM platform.users WHERE id=$1 AND enabled AND role='admin' FOR SHARE",[actor])).rowCount;if(!admin)throw new PlatformError('Administratorrechte erforderlich.',403);
 let changes:unknown,target=String(input.id??'');
 if(input.action==='assign'){
  const role=(await client.query('SELECT * FROM platform.app_roles WHERE id=$1 FOR SHARE',[input.roleId])).rows[0];if(!role)throw new PlatformError('Rolle nicht gefunden.',404);
  const user=(await client.query('SELECT * FROM platform.users WHERE id=$1 FOR UPDATE',[input.userId])).rows[0];if(!user||user.role==='admin')throw new PlatformError('Administratoren werden hier nicht umgestellt.',403);if(user.version!==input.version)throw new PlatformError('Benutzer wurde geändert. Bitte neu öffnen.',409);
  await client.query('UPDATE platform.users SET role=$1,app_role_id=$2,version=version+1,updated_at=now() WHERE id=$3',[role.base_role,role.builtin?null:role.id,user.id]);await client.query('UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);target=user.id;changes=[{field:'appRole',label:'App-Rolle',before:user.app_role_id??user.role,after:role.id}];
 }else{
  const old=input.id?(await client.query('SELECT * FROM platform.app_roles WHERE id=$1 FOR UPDATE',[input.id])).rows[0]:null;
  if(input.id&&!old)throw new PlatformError('Rolle nicht gefunden.',404);if(old&&old.version!==input.version)throw new PlatformError('Rolle wurde geändert. Bitte neu öffnen.',409);
  if(input.action==='delete'){if(old?.builtin)throw new PlatformError('Standardrollen können nicht gelöscht werden.');if((await client.query('SELECT id FROM platform.users WHERE app_role_id=$1',[old.id])).rowCount)throw new PlatformError('Rolle ist noch Benutzern zugeordnet.',409);await client.query('DELETE FROM platform.app_roles WHERE id=$1',[old.id]);changes=[{field:'role',label:'Rolle',before:old,after:null}];}
  else if(input.action==='save'){
   if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80||/[\x00-\x1f]/.test(input.name)||!Array.isArray(input.apps)||input.apps.length>appCatalog.length||input.apps.some(path=>!appCatalog.some(([value])=>value===path)||path==='/einstellungen')||new Set(input.apps).size!==input.apps.length)throw new PlatformError('Name und App-Auswahl prüfen.');
   if(!Array.isArray(input.writeApps)||input.writeApps.some(path=>!writableApps.includes(path as typeof writableApps[number])||!(input.apps as unknown[]).includes(path))||new Set(input.writeApps).size!==input.writeApps.length)throw new PlatformError('Schreibrechte müssen zu einer lesbaren App gehören.');
   const tools=input.tools??old?.tools??[];
   if(!Array.isArray(tools)||tools.length>toolCatalog.length||new Set(tools).size!==tools.length||tools.some(id=>!toolCatalog.some(tool=>tool.id===id&&(tool.app===null||(input.apps as unknown[]).includes(tool.app)))))throw new PlatformError('Werkzeuge benötigen Zugriff auf die zugehörige App.');
   const baseRole=old?.builtin?old.base_role:input.writeApps.length?'dispatcher':'reader';
   if(/^(admin|administrator)$/i.test(input.name.trim()))throw new PlatformError('Dieser Name ist für Administratoren reserviert.');
   if((await client.query('SELECT id FROM platform.app_roles WHERE lower(name)=lower($1) AND id<>$2',[input.name.trim(),old?.id??''])).rowCount)throw new PlatformError('Dieser Rollenname ist bereits vergeben.',409);
   target=old?.id??randomUUID();const apps=JSON.stringify(input.apps);if(old)await client.query('UPDATE platform.app_roles SET name=$1,base_role=$2,apps=$3::jsonb,write_apps=$5::jsonb,tools=$6::jsonb,version=version+1 WHERE id=$4',[input.name.trim(),baseRole,apps,target,JSON.stringify(input.writeApps),JSON.stringify(tools)]);else await client.query('INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps,tools) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)',[target,input.name.trim(),baseRole,apps,JSON.stringify(input.writeApps),JSON.stringify(tools)]);
   if(old){await client.query("UPDATE platform.sessions SET revoked_at=now() WHERE revoked_at IS NULL AND user_id IN(SELECT id FROM platform.users WHERE app_role_id=$1 OR app_role_id IS NULL AND role=$1)",[target]);await client.query('UPDATE platform.users SET role=$1,version=version+1,updated_at=now() WHERE app_role_id=$2',[baseRole,target]);}
   changes=[{field:'tools',label:'Menüleisten-Werkzeuge',before:old?.tools??[],after:tools},{field:'name',label:'Rollenname',before:old?.name??null,after:input.name.trim()},{field:'writeApps',label:'Schreibrechte je App',before:old?.write_apps??[],after:input.writeApps},{field:'apps',label:'App-Zugriffe',before:old?.apps??[],after:input.apps}];
  }else throw new PlatformError('Unbekannte Aktion.');
 }
 await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[actor,'app-role.'+input.action,target,JSON.stringify(changes)]);await client.query('COMMIT');return {ok:true,id:target};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {allowed,rights,can,read,mutate};
}
