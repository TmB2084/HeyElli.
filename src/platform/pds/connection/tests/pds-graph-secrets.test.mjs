import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,rename,readdir,lstat,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {savePdsConfiguration,readPdsConfiguration} from '../configuration.ts';
import {saveMicrosoft365Configuration,requireMicrosoft365Configuration,microsoft365Environment} from '../../../mail/configuration.ts';
const cases=[{name:'pds',legacy:'.env.pds.ui.local',key:'pds-secrets',save:()=>savePdsConfiguration({baseUrl:'https://pds.example.invalid',token:'fictional-pds'}),read:readPdsConfiguration},{name:'graph',legacy:'.env.microsoft365.ui.local',key:'mail-secrets',save:()=>saveMicrosoft365Configuration({tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',clientId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',secret:'fictional-graph'}),read:requireMicrosoft365Configuration}];
async function isolated(work){const root=await mkdtemp(join(tmpdir(),'pds-graph-secret-unit-')),previous={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=root;try{await work(root);}finally{for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(root,{recursive:true,force:true});}}
for(const c of cases){
 test(c.name+': missing master never replaces immutable or legacy data; restored key reads original',()=>isolated(async root=>{
  const id=c.save(),file=join(root,`.env.${c.name}.${id}.local`),key=join(root,'.local',c.key,'master.key'),bytes=await readFile(file),value=c.read(id);await rename(key,key+'.backup');const files=await readdir(root);
  assert.throws(c.save,e=>e.status===503);assert.deepEqual(await readdir(root),files);assert.deepEqual(await readFile(file),bytes);await assert.rejects(lstat(key));await rename(key+'.backup',key);assert.deepEqual(c.read(id),value);
  await rename(file,join(root,c.legacy));assert.deepEqual(c.read(),value);await rename(key,key+'.backup');assert.throws(c.save,e=>e.status===503);assert.deepEqual(await readFile(join(root,c.legacy)),bytes);await assert.rejects(lstat(key));await rename(key+'.backup',key);assert.deepEqual(c.read(),value);
 }));
 test(c.name+': candidates are immutable and never implicitly active; legacy remains byte-identical',()=>isolated(async root=>{
  const first=c.save(),file=join(root,`.env.${c.name}.${first}.local`),bytes=await readFile(file);assert.equal(c.read(),null);assert.equal((await lstat(file)).mode&0o777,0o600);
  await rename(file,join(root,c.legacy));const second=c.save();assert.notEqual(first,second);assert.deepEqual(await readFile(join(root,c.legacy)),bytes);assert.deepEqual(c.read(second),c.read());assert.throws(()=>c.read('invalid'),e=>e.status===503);
 }));
 test(c.name+': referenced missing/tampered/linked files fail closed',()=>isolated(async root=>{
  const id=c.save(),file=join(root,`.env.${c.name}.${id}.local`),bytes=await readFile(file);await writeFile(file,'broken');assert.throws(()=>c.read(id));await writeFile(file,bytes);await rename(file,file+'.backup');await symlink(file+'.backup',file);assert.throws(()=>c.read(id));
  if(c.name==='graph')assert.equal(microsoft365Environment(id).M365_CLIENT_SECRET,undefined);
 }));
}
