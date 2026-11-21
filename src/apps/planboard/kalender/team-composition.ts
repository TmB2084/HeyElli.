import type {CalendarEvent,Resource,ResourceGroup} from './domain.ts';
export function teamComposition(resources:Resource[],events:CalendarEvent[],groups:ResourceGroup[]){
 const byGroup=new Map<string,{id:string;name:string;members:Resource[];teams:{key:string;memberIds:string[];mainId?:string;companionIds:string[];events:CalendarEvent[]}[]}>();
 for(const person of resources){const ids=person.groupIds?.length?person.groupIds:[`fallback:${person.group||'Ohne Fachgruppe'}`];for(const id of ids){let group=byGroup.get(id);if(!group){group={id,name:groups.find(item=>item.id===id)?.name??(id.startsWith('fallback:')?id.slice(9):'Unbekannte Fachgruppe'),members:[],teams:[]};byGroup.set(id,group);}group.members.push(person);}}
 const seen=new Set<string>(),unique=events.filter(event=>{if(seen.has(event.id))return false;seen.add(event.id);return true;});
 for(const group of byGroup.values()){
  const members=new Set(group.members.map(item=>item.id)),teams=new Map<string,typeof group.teams[number]>();
  for(const event of unique){const ids=[...new Set(event.resourceIds)].sort();if(ids.length<2||!ids.some(id=>members.has(id)))continue;const key=JSON.stringify([ids,event.mainTechnicianId??'', [...(event.companionTechnicianIds??[])].sort()]);let team=teams.get(key);if(!team){team={key,memberIds:ids,mainId:event.mainTechnicianId,companionIds:event.companionTechnicianIds??[],events:[]};teams.set(key,team);}team.events.push(event);}
  group.teams=[...teams.values()];group.members.sort((a,b)=>a.name.localeCompare(b.name,'de'));
 }
 return [...byGroup.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
