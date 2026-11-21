import 'server-only';
import {requireAppRead} from '../../../platform/app-access/route-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {serviceVisibility} from './visibility-store';
export async function serviceVisibilityRequest(input?:{owner?:unknown;source?:unknown;kind?:unknown;id?:unknown;hidden?:unknown}){
 const user=await requireAppRead('/servicehub'),api=await pdsApi();
 try{
  const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,store=serviceVisibility(platformDatabase());
  if(input&&(input.owner!==user.id||input.source!==source))throw new PlatformError('Konto oder Datenquelle wurde gewechselt. Bitte die Ansicht erneut öffnen.',409);
  const hidden=input?await store.change(user.id,source,input.kind,input.id,input.hidden):await store.read(user.id,source);
  return {owner:user.id,source,hidden};
 }finally{api.close();}
}
