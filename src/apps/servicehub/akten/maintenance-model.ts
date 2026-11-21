import type {ServiceCustomer,ServiceObject} from './model.ts';
export type MaintenanceRow={id:string;contractId:string;intervalId:string;objectId:string;contract:string;title:string;description:string;due:string;closed:string;from:string;until:string;webLink?:string;issue:string};
export function maintenanceDate(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';}
export function maintenanceContext(row:Pick<MaintenanceRow,'objectId'>,objects:ServiceObject[],customers:ServiceCustomer[]){
 const byId=new Map(objects.map(item=>[item.id,item])),chain:ServiceObject[]=[],seen=new Set<string>();let item=byId.get(row.objectId);
 while(item&&!seen.has(item.id)){seen.add(item.id);chain.push(item);item=byId.get(item.parentId);}
 const direct=chain[0],unit=direct?.type==='TECHNISCHE_EINHEIT'?direct:undefined,object=chain.find(item=>item.type==='OBJEKT')??(unit?undefined:direct),customerId=chain.find(item=>item.customerId)?.customerId;
 return {customer:customers.find(item=>item.id===customerId),object,unit,address:chain.find(item=>item.address)?.address??''};
}
export function maintenanceState(row:MaintenanceRow,today:string){
 if(row.issue)return 'unknown';if(row.closed&&row.closed<=today||row.until&&row.until<today||row.from&&row.from>today)return 'inactive';
 if(!row.due)return 'unknown';return row.due<today?'overdue':row.due===today?'today':'future';
}
export function matchesMaintenance(row:MaintenanceRow,objects:ServiceObject[],customers:ServiceCustomer[],query:string){const context=maintenanceContext(row,objects,customers);const text=[row.title,row.contract,row.due,context.customer?.name,context.customer?.number,context.object?.name,context.unit?.name,context.address].join(' ').toLocaleLowerCase('de');return query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean).every(term=>text.includes(term));}
