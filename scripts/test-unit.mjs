import {spawnSync} from 'node:child_process';
import {unitTests} from './verification-plan.mjs';
if(process.env.HEYELLI_TEST_DATABASE_URL||process.env.DATABASE_URL)throw Error('Modultests dürfen keine Datenbankverbindung übernehmen. Bitte npm run verify verwenden.');
const tests=await unitTests(process.cwd());
const result=spawnSync(process.execPath,['--test','--test-concurrency=4',...tests],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
