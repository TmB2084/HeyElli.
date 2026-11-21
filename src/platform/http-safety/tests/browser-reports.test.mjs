import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventReport} from '../report-model.ts';
import {normalizeReports} from '../reports.ts';
const origin='https://heyelli.example.invalid',body={'document-uri':origin+'/servicehub?secret=fictional#private','effective-directive':'script-src-elem','blocked-uri':'inline','script-sample':'fictional private text','source-file':'https://private.invalid/customer','original-policy':'nonce-fictional-secret',disposition:'enforce'};
test('legacy browser reports retain only fixed diagnostic classes, never raw URLs, samples or policies',()=>{
 const rows=normalizeReports({'csp-report':body},origin,false);assert.deepEqual(rows,[{app:'/servicehub',directive:'script-src-elem',blockedKind:'inline',disposition:'enforce'}]);assert.doesNotMatch(JSON.stringify(rows),/secret|private|nonce|https/);
 const arbitrary=normalizeReports({'csp-report':{...body,'document-uri':origin+'/service/customer/private-id','blocked-uri':'https://customer.invalid/private?token=fictional'}},origin,false);assert.equal(arbitrary[0].app,'other');assert.equal(arbitrary[0].blockedKind,'external');
});
test('modern batches are limited and reject unknown directives, foreign documents and malformed bodies',()=>{
 assert.equal(normalizeReports([{type:'csp-violation',body:{documentURL:origin+'/anmeldung?code=fictional',effectiveDirective:'script-src-attr',blockedURL:'inline',disposition:'report'}}],origin,true)[0].disposition,'report');
 for(const value of [[],Array(6).fill({}),[{type:'network-error',body:{}}],[{type:'csp-violation',body:{}}]])assert.throws(()=>normalizeReports(value,origin,true));
 for(const changes of [{'document-uri':'https://foreign.invalid/'},{'effective-directive':'private-text'},{'blocked-uri':'x'.repeat(4097)}])assert.throws(()=>normalizeReports({'csp-report':{...body,...changes}},origin,false));
});

test('event fallback removes private paths and source strings before transmission',()=>{
 for(const blocked of ['https://customer.invalid/private?secret=fictional','blob:https://heyelli.example.invalid/private-id','data:private-content']){
  const result=eventReport({effectiveDirective:'img-src',blockedURI:blocked,disposition:'enforce'},origin,'/service/customer/private-id');assert.doesNotMatch(JSON.stringify(result),/private|secret|fictional/);assert.equal(normalizeReports(result,origin,false)[0].app,'other');
 }
});
