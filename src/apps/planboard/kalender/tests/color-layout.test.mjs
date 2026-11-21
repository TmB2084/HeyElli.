import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultColorLayouts,checkColorLayouts,eventColors} from '../domain.ts';
import {colorSettingsStore} from '../settings-store.ts';
const event={type:'FREIER',categories:['category-uuid'],link:{type:'AUFTRAG'},orderStatus:{id:'status-uuid',name:'Offen'}};
const rules=[{typ:'FREIER',farbe:'#111111'},{category:'category-uuid',farbe:'#222222'},{orderType:'AUFTRAG',orderStatus:'status-uuid',farbe:'#333333'}];
test('each of the three sources can independently be main or secondary without automatic fallback',()=>{
 const sourceColors={type:'#111111',category:'#222222',status:'#333333'};
 for(const main of Object.keys(sourceColors))for(const secondary of [null,...Object.keys(sourceColors).filter(source=>source!==main)]){
  const layouts=defaultColorLayouts();layouts.FREIER={main,secondary};checkColorLayouts(layouts);
  assert.deepEqual(eventColors(event,rules,layouts),{main:sourceColors[main],secondary:secondary?sourceColors[secondary]:undefined});
 }
 const layouts=defaultColorLayouts();layouts.FREIER={main:'status',secondary:'category'};
 assert.deepEqual(eventColors({...event,orderStatus:undefined},rules,layouts),{main:'#cad0db',secondary:'#222222'});
 assert.deepEqual(eventColors({...event,orderStatus:undefined,categories:[]},rules,layouts),{main:'#cad0db',secondary:undefined});
 assert.deepEqual(eventColors(event,rules),{main:'#111111',secondary:undefined});
 assert.deepEqual(eventColors({...event,orderStatus:{id:'status-uuid',name:'Renamed'}},rules,layouts),{main:'#333333',secondary:'#222222'});
});
test('layouts are separate per type; vacation always uses only its type color',()=>{
 const layouts=defaultColorLayouts();layouts.FREIER={main:'category',secondary:'status'};layouts.SERVICEAUFTRAGEBENE={main:'type',secondary:'status'};
 assert.deepEqual(eventColors({...event,type:'URLAUB'},[{typ:'URLAUB',farbe:'#abcdef'},...rules],layouts),{main:'#abcdef',secondary:undefined});
 assert.deepEqual(eventColors({...event,type:'SERVICEAUFTRAGEBENE',contractService:'MIT'},[{contractService:'MIT',farbe:'#123456'},...rules],layouts),{main:'#123456',secondary:'#333333'});
 assert.deepEqual(eventColors({...event,type:'VORGANG'},rules,layouts),{main:'#cad0db',secondary:undefined});
});
test('server validation rejects missing types, vacation, duplicate sources and unknown values',()=>{
 assert.deepEqual(checkColorLayouts(defaultColorLayouts()),defaultColorLayouts());
 for(const bad of [null,[],{}, {...defaultColorLayouts(),URLAUB:{main:'type',secondary:null}}, {...defaultColorLayouts(),FREIER:{main:'category',secondary:'category'}},{...defaultColorLayouts(),FREIER:{main:'unknown',secondary:null}},{...defaultColorLayouts(),FREIER:{main:'type',secondary:'unknown'}},{...defaultColorLayouts(),FREIER:{main:'type'}}])assert.throws(()=>checkColorLayouts(bad));
});
test('legacy colors survive with type-only defaults; layouts and colors share persistence and concurrency protection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-layout-'));try{
  const file=join(dir,'colors.json');writeFileSync(file,JSON.stringify(rules));const store=colorSettingsStore(file),legacy=store.read();
  assert.deepEqual(legacy.rules,rules);assert.deepEqual(legacy.colorLayouts,defaultColorLayouts());
  const layouts=defaultColorLayouts();layouts.FREIER={main:'status',secondary:'category'};
  const saved=store.write(rules,legacy.version,layouts);assert.notEqual(saved.version,legacy.version);assert.deepEqual(colorSettingsStore(file).read(),saved);
  assert.deepEqual(JSON.parse(readFileSync(file)),{rules,colorLayouts:layouts});
  assert.throws(()=>store.write(rules,legacy.version,defaultColorLayouts()),error=>error.status===409);
  const updated=store.write([{typ:'FREIER',farbe:'#ffffff'}],saved.version);assert.deepEqual(updated.colorLayouts,layouts);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
