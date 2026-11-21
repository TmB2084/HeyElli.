import type {ServiceCustomer,ServiceObject} from './model.ts';
import type {HiddenEntry} from './visibility-store.ts';
// Inspect the original ancestry so removing a parent cannot turn its children into roots.
export function visibleServiceEntries(customers:ServiceCustomer[],objects:ServiceObject[],hidden:HiddenEntry[]){
 const customerIds=new Set(hidden.filter(item=>item.kind==='customer').map(item=>item.id)),objectIds=new Set(hidden.filter(item=>item.kind==='object').map(item=>item.id)),byId=new Map(objects.map(item=>[item.id,item]));
 return {customers:customers.filter(item=>!customerIds.has(item.id)),objects:objects.filter(item=>{
  const seen=new Set<string>();let current:ServiceObject|undefined=item;
  while(current&&!seen.has(current.id)){seen.add(current.id);if(objectIds.has(current.id)||customerIds.has(current.customerId))return false;current=byId.get(current.parentId);}
  return true;
 })};
}
