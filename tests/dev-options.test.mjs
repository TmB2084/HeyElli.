import {test} from 'node:test';
import assert from 'node:assert/strict';
import {developmentArgs} from '../scripts/dev-options.mjs';
test('development binds to loopback and keeps ordinary Next flags',()=>{
 assert.deepEqual(developmentArgs([]),{lan:false,args:['--hostname','127.0.0.1']});
 assert.deepEqual(developmentArgs(['--webpack','--port','3100']).args,['--hostname','127.0.0.1','--webpack','--port','3100']);
 for(const args of [['--hostname','localhost'],['-H','::1'],['--hostname=127.0.0.1']])assert.deepEqual(developmentArgs(args).args,args);
});
test('nonlocal hosts need explicit LAN consent and all supported host spellings are checked',()=>{
 for(const args of [['--hostname','0.0.0.0'],['--hostname=0.0.0.0'],['-H','0.0.0.0'],['-H=0.0.0.0'],['-H0.0.0.0'],['--hostname','::']])assert.throws(()=>developmentArgs(args),/--lan/);
 assert.deepEqual(developmentArgs(['--lan']),{lan:true,args:['--hostname','0.0.0.0']});
 assert.deepEqual(developmentArgs(['--lan','--hostname','192.0.2.1']).args,['--hostname','192.0.2.1']);
 for(const args of [['--hostname'],['--hostname='],['-H'],['--hostname','--port'],['--hostname','localhost','-H127.0.0.1']])assert.throws(()=>developmentArgs(args));
});

test('monitor follows every supported spelling of the local web bind address',async()=>{
 const {developmentMonitorHost}=await import('../scripts/dev-options.mjs');
 for(const args of [['--hostname','::1'],['--hostname=::1'],['-H','::1'],['-H::1'],['-H=::1'],['--lan','--hostname','::']])assert.equal(developmentMonitorHost(developmentArgs(args).args),'::1');
 assert.equal(developmentMonitorHost(developmentArgs(['--hostname','localhost']).args),'localhost');
 for(const args of [[],['--hostname','127.0.0.1'],['--lan']])assert.equal(developmentMonitorHost(developmentArgs(args).args),'127.0.0.1');
});
