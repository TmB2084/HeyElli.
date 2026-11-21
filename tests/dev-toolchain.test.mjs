import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),estreeRequire=createRequire(require.resolve('@typescript-eslint/typescript-estree'));
test('the scoped patched minimatch preserves the API used by the TypeScript project service',()=>{
 const {minimatch}=estreeRequire('minimatch');assert.equal(estreeRequire('minimatch/package.json').version,'11.0.1');
 for(const [file,pattern,result] of [['eslint.config.mjs','*.mjs',true],['.config.mjs','*.mjs',true],['src/app/page.tsx','src/**/*.tsx',true],['src/app/page.tsx','scripts/*.mjs',false]])assert.equal(minimatch(file,pattern,{dot:true}),result);
});
