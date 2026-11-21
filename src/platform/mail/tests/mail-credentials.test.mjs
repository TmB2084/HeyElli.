import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveMicrosoft365Configuration,microsoft365Environment} from '../configuration.ts';
test('encrypted credentials roundtrip and tamper fails closed',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mail-crypto-')),previous=[process.env.APP_ENV,process.env.HEYELLI_TEST_SETTINGS_DIR];process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=directory;
 try{const input={tenantId:randomUUID(),clientId:randomUUID(),secret:randomUUID()};const id=saveMicrosoft365Configuration(input);const env=microsoft365Environment(id);assert.equal(env.M365_TENANT_ID,input.tenantId);assert.equal(env.M365_CLIENT_ID,input.clientId);assert.equal(env.M365_CLIENT_SECRET,input.secret);const file=join(directory,'.env.graph.'+id+'.local');assert.ok(!(await readFile(file,'utf8')).includes(input.secret));await writeFile(file,'M365_ENCRYPTED_CONFIG="broken"');assert.equal(microsoft365Environment(id).M365_CLIENT_SECRET,undefined);}finally{for(const [i,key] of ['APP_ENV','HEYELLI_TEST_SETTINGS_DIR'].entries()){if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];}await rm(directory,{recursive:true,force:true});}
});
