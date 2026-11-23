import {ancestors} from './customer-hierarchy';
import {indexedMaintenanceContext,maintenanceSearchText,type MaintenanceRow} from './maintenance-model';
import {type ServiceCustomer,type ServiceObject,type ServiceOrder} from './model';

type SearchIcon='order'|'customer'|'object'|'unit';
export type CockpitHit={
 kind:'order'|'maintenance'|'customer'|'object';id:string;title:string;description:string;icon:SearchIcon;score:number;
};
const categories=[
 {key:'orders',label:'Aufträge',item:'Auftrag'},
 {key:'maintenance',label:'Wartungen',item:'Wartung'},
 {key:'customers',label:'Kunden',item:'Kunde'},
 {key:'objects',label:'Objekte',item:'Objekt'},
 {key:'units',label:'Technische Einheiten',item:'Technische Einheit'},
] as const;
type Category=typeof categories[number];
export type CockpitSearchGroup=Category&{hits:CockpitHit[]};

const normalized=(value:string)=>value.trim().toLocaleLowerCase('de');
export function serviceSearchTerms(query:string){return normalized(query).split(/\s+/).filter(Boolean);}
function includesTerms(text:string,terms:string[]){
 const haystack=normalized(text);
 return terms.every(term=>haystack.includes(term));
}

export function matchesOrderSearch(order:ServiceOrder,objects:Map<string,ServiceObject>,customer:ServiceCustomer|undefined,terms:string[]){
 if(!terms.length)return true;
 return includesTerms([order.number,order.title,order.status,customer?.name,customer?.number,
  ...order.incidents.flatMap(item=>{
   const object=objects.get(item.objectId);
   const place=object?ancestors(object,objects).map(entry=>[entry.name,entry.number,entry.address,entry.costSearch].join(' ')):[];
   return [item.work,item.technician,...item.companions,...place];
  })].join(' '),terms);
}

export function cockpitSearch(query:string,orders:ServiceOrder[],maintenance:MaintenanceRow[],allObjects:Map<string,ServiceObject>,allCustomers:Map<string,ServiceCustomer>,
 visible:{customers:ServiceCustomer[];objects:ServiceObject[]}){
 const terms=serviceSearchTerms(query),needle=terms.join(' ');
 const groups:CockpitSearchGroup[]=categories.map(category=>({...category,hits:[]}));
 if(!terms.length)return groups;
 const groupByKey=new Map(groups.map(group=>[group.key,group]));
 function add(key:Category['key'],hit:Omit<CockpitHit,'score'|'description'>,description:string,primary:string[]){
  const fields=primary.filter(Boolean).map(normalized);
  const score=fields.includes(needle)?3:fields.some(field=>field.startsWith(needle))?2:includesTerms(fields.join(' '),terms)?1:0;
  const group=groupByKey.get(key)!;
  group.hits.push({...hit,description:[group.item,description].filter(Boolean).join(' · '),score});
 }
 for(const row of orders){
  const customer=allCustomers.get(row.customerId);
  if(matchesOrderSearch(row,allObjects,customer,terms))add('orders',{
   kind:'order',id:row.id,title:[row.number,row.title].filter(Boolean).join(' · '),icon:'order',
  },customer?.name??'',[row.number,row.title]);
 }
 for(const row of maintenance){
  const place=indexedMaintenanceContext(row,allObjects,id=>allCustomers.get(id));
  if(includesTerms(maintenanceSearchText(row,place),terms))add('maintenance',{kind:'maintenance',id:row.id,title:row.title,icon:'unit'},
   [place.unit?.name??place.object?.name,place.customer?.name].filter(Boolean).join(' · '),[row.title,row.contract]);
 }
 for(const row of visible.customers){
  if(includesTerms([row.name,row.number].join(' '),terms))add('customers',{kind:'customer',id:row.id,title:row.name,icon:'customer'},row.number,[row.name,row.number]);
 }
 const visibleById=new Map(visible.objects.map(row=>[row.id,row]));
 for(const row of visible.objects){
  const trail=ancestors(row,visibleById);
  const owner=allCustomers.get(trail.find(item=>item.customerId)?.customerId??'');
  if(!includesTerms([owner?.name,owner?.number,...trail.map(item=>[item.name,item.number,item.address,item.costSearch].join(' '))].join(' '),terms))continue;
  const unit=row.type==='TECHNISCHE_EINHEIT';
  add(unit?'units':'objects',{kind:'object',id:row.id,title:row.name,icon:unit?'unit':'object'},
   [row.number,trail[1]?.name||owner?.name||row.address].filter(Boolean).join(' · '),[row.name,row.number??'']);
 }
 for(const group of groups)group.hits.sort(compareCockpitHits);
 return groups;
}

export function compareCockpitHits(a:CockpitHit,b:CockpitHit){
 return b.score-a.score||a.title.localeCompare(b.title,'de',{numeric:true});
}
