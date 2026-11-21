import type {ServiceSearchCost} from './model.ts';
export function matchingCosts(costs:ServiceSearchCost[],query:string){
 const terms=query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);if(!terms.length)return [];
 const rows=costs.map(cost=>({cost,value:[cost.number,cost.name].join(' ').toLocaleLowerCase('de')}));
 // Customer/address terms may contribute elsewhere in the same hierarchical hit.
 const relevant=terms.filter(term=>rows.some(row=>row.value.includes(term)));if(!relevant.length)return [];
 const exact=rows.filter(row=>relevant.every(term=>row.value.includes(term)));
 return (exact.length?exact:rows.filter(row=>relevant.some(term=>row.value.includes(term)))).map(row=>row.cost);
}
export function costKindLabel(kind:ServiceSearchCost['kind']){return kind==='maintenance'?'Wartung':kind==='billing'?'Rechnung':'Kostenträger';}
