import 'server-only';
import {requireAppRead} from '../../../platform/app-access/route-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {servicePins} from './pin-store';
// Persönlicher Plattformweg: liest und ändert ausschließlich die eigenen angehefteten Kunden der aktiven Datenquelle.
export async function servicePinRequest(input?:{owner?:unknown;source?:unknown;id?:unknown;pinned?:unknown}){
 const user=await requireAppRead('/servicehub'),api=await pdsApi();
 try{
  const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,store=servicePins(platformDatabase());
  if(input&&(input.owner!==user.id||input.source!==source))throw new PlatformError('Konto oder Datenquelle wurde gewechselt. Bitte die Ansicht erneut öffnen.',409);
  const pinned=input?await store.change(user.id,source,input.id,input.pinned):await store.read(user.id,source);
  return {owner:user.id,source,pinned};
 }finally{api.close();}
}
