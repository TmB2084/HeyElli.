import {appLandingPath} from '../../../../platform/app-access/landing.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnPath} from '../return-path.ts';
test('login destinations stay inside the application and cannot target login loops, APIs or another host',()=>{
 assert.equal(returnPath('/planboard?from=2026-11-09'),'/planboard?from=2026-11-09');
 for(const value of [undefined,'https://evil.invalid','//evil.invalid','/\\evil.invalid','/%2f%2fevil.invalid','/%5cevil.invalid','/%0aevil','/anmeldung?next=/','/api/verwaltung','/API/simulator-session','/%61nmeldung','/%'])assert.equal(returnPath(value),'/');
});

test('login chooses an allowed app when AskElli is unavailable and handles empty grants',()=>{
 assert.equal(appLandingPath(['/servicehub','/planboard']),'/start');
 assert.equal(appLandingPath(['/planboard']),'/start');
 assert.equal(appLandingPath(['/servicehub'],'/'),'/start');
 assert.equal(appLandingPath(['/servicehub'],'https://evil.invalid'),'/start');
 assert.equal(appLandingPath(['/servicehub','/planboard'],'/planboard?from=2026-11-16'),'/planboard?from=2026-11-16');
 assert.equal(appLandingPath(['/servicehub'],'/planboard'),'/start');
 assert.equal(appLandingPath(['/','/servicehub']),'/');
 assert.equal(appLandingPath([]),'/start');
 assert.equal(appLandingPath(['/servicehub'],'/start'),'/start');
});
