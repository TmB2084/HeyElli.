import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resourceSelectionStore,checkResourceSelection,selectionOwner} from '../selection-store.ts';
test('resource selection persists separately per user across store reopening, including none and all',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-selection-'));
 try{
  const store=resourceSelectionStore(dir);
  assert.equal(store.read('demo-ad:kim'),null);
  store.write('demo-ad:kim',['resource-1','temporarily-unavailable']);store.write('demo-ad:alex',[]);
  const reopened=resourceSelectionStore(dir);
  assert.deepEqual(reopened.read('demo-ad:kim'),['resource-1','temporarily-unavailable']);
  assert.deepEqual(reopened.read('demo-ad:alex'),[]);
  reopened.write('demo-ad:kim',null);
  assert.equal(store.read('demo-ad:kim'),null);assert.deepEqual(store.read('demo-ad:alex'),[]);
  assert.notEqual(selectionOwner('demo-ad:kim'),selectionOwner('demo-ad:alex'));
  assert.ok(readdirSync(dir).every(file=>/^[a-f0-9]{64}\.json$/.test(file)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('selection validation bounds input and preserves UUIDs independent of display names',()=>{
 assert.deepEqual(checkResourceSelection(['uuid-1','uuid-1']),['uuid-1']);
 for(const value of [undefined,{},[1],[''],[' '.repeat(3)],['x'.repeat(201)],Array(5001).fill('uuid')])assert.throws(()=>checkResourceSelection(value));
});

test('badge visibility is isolated, persistent, backward compatible and independent of resource selection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-badges-'));
 try{
  const store=resourceSelectionStore(dir);
  writeFileSync(join(dir,selectionOwner('kim')+'.json'),JSON.stringify({selection:['uuid-1']}));
  assert.deepEqual(store.readSettings('kim'),{selection:['uuid-1'],showTechnicianBadges:true,limitWorkingHours:false,showTentative:true});
  store.update('kim',{showTechnicianBadges:false});
  assert.deepEqual(resourceSelectionStore(dir).readSettings('kim'),{selection:['uuid-1'],showTechnicianBadges:false,limitWorkingHours:false,showTentative:true});
  assert.equal(store.readSettings('alex').showTechnicianBadges,true);
  store.write('kim',['uuid-2']);assert.equal(store.readSettings('kim').showTechnicianBadges,false);
  assert.throws(()=>store.update('kim',{showTechnicianBadges:'false'}));
  assert.throws(()=>store.update('kim',{showTechnicianBadges:null}));
  assert.deepEqual(store.readSettings('kim'),{selection:['uuid-2'],showTechnicianBadges:false,limitWorkingHours:false,showTentative:true});
  store.update('kim',{showTechnicianBadges:true});assert.equal(store.readSettings('kim').showTechnicianBadges,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('working hour limit persists per user and preserves the other preferences on independent updates',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-working-limit-'));
 try{
  const store=resourceSelectionStore(dir);
  writeFileSync(join(dir,selectionOwner('kim')+'.json'),JSON.stringify({selection:['resource-1'],showTechnicianBadges:false}));
  assert.equal(store.readSettings('kim').limitWorkingHours,false);
  store.update('kim',{limitWorkingHours:true});
  assert.deepEqual(resourceSelectionStore(dir).readSettings('kim'),{selection:['resource-1'],showTechnicianBadges:false,limitWorkingHours:true,showTentative:true});
  assert.equal(store.readSettings('alex').limitWorkingHours,false);
  store.write('kim',[]);store.update('kim',{showTechnicianBadges:true});
  assert.equal(store.readSettings('kim').limitWorkingHours,true);
  for(const value of [null,'true',1,{}])assert.throws(()=>store.update('kim',{limitWorkingHours:value}));
  assert.equal(store.readSettings('kim').limitWorkingHours,true);
  store.update('kim',{limitWorkingHours:false});
  assert.deepEqual(store.readSettings('kim'),{selection:[],showTechnicianBadges:true,limitWorkingHours:false,showTentative:true});
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('tentative visibility is persistent, isolated and defaults to visible for existing preference files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-tentative-'));
 try{
  writeFileSync(join(dir,selectionOwner('kim')+'.json'),JSON.stringify({selection:['uuid-1'],showTechnicianBadges:false,limitWorkingHours:true}));
  const store=resourceSelectionStore(dir);
  assert.equal(store.readSettings('kim').showTentative,true);
  store.update('kim',{showTentative:false});
  assert.deepEqual(resourceSelectionStore(dir).readSettings('kim'),{selection:['uuid-1'],showTechnicianBadges:false,limitWorkingHours:true,showTentative:false});
  assert.equal(store.readSettings('alex').showTentative,true);
  store.write('kim',[]);store.update('kim',{limitWorkingHours:false});store.update('kim',{showTechnicianBadges:true});
  assert.equal(store.readSettings('kim').showTentative,false);
  for(const value of [null,'false',0,{}])assert.throws(()=>store.update('kim',{showTentative:value}));
  assert.equal(store.readSettings('kim').showTentative,false);
  store.update('kim',{showTentative:true});assert.equal(store.readSettings('kim').showTentative,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
