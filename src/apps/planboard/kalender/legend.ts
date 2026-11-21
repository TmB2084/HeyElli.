import {eventColorDetails,wallMinutes,vacationApprovalLabels,type CalendarData,type CalendarEvent,type ResolvedEventColor} from "./model.ts";
import {typeLabels} from "./options.ts";
import {statusScopeLabels} from "./status-catalog.ts";
import {contractServiceLabels} from "./contract-service.ts";
import type {ColorSource} from "./color-layout.ts";
import type {TimeWindow} from "./time-axis.ts";
export const legendGroups=[{id:"type",label:"Termintyp"},{id:"category",label:"Kategorie"},{id:"status",label:"Status"}] as const;
export type LegendEntry={group:ColorSource;key:string;color:string;label:string;position:"Hauptfarbe"|"Nebenfarbe"|"Kategoriefarbe"|"Ohne Farbzuordnung";categoryId?:string;count:number};
export function visibleLegendEvents(events:CalendarEvent[],resources:string[],from:string,days:number,window:TimeWindow,visibleDays?:number[]) {
 const ids=new Set(resources),origin=Date.parse(from+"T00:00:00Z")/60000,dayStarts=(visibleDays??Array.from({length:days},(_,day)=>day)).map(day=>origin+day*1440);
 return events.filter(event=>{if(!event.resourceIds.some(id=>ids.has(id)))return false;const start=wallMinutes(event.start),end=wallMinutes(event.end);return dayStarts.some(day=>start<day+window.end&&end>day+window.start);});
}
export function calendarLegend(events:CalendarEvent[],data:Pick<CalendarData,"colors"|"colorLayouts"|"categoryOptions"|"statusCatalogs">):LegendEntry[] {
 const entries=new Map<string,LegendEntry>(),seen=new Set<string>();
 function label(event:CalendarEvent,resolved:ResolvedEventColor) {
  const type=typeLabels[event.type as keyof typeof typeLabels]??event.type,rule=resolved.rule;
  if(resolved.neutral)return `${type} · Neutral (keine passende ${({type:"Typfarbe",category:"Kategoriefarbe",status:"Statusfarbe"})[resolved.source]})`;
  if(rule?.vacationApproval)return `Urlaub · ${vacationApprovalLabels[rule.vacationApproval as keyof typeof vacationApprovalLabels]}`;
  if(rule?.contractService)return `Störung · ${contractServiceLabels[rule.contractService]}`;
  if(rule?.category)return `${data.categoryOptions?.find(item=>item.id===rule.category)?.name??"Unbekannte Kategorie ("+rule.category+")"}`;
  if(rule?.orderStatus){const catalog=data.statusCatalogs?.find(item=>item.type===rule.orderType);return `${catalog?.name??statusScopeLabels[rule.orderType as keyof typeof statusScopeLabels]??rule.orderType} · ${catalog?.statuses.find(item=>item.id===rule.orderStatus)?.name??event.orderStatus?.name??rule.orderStatus}`;}
  return type;
 }
 for(const event of events) {
  if(seen.has(event.id))continue;seen.add(event.id);
  const resolved=eventColorDetails(event,data.colors,data.colorLayouts);
  for(const [position,color] of [["Hauptfarbe",resolved.main],["Nebenfarbe",resolved.secondary]] as const) {
   if(!color)continue;
   const text=label(event,color),key=JSON.stringify([color.source,position,color.color,text]);
   const existing=entries.get(key);if(existing)existing.count++;else entries.set(key,{group:color.source,key,color:color.color,label:text,position,...(color.rule?.category?{categoryId:color.rule.category}:{}),count:1});
  }
 }
 return [...entries.values()].sort((a,b)=>legendGroups.findIndex(group=>group.id===a.group)-legendGroups.findIndex(group=>group.id===b.group)||a.label.localeCompare(b.label,"de")||a.position.localeCompare(b.position,"de"));
}

export function completeCategoryLegend(entries:LegendEntry[],data:Pick<CalendarData,"colors"|"categoryOptions">):LegendEntry[]{
 const result=[...entries],shown=new Set(entries.filter(entry=>entry.group==='category').map(entry=>entry.categoryId));
 const categories=new Map((data.categoryOptions??[]).map(category=>[category.id,category.name]));
 for(const rule of data.colors)if(rule.category&&!rule.orderType&&!categories.has(rule.category))categories.set(rule.category,`Unbekannte Kategorie (${rule.category})`);
 for(const [id,name] of categories){if(shown.has(id))continue;const rule=data.colors.find(item=>item.category===id&&!item.orderType);result.push({key:`category:${id}`,group:'category',categoryId:id,label:name,color:rule?.farbe??'transparent',position:rule?'Kategoriefarbe':'Ohne Farbzuordnung',count:0});}
 return result.sort((a,b)=>legendGroups.findIndex(group=>group.id===a.group)-legendGroups.findIndex(group=>group.id===b.group)||a.label.localeCompare(b.label,'de'));
}
