import test from 'node:test';
import assert from 'node:assert/strict';
import {teamComposition} from '../team-composition.ts';
const people=[{id:'a',name:'Alex',groupIds:['h'],group:'Heizung'},{id:'b',name:'Kim',groupIds:['e'],group:'Elektro'},{id:'c',name:'Robin',groupIds:['h'],group:'Heizung'}];
const groups=[{id:'h',name:'Heizung'},{id:'e',name:'Elektro'}];
const event={id:'one',resourceIds:['a','b'],mainTechnicianId:'a',companionTechnicianIds:['b']};
test('groups members and combines identical crews without duplicating shared appointments',()=>{
 const result=teamComposition(people,[event,event,{...event,id:'two'},{id:'solo',resourceIds:['c']}],groups);
 const heat=result.find(item=>item.id==='h');assert.deepEqual(heat.members.map(item=>item.id),['a','c']);assert.equal(heat.teams.length,1);assert.equal(heat.teams[0].events.length,2);assert.equal(heat.teams[0].mainId,'a');assert.deepEqual(heat.teams[0].companionIds,['b']);assert.equal(result.find(item=>item.id==='e').teams.length,1);
});
test('different main technician creates a distinct crew; resource filter preserves full crew',()=>{
 const result=teamComposition([people[0]],[event,{...event,id:'two',mainTechnicianId:'b',companionTechnicianIds:['a']}],groups);assert.equal(result.length,1);assert.equal(result[0].teams.length,2);assert.deepEqual(result[0].teams[0].memberIds,['a','b']);assert.deepEqual(teamComposition([],[],groups),[]);
});
