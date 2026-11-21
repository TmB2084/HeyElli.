import 'server-only';
import {platformDatabase} from '@/platform/store';
import {bmaRepository} from './repository';
import {readConfig} from './configuration';
import {resolveContractLinks} from './mapping';
import type {ServiceFile} from '@/apps/servicehub/akten/model';
export function bmaStore(){return bmaRepository(platformDatabase());}
export async function enrichBmaLinks(file:ServiceFile,source:string,signal?:AbortSignal){
 if(file.kind!=='object'||file.objectType!=='TECHNISCHE_EINHEIT')return file;
 // Real source lookups never transmit fictional simulator references to BMACloud.
 try{
  const settings=await bmaStore().settings();if(!settings.enabled)return file;
  if(source!=='pds-readonly'){file.bmaNotice='BMACloud-Zuordnung ist eingerichtet und wird bei echtem PDS-Lesezugriff verwendet.';return file;}
  if(!settings.config_id)throw Error();const config=readConfig(settings.config_id);
  await resolveContractLinks(file,config,fetch,signal);
 }catch{signal?.throwIfAborted();file.bmaNotice='BMACloud-Zuordnung ist derzeit nicht verfügbar. Einrichtung prüfen lassen.';}
 return file;
}
