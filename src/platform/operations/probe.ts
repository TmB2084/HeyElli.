import type {Pool} from 'pg';
import type {WebProbeHost} from './web-probe.ts';
import {randomUUID} from 'node:crypto';
import {collectSample} from './collector.ts';
import {publishSample} from './repository.ts';
import {diagnostic} from './model.ts';
export type ProbeState={outage?:string};
export async function monitorTick(pool:Pool,port:number,state:ProbeState,emit:(line:string)=>void=console.error,host:WebProbeHost='localhost'){
 try{const sample=await collectSample(pool,port,host);
  if(state.outage){await publishSample(pool,{...sample,database:false},emit,{database:state.outage});state.outage=undefined;}
  return await publishSample(pool,sample,emit);
 }catch{if(!state.outage){state.outage=randomUUID();emit(diagnostic('database',state.outage,'raised'));}return ['database'];}
}
