import {addDays,wallInstant,berlinWall,unionIntervals,subtractIntervals,type WorkInterval,type Resource,type CalendarEvent,type CalendarWorkingTime} from '../kalender/domain.ts';
export type AvailabilityInput={start:string;duration:number;main:string;team:string[];existingIncidentId?:string};
export type AvailabilityPerson={id:string;name:string;group:string;status:'free'|'blocked'|'unknown'};
export type AvailabilityResult={people:AvailabilityPerson[];alternatives:AvailabilityPerson[];slots:{start:string;end:string}[];through:string;checkedAt:string};
export function availabilityInput(params:URLSearchParams):AvailabilityInput{
 const existingIncidentId=params.get('existingIncidentId')??undefined;if(existingIncidentId!==undefined&&(!existingIncidentId||existingIncidentId.length>200))throw new Error('Ungültiger Einsatz.');
 const start=params.get('start')??'',duration=Number(params.get('duration')),main=params.get('main')??'';let team:unknown;
 try{team=JSON.parse(params.get('team')??'[]');}catch{throw new Error('Bitte gültige Mitarbeiter auswählen.');}
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start))throw new Error('Bitte Beginn und Uhrzeit vollständig eingeben.');
 wallInstant(start);
 if(!Number.isInteger(duration)||duration<15||duration>1440||duration%15)throw new Error('Bitte eine Dauer von 15 bis 1440 Minuten in 15-Minuten-Schritten eingeben.');
 if(!main||main.length>200||!Array.isArray(team)||team.length>20||team.some(id=>typeof id!=='string'||!id||id.length>200))throw new Error('Bitte gültige Mitarbeiter auswählen.');
 return {start,duration,main,team:[...new Set(team as string[])].filter(id=>id!==main),...(existingIncidentId?{existingIncidentId}:{})};
}
function instant(day:string,minute:number){return Date.parse(wallInstant((minute===1440?addDays(day,1):day)+'T'+(minute===1440?'00:00':String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'))));}
const covers=(intervals:WorkInterval[],range:WorkInterval)=>intervals.some(item=>item.start<=range.start&&item.end>=range.end);
const overlaps=(a:WorkInterval,b:WorkInterval)=>a.start<b.end&&a.end>b.start;
export function planningAvailability(data:{resources:Resource[];events:CalendarEvent[];workingTime?:CalendarWorkingTime},input:AvailabilityInput):AvailabilityResult{
 const from=input.start.slice(0,10),through=addDays(from,13),start=Date.parse(wallInstant(input.start)),duration=input.duration*60000,requested={start,end:start+duration},selected=[input.main,...input.team];
 const intervals=new Map<string,WorkInterval[]>(),statuses=new Map<string,AvailabilityPerson['status']>();
 for(const resource of data.resources){
  const working=data.workingTime?.resources.find(item=>item.resourceId===resource.id),known:WorkInterval[]=[],work:WorkInterval[]=[];
  for(const day of working?.days??[]){
   if(day.date<from||day.date>through||resource.planningFrom&&day.date<resource.planningFrom||resource.planningTo&&day.date>resource.planningTo)continue;
   known.push({start:instant(day.date,0),end:instant(day.date,1440)});
   work.push(...subtractIntervals(day.intervals,day.breaks).map(item=>({start:instant(day.date,item.start),end:instant(day.date,item.end)})));
  }
  const events=data.events.filter(event=>event.resourceIds.includes(resource.id)&&event.status==='GEPLANT'),unknown=events.filter(event=>event.type==='URLAUB'&&!event.vacationApproval).map(event=>({start:Date.parse(event.start),end:Date.parse(event.end)}));
  const busy=events.filter(event=>event.type!=='URLAUB'||event.vacationApproval==='GENEHMIGT').map(event=>({start:Date.parse(event.start),end:Date.parse(event.end)}));
  const free=subtractIntervals(unionIntervals(work),[...busy,...unknown]);intervals.set(resource.id,free);
  statuses.set(resource.id,!covers(unionIntervals(known),requested)||unknown.some(item=>overlaps(item,requested))?'unknown':covers(free,requested)?'free':'blocked');
 }
 const person=(id:string):AvailabilityPerson=>{const resource=data.resources.find(item=>item.id===id);return {id,name:resource?.name??'Gewählter Mitarbeiter',group:resource?.group??'',status:statuses.get(id)??'unknown'};};
 // A replacement and every future suggestion must accommodate the selected companions too.
 const teamFree=input.team.every(id=>statuses.get(id)==='free'),group=data.resources.find(item=>item.id===input.main)?.group;
 const alternatives=teamFree?data.resources.filter(item=>!selected.includes(item.id)&&statuses.get(item.id)==='free').sort((a,b)=>Number(b.group===group)-Number(a.group===group)||a.name.localeCompare(b.name,'de')).slice(0,8).map(item=>person(item.id)):[];
 let joint=intervals.get(input.main)??[];
 for(const id of input.team){const other=intervals.get(id)??[];joint=joint.flatMap(a=>other.map(b=>({start:Math.max(a.start,b.start),end:Math.min(a.end,b.end)})).filter(item=>item.end>item.start));}
 const slots:AvailabilityResult['slots']=[];
 for(const interval of joint){
  let candidate=Math.ceil(Math.max(start,interval.start)/60000)*60000;
  if(candidate===start)continue;
  // The editor accepts unambiguous Berlin wall time. During the repeated hour,
  // advance inside this same free interval; never propose a start it cannot save.
  while(candidate+duration<=interval.end){
   const wall=berlinWall(new Date(candidate).toISOString());let selectable=false;
   try{selectable=Date.parse(wallInstant(wall))===candidate;}catch{/* Repeated hour: keep searching, without crossing an occupied interval. */}
   if(selectable){slots.push({start:wall,end:berlinWall(new Date(candidate+duration).toISOString())});break;}
   candidate+=60000;
  }
  if(slots.length===3)break;
 }
 return {people:selected.map(person),alternatives,slots,through,checkedAt:new Date().toISOString()};
}
