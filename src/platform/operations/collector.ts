import type {Pool} from 'pg';
import {statfs} from 'node:fs/promises';
import {probeWeb,type WebProbeHost} from './web-probe.ts';
export {probeWeb} from './web-probe.ts';
import {resolve} from 'node:path';
import {secretRoot} from '../secret-retention/lifecycle.ts';
import {encryptedStore} from '../secret-retention/encrypted-store.ts';
import {readPdsConfiguration} from '../pds/connection/configuration.ts';
import {readConfig as readCopilot} from '../../apps/askelli/copilot/configuration.ts';
import {readConfig as readSharePoint} from '../sharepoint/configuration.ts';
import {readConfig as readBma} from '../bmacloud/configuration.ts';
import type {Sample} from './model.ts';
export async function collectSample(pool:Pool,port:number,host:WebProbeHost='localhost'):Promise<Sample>{
 const web=await probeWeb(port,host);
 const client=await pool.connect();
 try{await client.query('BEGIN READ ONLY');await client.query('SELECT 1');
  const worker=(await client.query("SELECT extract(epoch FROM now()-last_seen)::float8 age,healthy FROM platform.mail_worker_health WHERE id='central'")).rows[0];
  const queue=(await client.query("SELECT coalesce(max(extract(epoch FROM now()-created_at)) FILTER(WHERE status IN ('queued','retry','sending')),0)::float8 age,count(*) FILTER(WHERE status='unknown')::int unknown,count(*) FILTER(WHERE status='failed')::int failed FROM platform.mail_queue")).rows[0];
  const uncertain=(await client.query("SELECT count(*)::int n FROM platform.assistant_actions WHERE state='uncertain'")).rows[0].n;
  const metrics=(await client.query("SELECT coalesce(sum(requests),0)::float8 requests,coalesce(sum(failures),0)::float8 failures,coalesce(sum(slow),0)::float8 slow,coalesce(sum(duration_ms)/nullif(sum(requests),0),0)::float8 mean FROM platform.operation_metrics WHERE minute>=date_trunc('minute',now())-interval '4 minutes'")).rows[0];
  let secrets=true;
  const pds=(await client.query("SELECT config_id FROM platform.pds_connection WHERE id='central'")).rows[0];
  const graph=(await client.query("SELECT config_id FROM platform.mail_settings WHERE id='central'")).rows[0];
  const copilot=(await client.query("SELECT config_id FROM platform.copilot_settings WHERE id='central'")).rows[0];
  const bma=(await client.query("SELECT config_id FROM platform.bmacloud_settings WHERE id='central'")).rows[0];
  const sharepoint=(await client.query("SELECT config_id FROM platform.sharepoint_settings WHERE id='central'")).rows[0];
  try{if(sharepoint?.config_id)readSharePoint(sharepoint.config_id);readPdsConfiguration(pds?.config_id);encryptedStore('graph','.env.microsoft365.ui.local','mail-secrets','M365_ENCRYPTED_CONFIG').read(graph?.config_id);if(copilot?.config_id)readCopilot(copilot.config_id);if(bma?.config_id)readBma(bma.config_id);}catch{secrets=false;}
  await client.query('COMMIT');
  const disk=await statfs(/* turbopackIgnore: true */ resolve(secretRoot())).catch(()=>({bavail:0,bsize:0,blocks:0}));
  return {database:true,web,workerAge:worker?.age??null,workerHealthy:worker?.healthy??false,queueAge:Math.max(0,queue.age),unknown:queue.unknown,failed:queue.failed,uncertain,requests:metrics.requests,failures:metrics.failures,slow:metrics.slow,meanMs:metrics.mean,freeBytes:disk.bavail*disk.bsize,freeRatio:disk.blocks?disk.bavail/disk.blocks:0,secrets};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
