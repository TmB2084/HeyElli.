import type {PoolClient} from 'pg';
import 'server-only';
import {platformDatabase} from '@/platform/store';
import {dutyResourcePreferences} from './resource-preferences';
export function dutyResourcePreferenceStore(){return dutyResourcePreferences(platformDatabase());}

import {wishesRange} from './wish-domain';
import type {DutyExclusion} from './wish-domain';
export async function readDutyExclusions(year:number,client?:PoolClient){const {from,to}=wishesRange(year);return (await (client??platformDatabase()).query<DutyExclusion>('SELECT id,user_id,resource_id,to_char(week_day,\'YYYY-MM-DD\') AS week_day FROM platform.duty_exclusions WHERE week_day BETWEEN $1::date AND $2::date ORDER BY week_day,resource_id',[from,to])).rows;}


import {pdsApi} from "@/platform/pds/connection/api";
import {CalendarError,berlinWall,type CalendarEvent,type CalendarWrite} from '@/apps/planboard/kalender/domain';
import {exclusionEvents} from './wish-domain';
export async function guardDutyExclusions(event:CalendarWrite,previous?:CalendarEvent){
 if(!event.categories.length)return;
 if(previous&&Date.parse(previous.start)===Date.parse(event.start)&&Date.parse(previous.end)===Date.parse(event.end)&&JSON.stringify([...previous.resourceIds].sort())===JSON.stringify([...event.resourceIds].sort())&&JSON.stringify([...previous.categories].sort())===JSON.stringify([...event.categories].sort()))return;
 const api=await pdsApi();try{if(!(await api.calendar.categories()).some(category=>category.name.trim().toLocaleLowerCase('de')==='bereitschaft'&&event.categories.includes(category.id)))return;}finally{api.close();}
 const {rows}=await platformDatabase().query<DutyExclusion>("SELECT id,user_id,resource_id,to_char(week_day,'YYYY-MM-DD') AS week_day FROM platform.duty_exclusions WHERE resource_id=ANY($1::text[]) AND week_day BETWEEN ($2::date-7) AND $3::date",[event.resourceIds,berlinWall(event.start).slice(0,10),berlinWall(event.end).slice(0,10)]);
 if(exclusionEvents(rows).some(block=>Date.parse(block.start)<Date.parse(event.end)&&Date.parse(block.end)>Date.parse(event.start)))throw new CalendarError('Eine persönliche Sperrwoche verhindert diese Bereitschaftszuordnung.',409);
}

export {dutySplit} from './split';
