import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarLegend,completeCategoryLegend,visibleLegendEvents} from '../legend.ts';
import {defaultColorLayouts,eventColors} from '../domain.ts';
const base={id:'event-1',title:'Beispiel',type:'FREIER',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['r1','r2'],status:'GEPLANT',fixed:false,categories:['cat-1','cat-2'],link:{type:'AUFTRAG'},orderStatus:{id:'s1',name:'Offen'}};
const rules=[{typ:'FREIER',farbe:'#111111'},{category:'cat-1',farbe:'#222222'},{category:'cat-2',farbe:'#444444'},{orderType:'AUFTRAG',orderStatus:'s1',farbe:'#333333'}];
const layouts=defaultColorLayouts();layouts.FREIER={main:'status',secondary:'category'};
const data={colors:rules,colorLayouts:layouts,categoryOptions:[{id:'cat-1',name:'Wartung'},{id:'cat-2',name:'Montage'}],statusCatalogs:[{type:'AUFTRAG',name:'Auftrag',statuses:[{id:'s1',name:'Offen'}]}]};
test('legend resolves exactly the rendered main and secondary colors and deduplicates shared appointments',()=>{
 const entries=calendarLegend([base,base],data),resolved=eventColors(base,rules,layouts);
 assert.equal(entries.length,2);assert.equal(entries.find(row=>row.position==='Hauptfarbe').group,'status');assert.equal(entries.find(row=>row.position==='Nebenfarbe').group,'category');assert.equal(entries.find(row=>row.position==='Hauptfarbe').color,resolved.main);assert.equal(entries.find(row=>row.position==='Nebenfarbe').color,resolved.secondary);
 assert.match(entries.find(row=>row.position==='Hauptfarbe').label,/Auftrag · Offen/);assert.match(entries.find(row=>row.position==='Nebenfarbe').label,/Wartung/);assert.ok(entries.every(row=>row.count===1));assert.ok(!entries.some(row=>row.color==='#444444'));
});
test('missing matches show neutral main without inventing a secondary or falling back to unused type colors',()=>{
 const event={...base,orderStatus:undefined,categories:[]},entries=calendarLegend([event],data);
 assert.equal(entries.length,1);assert.equal(entries[0].color,eventColors(event,rules,layouts).main);assert.match(entries[0].label,/Neutral/);assert.equal(entries[0].group,'status');
});
test('identical colors keep distinct meanings, and vacation and contract defaults are described',()=>{
 const entries=calendarLegend([{...base,type:'URLAUB',vacationApproval:'BEANTRAGT'},{...base,id:'event-2',type:'URLAUB',vacationApproval:'GENEHMIGT'},{...base,id:'event-3',type:'SERVICEAUFTRAGEBENE',contractService:'MIT'}],{...data,colors:[]});
 assert.equal(entries.length,3);assert.ok(entries.every(row=>row.group==='type'));assert.ok(entries.some(row=>row.label.includes('Beantragt')));assert.ok(entries.some(row=>row.label.includes('Genehmigt')));assert.ok(entries.some(row=>row.label.includes('Vertragsleistung')));
});
test('legend respects selected resources, displayed days and shortened working-time axis',()=>{
 const events=[base,{...base,id:'outside-resource',resourceIds:['r3']},{...base,id:'outside-day',start:'2026-11-07T08:00:00Z',end:'2026-11-07T09:00:00Z'},{...base,id:'before-window',start:'2026-11-06T01:00:00Z',end:'2026-11-06T02:00:00Z'},{...base,id:'overlapping-window',start:'2026-11-06T06:00:00Z',end:'2026-11-06T08:00:00Z'}];
 assert.deepEqual(visibleLegendEvents(events,['r1'],'2026-11-06',1,{start:480,end:1020}).map(row=>row.id),['event-1','overlapping-window']);
 assert.deepEqual(visibleLegendEvents(events,[],'2026-11-06',1,{start:0,end:1440}),[]);
});

test('one category used as main and secondary retains both clear position labels',()=>{
 const other={...base,id:'event-2',type:'VORGANG'};
 const mixed=defaultColorLayouts();mixed.FREIER={main:'category',secondary:null};mixed.VORGANG={main:'type',secondary:'category'};
 const entries=calendarLegend([base,other],{...data,colorLayouts:mixed});
 const category=entries.filter(row=>row.group==='category');
 assert.equal(category.length,2);assert.deepEqual(new Set(category.map(row=>row.position)),new Set(['Hauptfarbe','Nebenfarbe']));assert.ok(category.every(row=>row.label==='Wartung'&&row.color==='#222222'));
 assert.equal(entries.find(row=>row.group==='type').position,'Hauptfarbe');
});

test('category catalog remains complete when category colors are unused or missing',()=>{
 const catalog={...data,categoryOptions:[...data.categoryOptions,{id:'cat-3',name:'Ohne Farbe'}]};
 const entries=completeCategoryLegend(calendarLegend([base],catalog),catalog);
 assert.equal(entries.filter(item=>item.categoryId==='cat-1').length,1);
 assert.equal(entries.find(item=>item.categoryId==='cat-1').position,'Nebenfarbe');
 assert.equal(entries.find(item=>item.categoryId==='cat-2').color,'#444444');
 assert.equal(entries.find(item=>item.categoryId==='cat-2').position,'Kategoriefarbe');
 assert.equal(entries.find(item=>item.categoryId==='cat-3').position,'Ohne Farbzuordnung');
 assert.equal(completeCategoryLegend([],catalog).length,3);
});
