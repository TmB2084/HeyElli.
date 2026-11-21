import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
const f=JSON.parse(await readFile('/private/tmp/heyelli-chat-browser.json','utf8'));
if(!/^heyelli-chat-browser-[a-f\d]+$/.test(f.project)||new URL(f.database).pathname!=='/heyelli_test')throw Error('Named isolated fixture required');
async function snapshot(){const address=spawnSync('docker',['port',f.project+'-db-1','5432'],{encoding:'utf8'});assert.equal(address.status,0);const url=new URL(f.database);url.port=address.stdout.trim().split(':').at(-1);const pool=new Pool({connectionString:url.href});try{return {settings:(await pool.query("SELECT version,enabled,config_id,tested_version FROM platform.copilot_settings WHERE id='central'")).rows,actions:(await pool.query('SELECT id,state,preview FROM platform.assistant_actions ORDER BY id')).rows};}finally{await pool.end();}}
const before=await snapshot();assert.ok(before.settings[0].config_id);assert.equal(before.settings[0].enabled,false);assert.ok(before.actions.length);
const restart=spawnSync('docker',['restart',f.project+'-db-1'],{stdio:'ignore'});assert.equal(restart.status,0);let after;for(let i=0;i<20;i++){try{after=await snapshot();break;}catch{await new Promise(resolve=>setTimeout(resolve,300));}}assert.deepEqual(after,before);
const address=spawnSync('docker',['port',f.project+'-db-1','5432'],{encoding:'utf8'});assert.equal(address.status,0);const url=new URL(f.database);url.port=address.stdout.trim().split(':').at(-1);const pool=new Pool({connectionString:url.href});try{for(const file of ['examples.sql','platform_examples.sql']){const seed=await readFile('database/seeds/'+file,'utf8');await pool.query(seed);await pool.query(seed);}}finally{await pool.end();}
assert.deepEqual(await snapshot(),before);console.log('Isolierte Copilot-Daten bleiben nach Datenbankneustart und jeweils zweimaligem Seed unverändert.');
