import type {ServiceCustomer,ServiceObject} from './model.ts';
export type MaintenanceRow={id:string;contractId:string;intervalId:string;objectId:string;contract:string;title:string;description:string;due:string;closed:string;from:string;until:string;webLink?:string;issue:string};
export function maintenanceDate(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';}
export function maintenanceContext(row:Pick<MaintenanceRow,'objectId'>,objects:ServiceObject[],customers:ServiceCustomer[]){
 return indexedMaintenanceContext(row,new Map(objects.map(item=>[item.id,item])),id=>customers.find(item=>item.id===id));
}
export function indexedMaintenanceContext(row:Pick<MaintenanceRow,'objectId'>,byId:Map<string,ServiceObject>,findCustomer:(id:string)=>ServiceCustomer|undefined){
 const chain:ServiceObject[]=[],seen=new Set<string>();let item=byId.get(row.objectId);
 while(item&&!seen.has(item.id)){seen.add(item.id);chain.push(item);item=byId.get(item.parentId);}
 const direct=chain[0],unit=direct?.type==='TECHNISCHE_EINHEIT'?direct:undefined,object=chain.find(item=>item.type==='OBJEKT')??(unit?undefined:direct),customerId=chain.find(item=>item.customerId)?.customerId;
 return {customer:customerId?findCustomer(customerId):undefined,object,unit,address:chain.find(item=>item.address)?.address??''};
}
export function maintenanceState(row:MaintenanceRow,today:string){
 if(row.issue)return 'unknown';if(row.closed&&row.closed<=today||row.until&&row.until<today||row.from&&row.from>today)return 'inactive';
 if(!row.due)return 'unknown';return row.due<today?'overdue':row.due===today?'today':'future';
}
export function isDueMaintenance(row:MaintenanceRow,today:string){
 const state=maintenanceState(row,today);
 return state==='overdue'||state==='today';
}
export function maintenanceSearchText(row:MaintenanceRow,context:ReturnType<typeof maintenanceContext>){
 return [row.title,row.contract,row.description,row.due,context.customer?.name,context.customer?.number,
  context.object?.name,context.object?.number,context.object?.costSearch,context.unit?.name,context.unit?.number,context.unit?.costSearch,context.address].join(' ');
}
export function matchesMaintenance(row:MaintenanceRow,objects:ServiceObject[],customers:ServiceCustomer[],query:string){
 const text=maintenanceSearchText(row,maintenanceContext(row,objects,customers)).toLocaleLowerCase('de');
 return query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean).every(term=>text.includes(term));
}
