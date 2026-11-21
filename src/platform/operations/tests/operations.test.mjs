import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,diagnostic,metricArea} from '../model.ts';
const good={database:true,web:true,workerAge:1,workerHealthy:true,queueAge:0,unknown:0,failed:0,uncertain:0,requests:20,failures:0,slow:0,meanMs:10,freeBytes:1024**3,freeRatio:.2,secrets:true};
test('operations thresholds distinguish incidents, sparse traffic and recovery',()=>{
 assert.deepEqual(evaluate(good),[]);
 for(const [patch,code]of [[{database:false},'database'],[{web:false},'web'],[{workerAge:null},'worker'],[{workerAge:121},'worker'],[{workerHealthy:false},'worker'],[{queueAge:901},'queue'],[{unknown:1},'mailUnknown'],[{failed:1},'mailFailed'],[{uncertain:1},'actionUncertain'],[{failures:2},'httpErrors'],[{slow:4},'httpSlow'],[{freeBytes:1},'storage'],[{freeRatio:.04},'storage'],[{secrets:false},'secrets']])assert.ok(evaluate({...good,...patch}).includes(code));
 assert.deepEqual(evaluate({...good,requests:1,failures:1,slow:1}),[]);
});
test('diagnostics accept only fixed codes and generated IDs; route data is reduced to a fixed area',()=>{
 assert.equal(metricArea('/api/pds/rest/api/customer/private?token=hidden'),'pds');
 const value=diagnostic('database','11111111-1111-4111-8111-111111111111','raised');assert.deepEqual(Object.keys(JSON.parse(value)),['kind','at','code','incidentId','event']);assert.throws(()=>diagnostic('secret password','11111111-1111-4111-8111-111111111111','raised'));assert.throws(()=>diagnostic('database','cookie=private','raised'));
});

test('monitor addresses are restricted to local literal loopbacks and localhost',async()=>{
 const {webProbeHost}=await import('../web-probe.ts');
 for(const host of ['127.0.0.1','::1','localhost'])assert.equal(webProbeHost(host),host);
 for(const host of ['example.invalid','192.0.2.1','0.0.0.0','::','http://localhost','localhost:3000',''])assert.throws(()=>webProbeHost(host));
});
