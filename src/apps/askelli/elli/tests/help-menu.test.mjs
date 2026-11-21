import {test} from 'node:test';
import assert from 'node:assert/strict';
import {helpMenuResults} from '../../../../system/hilfe/help-menu.ts';
import {resolveHelpHash} from '../help-search.ts';
test('launcher help finds questions and links to exact help sections',()=>{
 const result=helpMenuResults('Wie vergebe ich einen Termin für einen bestehenden Einsatz?').find(item=>item.label==='Bestehenden Einsatz planen');assert.ok(result);
 assert.equal(resolveHelpHash(result.href.slice('/hilfe'.length)).topicId,'stoerung');
 assert.equal(helpMenuResults('Quantenbananendrucker').length,0);
});
test('launcher help follows the selected provider and admin visibility',()=>{
 const local=helpMenuResults('Ollama',false,true).filter(item=>item.topicId==='hilfe');assert.ok(local.length);assert.ok(local.every(item=>item.detail.includes('Ollama')));
 const active=helpMenuResults('Bestätigen',true,true).filter(item=>item.topicId==='hilfe');assert.ok(active.length);assert.ok(active.every(item=>item.detail.includes('Copilot')));
 assert.ok(!helpMenuResults('Kalenderfarben',false,false).some(item=>item.topicId==='einstellungen'));
});
