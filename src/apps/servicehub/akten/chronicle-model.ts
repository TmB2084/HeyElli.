import {maintenanceDate} from './maintenance-model.ts';
export type ChronicleKind='service'|'maintenance'|'report';
export type ChronicleEntry={id:string;kind:ChronicleKind;title:string;date:string;dateKind:'Termin'|'Fälligkeit'|'Dokumentdatum'|'Geändert';detail:string;origin:string;url?:string;orderId?:string;orderNumber?:string;orders?:{id:string;number:string}[]};
export function chronicleDate(value:unknown){if(typeof value!=='string')return '';if(maintenanceDate(value))return value;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))||Number(value.slice(11,13))>23||!maintenanceDate(value.slice(0,10)))return '';return value;}
export function chronicleEntries(rows:ChronicleEntry[]){
 const entries=new Map<string,ChronicleEntry>();for(const row of rows){const previous=entries.get(row.id);if(previous?.orders&&row.orders){entries.set(row.id,{...previous,orders:[...new Map([...previous.orders,...row.orders].map(order=>[order.id,order])).values()]});}else entries.set(row.id,row);}
 return [...entries.values()].sort((a,b)=>{if(!a.date)return b.date?1:a.id.localeCompare(b.id);if(!b.date)return -1;return Date.parse(b.date.length===10?b.date+'T12:00:00Z':b.date)-Date.parse(a.date.length===10?a.date+'T12:00:00Z':a.date)||a.id.localeCompare(b.id);});
}
