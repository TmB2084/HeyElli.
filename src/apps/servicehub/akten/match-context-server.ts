import 'server-only';
import {createHash} from 'node:crypto';
import {pdsApi} from '../../../platform/pds/connection/api';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readOverview,ServiceReadError} from './reader';
import {readCostCatalog,readObjectCosts} from './cost-search-reader';
// Zuordnungsdaten für MailDesk: Kunden, Objekte mit Adresse, Aufträge und Kostenträgernummern je Objekt.
// Nur lesend über die dokumentierte PDS-API; kurz je Datenquelle zwischengespeichert, keine Persistenz.
export type ServiceMatchContext={source:string;sourceRevision:string;loadedAt:string;
 customers:{id:string;name:string;number:string}[];objects:{id:string;customerId:string;parentId:string;name:string;address:string}[];
 orders:{id:string;number:string;customerId:string;objectId:string;title:string;status:string;unplanned?:boolean;technicianIds?:string[];nextStart?:string}[];costs:{number:string;objectIds:string[]}[]};
const TTL=5*60*1000,MAX_OBJECTS=6000,cache=new Map<string,{at:number;value:Promise<ServiceMatchContext>}>();
async function build(api:Awaited<ReturnType<typeof pdsApi>>,source:string,signal:AbortSignal):Promise<ServiceMatchContext>{
 const transport:PdsTransport={request:(method,path,body)=>{signal.throwIfAborted();return api.transport.request(method,path,body,{signal});}};
 const overview=await readOverview(transport);
 if(overview.objects.length>MAX_OBJECTS)throw new ServiceReadError('Zu viele Objekte für die automatische Zuordnung.',413);
 const catalog=new Map((await readCostCatalog(transport)).map(item=>[item.id,item])),costs=new Map<string,Set<string>>();
 const add=(number:string,objectId:string)=>{const key=number.trim();if(!key)return;let set=costs.get(key);if(!set)costs.set(key,set=new Set());set.add(objectId);};
 const ids=overview.objects.map(item=>item.id);
 for(let offset=0;offset<ids.length;offset+=12){for(const entry of await readObjectCosts(transport,ids.slice(offset,offset+12),signal)){const own=catalog.get(entry.reference);if(own)add(own.number,entry.id);for(const cost of entry.costs)add(cost.number,entry.id);}}
 return {source,sourceRevision:createHash('sha256').update(JSON.stringify(api.source)).digest('hex'),loadedAt:new Date().toISOString(),customers:overview.customers,
  objects:overview.objects.map(item=>({id:item.id,customerId:item.customerId||overview.objects.find(parent=>parent.id===item.parentId)?.customerId||'',parentId:item.parentId,name:item.name,address:item.address})),
  orders:overview.orders.map(order=>({id:order.id,number:order.number,customerId:order.customerId,objectId:order.incidents[0]?.objectId??'',title:order.title,status:order.status,unplanned:order.incidents.some(incident=>!incident.start),technicianIds:[...new Set(order.incidents.flatMap(incident=>incident.technicianId?[incident.technicianId]:[]))],nextStart:order.incidents.map(incident=>incident.start).filter(Boolean).sort()[0]})),
  costs:[...costs].map(([number,set])=>({number,objectIds:[...set]}))};
}
export async function serviceMatchContext(fresh=false):Promise<ServiceMatchContext>{
 const api=await pdsApi(),source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,cached=cache.get(source);
 if(cached&&!fresh&&Date.now()-cached.at<TTL){api.close();return cached.value;}
 const value=build(api,source,AbortSignal.timeout(60000)).finally(()=>api.close());
 cache.set(source,{at:Date.now(),value});value.catch(()=>{if(cache.get(source)?.value===value)cache.delete(source);});
 return value;
}
