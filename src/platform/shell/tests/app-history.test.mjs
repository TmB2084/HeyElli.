import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppHistory} from '../app-history.ts';
test('app arrows stay in one app, preserve deep links and branch safely',()=>{
 const trail=new AppHistory('/einstellungen');
 trail.visit('/casedesk',1);assert.equal(trail.begin(-1),null);
 trail.visit('/einstellungen',2);assert.deepEqual(trail.availability,{canGoBack:false,canGoForward:false});
 const child='/einstellungen?bereich=colors&seite=resources%3Acolors%2Fpalette%3A2';
 trail.visit(child,3);assert.equal(trail.begin(-1),'/einstellungen');trail.visit('/einstellungen',4);
 assert.equal(trail.begin(1),child);trail.visit(child,5);
 trail.visit('/benutzerkonto?bereich=account',6);assert.equal(trail.begin(1),null);
 assert.equal(trail.begin(-1),'/einstellungen');trail.visit('/einstellungen',7);
 trail.visit('/einstellungen?bereich=users',8);assert.equal(trail.begin(1),null);
});
test('native traversal, reload and another app have independent boundaries',()=>{
 const trail=new AppHistory('/benutzerkonto');trail.visit('/benutzerkonto',10);trail.visit('/benutzerkonto?bereich=account&seite=account:profile',11);
 trail.visit('/benutzerkonto',10);assert.equal(trail.availability.canGoBack,false);assert.equal(trail.availability.canGoForward,true);
 const fresh=new AppHistory('/benutzerkonto');fresh.visit('/benutzerkonto?bereich=account&seite=account:profile',11);assert.deepEqual(fresh.availability,{canGoBack:false,canGoForward:false});
 for(const bad of ['/einstellungen','//evil.invalid/benutzerkonto','https://evil.invalid/benutzerkonto'])fresh.visit(bad,12);
 assert.equal(fresh.begin(-1),null);
});
