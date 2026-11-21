import {dutyBalance} from './duty-balance.ts';
import {dutyHolidayBurden,defaultDutyHolidays,type DutyHolidayOptions} from './duty-holidays.ts';
import {addDays,berlinWall,wallInstant,calendarWeekLabel,type CalendarEvent,type Resource} from './domain.ts';
export type DutySlot={day:string;start:string;end:string;label:string;old:CalendarEvent[];resourceId:string|null;reason?:string;consecutiveWarning?:string;consecutiveNeighbors?:string[];consecutiveConfirmed?:boolean;createdId?:string;deleted?:string[];selectionReason?:string;holidayPoints?:number;holidays?:string[]};
export function dutyWeeks(year:number){const jan4=`${year}-01-04`,first=addDays(jan4,-((new Date(jan4+'T12:00:00Z').getUTCDay()+6)%7)),nextJan4=`${year+1}-01-04`,until=addDays(nextJan4,-((new Date(nextJan4+'T12:00:00Z').getUTCDay()+6)%7));const result:DutySlot[]=[];for(let day=first;day<until;day=addDays(day,7))result.push({day,start:wallInstant(day+'T07:00'),end:wallInstant(addDays(day,7)+'T07:00'),label:calendarWeekLabel(day,day),old:[],resourceId:null});return result;}
const overlap=(a:{start:string;end:string},b:{start:string;end:string})=>Date.parse(a.start)<Date.parse(b.end)&&Date.parse(a.end)>Date.parse(b.start);
export function dutyDays(events:CalendarEvent[],id:string,from:string,to:string){const intervals=events.filter(item=>item.resourceIds.includes(id)).map(item=>[Math.max(Date.parse(berlinWall(item.start)+'Z'),Date.parse(berlinWall(from)+'Z')),Math.min(Date.parse(berlinWall(item.end)+'Z'),Date.parse(berlinWall(to)+'Z'))]).filter(([a,b])=>a<b).sort((a,b)=>a[0]-b[0]);let total=0,end=-Infinity;for(const [a,b] of intervals){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return total/86400000;}
export function dutyPlan(year:number,people:Resource[],events:CalendarEvent[],category:string,now=new Date(),holidayOptions:DutyHolidayOptions=defaultDutyHolidays){
 const duties=events.filter(event=>event.categories.includes(category)),ids=new Set(people.map(item=>item.id)),slots=dutyWeeks(year),load=new Map(people.map(item=>[item.id,0]));
 const mutable=new Set<string>();
 for(const slot of slots){const occupied=duties.filter(item=>overlap(item,slot));slot.old=occupied;const safe=Date.parse(slot.start)>now.getTime()&&occupied.every(item=>!item.fixed&&item.categories.length===1&&item.resourceIds.every(id=>ids.has(id))&&Date.parse(item.start)===Date.parse(slot.start)&&Date.parse(item.end)===Date.parse(slot.end));if(!safe){slot.reason=Date.parse(slot.start)<=now.getTime()?'Vergangen oder bereits begonnen':'Geschützte, abweichende oder nicht ausgewählte Bereitschaft';}else for(const item of occupied)mutable.add(item.id);}
 const fixed=duties.filter(item=>!mutable.has(item.id)),from=slots[0].start,to=slots.at(-1)!.end;
 for(const person of people)load.set(person.id,dutyDays(fixed,person.id,from,to));
 const holidayLoad=new Map(people.map(person=>[person.id,{newYear:0,christmas:0,easter:0,pentecost:0,other:0}]));
 const addBurden=(id:string,start:string,end:string)=>{const burden=dutyHolidayBurden(start,end,holidayOptions),totals=holidayLoad.get(id);if(totals)for(const group of Object.keys(totals) as (keyof typeof totals)[])totals[group]+=burden.groups[group];};
 for(const person of people){const balance=dutyBalance(fixed,person.id,from,to,holidayOptions);holidayLoad.set(person.id,balance.groups);}
 const historyFrom=wallInstant(`${Math.max(2000,year-holidayOptions.historyYears)}-01-01T00:00`);
 const history=people.map(person=>({id:person.id,...dutyBalance(duties,person.id,historyFrom,from,holidayOptions)}));
 const historical=new Map(history.map(person=>[person.id,person]));
 let previous:string[]=[];
 for(const slot of slots){const burden=dutyHolidayBurden(slot.start,slot.end,holidayOptions);slot.holidayPoints=burden.points;slot.holidays=burden.holidays.map(item=>`${item.name} (${item.day})`);if(slot.reason){previous=[...new Set(slot.old.flatMap(item=>item.resourceIds))];continue;}
 const special=(id:string)=>{const totals=holidayLoad.get(id)!;return (Object.keys(totals) as (keyof typeof totals)[]).reduce((sum,key)=>sum+(totals[key]+historical.get(id)!.groups[key])*burden.groups[key],0);};
 const total=(id:string)=>load.get(id)!+Object.values(holidayLoad.get(id)!).reduce((sum,value)=>sum+value,0);
 const recent=(id:string)=>Math.max(0,...burden.holidays.map(holiday=>Number(historical.get(id)!.last[holiday.group].replaceAll('-',''))||0));
 const candidates=people.filter(person=>!previous.includes(person.id)&&!fixed.some(event=>event.resourceIds.includes(person.id)&&(overlap(event,{start:wallInstant(addDays(slot.day,-7)+'T07:00'),end:slot.start})||overlap(event,{start:slot.end,end:wallInstant(addDays(slot.day,14)+'T07:00')})))&&(!person.planningFrom||person.planningFrom<=slot.day)&&(!person.planningTo||person.planningTo>=addDays(slot.day,7))&&!events.some(item=>item.resourceIds.includes(person.id)&&item.status!=='FREI'&&['URLAUB','ABWESENHEIT','PRIVATE_ABWESENHEIT'].includes(item.type)&&overlap(item,slot))).sort((a,b)=>(burden.points?special(a.id)-special(b.id)||recent(a.id)-recent(b.id):0)||total(a.id)-total(b.id)||a.name.localeCompare(b.name,'de'));
 const selected=candidates[0];if(!selected){slot.reason='Niemand verfügbar ohne direkte Folgewoche';previous=[...new Set(slot.old.flatMap(item=>item.resourceIds))];for(const id of previous)if(load.has(id)){load.set(id,load.get(id)!+7);addBurden(id,slot.start,slot.end);}continue;}slot.resourceId=selected.id;
 const runnerUp=candidates[1],format=(value:number)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(value);
 if(!runnerUp)slot.selectionReason='Einziger verfügbarer Mitarbeiter ohne direkte Folgewoche.';
 else if(burden.points&&special(selected.id)<special(runnerUp.id))slot.selectionReason='Geringste gewichtete Vorbelastung für die Feiertage dieser Woche (Rückblick, Bestand und bisheriger Vorschlag).';
 else if(burden.points&&recent(selected.id)<recent(runnerUp.id))slot.selectionReason='Gleiche Feiertagsbelastung; letzte Übernahme liegt am längsten zurück.';
 else if(total(selected.id)<total(runnerUp.id))slot.selectionReason=`Geringste aktuelle Belastung: ${format(load.get(selected.id)!)} Tage + ${format(Object.values(holidayLoad.get(selected.id)!).reduce((sum,value)=>sum+value,0))} Feiertagspunkte (Bestand und bisheriger Vorschlag).`;
 else slot.selectionReason=selected.name===runnerUp.name?'Gleiche Bewertung; Reihenfolge der Mitarbeiter.':'Gleiche Bewertung; alphabetische Reihenfolge.';
 load.set(selected.id,load.get(selected.id)!+7);addBurden(selected.id,slot.start,slot.end);previous=[selected.id];}
 // A week that could not be reassigned keeps its old crew. Do not create an
 // adjacent new assignment that would extend that preserved duty beyond a week.
 let adjusted=true;while(adjusted){adjusted=false;for(let index=0;index<slots.length;index++){const slot=slots[index];if(!slot.resourceId)continue;const id=slot.resourceId;const neighbors=[slots[index-1],slots[index+1]].filter(Boolean);if(neighbors.some(next=>next.resourceId?next.resourceId===id:next.old.some(event=>event.resourceIds.includes(id)))){slot.resourceId=null;delete slot.selectionReason;slot.reason='Folgewoche kollidiert mit beibehaltener Bereitschaft';adjusted=true;}}}
 return slots;
}
export function dutyFingerprint(event:CalendarEvent){return JSON.stringify([event.id,event.start,event.end,[...event.resourceIds].sort(),event.title,event.notes??'',event.fixed,[...event.categories].sort()]);}

export function manualDutySlot(year:number,day:string,person:Resource,events:CalendarEvent[],category:string,now=new Date(),previewConsecutive=false):DutySlot{
 const slot=dutyWeeks(year).find(item=>item.day===day);if(!slot||Date.parse(slot.start)<=now.getTime())throw new Error('Nur noch nicht begonnene Kalenderwochen können zugewiesen werden.');
 if(person.planningFrom&&person.planningFrom>day||person.planningTo&&person.planningTo<addDays(day,7))throw new Error('Mitarbeiter ist nicht für die gesamte Woche planbar.');
 const duties=events.filter(item=>item.categories.includes(category));slot.old=duties.filter(item=>overlap(item,slot));
 if(slot.old.some(item=>item.fixed||item.categories.length!==1||Date.parse(item.start)!==Date.parse(slot.start)||Date.parse(item.end)!==Date.parse(slot.end)))throw new Error('Fixierte oder abweichende Bereitschaften können hier nicht ersetzt werden.');
 if(events.some(item=>item.resourceIds.includes(person.id)&&item.status!=='FREI'&&['URLAUB','ABWESENHEIT','PRIVATE_ABWESENHEIT'].includes(item.type)&&overlap(item,slot)))throw new Error('Mitarbeiter ist in dieser Woche abwesend.');
 const adjacent=duties.filter(item=>item.resourceIds.includes(person.id)&&(Date.parse(item.end)===Date.parse(slot.start)||Date.parse(item.start)===Date.parse(slot.end)));
 if(adjacent.length){
  const adjacentDay=berlinWall(adjacent[0].start).slice(0,10);
  const warning=`${person.name}: ${calendarWeekLabel(adjacentDay,adjacentDay)} und ${slot.label} ergeben zwei Bereitschaftswochen hintereinander.`;
  if(!previewConsecutive)throw new Error(warning+' Maximal eine Woche am Stück ist erlaubt.');
  const connected=[...adjacent];let changed=true;
  while(changed){changed=false;for(const item of duties){if(item.resourceIds.includes(person.id)&&!connected.includes(item)&&!slot.old.includes(item)&&connected.some(other=>Date.parse(item.end)===Date.parse(other.start)||Date.parse(item.start)===Date.parse(other.end))){connected.push(item);changed=true;}}}
  const from=new Date(Math.min(Date.parse(slot.start),...connected.map(item=>Date.parse(item.start)))).toISOString(),to=new Date(Math.max(Date.parse(slot.end),...connected.map(item=>Date.parse(item.end)))).toISOString();
  if(dutyDays([...connected,{...connected[0],start:slot.start,end:slot.end}],person.id,from,to)>14)throw new Error('Mehr als zwei Bereitschaftswochen am Stück sind nicht erlaubt.');
  slot.consecutiveWarning=warning;
  slot.consecutiveNeighbors=connected.map(dutyFingerprint).sort();
 }
 slot.resourceId=person.id;return slot;
}
