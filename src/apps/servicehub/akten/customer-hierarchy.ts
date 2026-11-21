import type {ServiceCustomer,ServiceObject} from './model.ts';
export function customerObjectGroups(customers:ServiceCustomer[],objects:ServiceObject[],query=''){
 const byId=new Map(objects.map(item=>[item.id,item])),terms=query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
 function ancestors(item:ServiceObject){const rows:ServiceObject[]=[],seen=new Set<string>();let current:ServiceObject|undefined=item;while(current&&!seen.has(current.id)){seen.add(current.id);rows.push(current);current=byId.get(current.parentId);}return rows;}
 const owners=new Map(objects.map(item=>[item.id,ancestors(item).find(parent=>parent.customerId)?.customerId??'']));
 const known=new Set(customers.map(customer=>customer.id));
 const groups=[...customers.map(customer=>({customer:customer as ServiceCustomer|null,objects:objects.filter(item=>owners.get(item.id)===customer.id)})),{customer:null,objects:objects.filter(item=>!known.has(owners.get(item.id)??''))}];
 return groups.flatMap(group=>{
  const customerText=group.customer?group.customer.name+' '+group.customer.number:'';
  const matched=group.objects.filter(item=>terms.every(term=>(customerText+' '+ancestors(item).map(parent=>parent.name+' '+parent.address+' '+(parent.costSearch??'')).join(' ')).toLocaleLowerCase('de').includes(term)));
  const visible=new Set(matched.flatMap(item=>ancestors(item).map(parent=>parent.id)));
  const rows=group.objects.filter(item=>visible.has(item.id));
  return rows.length||group.customer&&terms.every(term=>customerText.toLocaleLowerCase('de').includes(term))?[{...group,objects:rows}]:[];
 });
}
export function objectRoots(objects:ServiceObject[]){
 const byId=new Map(objects.map(item=>[item.id,item]));
 return objects.filter(item=>{if(!byId.has(item.parentId))return true;const chain:string[]=[],seen=new Set<string>();let current:ServiceObject|undefined=item;while(current){if(seen.has(current.id)){const cycle=chain.slice(chain.indexOf(current.id));return cycle.sort()[0]===item.id;}seen.add(current.id);chain.push(current.id);current=byId.get(current.parentId);}return false;});
}
