import {defaultColorLayouts} from '../color-layout.ts';
const layout=(main)=>Object.fromEntries(Object.keys(defaultColorLayouts()).map(type=>[type,{main,secondary:null}]));
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {colorSettingsStore} from '../settings-store.ts';
import {checkColorRules,readLegacyColorRules,normalizeColorRules,defaultColorsForCatalogs,isSupportedColorRule,eventColor} from '../domain.ts';
const catalogs=[{type:'SERVICEAUFTRAG',name:'Service',statuses:[{id:'status-open',name:'Offen'}]}];
test('old files are permanently restricted to three areas, with valid UUID migration and stale-write protection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-color-areas-'));try{
  const file=join(dir,'colors.json'),legacy=[
   {status:'GEPLANT',farbe:'#111111'},{status:'FREI',farbe:'#222222'},{status:'VORGEMERKT',farbe:'#333333'},
   {typ:'*',farbe:'#444444'},{orderStatus:'*',farbe:'#555555'},{orderStatusName:'Not in PDS',farbe:'#666666'},
   {typ:'UNSUPPORTED',farbe:'#777777'},{orderStatusName:'Offen',farbe:'#123456'},
   {orderType:'SERVICEAUFTRAG',orderStatus:'removed-status',farbe:'#234567'},
   {category:'category-id',farbe:'#345678'},{typ:'FREIER',farbe:'#456789'},{contractService:'MIT',farbe:'#567890'}
  ];writeFileSync(file,JSON.stringify(legacy));const settings=colorSettingsStore(file),old=settings.read();
  const migrated=settings.readWithCatalogs(catalogs);assert.deepEqual(migrated.rules,[
   {orderType:'SERVICEAUFTRAG',orderStatus:'status-open',farbe:'#123456'},
   {orderType:'SERVICEAUFTRAG',orderStatus:'removed-status',farbe:'#234567'},
   {category:'category-id',farbe:'#345678'},{typ:'FREIER',farbe:'#456789'},{contractService:'MIT',farbe:'#567890'}
  ]);
  assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),{rules:migrated.rules,colorLayouts:migrated.colorLayouts});assert.ok(migrated.rules.every(isSupportedColorRule));assert.notEqual(migrated.version,old.version);
  assert.deepEqual(colorSettingsStore(file).readWithCatalogs(catalogs),migrated);assert.throws(()=>settings.write([],old.version),error=>error.status===409);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('removed rules cannot be submitted again or influence display, while only explicitly selected areas influence display',()=>{
 const excluded=[{status:'FREI',farbe:'#ff0000'},{typ:'*',farbe:'#00ff00'},{typ:'UNSUPPORTED',farbe:'#0000ff'},{orderStatus:'*',farbe:'#ffff00'},{orderStatusName:'Offen',farbe:'#ff00ff'},{orderStatus:'status-open',farbe:'#00ffff'}];
 for(const rule of excluded)assert.throws(()=>checkColorRules([rule]),/drei|Termin-Konfiguration/);
 assert.equal(eventColor({type:'FREIER',status:'FREI',categories:[]},excluded),'#b9c2d1');assert.equal(eventColor({type:'FREIER',status:'FREI',categories:[],link:{type:'SERVICEAUFTRAG'},orderStatus:{id:'status-open',name:'Offen'}},excluded),'#cad0db');
 const event={type:'FREIER',status:'FREI',categories:['category-id'],link:{type:'SERVICEAUFTRAG'},orderStatus:{id:'status-open',name:'Offen'}};
 const allowed=checkColorRules([{typ:'FREIER',farbe:'#111111'},{category:'category-id',farbe:'#222222'},{orderType:'SERVICEAUFTRAG',orderStatus:'status-open',farbe:'#333333'}]);
 assert.equal(eventColor(event,allowed,layout('status')),'#333333');assert.equal(eventColor({...event,orderStatus:undefined},allowed,layout('category')),'#222222');assert.equal(eventColor({...event,orderStatus:undefined,categories:[]},allowed),'#111111');
});
test('defaults and legacy PDS-view rules normalize to the same three areas without silently accepting malformed colors',()=>{
 assert.ok(defaultColorsForCatalogs(catalogs).every(isSupportedColorRule));
 const view=readLegacyColorRules([{status:'GEPLANT',farbe:'#123456'},{typ:'*',farbe:'#234567'},{orderStatusName:'Offen',farbe:'#345678'},{typ:'URLAUB',farbe:'#456789'}]);
 assert.deepEqual(normalizeColorRules(view,catalogs),[{orderType:'SERVICEAUFTRAG',orderStatus:'status-open',farbe:'#345678'},{typ:'URLAUB',farbe:'#456789'}]);
 assert.throws(()=>readLegacyColorRules([{status:'GEPLANT',farbe:'not-a-color'}]));
});
