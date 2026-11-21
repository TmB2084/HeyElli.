// Clean source snapshot + fresh locked dependencies. Never copy local .env/.local/node_modules.
import {spawnSync} from 'node:child_process';
import {mkdtemp,cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verificationSteps,verificationTimeout,verificationEnvironment,inspectSnapshot} from './verification-plan.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);let commit,reportPath=join(root,'.local/verification/latest.json');
for(let i=0;i<args.length;i++){if(args[i]==='--commit'&&args[i+1])commit=args[++i];else if(args[i]==='--report'&&args[i+1])reportPath=resolve(args[++i]);else throw Error('Aufruf: npm run verify -- [--commit Git-Commit] [--report Datei.json]');}
const expected=(await readFile(join(root,'.node-version'),'utf8')).trim();if(process.version!==expected)throw Error('Erforderliche Node-Version: '+expected);
const directory=await mkdtemp(join(tmpdir(),'heyelli-verify-')),snapshot=join(directory,'source'),report={format:1,commit:null,sourceDigest:null,node:process.version,startedAt:new Date().toISOString(),finishedAt:null,status:'failed',steps:[]};
try{
 await mkdir(snapshot);
 if(commit){const revision=spawnSync('git',['rev-parse','--verify',commit+'^{commit}'],{cwd:root,encoding:'utf8'});if(revision.status!==0||!/^[a-f0-9]{40,64}$/.test(revision.stdout.trim()))throw Error('Git-Commit nicht verfügbar.');report.commit=revision.stdout.trim();const archive=spawnSync('git',['archive','--format=tar',report.commit],{cwd:root,maxBuffer:256*1024*1024});if(archive.status!==0)throw Error('Git-Prüfstand konnte nicht exportiert werden.');const unpack=spawnSync('tar',['-xf','-','-C',snapshot],{input:archive.stdout});if(unpack.status!==0)throw Error('Git-Prüfstand konnte nicht entpackt werden.');}
 else{const inventory=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,maxBuffer:32*1024*1024});if(inventory.status!==0)throw Error('Git-Dateiinventar nicht verfügbar.');for(const name of new Set(inventory.stdout.toString().split('\0').filter(Boolean))){try{await mkdir(dirname(join(snapshot,name)),{recursive:true});await cp(join(root,name),join(snapshot,name),{verbatimSymlinks:true});}catch(error){if(error.code!=='ENOENT')throw error;}}}
 const paths=await inspectSnapshot(snapshot),hash=createHash('sha256');for(const name of paths){const bytes=await readFile(join(snapshot,name));hash.update(name+'\0'+bytes.length+'\0');hash.update(bytes);}report.sourceDigest=hash.digest('hex');
 const env={...verificationEnvironment(process.env,directory),PLAYWRIGHT_BROWSERS_PATH:join(root,'.local/browser-engines'),HEYELLI_BROWSER_ARTIFACTS:join(root,'.local/verification/browser')};
 for(const [name,command]of verificationSteps){console.log('\nPrüfung: '+name);const started=Date.now(),result=spawnSync('npm',command,{cwd:snapshot,env,stdio:'inherit',timeout:verificationTimeout(name)});report.steps.push({name,status:result.status===0?'passed':'failed',seconds:Math.round((Date.now()-started)/1000)});if(result.error||result.status!==0)throw Error('Freigabeprüfung fehlgeschlagen: '+name);}
 report.status='passed';
}catch(error){console.error(error instanceof Error?error.message:'Freigabeprüfung fehlgeschlagen.');process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');await rm(directory,{recursive:true,force:true});console.log('Prüfnachweis: '+reportPath);}
