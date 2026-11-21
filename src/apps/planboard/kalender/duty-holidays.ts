import {addDays,berlinWall,wallInstant} from './domain.ts';
export const dutyStates={BW:'Baden-Württemberg',BY:'Bayern',BE:'Berlin',BB:'Brandenburg',HB:'Bremen',HH:'Hamburg',HE:'Hessen',MV:'Mecklenburg-Vorpommern',NI:'Niedersachsen',NW:'Nordrhein-Westfalen',RP:'Rheinland-Pfalz',SL:'Saarland',SN:'Sachsen',ST:'Sachsen-Anhalt',SH:'Schleswig-Holstein',TH:'Thüringen'};
export type DutyHolidayOptions={enabled:boolean;state:keyof typeof dutyStates;historyYears:number;localAssumption:boolean;localCorpus:boolean;localPeace:boolean;weights:{newYear:number;christmas:number;easter:number;pentecost:number;other:number}};
export const defaultDutyHolidays:DutyHolidayOptions={enabled:false,state:'NW',historyYears:5,localAssumption:false,localCorpus:false,localPeace:false,weights:{newYear:3,christmas:3,easter:2,pentecost:2,other:1}};
export function checkDutyHolidays(value:unknown):DutyHolidayOptions{
 if(value===undefined)return {...defaultDutyHolidays,weights:{...defaultDutyHolidays.weights}};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ungültige Feiertagseinstellungen.');
 const raw=value as DutyHolidayOptions;
 const v={...raw,historyYears:raw.historyYears??5,weights:{...raw.weights,newYear:raw.weights?.newYear??3}};
 if(typeof v.enabled!=='boolean'||!Number.isInteger(v.historyYears)||v.historyYears<1||v.historyYears>10||!Object.hasOwn(dutyStates,v.state)||['localAssumption','localCorpus','localPeace'].some(key=>typeof v[key as keyof DutyHolidayOptions]!=='boolean')||!v.weights||['newYear','christmas','easter','pentecost','other'].some(key=>!Number.isInteger(v.weights[key as keyof typeof v.weights])||v.weights[key as keyof typeof v.weights]<1||v.weights[key as keyof typeof v.weights]>10))throw new Error('Bundesland und Feiertagsgewichtung (1 bis 10) prüfen.');
 return {enabled:v.enabled,state:v.state,historyYears:v.historyYears,localAssumption:v.state==='BY'&&v.localAssumption,localCorpus:['SN','TH'].includes(v.state)&&v.localCorpus,localPeace:v.state==='BY'&&v.localPeace,weights:{newYear:v.weights.newYear,christmas:v.weights.christmas,easter:v.weights.easter,pentecost:v.weights.pentecost,other:v.weights.other}};
}
export type DutyHoliday={day:string;name:string;group:keyof DutyHolidayOptions['weights'];weight:number};
export function dutyHolidays(year:number,options:DutyHolidayOptions):DutyHoliday[]{
 if(!options.enabled)return [];
 // Gregorian computus; supported planning years 2000–2100.
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
 const easter=`${year}-${String(Math.floor(n/31)).padStart(2,'0')}-${String(n%31+1).padStart(2,'0')}`,rows:DutyHoliday[]=[];
 const push=(day:string,name:string,group:DutyHoliday['group']='other')=>rows.push({day,name,group,weight:options.weights[group]});
 const fixed=(md:string,name:string,states?:string[],group:DutyHoliday['group']='other')=>{if(!states||states.includes(options.state))push(`${year}-${md}`,name,group);};
 fixed('01-01','Neujahr',undefined,'newYear');fixed('05-01','Tag der Arbeit');fixed('10-03','Tag der Deutschen Einheit');fixed('12-25','1. Weihnachtstag',undefined,'christmas');fixed('12-26','2. Weihnachtstag',undefined,'christmas');
 push(addDays(easter,-2),'Karfreitag','easter');push(easter,'Ostersonntag','easter');push(addDays(easter,1),'Ostermontag','easter');push(addDays(easter,39),'Christi Himmelfahrt');push(addDays(easter,49),'Pfingstsonntag','pentecost');push(addDays(easter,50),'Pfingstmontag','pentecost');
 fixed('01-06','Heilige Drei Könige',['BW','BY','ST']);fixed('03-08','Internationaler Frauentag',[...(year>=2019?['BE']:[]),...(year>=2023?['MV']:[])]);
 if(['BW','BY','HE','NW','RP','SL'].includes(options.state)||options.localCorpus)push(addDays(easter,60),'Fronleichnam');
 if(options.state==='SL'||options.localAssumption)fixed('08-15','Mariä Himmelfahrt');if(options.localPeace)fixed('08-08','Augsburger Friedensfest');fixed('09-20','Weltkindertag',year>=2019?['TH']:[]);fixed('10-31','Reformationstag',year===2017?Object.keys(dutyStates):['BB','MV','SN','ST','TH',...(year>=2018?['HB','HH','NI','SH']:[])]);fixed('11-01','Allerheiligen',['BW','BY','NW','RP','SL']);
 if(options.state==='SN'){const nov23=`${year}-11-23`,weekday=new Date(nov23+'T12:00:00Z').getUTCDay();push(addDays(nov23,-((weekday-3+7)%7||7)),'Buß- und Bettag');}
 return rows.sort((a,b)=>a.day.localeCompare(b.day));
}
export function dutyHolidayBurden(start:string,end:string,options:DutyHolidayOptions){
 const groups={newYear:0,christmas:0,easter:0,pentecost:0,other:0},holidays:DutyHoliday[]=[];
 if(options.enabled)for(let year=Number(berlinWall(start).slice(0,4));year<=Number(berlinWall(end).slice(0,4));year++)for(const holiday of dutyHolidays(year,options)){
 const from=Math.max(Date.parse(start),Date.parse(wallInstant(holiday.day+'T00:00'))),to=Math.min(Date.parse(end),Date.parse(wallInstant(addDays(holiday.day,1)+'T00:00')));
 if(to>from){const dayHours=(Date.parse(wallInstant(addDays(holiday.day,1)+'T00:00'))-Date.parse(wallInstant(holiday.day+'T00:00')));groups[holiday.group]+=holiday.weight*(to-from)/dayHours;holidays.push(holiday);}}
 return {points:Object.values(groups).reduce((a,b)=>a+b,0),groups,holidays};
}
