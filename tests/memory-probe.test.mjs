import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,lstat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {installMemoryProbe} from './resource-load.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('memory sampler measures real children without recreating deleted files, including late inherited helpers',async()=>{
 const root=await mkdtemp(join(tmpdir(),'heyelli-memory-lifecycle-')),probe=await installMemoryProbe(root);let child;
 try{
  const env={...process.env,NODE_OPTIONS:probe.option};child=spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{env,stdio:'ignore'});
  let rows=[];for(let n=0;n<200;n++){rows=(await readFile(probe.memoryFile,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));if(rows.length)break;await pause(10);}
  assert.ok(rows.some(row=>row.pid===child.pid&&row.rss>0));await rm(probe.memoryFile);await pause(150);await assert.rejects(lstat(probe.memoryFile),{code:'ENOENT'});
  const late=spawn(process.execPath,['-e','setTimeout(()=>{},150)'],{env,stdio:'ignore'});const [code]=await once(late,'exit');assert.equal(code,0);await assert.rejects(lstat(probe.memoryFile),{code:'ENOENT'});
 }finally{if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}await rm(root,{recursive:true,force:true});}
});
