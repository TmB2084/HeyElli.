export function parseCalendarDate(text:string){
 const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
 if(!match)return '';
 const day=`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
 const date=new Date(day+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
}
export const formatCalendarDate=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)?day.split('-').reverse().join('.'):'';
