import {test} from 'node:test';import assert from 'node:assert/strict';
import {feedbackInput} from '../client.ts';
const base={epoch:'00000000-0000-4000-8000-000000000001',turnId:'00000000-0000-4000-8000-000000000002',rating:'down'};
test('feedback accepts an optional reason but no forged owner or answer snapshots',()=>{
 assert.deepEqual(feedbackInput(base),{...base,reason:null,comment:''});
 assert.equal(feedbackInput({...base,reason:'workflow',comment:'  Bitte genauer  '}).comment,'Bitte genauer');
 for(const input of [{...base,userId:'other'},{...base,question:'falsch'},{...base,answer:'falsch'},{...base,role:'admin'},{...base,reason:'__proto__'},{...base,comment:'x'.repeat(601)},{...base,rating:'up',comment:'Grund'},{...base,rating:'bad'},{...base,epoch:'bad'},null])assert.throws(()=>feedbackInput(input));
});
