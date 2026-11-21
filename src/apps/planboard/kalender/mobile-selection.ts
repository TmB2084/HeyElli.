import {berlinWall,wallInstant,addDays,type CalendarEvent} from './domain.ts';
export function mobileSelection(events:CalendarEvent[],todayOnly:boolean,now=new Date()):CalendarEvent[]{
 const today=berlinWall(now.toISOString()).slice(0,10),from=Date.parse(wallInstant(today+'T00:00')),to=Date.parse(wallInstant(addDays(today,1)+'T00:00')),seen=new Set<string>();
 return events.filter(event=>{if(seen.has(event.id)||event.type!=='SERVICEAUFTRAGEBENE'||event.link?.type!=='SERVICEAUFTRAG'||!event.link.id||!event.mainTechnicianId||event.continuation?.serviceCopy||/storniert/i.test(event.orderStatus?.name??'')||todayOnly&&(Date.parse(event.start)>=to||Date.parse(event.end)<=from))return false;seen.add(event.id);return true;});
}
