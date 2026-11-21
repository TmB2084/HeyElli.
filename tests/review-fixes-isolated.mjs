import {checkResourceBudgets} from './resource-budgets-postgres.mjs';
import {publishSample} from '../src/platform/operations/repository.ts';
import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {checkServiceHistory} from './service-history-postgres.mjs';
import {checkBackupMonitor} from './backup-monitor-postgres.mjs';
import {checkBackupRestore} from './backup-postgres.mjs';
const pool=new Pool({connectionString:process.env.HEYELLI_TEST_DATABASE_URL});
try{
 for(const file of (await readdir('database/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pool.query(await readFile('database/migrations/'+file,'utf8'));
 for(let pass=0;pass<2;pass++)for(const file of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+file,'utf8'));
 await checkServiceHistory(pool);console.log('PASS history: failure, restart, lost acknowledgement, parallel retry, planning, rollback');
 await checkResourceBudgets(pool);console.log('PASS browser budget reset: deadlock reproduced, shared-lock reset serialized');
 await checkBackupMonitor(pool);console.log('PASS backup stability: repeated monitoring, alarm acknowledgement, business change');
 await checkBackupRestore(pool,async()=>{for(let i=0;i<3;i++)await publishSample(pool,{database:true,web:false,workerAge:0,workerHealthy:true,queueAge:0,unknown:0,failed:0,uncertain:0,requests:0,failures:0,slow:0,meanMs:0,freeBytes:1e10,freeRatio:.8,secrets:true},()=>{});});console.log('PASS encrypted full backup during monitoring and isolated restoration');
}finally{await pool.end();}
