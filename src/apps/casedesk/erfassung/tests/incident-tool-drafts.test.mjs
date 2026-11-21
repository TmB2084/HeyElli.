import test from 'node:test';
import assert from 'node:assert/strict';
import {incidentDraftPrefix,isIncidentState,isToolDraft,latestToolDrafts} from '../tool-drafts.ts';
import {state} from '../../../../../tests/fixtures/incident-state.mjs';

const record=(branch,sequence)=>({kind:'incident-tool',version:1,draftId:crypto.randomUUID(),branchId:branch,sequence,updatedAt:new Date(1000+sequence).toISOString(),state});
test('incident drafts retain raw dates and queries and separate immutable tab branches',()=>{assert.ok(isIncidentState(state));const a=crypto.randomUUID(),b=crypto.randomUUID(),records=[record(a,1),record(b,1),record(a,2)];assert.ok(records.every(isToolDraft));assert.equal(latestToolDrafts(records).length,2);assert.equal(latestToolDrafts(records)[0].sequence,2);assert.notEqual(incidentDraftPrefix('owner-a'),incidentDraftPrefix('owner-b'));});
test('uncertain order requests require the original immutable operation and payload',()=>{const key=crypto.randomUUID();assert.ok(isIncidentState({...state,requestKey:key,pending:{key,payload:{problem:'Nicht verlieren'}},attempted:true}));for(const invalid of [{...state,attempted:true},{...state,pending:{key,payload:{}}},{...state,fields:{}},{...state,completed:[]},{...state,dates:{reportedAt:{date:null}}}])assert.equal(isIncidentState(invalid),false);});
