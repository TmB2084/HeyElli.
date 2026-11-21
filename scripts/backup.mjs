import nextEnv from '@next/env';
import {Pool} from 'pg';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {databaseConfig} from '../src/platform/store/config.ts';
import {snapshotApplication} from './backup-snapshot.mjs';
import {command,encryptArchive,fileDigest} from './backup-core.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==2)throw Error('Aufruf: npm run backup');
nextEnv.loadEnvConfig(root,true,{info(){},error(){}});
if(process.env.APP_ENV&&process.env.APP_ENV!=='development'||process.env.NODE_ENV==='production')throw Error('Dieser Sicherungsweg ist ausschließlich lokal freigegeben');
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),archive=join(root,'.local/backups',id+'.hebackup'),key=join(root,'.local/backup-unlock',id+'.key'),work=await mkdtemp(join(tmpdir(),'heyelli-backup-'));await chmod(work,0o700);
const pool=new Pool({...databaseConfig(process.env),options:'-c default_transaction_read_only=on -c statement_timeout=60000'});pool.on('error',()=>{});const started=Date.now();
try{
 const git=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,maxBuffer:32*1024*1024});if(git.status!==0)throw Error('Quellinventar nicht verfügbar');const paths=[...new Set(git.stdout.toString().split('\0').filter(Boolean))];
 const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();let manifest;
 for(let attempt=1;attempt<=3;attempt++){const directory=join(work,'payload');await mkdir(directory,{mode:0o700});const client=await pool.connect();try{manifest=await snapshotApplication({root,directory,client,freshClient:()=>pool.connect(),paths,revision,dump:(snapshot,output)=>command('docker',['compose','exec','-T','db','sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl --snapshot "$1"','sh',snapshot],{cwd:root,output})});break;}catch(error){await rm(directory,{recursive:true,force:true});if(attempt===3)throw error;}finally{client.release();}}
 const tar=join(work,'payload.tar.gz');await command('tar',['-czf',tar,'-C',join(work,'payload'),'.']);await encryptArchive(tar,archive,key);
 const report={status:'passed',archive,keyPath:key,sha256:await fileDigest(archive),createdAt:manifest.createdAt,snapshotAt:manifest.snapshotAt,seconds:Math.round((Date.now()-started)/1000),tables:manifest.postgres.tables.length,rows:manifest.postgres.tables.reduce((n,t)=>n+t.rows,0),sqliteFiles:manifest.files.filter(f=>f.sqlite).length,stateFiles:manifest.files.length,sourceFiles:manifest.source.length,sourceStable:true,sourceReadOnly:true};
 await mkdir(join(root,'.local/verification'),{recursive:true});await writeFile(join(root,'.local/verification/backup-latest.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
}catch{console.error('Sicherung fehlgeschlagen. Keine Quelldaten oder Zugangsdaten geändert; geschützten Sicherungsbestand prüfen und erneut versuchen.');process.exitCode=1;}
finally{await pool.end();await rm(work,{recursive:true,force:true});}
