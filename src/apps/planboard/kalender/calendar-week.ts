// ISO 8601: weeks begin Monday; week 1 contains the first Thursday.
export function calendarWeek(day:string){
 const date=new Date(day+"T12:00:00Z");
 date.setUTCDate(date.getUTCDate()+3-(date.getUTCDay()+6)%7);
 const year=date.getUTCFullYear(),first=new Date(Date.UTC(year,0,4,12));
 first.setUTCDate(first.getUTCDate()+3-(first.getUTCDay()+6)%7);
 return {year,week:1+Math.round((date.getTime()-first.getTime())/604800000)};
}
export function calendarWeekLabel(from:string,to=from){
 const start=calendarWeek(from),end=calendarWeek(to);
 if(start.year!==end.year)return `KW ${start.week}/${start.year} – KW ${end.week}/${end.year}`;
 return start.week===end.week?`KW ${start.week}`:`KW ${start.week}–${end.week}`;
}
