import {once} from 'node:events';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnTestProcess,stopTestProcess} from '../scripts/test-process.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('fixture shutdown stops descendants before cleanup and preserves unrelated groups',{skip:process.platform==='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'heyelli-process-tree-')),file=join(root,'heartbeat');let child,unrelated,expired;
 try{
  unrelated=spawnTestProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  const writer=`const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync(process.argv[1],'x'),10);`;
  const leader=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(writer)},process.argv[1]],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`;
  child=spawnTestProcess(process.execPath,['-e',leader,file],{stdio:'ignore'});
  let started=false;for(let i=0;i<200;i++){try{started=(await readFile(file)).length>0;}catch{}if(started)break;await pause(10);}assert.equal(started,true);
  await stopTestProcess(child,{graceMs:100});const before=await readFile(file,'utf8');await pause(100);assert.equal(await readFile(file,'utf8'),before);
  assert.equal(unrelated.exitCode,null);assert.equal(unrelated.signalCode,null);assert.doesNotThrow(()=>process.kill(unrelated.pid,0));
  expired=spawnTestProcess(process.execPath,['-e','process.exit(0)'],{stdio:'ignore'});await once(expired,'close');await stopTestProcess(expired);
  await stopTestProcess(child);assert.throws(()=>stopTestProcess({pid:process.pid}),/Fremder/);
 }finally{await stopTestProcess(expired);await stopTestProcess(child);await stopTestProcess(unrelated);await rm(root,{recursive:true,force:true});}
});
