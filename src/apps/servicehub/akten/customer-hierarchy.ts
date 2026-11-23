import type {ServiceCustomer,ServiceObject} from './model.ts';
export function ancestors(item:ServiceObject,byId:Map<string,ServiceObject>){
 const rows:ServiceObject[]=[],seen=new Set<string>();
 let current:ServiceObject|undefined=item;
 while(current&&!seen.has(current.id)){
  seen.add(current.id);
  rows.push(current);
  current=byId.get(current.parentId);
 }
 return rows;
}
export function customerObjectGroups(customers:ServiceCustomer[],objects:ServiceObject[],query=''){
 const byId=new Map(objects.map(item=>[item.id,item])),terms=query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
 const owners=new Map(objects.map(item=>[item.id,ancestors(item,byId).find(parent=>parent.customerId)?.customerId??'']));
 const known=new Set(customers.map(customer=>customer.id));
 const groups=[...customers.map(customer=>({customer:customer as ServiceCustomer|null,objects:objects.filter(item=>owners.get(item.id)===customer.id)})),{customer:null,objects:objects.filter(item=>!known.has(owners.get(item.id)??''))}];
 return groups.flatMap(group=>{
  const customerText=group.customer?group.customer.name+' '+group.customer.number:'';
  const matched=group.objects.filter(item=>terms.every(term=>(customerText+' '+ancestors(item,byId).map(parent=>[parent.name,parent.number,parent.address,parent.costSearch].join(' ')).join(' ')).toLocaleLowerCase('de').includes(term)));
  const visible=new Set(matched.flatMap(item=>ancestors(item,byId).map(parent=>parent.id)));
  const rows=group.objects.filter(item=>visible.has(item.id));
  return rows.length||group.customer&&terms.every(term=>customerText.toLocaleLowerCase('de').includes(term))?[{...group,objects:rows}]:[];
 });
}
export function objectRoots(objects:ServiceObject[]){
 const byId=new Map(objects.map(item=>[item.id,item]));
 return objects.filter(item=>{if(!byId.has(item.parentId))return true;const chain:string[]=[],seen=new Set<string>();let current:ServiceObject|undefined=item;while(current){if(seen.has(current.id)){const cycle=chain.slice(chain.indexOf(current.id));return cycle.sort()[0]===item.id;}seen.add(current.id);chain.push(current.id);current=byId.get(current.parentId);}return false;});
}

export function orderNavigationTargets(objects:ServiceObject[],incidentObjectIds:string[]){
 const byId=new Map(objects.map(object=>[object.id,object]));
 const targets=new Set<string>();
 for(const id of incidentObjectIds){
  const object=byId.get(id);
  if(!object)continue;
  targets.add(id);
  const site=ancestors(object,byId).find(ancestor=>ancestor.type!=='TECHNISCHE_EINHEIT');
  if(site)targets.add(site.id);
 }
 return targets;
}

/** Ziele der Aktennavigation aus der sichtbaren Serviceübersicht. */
export function serviceFileNavigation(customers:ServiceCustomer[],objects:ServiceObject[],customerId:string,anchors:string[],resolveOwner:boolean,orderTargets?:ReadonlySet<string>){
 const byId=new Map(objects.map(object=>[object.id,object]));
 const trails=anchors.flatMap(id=>{const object=byId.get(id);return object?[ancestors(object,byId)]:[];});
 const owners=new Set(trails.map(trail=>trail.find(object=>object.customerId)?.customerId).filter(Boolean));
 const owner=customerId||(resolveOwner&&owners.size===1?[...owners][0]:'');
 const customer=customers.find(item=>item.id===owner)??null;
 const linked=new Set(trails.flat().map(object=>object.id));
 const candidates=objects.filter(object=>linked.has(object.id)||orderTargets?.has(object.id)||
  customer&&ancestors(object,byId).find(parent=>parent.customerId)?.customerId===customer.id);
 const choices=candidates.map(object=>{
  const parent=byId.get(object.parentId)?.name;
  const belongsToOrder=Boolean(orderTargets?.has(object.id));
  return {value:object.id,belongsToOrder,label:parent?`${object.name} · ${parent}`:object.name,unit:object.type==='TECHNISCHE_EINHEIT'};
 }).sort((left,right)=>Number(right.belongsToOrder)-Number(left.belongsToOrder)||left.label.localeCompare(right.label,'de')||left.value.localeCompare(right.value));
 return {
  customer,
  objects:choices.filter(choice=>!choice.unit),
  units:choices.filter(choice=>choice.unit),
 };
}
