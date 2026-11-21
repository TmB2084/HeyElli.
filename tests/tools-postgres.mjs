import assert from 'node:assert/strict';
import {appRoleRepository} from '../src/platform/app-access/repository.ts';
import {toolPreferences} from '../src/platform/store/tool-preferences.ts';
import {grantedTools} from '../src/platform/app-access/tools.ts';
export async function checkTools(pool){
 const roles=appRoleRepository(pool),prefs=toolPreferences(pool),admin='demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user='tools:fictional-owner',other='tools:fictional-other';let role;
 await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Werkzeugnutzerin','reader',true),($2,'Fiktiver Werkzeugnutzer','reader',true)",[user,other]);
 try{
  assert.deepEqual(grantedTools((await roles.rights(admin)).apps,(await roles.rights(admin)).tools).map(t=>t.id),['incident','notes']);
  await assert.rejects(roles.mutate(admin,{action:'save',name:'Unzulässiges Werkzeug',apps:['/hilfe'],writeApps:[],tools:['incident']}),e=>e.status===400);
  role=await roles.mutate(admin,{action:'save',name:'Fiktive Werkzeugrolle',apps:['/casedesk'],writeApps:[],tools:['incident']});
  await pool.query('UPDATE platform.users SET app_role_id=$1 WHERE id=$2',[role.id,user]);
  let rights=await roles.rights(user);assert.equal(grantedTools(rights.apps,rights.tools).length,1);assert.equal(await roles.can(user,'/casedesk','write'),false);
  assert.deepEqual(await prefs.read(user),{hidden:[],version:0});
  const hidden=await prefs.write(user,['incident'],0);assert.deepEqual(hidden.hidden,['incident']);
  assert.deepEqual(await prefs.read(other),{hidden:[],version:0});
  await assert.rejects(prefs.write(user,[],0),e=>e.status===409);await assert.rejects(prefs.write(user,['unknown'],hidden.version),e=>e.status===400);
  assert.deepEqual(await prefs.read(user),hidden);
  const saved=(await roles.read()).roles.find(r=>r.id===role.id);
  await roles.mutate(admin,{action:'save',id:role.id,version:saved.version,name:saved.name,apps:['/casedesk'],writeApps:[],tools:[]});
  rights=await roles.rights(user);assert.equal(grantedTools(rights.apps,rights.tools).length,0);assert.deepEqual((await prefs.read(user)).hidden,['incident']);
  assert.equal((await pool.query("SELECT changes FROM platform.audit_events WHERE target_id=$1 AND action='app-role.save' ORDER BY created_at DESC LIMIT 1",[role.id])).rows.length,1);
  const fresh=await pool.connect();try{assert.deepEqual((await fresh.query('SELECT hidden_tools FROM platform.tool_preferences WHERE user_id=$1',[user])).rows[0].hidden_tools,['incident']);}finally{fresh.release();}
 }finally{await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[user,other]]);if(role)await pool.query('DELETE FROM platform.app_roles WHERE id=$1',[role.id]);}
}
