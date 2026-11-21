import type {BmaConfig} from './configuration.ts';
import {plants,plantLinks} from './transport.ts';
import type {ServiceFile} from '../../apps/servicehub/akten/model.ts';
export async function resolveContractLinks(file:ServiceFile,config:BmaConfig,transport:typeof fetch=fetch,signal?:AbortSignal){
 const numbers=[...new Set((file.contracts??[]).map(contract=>contract.maintenanceCostCarrier?.number).filter((value):value is string=>!!value))];
  if(numbers.length>30){file.bmaNotice='Zu viele Wartungskostenträger für eine Anlagenzuordnung. Bitte die Vertragszuordnungen prüfen.';return file;}
  const results=new Map<string,{links:ReturnType<typeof plantLinks>;error?:string}>();
  for(let index=0;index<numbers.length;index+=3)await Promise.all(numbers.slice(index,index+3).map(async number=>{signal?.throwIfAborted();try{results.set(number,{links:plantLinks(config,await plants(config,number,transport,signal))});}catch{signal?.throwIfAborted();results.set(number,{links:[],error:'BMACloud-Zuordnung konnte nicht geladen werden. Verbindung in den Einstellungen prüfen lassen.'});}}));
  signal?.throwIfAborted();
  for(const contract of file.contracts??[]){const number=contract.maintenanceCostCarrier?.number;contract.bma=number?results.get(number):{links:[],error:'Kein Wartungskostenträger mit Nummer zugeordnet.'};}
 return file;
}
