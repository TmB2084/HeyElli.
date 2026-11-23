'use client';
import {PopoverItem} from '@/platform/ui';
import {PopUpButton} from '@/platform/shell';
import {FilterCapsule} from './list-controls';

export const orderPlanningOptions=[
 {value:'unplanned',label:'Ohne Termin',icon:'alert'},
 {value:'unassigned',label:'Ohne Techniker',icon:'user'},
 {value:'today',label:'Heute',icon:'cal'},
 {value:'all',label:'Alle',icon:'inbox'},
];

export function OrderFlagIcon(){
 return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4m0 1c3-4 9 4 14 0v10c-5 4-11-4-14 0"/></svg>;
}

export function OrderFilters({filter,status,marked,paused,statuses,onChange,onToggle}:{
 filter:string;status:string;marked:boolean;paused:boolean;statuses:string[];
 onChange:(values:Record<string,string|null>)=>void;onToggle:(paused:boolean)=>void;
}){
 const configured=filter!=='all'||!!status||marked;
 return <FilterCapsule label="Auftragsfilter" configured={configured} paused={paused} onToggle={onToggle}>{()=> <>
   <div><span>Planung</span><PopUpButton label="Planung" value={filter} options={orderPlanningOptions} align="right" onChange={value=>onChange({filter:value==='all'?null:value})}/></div>
   <div><span>Auftragsstatus</span><PopUpButton label="Status" value={status} options={[{value:'',label:'Alle Status'},...statuses.map(value=>({value,label:value}))]} align="right" onChange={value=>onChange({status:value||null})}/></div>
   <PopoverItem aria-pressed={marked} onClick={()=>onChange({markiert:marked?null:'1'})}><OrderFlagIcon/>Markiert</PopoverItem>
   {configured&&<PopoverItem onClick={()=>onChange({filter:null,status:null,markiert:null})}>Filter zurücksetzen</PopoverItem>}
 </>}</FilterCapsule>;
}
