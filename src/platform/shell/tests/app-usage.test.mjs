import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usageApp,usageScore} from '../app-usage-model.ts';
test('usage attributes sections to their app without counting query changes or unknown routes',()=>{
 assert.equal(usageApp('/servicehub/orders'),'/servicehub');assert.equal(usageApp('/'),'/');assert.equal(usageApp('/servicehub-other'),undefined);
 assert.equal(usageScore('/einstellungen?bereich=colors',{'/einstellungen':7}),7);
 assert.equal(usageScore('/hilfe',{}),0);
});
