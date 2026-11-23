import 'server-only';
import {requireAppRead} from '../../../platform/app-access/route-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {serviceFlags} from './flag-store';

// Persönlicher Plattformweg. Die Identität kommt aus der geprüften Sitzung.
export async function serviceFlagRequest(input?:{owner?:unknown;source?:unknown;id?:unknown;flagged?:unknown}){
 const user=await requireAppRead('/servicehub'),api=await pdsApi();
 try{
  const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId;
  if(input&&(input.owner!==user.id||input.source!==source))throw new PlatformError('Konto oder Datenquelle wurde gewechselt. Bitte die Ansicht erneut öffnen.',409);
  const store=serviceFlags(platformDatabase());
  const flagged=input?await store.change(user.id,source,input.id,input.flagged):await store.read(user.id,source);
  return {owner:user.id,source,flagged};
 }finally{api.close();}
}
