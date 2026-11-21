// Self-contained PostgreSQL verification: never reads development .env files.
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {bmaRepository} from '../src/platform/bmacloud/repository.ts';
const project='heyelli-test-'+randomBytes(5).toString('hex'),password=randomBytes(32).toString('hex');
const directory=await mkdtemp(join(tmpdir(),'heyelli-bma-postgres-'));
const oldEnv=process.env.APP_ENV,oldRoot=process.env.HEYELLI_TEST_SETTINGS_DIR;process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=directory;
function compose(args,capture=false){const result=spawnSync('docker',['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project,...args],{env:{...process.env,HEYELLI_TEST_POSTGRES_PASSWORD:password},encoding:'utf8',stdio:capture?'pipe':'inherit'});if(result.status!==0)throw Error('Isolierte BMACloud-Prüfdatenbank nicht verfügbar.');return result.stdout;}
let pool;
try{
 compose(['up','-d','--wait']);const port=compose(['port','db','5432'],true).trim().split(':').at(-1),url=new URL(`postgresql://heyelli_test@127.0.0.1:${port}/heyelli_test`);url.password=password;pool=new Pool({connectionString:url.href});
 await pool.query('CREATE TABLE public.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL)');
 async function migrate(){for(const name of (await readdir('database/migrations')).filter(n=>/^\d+_[a-z0-9_]+\.sql$/.test(n)).sort()){const sql=await readFile('database/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex'),old=await pool.query('SELECT checksum FROM public.schema_migrations WHERE name=$1',[name]);if(old.rowCount)assert.equal(old.rows[0].checksum,checksum);else{await pool.query(sql);await pool.query('INSERT INTO public.schema_migrations VALUES($1,$2)',[name,checksum]);}}}
 async function seed(){for(const name of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+name,'utf8'));}
 await migrate();await migrate();await seed();await seed();
 const admin='demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reader='demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';let fail=false,calls=0;
 const transport=async()=>{calls++;return fail?new Response('not returned',{status:401}):Response.json([{aid:1,nr:'00123'}]);};
 let store=bmaRepository(pool,transport);assert.equal((await store.read(admin)).enabled,false);await assert.rejects(store.read(reader),e=>e.status===403);
 await assert.rejects(store.save(reader,{version:0,baseUrl:'https://bma.example.invalid/',token:'fictional-test-token'}),e=>e.status===403);
 await store.save(admin,{version:0,baseUrl:'https://bma.example.invalid/',token:'fictional-test-token'});let state=await store.read(admin);assert.equal(state.enabled,false);assert.equal(state.configured,true);assert.ok(!JSON.stringify(state).includes('fictional-test-token'));
 await assert.rejects(store.mode(admin,{version:state.version,enabled:true}),e=>e.status===409);
 fail=true;await assert.rejects(store.test(admin,{version:state.version}),/401/);assert.equal((await store.read(admin)).configured,true);assert.equal((await store.read(admin)).enabled,false);
 fail=false;await store.test(admin,{version:state.version});await store.mode(admin,{version:state.version,enabled:true});state=await store.read(admin);assert.equal(state.enabled,true);
 await assert.rejects(store.save(admin,{version:state.version-1,baseUrl:'https://bma.example.invalid/',token:''}),e=>e.status===409);
 await assert.rejects(store.save(admin,{version:state.version,baseUrl:'https://other.example.invalid/',token:''}),/erneut eingeben/);assert.deepEqual(await store.read(admin),state);
 const audits=(await pool.query("SELECT changes FROM platform.audit_events WHERE target_id='bmacloud'")).rows;assert.ok(audits.length>=3);assert.ok(!JSON.stringify(audits).includes('fictional-test-token'));
 await seed();await seed();await pool.end();pool=new Pool({connectionString:url.href});store=bmaRepository(pool,transport);assert.deepEqual(await store.read(admin),state);
 await store.save(admin,{version:state.version,baseUrl:state.baseUrl,token:''});state=await store.read(admin);assert.equal(state.enabled,false);assert.equal(state.configured,true);assert.equal(state.tested,false);assert.equal(calls,2);
 console.log('BMACloud: Migrationen/Seeds wiederholbar; Adminschutz, Geheimnisschutz, Fehlererhalt, Freigabe, Versionskonflikte und Persistenz erfolgreich geprüft.');
}finally{await pool?.end();compose(['down','-v','--remove-orphans']);await rm(directory,{recursive:true,force:true});if(oldEnv===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=oldEnv;if(oldRoot===undefined)delete process.env.HEYELLI_TEST_SETTINGS_DIR;else process.env.HEYELLI_TEST_SETTINGS_DIR=oldRoot;}
