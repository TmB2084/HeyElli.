import test from 'node:test';
import assert from 'node:assert/strict';
import {dutyWeeks,dutyDays,dutyPlan,manualDutySlot} from '../duty.ts';
import {berlinWall} from '../domain.ts';
const people=['a','b','c'].map(id=>({id,name:id,number:id,group:'Team'}));
const base={id:'duty',title:'Bereitschaft',resourceIds:['a'],start:'2027-01-04T06:00:00Z',end:'2027-01-11T06:00:00Z',categories:['duty'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false};
test('ISO weeks stay Monday 07 to Monday 07 even across daylight saving',()=>{const weeks=dutyWeeks(2027);assert.equal(weeks.length,52);for(const item of weeks){assert.equal(new Date(item.day).getUTCDay(),1);assert.equal(berlinWall(item.start).slice(11),'07:00');assert.equal(berlinWall(item.end).slice(11),'07:00');assert.equal(dutyDays([{...base,start:item.start,end:item.end}],'a',item.start,item.end),7);}assert.ok(weeks.some(item=>(Date.parse(item.end)-Date.parse(item.start))/3600000===167));assert.ok(weeks.some(item=>(Date.parse(item.end)-Date.parse(item.start))/3600000===169));});
test('fair assignment balances weeks without back-to-back duty',()=>{const plan=dutyPlan(2027,people,[],'duty',new Date('2026-11-07T12:00:00Z'));assert.ok(plan.every(item=>item.resourceId));const counts=people.map(person=>plan.filter(item=>item.resourceId===person.id).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);for(let i=1;i<plan.length;i++)assert.notEqual(plan[i].resourceId,plan[i-1].resourceId);});
test('fixed and started duty remains; leave and adjacent protected duty exclude a person',()=>{const fixed={...base,fixed:true};const leave={...base,id:'leave',type:'URLAUB',categories:[],resourceIds:['b'],start:'2027-01-11T06:00:00Z',end:'2027-01-18T06:00:00Z'};const plan=dutyPlan(2027,people,[fixed,leave],'duty',new Date('2026-11-07T12:00:00Z'));assert.match(plan[0].reason,/Geschützte/);assert.equal(plan[1].resourceId,'c');const started=dutyPlan(2027,people,[base],'duty',new Date('2027-01-06T12:00:00Z'));assert.match(started[0].reason,/begonnen/);});
test('existing future weeks are replaced, overlapping days counted once, no forced long streak for one person',()=>{const plan=dutyPlan(2027,people,[base],'duty',new Date('2026-11-07T12:00:00Z'));assert.equal(plan[0].old[0].id,'duty');assert.ok(plan[0].resourceId);assert.equal(dutyDays([base,base],'a',base.start,base.end),7);const solo=dutyPlan(2027,[people[0]],[],'duty',new Date('2026-11-07T12:00:00Z'));assert.equal(solo[1].resourceId,null);assert.match(solo[1].reason,/Folgewoche/);});

test('manual assignment replaces another technician but rejects protected, absent and consecutive duty',()=>{
 const now=new Date('2026-11-07T12:00:00Z');const slot=manualDutySlot(2027,'2027-01-04',people[1],[base],'duty',now);assert.equal(slot.resourceId,'b');assert.equal(slot.old[0].id,'duty');
 assert.throws(()=>manualDutySlot(2027,'2027-01-04',people[1],[{...base,fixed:true}],'duty',now));
 assert.throws(()=>manualDutySlot(2027,'2027-01-04',people[0],[],'duty',new Date('2027-01-06T12:00:00Z')));
 assert.throws(()=>manualDutySlot(2027,'2027-01-04',people[1],[{...base,id:'leave',categories:[],type:'URLAUB',resourceIds:['b']}],'duty',now));
 assert.throws(()=>manualDutySlot(2027,'2027-01-11',people[0],[base],'duty',now),/a: KW 1.*KW 2.*zwei Bereitschaftswochen hintereinander/);
 const next={...base,start:'2027-01-11T06:00:00Z',end:'2027-01-18T06:00:00Z'};
 assert.throws(()=>manualDutySlot(2027,'2027-01-04',people[0],[next],'duty',now),/a: KW 2.*KW 1.*zwei Bereitschaftswochen hintereinander/);
 const prior={...base,start:'2026-12-28T06:00:00Z',end:'2027-01-04T06:00:00Z'};
 assert.throws(()=>manualDutySlot(2027,'2027-01-04',people[0],[prior],'duty',now),/KW 53.*KW 1.*hintereinander/);
 assert.equal(manualDutySlot(2027,'2027-01-18',people[0],[base],'duty',now).resourceId,'a');
});

import {dutyHolidays,dutyHolidayBurden,defaultDutyHolidays,checkDutyHolidays} from '../duty-holidays.ts';
const holidayOptions={...defaultDutyHolidays,enabled:true};
test('movable holidays and state/local exceptions follow German holiday dates',()=>{
 const days=dutyHolidays(2026,holidayOptions);for(const [name,day] of [['Karfreitag','2026-04-03'],['Ostermontag','2026-04-06'],['Pfingstmontag','2026-05-25'],['Fronleichnam','2026-06-04']])assert.equal(days.find(item=>item.name===name)?.day,day);
 assert.equal(dutyHolidays(2027,holidayOptions).find(item=>item.name==='Ostersonntag').day,'2027-03-28');
 assert.equal(dutyHolidays(2026,{...holidayOptions,state:'SN'}).find(item=>item.name==='Buß- und Bettag').day,'2026-11-18');
 assert.ok(!dutyHolidays(2026,{...holidayOptions,state:'BE'}).some(item=>item.name==='Fronleichnam'));
 assert.ok(dutyHolidays(2026,{...holidayOptions,state:'BY',localAssumption:true,localPeace:true}).some(item=>item.name==='Augsburger Friedensfest'));
 assert.ok(!dutyHolidays(2026,{...holidayOptions,state:'BY'}).some(item=>item.name==='Mariä Himmelfahrt'));
 assert.ok(dutyHolidays(2026,{...holidayOptions,state:'TH',localCorpus:true}).some(item=>item.name==='Fronleichnam'));
 assert.deepEqual(dutyHolidays(2026,defaultDutyHolidays),[]);
});
test('holiday points split Monday at 07:00, span years and respect DST',()=>{
 const weeks=dutyWeeks(2026),before=weeks.find(item=>item.day==='2026-03-30'),after=weeks.find(item=>item.day==='2026-04-06');
 assert.ok(Math.abs(dutyHolidayBurden(before.start,before.end,holidayOptions).points-(4+2*7/24))<1e-9);
 assert.ok(Math.abs(dutyHolidayBurden(after.start,after.end,holidayOptions).points-2*17/24)<1e-9);
 const dst=dutyHolidayBurden('2027-03-27T23:00:00Z','2027-03-28T22:00:00Z',holidayOptions);assert.equal(dst.points,2);
 assert.ok(dutyHolidayBurden('2026-12-28T06:00:00Z','2027-01-04T06:00:00Z',holidayOptions).holidays.some(item=>item.day==='2027-01-01'));
});
test('holiday settings are validated and irrelevant municipal flags are discarded',()=>{
 assert.throws(()=>checkDutyHolidays({...holidayOptions,state:'XX'}));assert.throws(()=>checkDutyHolidays({...holidayOptions,weights:{...holidayOptions.weights,christmas:11}}));assert.throws(()=>checkDutyHolidays({...holidayOptions,weights:null}));assert.throws(()=>checkDutyHolidays({...holidayOptions,enabled:'yes'}));
 assert.equal(checkDutyHolidays({...holidayOptions,state:'BE',localPeace:true}).localPeace,false);
});
test('holiday-aware planning accounts for protected holidays and keeps weekly safety rules',()=>{
 const weeks=dutyWeeks(2027),easter=weeks.find(item=>item.day==='2027-03-22'),protectedEaster={...base,start:easter.start,end:easter.end,fixed:true};
 const plan=dutyPlan(2027,people,[protectedEaster],'duty',new Date('2026-11-07T12:00:00Z'),holidayOptions);
 assert.ok(plan.some(item=>item.holidayPoints>0));assert.equal(plan.find(item=>item.day===easter.day).resourceId,null);
 assert.notEqual(plan.find(item=>item.day==='2027-03-29').resourceId,'a');
 for(let i=1;i<plan.length;i++)if(plan[i].resourceId&&plan[i-1].resourceId)assert.notEqual(plan[i].resourceId,plan[i-1].resourceId);
 const normal=dutyPlan(2027,people,[],'duty',new Date('2026-11-07T12:00:00Z'));
 const disabled=dutyPlan(2027,people,[],'duty',new Date('2026-11-07T12:00:00Z'),{...holidayOptions,enabled:false});assert.deepEqual(normal,disabled);
 const christmas=dutyHolidayBurden('2027-12-20T06:00:00Z','2027-12-27T06:00:00Z',{...holidayOptions,weights:{...holidayOptions.weights,christmas:8}});assert.equal(christmas.points,16);
});

test('New Year has its own configurable weight and remains separate from other holidays',()=>{
 const options={...holidayOptions,weights:{...holidayOptions.weights,newYear:9,other:1}};
 const newYear=dutyHolidays(2028,options).find(item=>item.name==='Neujahr');assert.equal(newYear.group,'newYear');assert.equal(newYear.weight,9);
 assert.equal(dutyHolidayBurden('2027-12-27T06:00:00Z','2028-01-03T06:00:00Z',options).groups.newYear,9);
 assert.equal(checkDutyHolidays({...holidayOptions,weights:{christmas:3,easter:2,pentecost:2,other:1}}).weights.newYear,3);
 assert.throws(()=>checkDutyHolidays({...options,weights:{...options.weights,newYear:0}}));assert.throws(()=>checkDutyHolidays({...options,historyYears:11}));
});
test('six successive years rotate major holiday duties using saved prior assignments',()=>{
 const history=[],assignments={christmas:[],easter:[],pentecost:[],newYear:[]};
 for(let year=2027;year<=2032;year++){
 const plan=dutyPlan(year,people,history,'duty',new Date('2026-11-07T12:00:00Z'),holidayOptions);
 for(const group of Object.keys(assignments)){
 const holidaySlots=plan.filter(slot=>slot.resourceId&&dutyHolidayBurden(slot.start,slot.end,holidayOptions).groups[group]>0);
 assert.ok(holidaySlots.length,`${year} ${group} assigned`);
 // Track the principal week of the holiday (Monday splits may create two).
 const principal=holidaySlots.sort((a,b)=>dutyHolidayBurden(b.start,b.end,holidayOptions).groups[group]-dutyHolidayBurden(a.start,a.end,holidayOptions).groups[group])[0];assignments[group].push(principal.resourceId);
 }
 history.push(...plan.filter(slot=>slot.resourceId).map(slot=>({...base,id:`${year}:${slot.day}`,start:slot.start,end:slot.end,resourceIds:[slot.resourceId]})));
 }
 for(const [group,ids] of Object.entries(assignments)){assert.equal(new Set(ids).size,3,`${group}: all employees participate (${ids})`);assert.ok(Math.max(...people.map(person=>ids.filter(id=>id===person.id).length))<=3,`${group}: no permanent holiday owner (${ids})`);}
});
test('historical duplicates do not double weight and expired lookback records do not affect rotation',()=>{
 const weeks=dutyWeeks(2026),christmas=weeks.find(slot=>slot.day==='2026-12-21'),past={...base,id:'old-christmas',start:christmas.start,end:christmas.end};
 const now=new Date('2026-11-07T12:00:00Z'),plan=dutyPlan(2027,people,[past],'duty',now,holidayOptions);
 const duplicate=dutyPlan(2027,people,[past,{...past,id:'duplicate'}],'duty',now,holidayOptions);assert.deepEqual(plan,duplicate);
 const older={...past,id:'expired',start:'2018-12-24T06:00:00Z',end:'2018-12-31T06:00:00Z'};
 assert.deepEqual(dutyPlan(2027,people,[older],'duty',now,holidayOptions),dutyPlan(2027,people,[],'duty',now,holidayOptions));
 const main=plan.find(slot=>slot.day==='2027-12-20');assert.notEqual(main.resourceId,'a');
});
test('equal historic burden prefers the least recent holiday, but availability remains mandatory',()=>{
 const history=[['a','2025-12-22','2025-12-29'],['b','2026-12-21','2026-12-28'],['c','2024-12-23','2024-12-30']].map(([id,start,end])=>({...base,id:'history-'+id,resourceIds:[id],start:start+'T06:00:00Z',end:end+'T06:00:00Z'}));
 const previous={...base,id:'protected-previous',resourceIds:['b'],fixed:true,start:'2027-12-13T06:00:00Z',end:'2027-12-20T06:00:00Z'},now=new Date('2026-11-07T12:00:00Z');
 const plan=dutyPlan(2027,people,[...history,previous],'duty',now,holidayOptions);assert.equal(plan.find(slot=>slot.day==='2027-12-20').resourceId,'c');
 const leave={...base,id:'leave',categories:[],type:'URLAUB',resourceIds:['c'],start:'2027-12-20T06:00:00Z',end:'2027-12-27T06:00:00Z'};
 const constrained=dutyPlan(2027,people,[...history,previous,leave],'duty',now,holidayOptions);assert.equal(constrained.find(slot=>slot.day==='2027-12-20').resourceId,'a');
});
test('New Year rotation uses prior New Year service rather than unrelated holiday totals',()=>{
 const prior={...base,id:'prior-new-year',resourceIds:['a'],start:'2026-12-28T06:00:00Z',end:'2027-01-04T06:00:00Z'};
 const plan=dutyPlan(2027,people,[prior],'duty',new Date('2026-11-07T12:00:00Z'),holidayOptions);
 assert.notEqual(plan.find(slot=>slot.day==='2027-12-27').resourceId,'a');
});

import {dutyFairness} from '../duty-fairness.ts';
import {dutyBalance} from '../duty-balance.ts';
test('fairness accounts separate past and planned days/points and never count duplicates twice',()=>{
 const past={...base,id:'christmas',resourceIds:['a'],status:'FREI',start:'2025-12-22T06:00:00Z',end:'2025-12-29T06:00:00Z'},future={...base,id:'next-christmas',resourceIds:['a'],start:'2026-12-21T06:00:00Z',end:'2026-12-28T06:00:00Z'};
 const result=dutyFairness(people,[past,{...past,id:'duplicate'},future,{...past,id:'not-duty',categories:[]}],'duty','2025-01-01T00:00:00Z','2027-01-04T06:00:00Z',holidayOptions,new Date('2026-11-07T12:00:00Z'));
 const account=result.accounts.find(item=>item.id==='a');assert.equal(account.days,7);assert.equal(account.plannedDays,7);assert.equal(account.holidayPoints,6);assert.equal(account.plannedHolidayPoints,6);assert.equal(account.last.christmas,'2025-12-26');assert.equal(account.last.newYear,'');
 assert.equal(result.accounts.find(item=>item.id==='b').holidayPoints,0);
 const ledger=dutyBalance([past,past],'a',result.from,result.to,holidayOptions);assert.equal(ledger.days,7);assert.equal(ledger.groups.christmas,6);
});
test('fairness uses local days across DST, clips the snapshot and calculates points even when weighting is disabled',()=>{
 const easter={...base,start:'2027-03-22T06:00:00Z',end:'2027-03-29T05:00:00Z'};
 const result=dutyFairness(people,[easter],'duty',easter.start,easter.end,{...holidayOptions,enabled:false},new Date('2027-03-29T05:00:00Z'));
 assert.equal(result.accounts[0].days,7);assert.equal(result.accounts[0].last.easter,'2027-03-29');assert.equal(result.weighted,false);assert.ok(result.accounts[0].holidayPoints>4);
 const before=dutyFairness(people,[easter],'duty',easter.start,easter.end,holidayOptions,new Date('2026-11-07T12:00:00Z'));assert.equal(before.accounts[0].days,0);assert.equal(before.accounts[0].last.easter,'');assert.equal(before.accounts[0].plannedDays,7);
});
test('selection explanations describe only the decisive ranking and are removed from rejected slots',()=>{
 const now=new Date('2026-11-07T12:00:00Z'),plain=dutyPlan(2027,people,[],'duty',now);assert.match(plain[0].selectionReason,/alphabetisch/);assert.ok(plain.filter(slot=>slot.resourceId).every(slot=>slot.selectionReason));
 const solo=dutyPlan(2027,[people[0]],[],'duty',now);assert.match(solo[0].selectionReason,/Einziger/);assert.ok(solo.filter(slot=>!slot.resourceId).every(slot=>!slot.selectionReason));
 const history=[['a','2025-12-22','2025-12-29'],['b','2026-12-21','2026-12-28'],['c','2024-12-23','2024-12-30']].map(([id,start,end])=>({...base,id:'h-'+id,resourceIds:[id],start:start+'T06:00:00Z',end:end+'T06:00:00Z'}));
 const previous={...base,id:'previous',fixed:true,resourceIds:['b'],start:'2027-12-13T06:00:00Z',end:'2027-12-20T06:00:00Z'};
 const plan=dutyPlan(2027,people,[...history,previous],'duty',now,holidayOptions);assert.match(plan.find(slot=>slot.day==='2027-12-20').selectionReason,/längsten zurück/);
});

test('manual consecutive preview allows two weeks only and keeps other constraints',()=>{
 const now=new Date('2026-11-07T12:00:00Z');
 const slot=manualDutySlot(2027,'2027-01-11',people[0],[base],'duty',now,true);
 assert.equal(slot.resourceId,'a');assert.match(slot.consecutiveWarning,/KW 1.*KW 2/);assert.equal(slot.consecutiveNeighbors.length,1);assert.equal(slot.consecutiveConfirmed,undefined);
 const next={...base,id:'next',start:'2027-01-11T06:00:00Z',end:'2027-01-18T06:00:00Z'};
 assert.throws(()=>manualDutySlot(2027,'2027-01-18',people[0],[base,next],'duty',now,true),/Mehr als zwei/);
 assert.throws(()=>manualDutySlot(2027,'2027-01-11',people[0],[base,{...next,id:'leave',categories:[],type:'URLAUB'}],'duty',now,true),/abwesend/);
 assert.throws(()=>manualDutySlot(2027,'2027-01-11',people[0],[base,{...next,fixed:true}],'duty',now,true),/Fixierte/);
});
