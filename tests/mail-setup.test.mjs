import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parseEnv} from 'node:util';
test('setup writes private local configuration without exposing or replacing credentials',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'heyelli-mail-setup-'));
 async function run(){return new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,[resolve('scripts/setup-microsoft365.mjs')],{cwd:directory,stdio:['pipe','pipe','pipe']});let text='',stage=0;const answers=['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee','bbbbbbbb-cccc-dddd-eeee-ffffffffffff','fictional-setup-secret'];child.stdout.on('data',data=>{text+=data;const prompts=['Tenant-ID:','Client-ID:','Eingabe verborgen'];if(stage<3&&text.includes(prompts[stage]))child.stdin.write(answers[stage++]+'\n');});child.stderr.on('data',data=>{text+=data;});child.on('error',reject);child.on('exit',code=>resolveRun({code,text}));});}
 try{const first=await run();assert.equal(first.code,0);assert.ok(!first.text.includes('fictional-setup-secret'));const path=join(directory,'.env.microsoft365.local'),contents=await readFile(path,'utf8');assert.equal(parseEnv(contents).M365_CLIENT_SECRET,'fictional-setup-secret');assert.equal((await stat(path)).mode&0o777,0o600);const second=await run();assert.equal(second.code,1);assert.equal(await readFile(path,'utf8'),contents);}finally{await rm(directory,{recursive:true,force:true});}
});
