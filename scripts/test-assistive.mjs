// Real independent screen reader in a disposable Linux desktop. No host UI access.
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,chmod,rm,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {verificationEnvironment} from './verification-plan.mjs';
if(process.platform!=='darwin')throw Error('Dieser Assistive-Pruefweg ist fuer Docker Desktop auf macOS nachgewiesen.');
const root=process.cwd(),artifacts=resolve('.local/verification/assistive');await mkdir(artifacts,{recursive:true});await rm(join(artifacts,'results.json'),{force:true});
const directory=await mkdtemp(join(root,'.local/verification/orca-temp-')),output=join(directory,'output'),name='heyelli-a09-orca-'+randomBytes(6).toString('hex');
const env=verificationEnvironment(process.env,directory);let fixtureProcess,fixtureClosed=false,containerRemoved=false,fixtureResourcesRemoved=false;
function docker(args,quiet=false){return spawnSync('docker',args,{env,stdio:quiet?'ignore':'inherit',timeout:240000});}
try{
 if(docker(['build','-f','tests/assistive/Dockerfile','-t','heyelli-a09-orca:local','tests/assistive']).status!==0)throw Error('Assistive-Pruefabbild konnte nicht gebaut werden.');
 fixtureProcess=spawn(process.execPath,['scripts/test-browser.mjs','--manual'],{cwd:root,env:{...env,HEYELLI_BROWSER_ARTIFACTS:join(artifacts,'fixture')},stdio:['pipe','pipe','pipe']});fixtureProcess.stdin.on('error',()=>{});fixtureProcess.stderr.resume();
 const lines=createInterface({input:fixtureProcess.stdout});const metadata=await new Promise((resolveReady,reject)=>{const timeout=setTimeout(()=>reject(Error('Assistiver Pruefserver nicht bereit.')),90000);fixtureProcess.once('exit',()=>{clearTimeout(timeout);reject(Error('Assistiver Pruefserver beendet.'));});lines.on('line',line=>{if(!line.startsWith('{'))return;try{const value=JSON.parse(line);if(value.ready&&value.metadata){clearTimeout(timeout);resolveReady(value.metadata);}}catch{}});});
 const control=JSON.parse(await readFile(metadata,'utf8'));if(!/^heyelli-test-[a-f0-9]{12}$/.test(control.project)||!control.base.startsWith('http://127.0.0.1:'))throw Error('Unbekannte Pruefumgebung.');
 const fixture=JSON.parse(await readFile(control.fixture,'utf8'));await mkdir(output,{mode:0o777});await chmod(output,0o777);await writeFile(join(directory,'fixture.json'),JSON.stringify({base:fixture.base.replace('127.0.0.1','host.docker.internal'),password:fixture.password}),{mode:0o444});
 const run=docker(['run','--rm','--init','--name',name,'--cap-drop=ALL','--pids-limit=256','--memory=2g','--cpus=2','--shm-size=256m','--mount',`type=bind,src=${resolve('tests/assistive')},dst=/work,readonly`,'--mount',`type=bind,src=${resolve('node_modules')},dst=/node_modules,readonly`,'--mount',`type=bind,src=${join(directory,'fixture.json')},dst=/fixture.json,readonly`,'--mount',`type=bind,src=${output},dst=/output`,'heyelli-a09-orca:local']);
 try{await cp(join(output,'results.json'),join(artifacts,'results.json'));}catch{}
 if(run.status!==0)throw Error('Assistive-Pruefung fehlgeschlagen.');
 const result=JSON.parse(await readFile(join(artifacts,'results.json'),'utf8'));if(result.status!=='passed'||result.checks.length!==6||result.checks.some(check=>!check.passed))throw Error('Assistive-Abnahme nicht vollstaendig nachgewiesen.');
 console.log('Sechs echte Orca-Prueffaelle bestanden.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 docker(['stop','-t','2',name],true);const inventory=spawnSync('docker',['ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}'],{env,encoding:'utf8',stdio:'pipe'});containerRemoved=inventory.status===0&&!inventory.stdout.trim();
 if(fixtureProcess&&fixtureProcess.exitCode===null){const exit=once(fixtureProcess,'exit');fixtureProcess.stdin.end('stop\n');let timer;await Promise.race([exit,new Promise(resolveWait=>{timer=setTimeout(()=>{fixtureProcess.kill('SIGTERM');resolveWait();},20000);})]);clearTimeout(timer);if(fixtureProcess.exitCode===null)await Promise.race([once(fixtureProcess,'exit'),new Promise(resolveWait=>setTimeout(resolveWait,10000))]);}
 fixtureClosed=!fixtureProcess||fixtureProcess.exitCode===0;fixtureResourcesRemoved=!fixtureProcess;try{fixtureResourcesRemoved=JSON.parse(await readFile(join(artifacts,'fixture/cleanup.json'),'utf8')).status==='passed';}catch{}
 await rm(directory,{recursive:true,force:true});await writeFile(join(artifacts,'cleanup.json'),JSON.stringify({status:fixtureClosed&&containerRemoved&&fixtureResourcesRemoved?'passed':'failed',ownContainerRemoved:containerRemoved,ownFixtureClosed:fixtureClosed,ownFixtureResourcesRemoved:fixtureResourcesRemoved,ownCredentialsRemoved:true},null,2)+'\n');if(!fixtureClosed||!containerRemoved||!fixtureResourcesRemoved)process.exitCode=1;
}
