import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeBrowserReports} from '../scripts/browser-results.mjs';
import {browserEngineTimeout,verificationTimeout} from '../scripts/verification-plan.mjs';
const part=(engine,status='passed')=>({engine,report:{status,cases:[{id:'fixture',engine,status}],steps:[]}});
test('browser matrix retains both results and never turns partial, failed or stale evidence green',()=>{
 const engines=['chromium','webkit'];assert.equal(mergeBrowserReports(engines,engines.map(e=>part(e))).cases.length,2);
 assert.equal(mergeBrowserReports(engines,[part('chromium'),part('webkit','failed')]).status,'failed');
 assert.equal(mergeBrowserReports(engines,[part('chromium'),{engine:'webkit',report:{status:'passed',cases:[]}}]).status,'failed');
 assert.throws(()=>mergeBrowserReports(engines,[part('chromium')]));assert.throws(()=>mergeBrowserReports(engines,[part('chromium'),part('chromium')]));
 assert.throws(()=>mergeBrowserReports(['chromium'],[{engine:'chromium',report:{status:'passed',cases:[{engine:'webkit',status:'passed'}]}}]));
});
test('total browser budget covers two bounded engine runs plus setup; ordinary gate budgets stay unchanged',()=>{assert.equal(browserEngineTimeout,14*60*1000);assert.equal(verificationTimeout('browser'),2*browserEngineTimeout+7*60*1000);for(const name of ['unit','platform','chat','lint','build','types','dependencies'])assert.equal(verificationTimeout(name),15*60*1000);});
