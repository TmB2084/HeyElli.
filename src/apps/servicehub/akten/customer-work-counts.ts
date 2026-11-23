import type {ServiceObject,ServiceOrder} from './model.ts';
import {isDueMaintenance,type MaintenanceRow} from './maintenance-model.ts';

export type WorkCounts={orders:number;maintenance:number};

export function customerWorkCounts(
 openOrders:ServiceOrder[], maintenance:MaintenanceRow[], objects:ServiceObject[], today:string,
){
 const customers=new Map<string,WorkCounts>();
 const sites=new Map<string,WorkCounts>();
 const byId=new Map(objects.map(object=>[object.id,object]));
 const trails=new Map<string,ServiceObject[]>();

 function trail(id:string){
  const cached=trails.get(id);
  if(cached)return cached;
  const path:ServiceObject[]=[],seen=new Set<string>();
  let object=byId.get(id);
  while(object&&!seen.has(object.id)){
   path.push(object);
   seen.add(object.id);
   object=byId.get(object.parentId);
  }
  trails.set(id,path);
  return path;
 }

 function increment(target:Map<string,WorkCounts>,id:string,field:keyof WorkCounts){
  if(!id)return;
  const counts=target.get(id)??{orders:0,maintenance:0};
  counts[field]++;
  target.set(id,counts);
 }

 for(const order of openOrders){
  increment(customers,order.customerId,'orders');
  const sitesForOrder=new Set(order.incidents.flatMap(incident=>trail(incident.objectId).map(site=>site.id)));
  for(const id of sitesForOrder)increment(sites,id,'orders');
 }

 for(const row of maintenance){
  if(!isDueMaintenance(row,today))continue;
  const sitesForMaintenance=trail(row.objectId);
  const customerId=sitesForMaintenance.find(site=>site.customerId)?.customerId;
  if(customerId)increment(customers,customerId,'maintenance');
  for(const site of sitesForMaintenance)increment(sites,site.id,'maintenance');
 }

 return {customers,sites};
}
