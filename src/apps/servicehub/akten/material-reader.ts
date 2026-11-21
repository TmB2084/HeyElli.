import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readCore,ServiceReadError} from './reader.ts';
import {dispatchId} from './dispatch-reader.ts';
import type {MaterialList,MaterialGroup,MaterialPosition} from './material-model.ts';
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceReadError('Unvollständige Positionsdaten aus PDS.');return value as Record<string,unknown>;};
function text(value:unknown,max=400){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw new ServiceReadError('Positionsbeschreibung ist ungültig oder überschreitet das Lesebudget.',413);return value.trim();}
export function projectMaterials(raw:unknown):MaterialList{
 const root=object(raw),levels=root.ebenen;if(levels===undefined)return {groups:[],count:0};if(!Array.isArray(levels)||levels.length>100)throw new ServiceReadError('Die Einsatzzuordnungen überschreiten das Positionsbudget.',413);
 const groups:MaterialGroup[]=[],seenGroups=new Set<string>();let count=0,bytes=0;
 for(const value of levels){const level=object(value),id=dispatchId(level.uuid);if(seenGroups.has(id))throw new ServiceReadError('Die Einsatzzuordnung ist nicht eindeutig.');seenGroups.add(id);const group:MaterialGroup={id,objectId:level.objektUUID==null||level.objektUUID===''?'':dispatchId(level.objektUUID),provided:level.positionen!==undefined,rows:[],error:''},seen=new Set<string>();
  function visit(values:unknown,parentId:string,depth:number){if(!Array.isArray(values))throw new ServiceReadError('PDS liefert keine gültige Positionsliste.');if(depth>8&&values.length)throw new ServiceReadError('Mehr als acht Unterpositionsebenen. Die Positionsliste ist unvollständig.',413);for(const raw of values){if(++count>1000)throw new ServiceReadError('Mehr als 1.000 Positionen. Das Positionsbudget ist erreicht.',413);const item=object(raw),positionId=dispatchId(item.uuid);if(seen.has(positionId))throw new ServiceReadError('Eine Position ist innerhalb des Einsatzes mehrfach zugeordnet.');seen.add(positionId);
   const issues:string[]=[];function quantity(value:unknown,label:string){if(value===undefined||value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER){issues.push(label+' aus PDS ist nicht verlässlich lesbar.');return null;}return value;}
   const row:MaterialPosition={id:positionId,parentId,depth,number:text(item.nummer,100),name:text(item.name),shortText:text(item.kurztext,2000),longText:text(item.langtext,16000),extraText:text(item.zusatztext,8000),type:text(item.positionsTyp,80),variant:text(item.positionsArt,80),quantity:quantity(item.menge,'Menge'),totalQuantity:quantity(item.gesamtMenge,'Gesamtmenge'),unit:item.masseinheit==null?'':text(object(item.masseinheit).bezeichnung,100),orderNumber:text(item.bestellnummer,160),manufacturerNumber:text(item.herstellernummer,160),ean:text(item.eannummer,160),ignorePart:item.teilleistungIgnorieren===true,issue:issues.join(' ')};
   bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>1024*1024)throw new ServiceReadError('Die projizierten Positionen überschreiten 1 MiB.',413);group.rows.push(row);if(item.teilleistungen!==undefined)visit(item.teilleistungen,positionId,depth+1);
  }}
  try{if(group.provided)visit(level.positionen,'',0);}catch(error){if(error instanceof ServiceReadError&&error.status===413)throw error;group.rows=[];group.error='Positionsdaten dieses Einsatzes konnten nicht vollständig geprüft werden.';}
  groups.push(group);
 }
 return {groups,count:groups.reduce((sum,group)=>sum+group.rows.length,0)};
}
export async function readMaterials(api:PdsTransport,orderId:string){const core=await readCore(api,'order',dispatchId(orderId));if(core.row.rootEbene===undefined)return {groups:[],count:0,notice:'PDS liefert zu diesem Auftrag keine Einsatz- oder Positionsliste.'};const result=projectMaterials(core.row.rootEbene);return {...result,notice:result.groups.length?'':'PDS liefert zu diesem Auftrag keine Einsatz- oder Positionsliste.'};}
