import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSettingsPath,settingsLeafTitle} from '../settings-page-model.ts';
test('settings routes stay in their section and enforce parent-child relationships',()=>{
 assert.deepEqual(parseSettingsPath('colors','resources:colors/palette:2'),['resources:colors','palette:2']);
 assert.equal(settingsLeafTitle('resources:colors/palette:2','colors'),'Statusfarbe');
 for(const value of ['pds:connection','palette:2','resources:unknown'])assert.deepEqual(parseSettingsPath('colors',value),[]);
 assert.deepEqual(parseSettingsPath('colors','resources:defaults/palette:2'),['resources:defaults']);
 assert.deepEqual(parseSettingsPath('users','users:accounts/palette:2'),['users:accounts']);
 assert.equal(settingsLeafTitle('mail:settings','account'),null);
 assert.deepEqual(parseSettingsPath('account','account:profile'),['account:profile']);
});

test('Graph setup has its own scope, email only contains delivery pages',()=>{
 assert.deepEqual(parseSettingsPath('graph','graph:connection'),['graph:connection']);
 assert.equal(settingsLeafTitle('graph:release','graph'),'Prüfung & Freigabe');
 assert.deepEqual(parseSettingsPath('email','graph:connection'),[]);
 assert.deepEqual(parseSettingsPath('graph','mail:compose'),[]);
 assert.deepEqual(parseSettingsPath('email','mail:settings'),[]);
 assert.deepEqual(parseSettingsPath('email','mail:compose'),['mail:compose']);
});
test('platform Info is scoped to General settings',()=>{
 assert.deepEqual(parseSettingsPath('system','system:info'),['system:info']);
 assert.equal(settingsLeafTitle('system:info','system'),'Info');
 assert.deepEqual(parseSettingsPath('account','system:info'),[]);
});

test('role details and creation stay nested in the role list',()=>{
 assert.deepEqual(parseSettingsPath('users','users:roles/roles:create'),['users:roles','roles:create']);
 assert.equal(settingsLeafTitle('users:roles/roles:detail','users'),'Rolle bearbeiten');
 assert.deepEqual(parseSettingsPath('users','users:accounts/roles:create'),['users:accounts']);
 assert.deepEqual(parseSettingsPath('users','users:roles/roles:unknown'),['users:roles']);
});

test('security topics have their own root and old general links resolve safely',async()=>{
 const {settingsPages,resolveSettingsLocation}=await import('../settings-page-model.ts');
 assert.deepEqual(settingsPages.system.map(([id])=>id),['appearance','info']);
 for(const id of ['sessions','secrets','browser','data','operations'])assert.deepEqual(parseSettingsPath('security','security:'+id),['security:'+id]);
 assert.deepEqual(resolveSettingsLocation('system','system:security'),{root:'security',path:null});
 for(const id of ['data','operations'])assert.deepEqual(resolveSettingsLocation('system','system:'+id),{root:'security',path:'security:'+id});
 assert.deepEqual(resolveSettingsLocation('account','account:profile'),{root:'account',path:'account:profile'});
 assert.deepEqual(parseSettingsPath('system','security:sessions'),[]);
});
