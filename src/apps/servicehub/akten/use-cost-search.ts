'use client';
import {useEffect,useState} from 'react';
import type {ServiceOverview,ServiceSearchCost} from './model';
import type {CostReference,ObjectCostSearch} from './cost-search-reader';
type State={key:string;text:Record<string,string>;costs:Record<string,ServiceSearchCost[]>;done:number;complete:boolean;error:string};
export function useCostSearch(data:ServiceOverview|null,active:boolean){
 const ids=JSON.stringify(data?.objects.map(item=>item.id).sort()??[]),revision=data?.costRevision??'',key=revision+':'+ids;
 const [state,setState]=useState<State>({key:'',text:{},costs:{},done:0,complete:false,error:''}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!active||!revision)return;const controller=new AbortController(),objects:string[]=JSON.parse(ids);let cancelled=false;
  async function json(part:string,batch?:string[]){const response=await fetch('/api/service?'+new URLSearchParams({part,revision,...(batch?{id:JSON.stringify(batch)}:{})}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});const value=await response.json();if(!response.ok){if(response.status===401||response.status===403)window.dispatchEvent(new Event('heyelli:session-change'));throw Error(value.error);}return value;}
  async function load(){const texts:Record<string,string>={},costs:Record<string,ServiceSearchCost[]>={};let characters=0;try{
   const result=await json('cost-catalog'),catalog=new Map<string,CostReference>((result.catalog as CostReference[]).map(item=>[item.id,item]));
   if(cancelled)return;setState({key,text:{},costs:{},done:0,complete:objects.length===0,error:''});
   for(let offset=0;offset<objects.length;offset+=12){const result=await json('cost-objects',objects.slice(offset,offset+12));if(cancelled)return;
    for(const object of result.objects as ObjectCostSearch[]){const carrier=catalog.get(object.reference);if(object.reference&&!carrier)throw Error('Ein zugeordneter Kostenträger ist derzeit nicht verfügbar.');const text=[carrier?.number,carrier?.name,object.contractText].filter(Boolean).join(' ');const entries:ServiceSearchCost[]=[...(carrier?[{kind:'own' as const,number:carrier.number,name:carrier.name}]:[]),...object.costs];characters+=text.length+JSON.stringify(entries).length;if(characters>4000000)throw Error('Suchbudget erreicht.');texts[object.id]=text;costs[object.id]=entries;}
    setState({key,text:{...texts},costs:{...costs},done:Math.min(offset+12,objects.length),complete:offset+12>=objects.length,error:''});
   }
  }catch{if(!cancelled)setState(previous=>({key,text:previous.key===key?previous.text:{},costs:previous.key===key?previous.costs:{},done:previous.key===key?previous.done:0,complete:false,error:'Kostenträger konnten nicht vollständig durchsucht werden. Die übrige Suche bleibt verfügbar.'}));}}
  const start=setTimeout(()=>void load(),300);return()=>{cancelled=true;controller.abort();clearTimeout(start);};
 },[ids,revision,key,active,retry]);
 useEffect(()=>{if(!active||!state.complete)return;const timer=setTimeout(()=>setRetry(value=>value+1),300000);return()=>clearTimeout(timer);},[active,state.complete,retry]);
 const current=state.key===key?state:null;
 return {text:current?.text??{},costs:current?.costs??{},done:current?.done??0,total:JSON.parse(ids).length,loading:active&&!!revision&&!current?.complete&&!current?.error,error:active?current?.error??'':'',retry:()=>setRetry(value=>value+1)};
}
