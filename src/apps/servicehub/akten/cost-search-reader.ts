import type {ServiceSearchCost} from './model.ts';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readList,ServiceReadError} from './reader.ts';
export type CostReference={id:string;number:string;name:string};
export type ObjectCostSearch={id:string;reference:string;contractText:string;costs:ServiceSearchCost[]};
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceReadError('Ungültige Kostenträgerdaten.');return value as Record<string,unknown>;}
const text=(value:unknown)=>typeof value==='string'?value:'';
export async function readCostCatalog(api:PdsTransport):Promise<CostReference[]>{
 const rows=(await Promise.all([readList(api,'/administration/listkostentraeger'),readList(api,'/administration/listkostenstelle')])).flat(),map=new Map<string,CostReference>();
 for(const item of rows){const entry={id:text(item.uuid),number:text(item.nummer),name:text(item.bezeichnung)};if(!entry.id)throw new ServiceReadError('Kennung des Kostenträgers fehlt.');const previous=map.get(entry.id);if(previous&&(previous.number!==entry.number||previous.name!==entry.name))throw new ServiceReadError('Kostenreferenz nicht eindeutig.');map.set(entry.id,entry);}
 const result=[...map.values()];if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)throw new ServiceReadError('Kostenträgerkatalog überschreitet das Suchbudget.',413);return result;
}
export async function readObjectCosts(api:PdsTransport,ids:string[],signal?:AbortSignal):Promise<ObjectCostSearch[]>{
 if(ids.length>12||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id||id.length>200||/[\x00-\x1f]/.test(id)))throw new ServiceReadError('Ungültige Kostenträgerauswahl.',400);
 const result=await api.request('POST','/objekt/detailsbatch',{uuids:ids});if(!Array.isArray(result)||result.length!==ids.length)throw new ServiceReadError('Unvollständige Objektzuordnung für die Kostenträgersuche.');
 const found=result.map(row);if(new Set(found.map(item=>item.uuid)).size!==ids.length||found.some(item=>!ids.includes(text(item.uuid))))throw new ServiceReadError('Unvollständige Objektzuordnung für die Kostenträgersuche.');
 const output:ObjectCostSearch[]=[];
 for(let offset=0;offset<found.length;offset+=3){signal?.throwIfAborted();output.push(...await Promise.all(found.slice(offset,offset+3).map(async item=>{
  const contracts=await api.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:item.uuid});if(!Array.isArray(contracts)||contracts.length>1000||Buffer.byteLength(JSON.stringify(contracts))>1024*1024)throw new ServiceReadError('Vertragsdaten für die Kostenträgersuche unvollständig oder zu groß.');
  const mapped=contracts.flatMap(value=>{const contract=row(value);return (['wartung','rechnung'] as const).flatMap(key=>{const side=contract[key];if(side==null)return [];const cost=row(side).kstKtr;if(cost==null)return [];const carrier=row(cost),number=text(carrier.nummer),name=text(carrier.bezeichnung);return number||name?[{kind:key==='wartung'?'maintenance' as const:'billing' as const,number,name}]:[];});});
  const costs=[...new Map(mapped.map(cost=>[JSON.stringify(cost),cost])).values()],contractText=[...new Set(costs.flatMap(cost=>[cost.number,cost.name]))].join(' ');
  if(Buffer.byteLength(JSON.stringify(costs))>8192)throw new ServiceReadError('Kostenträgertexte überschreiten das Suchbudget.',413);return {id:text(item.uuid),reference:text(item.kstKtrUUID),contractText,costs};
 })));}
 signal?.throwIfAborted();return output;
}
