'use client';
import {useEffect,useState} from 'react';
import type {ServiceOverview} from './model';
import type {MaintenanceRow} from './maintenance-model';
type State={key:string;rows:MaintenanceRow[];done:number;loading:boolean;error:string};
export function useMaintenance(data:ServiceOverview){
 const ids=JSON.stringify(data.objects.map(item=>item.id).sort()),revision=data.costRevision??'',key=revision+':'+ids;
 const [state,setState]=useState<State>({key:'',rows:[],done:0,loading:true,error:''}),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!revision)return;const controller=new AbortController(),objects:string[]=JSON.parse(ids);let disposed=false;
  async function load(){const rows=new Map<string,MaintenanceRow>();let done=0;setState(old=>({key,rows:old.key===key?old.rows:[],done:0,loading:true,error:''}));
   try{for(const id of objects){let cursor=0,indexRevision='';do{
    const response=await fetch('/api/service?'+new URLSearchParams({part:'maintenance',id,revision,cursor:String(cursor),indexRevision}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])}),value=await response.json();
    if(!response.ok){if(response.status===401||response.status===403)window.dispatchEvent(new Event('heyelli:session-change'));throw Error(value.error);}
    if(disposed)return;if(!Array.isArray(value.rows)||!Number.isSafeInteger(value.nextCursor)&&value.nextCursor!==null||value.nextCursor!==null&&value.nextCursor<=cursor)throw Error('Ungültige Wartungsseite.');
    for(const row of value.rows as MaintenanceRow[]){rows.set(row.id,row);if(rows.size>20000)throw Error('Zu viele Wartungen.');}if(JSON.stringify([...rows.values()]).length>4000000)throw Error('Suchbudget erreicht.');
    indexRevision=value.revision;cursor=value.nextCursor;
   }while(cursor!==null);done++;if(disposed)return;setState(old=>({key,rows:done===objects.length?[...rows.values()]:[...new Map([...(old.key===key?old.rows:[]),...rows.values()].map(row=>[row.id,row])).values()],done,loading:done<objects.length,error:''}));}
   if(!disposed)setState({key,rows:[...rows.values()],done,loading:false,error:''});
   }catch{if(!disposed)setState(old=>({key,rows:old.key===key?old.rows:[],done,loading:false,error:'Wartungen konnten nicht vollständig geladen werden. Die angezeigten Ergebnisse sind unvollständig.'}));}
  }
  const initial=setTimeout(()=>void load(),0);return()=>{disposed=true;controller.abort();clearTimeout(initial);};
 },[ids,key,revision,refresh]);
 useEffect(()=>{if(state.loading||state.error||state.key!==key)return;const timer=setTimeout(()=>setRefresh(value=>value+1),60000);return()=>clearTimeout(timer);},[state.loading,state.error,state.key,key,refresh]);
 const current=state.key===key?state:null;return {rows:current?.rows??[],loading:current?.loading??true,error:current?.error??'',done:current?.done??0,total:JSON.parse(ids).length,reload:()=>setRefresh(value=>value+1)};
}
