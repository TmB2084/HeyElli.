import 'server-only';
import {adminRequest,adminBody} from '../../../system/einstellungen';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {pdsApi} from '../../../platform/pds/connection/api';
import {incidentDefaults} from './repository';
import {searchArticles,resolvePositions} from './catalog';
export async function incidentDefaultsRequest(request:Request){const {user}=await adminRequest(request.method==='POST'?request:undefined),api=await pdsApi();try{const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,store=incidentDefaults(platformDatabase()),url=new URL(request.url);
 if(request.method==='GET'){if(url.searchParams.has('q'))return {source,...await searchArticles(api.transport,url.searchParams.get('q')??'',Number(url.searchParams.get('page')??0))};return {source,...await store.read(source)};}
 const raw=await adminBody(request) as Record<string,unknown>;if(!raw||raw.source!==source)throw new PlatformError('Die Datenquelle wurde gewechselt. Eingaben bleiben erhalten; bitte die Einstellungen erneut öffnen.',409);const positions=await resolvePositions(api.transport,raw.positions);return {source,...await store.save(user.id,source,raw.version,positions)};
 }finally{api.close();}}
export async function standardPositionsForNewOrder(){return (await incidentDefaults(platformDatabase()).read('simulator')).positions;}
