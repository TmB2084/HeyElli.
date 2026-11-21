import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsHttpTransport,createService} from '../../api/index.ts';
import {SimulatedPdsApi} from '../api.ts';
import {openOrderStore} from '../order-store.ts';

test('two heyelli accounts share one API account and retain distinct Bearbeiter after reopening PDS',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pds-two-users-'));
  const db=join(dir,'test.sqlite');let store=openOrderStore(db);
  // A random test-only secret: never load or print any development credentials.
  const centralToken=randomBytes(32).toString('base64url');
  // Two fictional heyelli accounts with their PDS user of the simulator source (as assigned in the account administration).
  const accounts=[{id:'konto:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'dispatcher',mode:'local',pdsUserUUID:'sim-employee-1'},{id:'konto:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'dispatcher',mode:'local',pdsUserUUID:'sim-employee-2'}];
  const requestCredentials=new Set();const created=[];
  let workflow='';let httpCalls=0;
  // One shared HTTP transport and one API credential for both simulated users.
  // The fetch boundary dispatches to the durable emulator, not canned UUID responses.
  const api=new PdsHttpTransport('https://pds.example.invalid/rest/api',centralToken,async(url,options)=>{
    httpCalls++;
    assert.equal(options.headers.Authorization,`Bearer ${centralToken}`);
    requestCredentials.add(options.headers.Authorization);
    const path=new URL(url).pathname.replace('/rest/api','');
    const result=await new SimulatedPdsApi(store,workflow).request(options.method,path,options.body ? JSON.parse(options.body) : undefined);
    return Response.json(result);
  });
  try {
    for(const [index,identity] of accounts.entries()) {
      // The session carries the account's PDS user; the client cannot choose a Bearbeiter.
      const actor={pdsUserUUID:identity.pdsUserUUID};
      workflow=`${identity.id}:order:two-user-test`;
      const input={customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:`Fiktiver Testauftrag Benutzer ${index+1}`,externalNumber:`SIM-TWO-USERS-${index+1}`,reportedAt:'2026-11-02T10:00',technicianId:'',companions:[],bearbeiterUUID:'forged-client-value'};
      const receipt=await createService(api,input,'SIM-Serviceauftrag',actor);
      const details=await api.request('POST','/service/details',{uuid:receipt.uuid});
      assert.equal(details.bearbeiterUUID,identity.pdsUserUUID);
      assert.equal(store.apiEntity(receipt.uuid).data.externeNummer,input.externalNumber);
      assert.equal(details.rootEbene.ebenen.length,1);
      assert.equal(details.rootEbene.ebenen[0].objektUUID,'sim-unit-1');
      assert.equal((await createService(api,input,'SIM-Serviceauftrag',actor)).uuid,receipt.uuid);
      created.push({...receipt,bearbeiter:identity.pdsUserUUID});
    }
    assert.equal(requestCredentials.size,1);
    assert.notEqual(created[0].uuid,created[1].uuid);
    assert.notEqual(created[0].number,created[1].number);
    assert.equal(store.apiEntities('service').length,2);
    assert.equal(store.apiEntities('incident').length,2);
    store.close();store=openOrderStore(db);
    // Read back through the same API transport after closing/reopening persistence.
    for(const receipt of created) {
      const details=await api.request('POST','/service/details',{uuid:receipt.uuid});
      assert.equal(details.bearbeiterUUID,receipt.bearbeiter);
      assert.equal(details.vorgangsNummer,receipt.number);
    }
    assert.ok(httpCalls>=12);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
