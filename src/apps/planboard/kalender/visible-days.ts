import {addDays} from './model.ts';
export function isWeekend(day:string){return [0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());}
export function visibleDayOffsets(from:string,days:number,showWeekends=true){return Array.from({length:days},(_,index)=>index).filter(index=>showWeekends||!isWeekend(addDays(from,index)));}
export function weekday(day:string,direction=1){while(isWeekend(day))day=addDays(day,direction);return day;}
