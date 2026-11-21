import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeNotes,validNoteBuffer,validNoteText} from '../model.ts';
import {grantedTools} from '../../../platform/app-access/tools.ts';
test('notes grant is independent, explicit and does not grant business apps',()=>{assert.deepEqual(grantedTools([],['notes']).map(tool=>tool.id),['notes']);assert.deepEqual(grantedTools(['/hilfe'],[]),[]);assert.deepEqual(grantedTools([],['incident']),[]);});
test('disjoint note edits merge while overlapping drafts remain unresolved',()=>{assert.equal(mergeNotes('one\ntwo','ONE\ntwo','one\nTWO'),'ONE\nTWO');assert.equal(mergeNotes('base','base local','base remote'),null);assert.equal(mergeNotes('old','same','same'),'same');assert.equal(mergeNotes('base','base','remote'),'remote');assert.equal(mergeNotes('base','local','base'),'local');});
test('personal notes and protected pending copies validate size and version',()=>{assert.ok(validNoteText('Meine Notiz\nNächste Zeile'));assert.equal(validNoteText('x'.repeat(20001)),false);assert.equal(validNoteText('not\u0000allowed'),false);assert.ok(validNoteBuffer({base:'',text:'Noch offen',version:0,updatedAt:new Date().toISOString()}));assert.equal(validNoteBuffer({base:'',text:'x',version:-1,updatedAt:'invalid'}),false);});
