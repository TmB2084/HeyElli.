import {addDays,berlinWall,CalendarError,type CalendarEvent,type Resource} from '../planboard/kalender/domain.ts';
import {dutyWeeks,manualDutySlot} from '../planboard/kalender/duty.ts';
export type DutyExclusion={id:string;user_id:string;resource_id:string;week_day:string;created_at?:string};
export function exclusionEvents(exclusions:DutyExclusion[]):CalendarEvent[]{return exclusions.map(item=>{const year=Number(item.week_day.slice(0,4)),slot=[...dutyWeeks(year-1),...dutyWeeks(year),...dutyWeeks(year+1)].find(week=>week.day===item.week_day);if(!slot)throw new CalendarError('Ungültige Sperrwoche.');return {id:'heyelli-duty-exclusion:'+item.id,title:'Persönliche Sperrwoche',start:slot.start,end:slot.end,resourceIds:[item.resource_id],categories:[],type:'ABWESENHEIT',status:'GEPLANT',fixed:false,allDay:false};});}
export function swapFingerprint(event:CalendarEvent){return JSON.stringify([event.id,Date.parse(event.start),Date.parse(event.end),[...event.resourceIds].sort(),event.type,event.status,event.fixed,event.allDay,[...event.categories].sort()]);}
export function swapTargets(first:CalendarEvent,second:CalendarEvent){return [{...first,status:'FREI' as const,resourceIds:[second.resourceIds[0]]},{...second,status:'FREI' as const,resourceIds:[first.resourceIds[0]]}];}
export function checkSwap(year:number,first:CalendarEvent,second:CalendarEvent,current:CalendarEvent[],resources:Resource[],category:string,exclusions:DutyExclusion[],resuming=false,now=new Date()){
 if(first.id===second.id||first.resourceIds.length!==1||second.resourceIds.length!==1||first.resourceIds[0]===second.resourceIds[0])throw new CalendarError('Zwei Bereitschaften unterschiedlicher Mitarbeiter auswählen.');
 const targets=swapTargets(first,second),weeks=dutyWeeks(year);
 for(const [index,before] of [first,second].entries()){
  const day=berlinWall(before.start).slice(0,10),week=weeks.find(item=>item.day===day),latest=current.find(item=>item.id===before.id);
  if(!week||Date.parse(before.start)!==Date.parse(week.start)||Date.parse(before.end)!==Date.parse(week.end)||Date.parse(week.start)<=now.getTime()||before.fixed||before.categories.length!==1||before.categories[0]!==category||before.type!=='FREIER')throw new CalendarError('Nur zukünftige, nicht fixierte Bereitschaftswochen von Montag 07:00 bis Montag 07:00 können getauscht werden.');
  if(!latest||swapFingerprint(latest)!==swapFingerprint(before)&&(!resuming||swapFingerprint(latest)!==swapFingerprint(targets[index])))throw new CalendarError('Eine Bereitschaft wurde zwischenzeitlich geändert. Bitte einen neuen Tauschwunsch stellen.',409);
 }
 const finalEvents=[...current.filter(item=>![first.id,second.id].includes(item.id)),...targets,...exclusionEvents(exclusions)];
 for(const target of targets){const person=resources.find(item=>item.id===target.resourceIds[0]);if(!person)throw new CalendarError('Mitarbeiter ist nicht mehr verfügbar.');try{manualDutySlot(year,berlinWall(target.start).slice(0,10),person,finalEvents,category,now);}catch(error){throw new CalendarError(error instanceof Error?error.message:'Tausch ist nicht möglich.',409);}}
 return targets;
}
export function exclusionDay(year:number,day:unknown,now=new Date()){
 if(typeof day!=='string')throw new CalendarError('Bitte eine Kalenderwoche auswählen.');const week=dutyWeeks(year).find(item=>item.day===day);if(!week||Date.parse(week.start)<=now.getTime())throw new CalendarError('Nur zukünftige Kalenderwochen können gesperrt werden.');return week;
}
export const wishesRange=(year:number)=>({from:addDays(dutyWeeks(year)[0].day,-7),to:addDays(dutyWeeks(year).at(-1)!.day,14)});
