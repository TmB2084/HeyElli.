import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {snapshotApplication} from '../scripts/backup-snapshot.mjs';
import {publishSample} from '../src/platform/operations/repository.ts';
export async function checkBackupMonitor(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-[a-f0-9]+$/);
 const root=await mkdtemp(join(tmpdir(),'heyelli-backup-monitor-'));
 const sample={database:true,web:false,workerAge:0,workerHealthy:true,queueAge:0,unknown:0,failed:0,uncertain:0,requests:0,failures:0,slow:0,meanMs:0,freeBytes:1e10,freeRatio:.8,secrets:true};
 try{
  await writeFile(join(root,'fixture.txt'),'fictional stable source');await publishSample(pool,sample,()=>{});
  for(const kind of ['heartbeat','acknowledgement','business']){const directory=join(root,kind);await mkdir(directory);const client=await pool.connect();
   try{const run=()=>snapshotApplication({root,directory,client,freshClient:()=>pool.connect(),paths:['fixture.txt'],revision:'fictional',dump:async(_snapshot,path)=>{
    await writeFile(path,'fictional dump for source stability check');
    for(let i=0;i<3;i++)await publishSample(pool,sample,()=>{});
    await pool.query("INSERT INTO platform.operation_metrics VALUES(date_trunc('minute',now()),'review',1,0,0,1) ON CONFLICT(minute,area) DO UPDATE SET requests=platform.operation_metrics.requests+1");
    if(kind==='acknowledgement')await pool.query("UPDATE platform.operation_alarms SET acknowledged_by='fictional-review',acknowledged_at=now() WHERE code='web'");
    if(kind==='business')await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id) VALUES('fictional-review','review.business','fixture')");
   }});
   if(kind==='heartbeat')assert.ok((await run()).postgres.tables.some(t=>t.table==='platform.operation_monitor'));
   else await assert.rejects(run(),/während Sicherung geändert/);
   }finally{client.release();}
  }
 }finally{await rm(root,{recursive:true,force:true});}
}
