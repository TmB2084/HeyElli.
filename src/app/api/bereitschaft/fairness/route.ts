import {withRouteAccess} from '@/platform/app-access/route-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,permitted} from '@/platform/session';
import {dutyResourcePreferenceStore} from '@/apps/dutyboard/server';
import {readDutyYear} from '@/apps/planboard/kalender/duty-server';
import {dutyWeeks} from '@/apps/planboard/kalender/duty';
import {dutyFairness,fairnessStart} from '@/apps/planboard/kalender/duty-fairness';
const headers={'Cache-Control':'no-store'};
async function scopedGET(request:Request){try{await requireSimulatorWrites();}catch{return Response.json({error:"Bereitschaftsplanung und Mitarbeiterzuordnungen sind für diese Quelle noch nicht freigegeben."},{status:409});}
 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte anmelden.'},{status:user?403:401,headers});
 try{const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2000||year>2100)throw new Error('Ungültiges Planungsjahr.');
  const saved=await dutyResourcePreferenceStore().readHolidays(user.id),data=await readDutyYear(year,saved.holidays.historyYears),categories=data.categories.filter(item=>item.name.trim().toLocaleLowerCase('de')==='bereitschaft');if(categories.length!==1)throw new Error('Bereitschaftskategorie ist nicht eindeutig.');
  return Response.json({...dutyFairness(data.resources,data.events,categories[0].id,fairnessStart(year,saved.holidays.historyYears),dutyWeeks(year).at(-1)!.end,saved.holidays),settingsVersion:saved.version},{headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Fairnesskonten konnten nicht geladen werden.'},{status:400,headers});}
}

export const GET=withRouteAccess('/api/bereitschaft/fairness','GET',scopedGET);
