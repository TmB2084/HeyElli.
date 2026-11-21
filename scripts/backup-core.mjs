import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream} from 'node:fs';
import {access,mkdir,readFile,writeFile,appendFile,readdir,lstat,chmod,rm,open} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {DatabaseSync,backup} from 'node:sqlite';
const magic=Buffer.from('HEYELLI-BACKUP-1\n');
export const digest=data=>createHash('sha256').update(data).digest('hex');
export async function fileDigest(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
export async function command(binary,args,{cwd,env=process.env,input,output}={}){
 const child=spawn(binary,args,{cwd,env,stdio:['pipe',output?'pipe':'ignore','ignore']});
 const completed=new Promise((accept,reject)=>{child.once('error',()=>reject(Error('Prüfkommando nicht verfügbar: '+binary)));child.once('exit',code=>code===0?accept():reject(Error('Prüfkommando fehlgeschlagen: '+binary)));});
 const transfer=output?pipeline(child.stdout,createWriteStream(output,{flags:'wx',mode:0o600})):Promise.resolve();
 child.stdin.on('error',()=>{});if(input)createReadStream(input).pipe(child.stdin);else child.stdin.end();
 try{await Promise.all([completed,transfer]);}catch(error){child.kill('SIGTERM');throw error;}
}
export function safeRelative(path){if(!path||path.includes('\\')||/[\x00-\x1f\x7f]/.test(path)||path.startsWith('/')||path.split('/').some(p=>p==='..'||p===''))throw Error('Unsicherer Sicherungspfad');return path;}
export async function filesUnder(root,prefix='',exclude=()=>false){
 const found=[];async function walk(path){if(exclude(path))return;safeRelative(path);const info=await lstat(join(root,path));if(info.isSymbolicLink()||(!info.isDirectory()&&(!info.isFile()||info.nlink!==1)))throw Error('Unsicherer Dateityp in Sicherung');if(info.isDirectory()){for(const name of (await readdir(join(root,path))).sort())await walk(path+'/'+name);}else found.push(path);}
 if(prefix)await walk(prefix);else for(const name of (await readdir(root)).sort())await walk(name);return found;
}
export function stateExcluded(path){return /^\.local\/(verification|backups|backup-unlock)(\/|$)/.test(path)||/\.(sqlite|sqlite3|db)-(wal|shm|journal)$/.test(path);}
export async function stateInventory(root){const paths=(await readdir(root)).filter(n=>/^\.env(?:$|\.)/.test(n)&&n!=='.env.example');let local=true;try{await access(join(root,'.local'));}catch(e){if(e.code!=='ENOENT')throw e;local=false;}if(local)paths.push(...await filesUnder(root,'.local',stateExcluded));
 const files=[];for(const path of paths.sort()){safeRelative(path);const info=await lstat(join(root,path));if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)throw Error('Unsichere Konfigurationsdatei');files.push({path,size:info.size,fingerprint:[info.dev,info.ino,info.mtimeMs,info.ctimeMs].join(':'),identity:[info.dev,info.ino].join(':'),sqlite:/\.(sqlite|sqlite3|db)$/.test(path)});}return files;}
const q=name=>'"'+name.replaceAll('"','""')+'"';
export async function postgresManifest(client,{sourceStability=false}={}){
 await client.query("SET TIME ZONE 'UTC'");
 const tables=(await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname !~ '^pg_' AND schemaname<>'information_schema' ORDER BY 1,2")).rows,records=[];
 for(const t of tables){const name=t.schemaname+'.'+t.tablename,result=await client.query(`SELECT row_to_json(t)::text AS value FROM ${q(t.schemaname)}.${q(t.tablename)} t ORDER BY row_to_json(t)::text`);const hash=createHash('sha256');for(const row of result.rows)hash.update(row.value+'\n');const stability=sourceStability&&name==='platform.operation_alarms'?digest(result.rows.map(row=>{const value=JSON.parse(row.value);delete value.last_seen;delete value.occurrences;return JSON.stringify(value);}).sort().join('\n')):undefined;records.push({table:name,rows:result.rowCount,sha256:hash.digest('hex'),...(stability?{sourceStabilitySha256:stability}:{})});}
 const sequences=[];for(const s of (await client.query("SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname !~ '^pg_' ORDER BY 1,2")).rows){const row=(await client.query(`SELECT last_value::text,is_called FROM ${q(s.schemaname)}.${q(s.sequencename)}`)).rows[0];sequences.push({name:s.schemaname+'.'+s.sequencename,...row});}
 const schema=(await client.query("SELECT n.nspname,c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relkind IN ('r','p','v','m') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,a.attnum")).rows;
 return {tables:records,sequences,schemaSha256:digest(JSON.stringify(schema))};
}
export function integrityPostgres(manifest){return {...manifest,tables:manifest.tables.map(table=>{const full={...table};delete full.sourceStabilitySha256;return full;})};}
// Exclusions apply only to live-source stability, never to dump/restore integrity.
export const volatileBackupTables=['platform.mail_worker_health','platform.operation_monitor','platform.operation_metrics','platform.resource_leases','platform.resource_windows'];
export function stablePostgres(manifest){return {...manifest,tables:manifest.tables.filter(t=>!volatileBackupTables.includes(t.table)).map(t=>t.table==='platform.operation_alarms'&&t.sourceStabilitySha256?{...t,sha256:t.sourceStabilitySha256}:t)};}
export function sqliteManifest(path){const db=new DatabaseSync(path,{readOnly:true});try{const tables=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all(),records=[];for(const t of tables){const rows=db.prepare('SELECT * FROM '+q(t.name)).all().map(row=>JSON.stringify(row,(_,value)=>value instanceof Uint8Array?{bytes:value.length,sha256:digest(value)}:typeof value==='bigint'?value.toString():value)).sort();records.push({table:t.name,rows:rows.length,sha256:digest(JSON.stringify(rows)),schema:t.sql});}return {integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,tables:records};}finally{db.close();}}
export async function snapshotState(root,target,inventory){
 const manifest=[];for(const item of inventory){const source=join(root,item.path),destination=join(target,item.path);await mkdir(dirname(destination),{recursive:true,mode:0o700});
  if(item.sqlite){const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,destination);}finally{db.close();}await chmod(destination,0o600);const logical=sqliteManifest(destination);if(logical.integrity!=='ok')throw Error('SQLite-Integritätsprüfung fehlgeschlagen');manifest.push({...item,logical,sha256:await fileDigest(destination)});}
  else{await writeFile(destination,await readFile(source),{flag:'wx',mode:0o600});manifest.push({...item,sha256:await fileDigest(destination)});}
 }return manifest;
}
export async function checkState(root,manifest,{logical=false}={}){for(const item of manifest){if(item.sqlite&&logical){if(JSON.stringify(sqliteManifest(join(root,item.path)))!==JSON.stringify(item.logical))return false;}else if(await fileDigest(join(root,item.path))!==item.sha256)return false;}return true;}
export async function encryptArchive(tar,archive,keyPath){
 if(resolve(archive)===resolve(keyPath))throw Error('Sicherung und Entsperrschlüssel müssen getrennt sein');
 await mkdir(dirname(keyPath),{recursive:true,mode:0o700});await mkdir(dirname(archive),{recursive:true,mode:0o700});const key=randomBytes(32),iv=randomBytes(12);let archiveOwned=false,keyOwned=false;
 try{await writeFile(archive,Buffer.concat([magic,iv]),{flag:'wx',mode:0o600});archiveOwned=true;await writeFile(keyPath,key,{flag:'wx',mode:0o600});keyOwned=true;const unlock=await open(keyPath,'r+');try{await unlock.sync();}finally{await unlock.close();}const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);await pipeline(createReadStream(tar),cipher,createWriteStream(archive,{flags:'a',mode:0o600}));await appendFile(archive,cipher.getAuthTag());const file=await open(archive,'r+');try{await file.sync();}finally{await file.close();}}
 catch(error){if(archiveOwned)await rm(archive,{force:true});if(keyOwned)await rm(keyPath,{force:true});throw error;}
}
export async function decryptArchive(archive,keyPath,tar){
 const info=await lstat(keyPath);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||(info.mode&0o077))throw Error('Entsperrschlüssel nicht sicher lesbar');
 const archiveInfo=await lstat(archive);if(!archiveInfo.isFile()||archiveInfo.isSymbolicLink()||archiveInfo.nlink!==1)throw Error('Unsichere Sicherungsdatei');const key=await readFile(keyPath),size=archiveInfo.size;if(key.length!==32||size<magic.length+28)throw Error('Sicherung ungültig');const fd=await open(archive,'r');let header,tag;try{header=Buffer.alloc(magic.length+12);await fd.read(header,0,header.length,0);tag=Buffer.alloc(16);await fd.read(tag,0,16,size-16);}finally{await fd.close();}if(!header.subarray(0,magic.length).equals(magic))throw Error('Sicherungsformat unbekannt');
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(magic.length));decipher.setAAD(magic);decipher.setAuthTag(tag);
 let owned=false;try{await writeFile(tar,'',{flag:'wx',mode:0o600});owned=true;await pipeline(createReadStream(archive,{start:header.length,end:size-17}),decipher,createWriteStream(tar,{flags:'w',mode:0o600}));}catch{if(owned)await rm(tar,{force:true});throw Error('Sicherung nicht authentisch, Ziel bereits vorhanden oder Entsperrschlüssel falsch');}
}
