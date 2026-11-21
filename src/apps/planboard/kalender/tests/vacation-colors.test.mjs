import test from 'node:test';
import assert from 'node:assert/strict';
import {checkColorRules,colorRuleIdentity,eventColors,defaultColorLayouts,vacationDefaultColors} from '../domain.ts';
import {colorSettingsStore} from '../settings-store.ts';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const rules=[{vacationApproval:'BEANTRAGT',farbe:'#112233'},{vacationApproval:'GENEHMIGT',farbe:'#445566'},{typ:'URLAUB',farbe:'#778899'},{category:'cat',farbe:'#abcdef'}];
test('vacation requested and approved use independent type colors; unknown is never classified by appointment status',()=>{
 const event={type:'URLAUB',status:'GEPLANT',categories:['cat']};
 assert.equal(eventColors({...event,vacationApproval:'BEANTRAGT'},rules).main,'#112233');
 assert.equal(eventColors({...event,vacationApproval:'GENEHMIGT'},rules).main,'#445566');
 assert.equal(eventColors(event,rules).main,'#778899');
 assert.equal(eventColors(event,rules.filter(rule=>rule.typ!=='URLAUB')).main,'#b9c2d1');
 assert.deepEqual(eventColors({...event,vacationApproval:'GENEHMIGT'},rules,defaultColorLayouts()),{main:'#445566',secondary:undefined});
 assert.equal(eventColors({...event,vacationApproval:'BEANTRAGT'},[]).main,vacationDefaultColors.BEANTRAGT);
 assert.equal(eventColors({type:'FREIER',categories:[]},rules).main,'#b9c2d1');
});
test('vacation variant validation, identities and persistence remain separate',()=>{
 assert.deepEqual(checkColorRules(rules),rules);assert.notEqual(colorRuleIdentity(rules[0]),colorRuleIdentity(rules[1]));
 for(const invalid of [{vacationApproval:'UNKNOWN',farbe:'#112233'},{vacationApproval:'BEANTRAGT',typ:'URLAUB',farbe:'#112233'},{vacationApproval:'GENEHMIGT',orderType:'AUFTRAG',farbe:'#112233'}])assert.throws(()=>checkColorRules([invalid]));
 assert.throws(()=>checkColorRules([rules[0],rules[0]]));
 const dir=mkdtempSync(join(tmpdir(),'heyelli-vacation-'));try{
  const file=join(dir,'colors.json'),store=colorSettingsStore(file);const saved=store.write(rules,store.read().version);
  assert.deepEqual(colorSettingsStore(file).read().rules,rules);assert.deepEqual(saved.colorLayouts,defaultColorLayouts());
 }finally{rmSync(dir,{recursive:true,force:true});}
});
