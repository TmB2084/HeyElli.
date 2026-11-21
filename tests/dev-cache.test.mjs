import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,symlink,readdir,link} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {prepareDevelopmentCache} from '../scripts/dev-cache.mjs';
async function folder(){const root=await mkdtemp(join(tmpdir(),'heyelli-dev-cache-'));await mkdir(join(root,'.next/dev'),{recursive:true});return root;}
async function holder(mode,path){const child=spawn(process.execPath,[resolve('tests/fixtures/dev-lock-holder.mjs'),mode,path],{stdio:['ignore','pipe','pipe']});try{await new Promise((resolveReady,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Test lock did not become ready')),10000);child.stdout.on('data',data=>{output+=data;if(output.includes('ready')){clearTimeout(timer);resolveReady();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Test lock process exited early'));});child.once('error',error=>{clearTimeout(timer);reject(error);});});return child;}catch(error){await stop(child,'SIGKILL');throw error;}}
async function stop(child,signal='SIGTERM'){if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill(signal);await exited;}}
test('cold start preserves persistent data and build; repeated starts release their lease',async()=>{
 const root=await folder();let lease;try{await mkdir(join(root,'.local'));for(const [name,value]of [['.next/dev/stale','cache'],['.next/BUILD_ID','build'],['.local/state','persistent'],['.env.local','fictitious']])await writeFile(join(root,name),value);lease=await prepareDevelopmentCache(root);assert.deepEqual(await readdir(join(root,'.next/dev')),[]);for(const [name,value]of [['.next/BUILD_ID','build'],['.local/state','persistent'],['.env.local','fictitious']])assert.equal(await readFile(join(root,name),'utf8'),value);lease.release();lease=await prepareDevelopmentCache(root);}finally{lease?.release();await rm(root,{recursive:true,force:true});}
});
test('an actual Next native lock blocks cleanup even without a listening server',async()=>{
 const root=await folder();let child;try{await writeFile(join(root,'.next/dev/state'),'keep');child=await holder('next',join(root,'.next/dev/lock'));const bytes=await readFile(join(root,'.next/dev/lock'));await assert.rejects(prepareDevelopmentCache(root),/bestehenden Server beenden/);assert.equal(await readFile(join(root,'.next/dev/state'),'utf8'),'keep');assert.deepEqual(await readFile(join(root,'.next/dev/lock')),bytes);assert.equal(child.exitCode,null);}finally{await stop(child);await rm(root,{recursive:true,force:true});}
});
test('SIGKILL-orphaned Next locks recover immediately without file age or PID heuristics',async()=>{
 const root=await folder();let child,lease;try{child=await holder('next',join(root,'.next/dev/lock'));await stop(child,'SIGKILL');await lstat(join(root,'.next/dev/lock'));await writeFile(join(root,'.next/dev/state'),'old');lease=await prepareDevelopmentCache(root);assert.deepEqual(await readdir(join(root,'.next/dev')),[]);}finally{lease?.release();await stop(child);await rm(root,{recursive:true,force:true});}
});
test('malformed lock metadata and a reused live PID cannot override native ownership',async()=>{
 const root=await folder();let lease;try{for(const text of ['{broken',JSON.stringify({pid:process.pid,appUrl:'http://127.0.0.1:1'})]){await writeFile(join(root,'.next/dev/lock'),text);lease=await prepareDevelopmentCache(root);lease.release();lease=null;}assert.ok(process.pid>0);}finally{lease?.release();await rm(root,{recursive:true,force:true});}
});
test('the outer lease prevents concurrent cleanup before Next starts',async()=>{
 const root=await folder();let child;try{child=await holder('starter',root);await writeFile(join(root,'.next/dev/starting'),'keep');await assert.rejects(prepareDevelopmentCache(root),/HeyElli-Start/);assert.equal(await readFile(join(root,'.next/dev/starting'),'utf8'),'keep');assert.equal(child.exitCode,null);}finally{await stop(child);await rm(root,{recursive:true,force:true});}
});
test('an orphaned outer lease after SIGKILL is recoverable as well',async()=>{
 const root=await folder();let child,lease;try{child=await holder('starter',root);await stop(child,'SIGKILL');await lstat(join(root,'.next/heyelli-dev-start.lock'));lease=await prepareDevelopmentCache(root);}finally{lease?.release();await stop(child);await rm(root,{recursive:true,force:true});}
});
test('symbolic and multiply linked lock/cache paths fail closed and preserve external data',async()=>{
 const root=await folder();try{await mkdir(join(root,'external'));await writeFile(join(root,'external/state'),'keep');await rm(join(root,'.next/dev'),{recursive:true});await symlink(join(root,'external'),join(root,'.next/dev'));await assert.rejects(prepareDevelopmentCache(root),/reguläres Verzeichnis/);await rm(join(root,'.next/dev'));await mkdir(join(root,'.next/dev'));await symlink(join(root,'external/state'),join(root,'.next/dev/lock'));await assert.rejects(prepareDevelopmentCache(root),/sichere reguläre Datei/);await rm(join(root,'.next/dev/lock'));await link(join(root,'external/state'),join(root,'.next/dev/lock'));await assert.rejects(prepareDevelopmentCache(root),/sichere reguläre Datei/);await rm(join(root,'.next/dev/lock'));await writeFile(join(root,'.next/dev/keep'),'cache');await symlink(join(root,'external'),join(root,'.next/dev/nested-link'));await assert.rejects(prepareDevelopmentCache(root),/symbolische Links/);assert.equal(await readFile(join(root,'.next/dev/keep'),'utf8'),'cache');assert.equal(await readFile(join(root,'external/state'),'utf8'),'keep');}finally{await rm(root,{recursive:true,force:true});}
});
test('simultaneous launchers have exactly one cleanup owner',async()=>{
 const root=await folder();let result;try{await mkdir(join(root,'.local'));await writeFile(join(root,'.local/state'),'keep');result=await Promise.allSettled([prepareDevelopmentCache(root),prepareDevelopmentCache(root)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);assert.equal(await readFile(join(root,'.local/state'),'utf8'),'keep');}finally{for(const r of result??[])if(r.status==='fulfilled')r.value.release();await rm(root,{recursive:true,force:true});}
});
