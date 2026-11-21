import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionResult} from '../session-check.ts';
const valid={authenticated:true,allowedApps:['/servicehub'],sessionRemainingMs:60000};
test('transient errors and malformed responses never masquerade as an invalid session',()=>{
 for(const [status,body] of [[503,{error:'DB unavailable'}],[500,null],[200,null],[200,{}],[200,{...valid,sessionRemainingMs:null}]])assert.deepEqual(sessionResult(status,body,'/servicehub',0),{kind:'unavailable'});
 assert.deepEqual(sessionResult(200,valid,'/servicehub',1000),{kind:'valid',remaining:59000});
});
test('expired and revoked sessions stay locked, app revocation and fallback remain enforced',()=>{
 for(const [status,body] of [[401,null],[403,null],[200,{authenticated:false}],[200,{...valid,sessionRemainingMs:10}]])assert.deepEqual(sessionResult(status,body,'/servicehub',20),{kind:'redirect',path:'/anmeldung'});
 assert.deepEqual(sessionResult(200,{...valid,allowedApps:[]},'/servicehub',0),{kind:'redirect',path:'/kein-zugriff'});
 assert.deepEqual(sessionResult(200,valid,'/',0),{kind:'redirect',path:'/start'});
});
