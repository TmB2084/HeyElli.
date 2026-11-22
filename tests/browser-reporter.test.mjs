import {test} from 'node:test';
import assert from 'node:assert/strict';
import SafeReporter from './browser/reporter.mjs';

test('browser failure reports keep numeric comparisons without response content or secrets',()=>{
 const reporter=new SafeReporter(),caseInfo={title:'Fiktive Prüfung',parent:{project:()=>({name:'webkit'})}};
 reporter.onTestEnd(caseInfo,{status:'failed',duration:1,error:{message:'\u001b[31mExpected: 403\u001b[0m\nReceived: 200\nhttps://private.example.invalid/?token=fictitious-secret\nCookie: fictitious-cookie'}});
 assert.deepEqual(reporter.cases[0].assertion,{expectedNumber:403,receivedNumber:200});
 reporter.onTestEnd(caseInfo,{status:'failed',duration:1,error:{message:'Expected length: 1\nReceived length: 0\nReceived array: ["Fiktiver Fachtext"]'}});
 assert.deepEqual(reporter.cases[1].assertion,{expectedLength:1,receivedLength:0});
 const serialized=JSON.stringify(reporter.cases);
 for(const forbidden of ['private.example.invalid','fictitious-secret','fictitious-cookie','Fiktiver Fachtext'])assert.ok(!serialized.includes(forbidden));
});

test('browser failure locations include only numeric source coordinates',()=>{
 const reporter=new SafeReporter(),info={title:'Fiktive Prüfung',parent:{project:()=>({name:'webkit'})}};
 reporter.onStepEnd(info,{}, {category:'pw:api',location:{line:789,column:123,file:'fictitious-private-path'},error:{message:'Timeout fictitious-secret'}});
 assert.equal(reporter.steps[0].line,789);assert.equal(reporter.steps[0].column,123);assert.equal(reporter.steps[0].failureClass,'timeout');
 reporter.onStepEnd(info,{}, {category:'pw:api',location:{line:789,column:'fictitious-secret'},error:{message:'Timeout'}});
 assert.equal(reporter.steps[1].column,undefined);assert.ok(!JSON.stringify(reporter.steps).includes('fictitious-'));
});
