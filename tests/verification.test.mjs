import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {unitTests,verificationEnvironment,verificationSteps,inspectSnapshot} from '../scripts/verification-plan.mjs';
test('verification forwards the browser system-deps opt-out only with the exact value',()=>{
 assert.equal(verificationEnvironment({PATH:'/bin',HEYELLI_BROWSER_SYSTEM_DEPS:'installed'},'/t').HEYELLI_BROWSER_SYSTEM_DEPS,'installed');
 assert.equal(verificationEnvironment({PATH:'/bin',HEYELLI_BROWSER_SYSTEM_DEPS:'yes; rm -rf /'},'/t').HEYELLI_BROWSER_SYSTEM_DEPS,undefined);
});
test('verification never forwards application credentials or a caller supplied database',()=>{
 const env=verificationEnvironment({PATH:'/bin',HOME:'/fixture',DATABASE_URL:'must-not-forward',HEYELLI_TEST_DATABASE_URL:'must-not-forward',M365_CLIENT_SECRET:'must-not-forward',NODE_OPTIONS:'must-not-forward',AUTH_MODE:'ldap',DOCKER_HOST:'unix:///fixture.sock'},'/temporary');assert.equal(env.PATH,'/bin');assert.equal(env.APP_ENV,'test');assert.equal(env.HEYELLI_TEST_SETTINGS_DIR,'/temporary/settings');for(const value of Object.values(env))assert.ok(!value.includes('must-not-forward'));assert.equal(env.npm_config_userconfig,'/dev/null');assert.equal(env.AUTH_MODE,undefined);assert.throws(()=>verificationEnvironment({DOCKER_HOST:'tcp://remote:2375'},'/temporary'));
});
test('one gate includes isolated databases, all ordinary modules and build before independent typecheck',async()=>{
 const files=await unitTests(process.cwd());assert.ok(files.length>=70);assert.ok(files.includes('src/apps/planboard/entwuerfe/tests/private-drafts.test.mjs'));assert.ok(!files.some(name=>name.includes('postgres')));assert.deepEqual(verificationSteps.map(step=>step[0]),['install','unit','platform','chat','lint','build','types','browser','browser-mutations','dependencies']);
});
test('snapshots reject local configuration, key files, credential patterns and symbolic links without printing content',async()=>{
 const root=await mkdtemp(join(tmpdir(),'heyelli-snapshot-safety-'));try{
 await writeFile(join(root,'.env.example'),'FICTIONAL_PLACEHOLDER=example');assert.deepEqual(await inspectSnapshot(root),['.env.example']);
 for(const [name,value]of [['.env.local','local-only'],['master.key','local-only'],['leak.txt','ghp_'+'x'.repeat(36)]]){await writeFile(join(root,name),value);await assert.rejects(inspectSnapshot(root),error=>!error.message.includes(value));await rm(join(root,name));}
 await symlink(join(root,'.env.example'),join(root,'external'));await assert.rejects(inspectSnapshot(root),/symbolischen Link/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('new database test files need explicit isolated registration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'heyelli-test-inventory-'));try{await mkdir(join(root,'tests'));for(const name of ['platform-postgres.test.mjs','assistant-chat-postgres.test.mjs','new-postgres.test.mjs'])await writeFile(join(root,'tests',name),'');await assert.rejects(unitTests(root),/isolierten Prüfaufruf/);}finally{await rm(root,{recursive:true,force:true});}
});
