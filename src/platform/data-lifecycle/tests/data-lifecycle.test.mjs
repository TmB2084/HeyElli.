import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selection} from '../model.ts';
test('privacy cleanup accepts only bounded explicit classes and real past dates',()=>{
 assert.deepEqual(selection({categories:['chat','chat'],cutoff:'2026-01-01'}),{categories:['chat'],cutoff:'2026-01-01'});
 for(const input of [{categories:[],cutoff:'2026-01-01'},{categories:['keys'],cutoff:'2026-01-01'},{categories:['chat'],cutoff:'2026-02-30'},{categories:['chat'],cutoff:'2100-01-01'},{categories:['chat'],cutoff:'2026-1-1'}])assert.throws(()=>selection(input));
});
