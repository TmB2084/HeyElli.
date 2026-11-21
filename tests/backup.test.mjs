import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,symlink,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {encryptArchive,decryptArchive,safeRelative,stateInventory,snapshotState,checkState,sqliteManifest,command} from '../scripts/backup-core.mjs';
async function isolated(work){const root=await mkdtemp(join(tmpdir(),'heyelli-backup-unit-'));try{await work(root);}finally{await rm(root,{recursive:true,force:true});}}
test('encrypted backup roundtrip, separate protected key and authenticated tamper rejection',()=>isolated(async root=>{
 const input=join(root,'input'),archive=join(root,'archive'),key=join(root,'key'),output=join(root,'output');const plain=Buffer.from('Fictional sensitive state '+randomBytes(64).toString('hex'));await writeFile(input,plain);await encryptArchive(input,archive,key);assert.equal((await lstat(archive)).mode&0o777,0o600);assert.equal((await lstat(key)).mode&0o777,0o600);assert.ok(!(await readFile(archive)).includes(plain));await decryptArchive(archive,key,output);assert.deepEqual(await readFile(output),plain);
 const changed=await readFile(archive);changed[changed.length-20]^=1;await writeFile(archive,changed);const rejected=join(root,'rejected');await assert.rejects(decryptArchive(archive,key,rejected));await assert.rejects(lstat(rejected));
}));
test('existing archives, keys and restore targets are never overwritten or removed',()=>isolated(async root=>{
 const input=join(root,'input'),archive=join(root,'archive'),key=join(root,'key');await writeFile(input,'Fictional');await writeFile(archive,'keep archive');await assert.rejects(encryptArchive(input,archive,key));assert.equal(await readFile(archive,'utf8'),'keep archive');await rm(archive);await writeFile(key,'keep key');await assert.rejects(encryptArchive(input,archive,key));assert.equal(await readFile(key,'utf8'),'keep key');await assert.rejects(lstat(archive));await rm(key);await encryptArchive(input,archive,key);const target=join(root,'target');await writeFile(target,'keep target');await assert.rejects(decryptArchive(archive,key,target));assert.equal(await readFile(target,'utf8'),'keep target');
}));
test('wrong or symlinked unlock keys fail before extraction',()=>isolated(async root=>{
 const input=join(root,'input'),archive=join(root,'archive'),key=join(root,'key');await writeFile(input,'Fictional');await encryptArchive(input,archive,key);const wrong=join(root,'wrong');await writeFile(wrong,randomBytes(32),{mode:0o600});await assert.rejects(decryptArchive(archive,wrong,join(root,'rejected')));const link=join(root,'link');await symlink(key,link);await assert.rejects(decryptArchive(archive,link,join(root,'rejected')));
}));
test('SQLite online copy includes committed WAL rows without changing source data',()=>isolated(async root=>{
 await mkdir(join(root,'.local'));const path=join(root,'.local/demo.sqlite'),db=new DatabaseSync(path);try{db.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER PRIMARY KEY,content BLOB);');db.prepare('INSERT INTO sample(content) VALUES(?)').run(Buffer.from('fictional retained attachment'));const before=sqliteManifest(path),target=join(root,'copy');await mkdir(target);const files=await snapshotState(root,target,await stateInventory(root));assert.deepEqual(sqliteManifest(join(target,'.local/demo.sqlite')),before);assert.equal(await checkState(root,files,{logical:true}),true);db.prepare('INSERT INTO sample(content) VALUES(?)').run(Buffer.from('new input'));assert.equal(await checkState(root,files,{logical:true}),false);assert.ok(!files.some(f=>/-wal$|-shm$/.test(f.path)));}finally{db.close();}
}));
test('backup inventory excludes recursion and generated reports, but retains env and master keys',()=>isolated(async root=>{
 for(const name of ['backups','backup-unlock','verification','copilot-secrets']){await mkdir(join(root,'.local',name),{recursive:true});await writeFile(join(root,'.local',name,'file'),'fictional');}await writeFile(join(root,'.env.local'),'FICTITIOUS=1');const paths=(await stateInventory(root)).map(f=>f.path);assert.deepEqual(paths,['.env.local','.local/copilot-secrets/file']);await symlink(join(root,'.env.local'),join(root,'.local/unsafe'));await assert.rejects(stateInventory(root));for(const path of ['../outside','/absolute','safe/../outside','safe\\outside','safe\nname'])assert.throws(()=>safeRelative(path));
}));
test('extractor rejects traversal and links before writing payload files',()=>isolated(async root=>{
 for(const kind of ['traversal','link']){const archive=join(root,kind+'.tar.gz'),target=join(root,kind);await command('python3',['-c',"import sys,tarfile,io; t=tarfile.open(sys.argv[1],'w:gz'); m=tarfile.TarInfo('../outside' if sys.argv[2]=='traversal' else 'link'); m.type=tarfile.REGTYPE if sys.argv[2]=='traversal' else tarfile.SYMTYPE; m.linkname='/outside'; m.size=1 if sys.argv[2]=='traversal' else 0; t.addfile(m,io.BytesIO(b'x') if m.size else None); t.close()",archive,kind]);await assert.rejects(command('python3',['scripts/backup-extract.py',archive,target]));await assert.rejects(lstat(join(root,'outside')));}
}));
test('source-only telemetry exclusions preserve full integrity and alarm acknowledgements',async()=>{
 const {stablePostgres,integrityPostgres}=await import('../scripts/backup-core.mjs');
 const base={tables:[{table:'platform.operation_monitor',rows:1,sha256:'heartbeat-a'},{table:'platform.operation_alarms',rows:1,sha256:'full-a',sourceStabilitySha256:'durable-a'},{table:'platform.audit_events',rows:1,sha256:'business-a'}]};
 const next=structuredClone(base);next.tables[0].sha256='heartbeat-b';next.tables[1].sha256='full-b';assert.deepEqual(stablePostgres(base),stablePostgres(next));assert.notDeepEqual(integrityPostgres(base),integrityPostgres(next));
 next.tables[1].sourceStabilitySha256='acknowledged';assert.notDeepEqual(stablePostgres(base),stablePostgres(next));
 const legacy=integrityPostgres(base);assert.ok(!('sourceStabilitySha256' in legacy.tables[1]));assert.equal(legacy.tables[1].sha256,'full-a');
});
