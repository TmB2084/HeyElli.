import {mkdir,readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {parseEnv} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {digest,fileDigest,stateInventory,snapshotState,checkState,postgresManifest,integrityPostgres,stablePostgres,volatileBackupTables,safeRelative} from './backup-core.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function sourceManifest(root,paths){const files=[];for(const path of [...paths].sort()){safeRelative(path);const info=await lstat(join(root,path));if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)throw Error('Quellstand enthält unsichere Dateien');files.push({path,sha256:await fileDigest(join(root,path)),mode:info.mode&0o100?0o700:0o600,fingerprint:[info.dev,info.ino,info.mtimeMs,info.ctimeMs].join(':')});}return files;}
export async function snapshotApplication({root,directory,client,freshClient,paths,dump,revision}){
 const application=join(directory,'application'),state=join(directory,'state');await mkdir(application,{recursive:true,mode:0o700});await mkdir(state,{mode:0o700});
 const inventory=await stateInventory(root),guards=[];
 try{
  for(const item of inventory.filter(i=>i.sqlite)){const db=new DatabaseSync(join(root,item.path),{readOnly:true});guards.push({db,version:db.prepare('PRAGMA data_version').get().data_version});}
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const point=(await client.query('SELECT pg_export_snapshot() AS snapshot,transaction_timestamp() AS captured_at')).rows[0],snapshot=point.snapshot;
  const before=await postgresManifest(client,{sourceStability:true}),source=await sourceManifest(root,paths),externals=[];
  for(const item of inventory.filter(i=>/^\.env/.test(i.path))){const env=parseEnv(await readFile(join(root,item.path),'utf8'));for(const key of ['DEMO_DIRECTORY_USERS_FILE'])if(env[key]){const path=resolve(root,env[key]);if(relative(root,path).startsWith('..')){const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)throw Error('Zusätzliche Konfiguration nicht sicher lesbar');if(!externals.some(e=>e.original===path))externals.push({original:path,path:'external/'+digest(path).slice(0,24),sha256:await fileDigest(path)});}}}
  const files=await snapshotState(root,state,inventory);
  // Compare logical SQLite snapshots too; unchanged main files alone cannot
  // prove stability when committed rows still reside in the WAL.
  if(!await checkState(root,files,{logical:true}))throw Error('Lokaler Bestand während Sicherung geändert; erneut versuchen');
  for(const item of source){const path=join(application,item.path);await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,await readFile(join(root,item.path)),{flag:'wx',mode:item.mode});if(await fileDigest(path)!==item.sha256)throw Error('Quellstand während Sicherung geändert');}
  for(const item of externals){await mkdir(join(directory,'external'),{recursive:true,mode:0o700});await writeFile(join(directory,item.path),await readFile(item.original),{flag:'wx',mode:0o600});if(await fileDigest(join(directory,item.path))!==item.sha256)throw Error('Zusätzliche Konfiguration geändert');}
  await dump(snapshot,join(directory,'postgres.dump'));
  const fresh=await freshClient();let after;try{await fresh.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');after=await postgresManifest(fresh,{sourceStability:true});await fresh.query('ROLLBACK');}finally{fresh.release();}
  const afterInventory=await stateInventory(root);
  const identity=list=>list.map(i=>({path:i.path,...(i.sqlite?{identity:i.identity}:{fingerprint:i.fingerprint,size:i.size})}));
  if(guards.some(g=>g.db.prepare('PRAGMA data_version').get().data_version!==g.version))throw Error('SQLite während Sicherung geändert');
  if(!same(stablePostgres(before),stablePostgres(after))||!same(identity(inventory),identity(afterInventory))||!await checkState(root,files,{logical:true})||!same(source,await sourceManifest(root,paths)))throw Error('Bestand während Sicherung geändert; keine konsistente Sicherung veröffentlicht');
  for(const item of externals)if(await fileDigest(item.original)!==item.sha256)throw Error('Zusätzliche Konfiguration geändert');
  const manifest={format:1,sourceRoot:root,snapshotAt:new Date(point.captured_at).toISOString(),createdAt:new Date().toISOString(),revision,postgres:integrityPostgres(before),sourceStabilityPostgres:stablePostgres(before),dumpSha256:await fileDigest(join(directory,'postgres.dump')),source,files,externals,volatileExclusion:{tables:volatileBackupTables,alarmFields:['last_seen','occurrences'],scope:'source stability only; full dump and restore comparison retained'}};
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});return manifest;
 }finally{try{await client.query('ROLLBACK');}finally{for(const guard of guards)guard.db.close();}}
}
export async function checkPayload(directory){const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));if(manifest.format!==1||!Array.isArray(manifest.source)||!Array.isArray(manifest.files)||!Array.isArray(manifest.externals))throw Error('Sicherungsinventar ungültig');
 for(const item of manifest.source){safeRelative(item.path);if(await fileDigest(join(directory,'application',item.path))!==item.sha256)throw Error('Quellprüfsumme stimmt nicht');}
 if(!await checkState(join(directory,'state'),manifest.files))throw Error('Dateiprüfsumme stimmt nicht');
 for(const item of manifest.externals){safeRelative(item.path);if(await fileDigest(join(directory,item.path))!==item.sha256)throw Error('Zusatzdatei-Prüfsumme stimmt nicht');}
 if(await fileDigest(join(directory,'postgres.dump'))!==manifest.dumpSha256)throw Error('Datenbankdump-Prüfsumme stimmt nicht');return manifest;
}
