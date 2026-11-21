import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateConfig,saveConfig,readConfig} from '../configuration.ts';
import {plants,plantLinks} from '../transport.ts';
import {resolveContractLinks} from '../mapping.ts';
const config={baseUrl:'https://bma.example.invalid/site/',token:'fictional-test-token-only'};
test('BMACloud configuration stays encrypted and validates install URLs',()=>{
 const oldEnv=process.env.APP_ENV,oldRoot=process.env.HEYELLI_TEST_SETTINGS_DIR,directory=mkdtempSync(join(tmpdir(),'bmacloud-test-'));process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=directory;
 try{const id=saveConfig(config);assert.deepEqual(readConfig(id),config);const raw=readFileSync(join(directory,`.env.bmacloud.${id}.local`),'utf8');assert.ok(!raw.includes(config.token));assert.ok(!raw.includes(config.baseUrl));assert.deepEqual(readConfig(id),config);
 for(const baseUrl of ['http://bma.example.invalid/','https://user:pass@bma.example.invalid/','https://bma.example.invalid/?token=x','https://bma.example.invalid/api/v2/','https://bma.example.invalid/portal.php','javascript:alert(1)'])assert.throws(()=>validateConfig({...config,baseUrl}));
 }finally{if(oldEnv===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=oldEnv;if(oldRoot===undefined)delete process.env.HEYELLI_TEST_SETTINGS_DIR;else process.env.HEYELLI_TEST_SETTINGS_DIR=oldRoot;rmSync(directory,{recursive:true});}
});
test('uses exact maintenance numbers, preserves leading zeroes and presents all matching AIDs',async()=>{
 const calls=[],transport=async(url,options)=>{calls.push(String(url));assert.equal(options.method,undefined);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${config.token}`);return Response.json([{aid:11,nr:'00120',anlagenort:'Nord'},{aid:12,nr:'00120',anlagenort:'Süd'},{aid:13,nr:'120'},{aid:11,nr:'00120',anlagenort:'Nord'}]);};
 const file={kind:'object',name:'TE',contracts:[{name:'A',maintenanceCostCarrier:{number:'00120'},billingCostCarrier:{number:'999'}},{name:'B',maintenanceCostCarrier:{number:'00120'}},{name:'Ohne'}]};
 await resolveContractLinks(file,config,transport);assert.equal(calls.length,1);assert.equal(new URL(calls[0]).searchParams.get('nr'),'00120');assert.deepEqual(file.contracts[0].bma.links.map(v=>v.aid),[11,12]);assert.equal(file.contracts[0].bma.links[0].url,'https://bma.example.invalid/site/portal.php?action=anlagen_add&aid=11');assert.deepEqual(file.contracts[1].bma,file.contracts[0].bma);assert.match(file.contracts[2].bma.error,/Kein Wartungskostenträger/);assert.ok(!JSON.stringify(file).includes(config.token));
});
test('distinguishes no matching plant, invalid responses and connection failures',async()=>{
 assert.deepEqual(await plants(config,'0001',async()=>Response.json([{aid:1,nr:'1'}])),[]);
 for(const response of [Response.json({aid:1}),Response.json([{aid:'1',nr:'0001'}]),new Response('Login HTML')])await assert.rejects(plants(config,'0001',async()=>response),/BMACloud/);
 for(const status of [401,403,500])await assert.rejects(plants(config,'0001',async()=>new Response('never expose response details',{status})),e=>e.message.includes(String(status))&&!e.message.includes('never expose'));
 await assert.rejects(plants(config,'0001',async()=>{throw Error('sensitive remote message');}),e=>/nicht erreichbar/.test(e.message)&&!e.message.includes('sensitive'));
 const file={kind:'object',name:'TE',contracts:[{name:'A',maintenanceCostCarrier:{number:'001'}}]};await resolveContractLinks(file,config,async()=>{throw Error('down');});assert.equal(file.contracts[0].bma.links.length,0);assert.match(file.contracts[0].bma.error,/nicht geladen/);
 assert.deepEqual(plantLinks(config,[]),[]);
});
