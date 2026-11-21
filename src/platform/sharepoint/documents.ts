import {appRoleRepository} from '../app-access/repository.ts';
import type {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {PlatformError} from '../store/model.ts';
import {readConfig,libraryKey,safeLink} from './configuration.ts';
import {graph,type DriveItem} from './transport.ts';
import {locationSegments,remoteFileName,usesStorageTypes,folderName,type DocumentLocation,type StorageType} from './layout.ts';
export const FILE_LIMIT=8388608;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateFile(name:string,bytes:Uint8Array){
 if(!name||name.length>160||/[\\/:*?"<>|\x00-\x1f\x7f]/.test(name)||name!==name.trim()||name.endsWith('.'))throw new PlatformError('Dateiname ungültig. Maximal 160 Zeichen ohne Pfad- oder Sonderzeichen.');if(!bytes.length||bytes.length>FILE_LIMIT)throw new PlatformError('Datei muss zwischen 1 Byte und 8 MiB groß sein.',413);
 const ext=name.split('.').at(-1)?.toLowerCase(),prefix=Buffer.from(bytes.subarray(0,8)),valid=ext==='pdf'?prefix.subarray(0,5).toString()==='%PDF-':ext==='png'?prefix.equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='jpg'||ext==='jpeg'?prefix[0]===255&&prefix[1]===216&&prefix[2]===255:ext==='docx'||ext==='xlsx'?prefix.subarray(0,4).equals(Buffer.from([80,75,3,4])):ext==='txt'?!bytes.includes(0):false;
 if(!valid)throw new PlatformError('Nur PDF, PNG, JPEG, DOCX, XLSX oder Text mit passendem Dateiformat hochladen.');if(ext==='txt')try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new PlatformError('Textdatei muss UTF-8 enthalten.');}
}
export const scopeKey=(source:string,kind:string,id:string,contractId='')=>createHash('sha256').update(JSON.stringify([source,kind,id,contractId])).digest('hex');
export function documentRepository(pool:Pool,transport:typeof fetch=fetch){
 async function settings(){const row=(await pool.query("SELECT * FROM platform.sharepoint_settings WHERE id='central'")).rows[0];if(!row)throw new PlatformError('SharePoint-Datenbankeinrichtung fehlt.',503);return row;}
 function publicItem(item:DriveItem,config:ReturnType<typeof readConfig>,name?:string){const url=safeLink(item.webUrl,config);return {id:item.id,name:name??item.name,size:item.size,modified:item.lastModifiedDateTime??null,url};}
 return {
  // Ablagetypen pflegen (nur Administratoren): umbenennen, ergänzen, ausblenden, sortieren. Löschen gibt es nicht,
  // damit vorhandene Ablagen zugeordnet bleiben. Bestehende Ordner behalten ihren Namen; die Zuordnung bleibt über die Ordnerkennung.
  async saveStorageTypes(actor:string,input:unknown){
   if(!Array.isArray(input)||!input.length||input.length>30)throw new PlatformError('Bitte 1 bis 30 Ablagetypen angeben.');
   const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled||user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);
    const before=(await client.query('SELECT key,label,sort,active FROM platform.sharepoint_storage_types ORDER BY sort,label FOR UPDATE')).rows as StorageType[],seen=new Set<string>();
    for(const [index,raw] of input.entries()){const value=raw as Record<string,unknown>,label=typeof value.label==='string'?value.label.trim():'';if(!label||label.length>60||folderName(label,'')!==label)throw new PlatformError(`Ablagetyp „${label||'leer'}“: 1–60 Zeichen ohne " * : < > ? / \\ | # %.`);
     if(seen.has(label.toLocaleLowerCase('de')))throw new PlatformError(`Ablagetyp „${label}“ ist doppelt.`);seen.add(label.toLocaleLowerCase('de'));
     let key=typeof value.key==='string'&&before.some(type=>type.key===value.key)?value.key:label.toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'typ';
     if(!before.some(type=>type.key===value.key))for(let n=2;before.some(type=>type.key===key)||(await client.query('SELECT 1 FROM platform.sharepoint_storage_types WHERE key=$1',[key])).rowCount;n++)key=key.slice(0,36)+'-'+n;
     await client.query('INSERT INTO platform.sharepoint_storage_types(key,label,sort,active,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(key) DO UPDATE SET label=excluded.label,sort=excluded.sort,active=excluded.active,updated_by=excluded.updated_by,updated_at=now()',[key,label,(index+1)*10,value.active!==false,actor]);}
    const missing=before.filter(type=>!input.some(raw=>(raw as Record<string,unknown>).key===type.key));for(const type of missing)await client.query('UPDATE platform.sharepoint_storage_types SET active=false,updated_by=$2,updated_at=now() WHERE key=$1',[type.key,actor]);
    if(!(await client.query('SELECT 1 FROM platform.sharepoint_storage_types WHERE active')).rowCount)throw new PlatformError('Mindestens ein Ablagetyp muss aktiv bleiben.');
    const after=(await client.query('SELECT key,label,sort,active FROM platform.sharepoint_storage_types ORDER BY sort,label')).rows;
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'sharepoint.storage-types.updated','sharepoint',$2::jsonb)",[actor,JSON.stringify([{field:'storageTypes',label:'SharePoint-Ablagetypen',before:before.map(type=>`${type.label}${type.active?'':' (aus)'}`),after:after.map((type:StorageType)=>`${type.label}${type.active?'':' (aus)'}`)}])]);
    await client.query('COMMIT');return after as StorageType[];
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
  // Bisherige Hash-Ablage „heyelli-<scope>“: auflisten und (nach Bestätigung) in die neue Struktur unter „Sonstiges“ verschieben.
  async legacyFolders(signal?:AbortSignal){const row=await settings();if(!row.enabled||!row.config_id)throw new PlatformError('SharePoint ist nicht freigegeben.',409);const config=readConfig(row.config_id),api=graph(config,transport,signal);
   const folders=await api.rootFolders('heyelli-');const result:{scope:string;folderId:string;files:number}[]=[];for(const folder of folders){const scope=folder.name.slice('heyelli-'.length);if(!/^[a-f0-9]{64}$/.test(scope))continue;const files=await api.children(folder.id);result.push({scope,folderId:folder.id,files:files.items.length});}return result;},
  async moveLegacy(actor:string,scope:string,location:DocumentLocation,signal?:AbortSignal){
   if(!/^[a-f0-9]{64}$/.test(scope))throw new PlatformError('Ungültige Akte.');const client=await pool.connect();let locked=false;
   try{locked=(await client.query('SELECT pg_try_advisory_lock(741963326) AS locked')).rows[0].locked;if(!locked)throw new PlatformError('SharePoint wird gerade verwendet. Bitte erneut versuchen.',429);
    const user=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1',[actor])).rows[0];if(!user?.enabled||user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);
    const row=await settings();if(!row.enabled||!row.config_id)throw new PlatformError('SharePoint ist nicht freigegeben.',409);const config=readConfig(row.config_id),library=libraryKey(config),api=graph(config,transport,signal);
    const legacy=await api.folder(scope);if(!legacy)return {moved:0};
    const segments=locationSegments(location),base=await api.ensurePath(segments,true);if(!base)throw new PlatformError('Zielordner konnte nicht angelegt werden.',503);
    let target=base;if(usesStorageTypes(location)){const type=(await client.query("SELECT key,label FROM platform.sharepoint_storage_types WHERE key='sonstiges'")).rows[0]??{key:'sonstiges',label:'Sonstiges'},name=folderName(type.label,'Sonstiges');
     target=(await api.childFolders(base.id)).find(folder=>folder.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))??api.item(await api.json(api.drive+'/items/'+encodeURIComponent(base.id)+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})}));
     await client.query('INSERT INTO platform.sharepoint_folders(library_key,scope_key,type_key,folder_id,path) VALUES($1,$2,$3,$4,$5) ON CONFLICT (library_key,scope_key,type_key) DO NOTHING',[library,scope,type.key,target.id,[...segments,name].join('/')]);}
    await client.query("INSERT INTO platform.sharepoint_folders(library_key,scope_key,type_key,folder_id,path,name_prefix) VALUES($1,$2,'',$3,$4,$5) ON CONFLICT (library_key,scope_key,type_key) DO NOTHING",[library,scope,base.id,segments.join('/'),location.namePrefix??'']);
    const files=await api.children(legacy.id);let moved=0;
    for(const file of files.items){const known=(await client.query('SELECT id,display_name FROM platform.sharepoint_uploads WHERE remote_id=$1 AND library_key=$2',[file.id,library])).rows[0];
     let name=known?remoteFileName(known.display_name,location.namePrefix??''):file.name;for(let attempt=2;await api.find(target.id,name)&&attempt<50;attempt++)name=known?remoteFileName(known.display_name,location.namePrefix??'',attempt):remoteFileName(file.name,'',attempt);
     const result=await api.move(file.id,target.id,name);moved++;
     if(known)await client.query("UPDATE platform.sharepoint_uploads SET storage_type=$2,remote_name=$3,etag=$4 WHERE id=$1",[known.id,usesStorageTypes(location)?'sonstiges':'~',result.name,result.eTag??null]);}
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'sharepoint.legacy.moved',$2,$3::jsonb)",[actor,scope.slice(0,16),JSON.stringify([{field:'folder',label:'SharePoint-Ablage übernommen',before:'heyelli-'+scope.slice(0,12)+'…',after:segments.join('/')+(usesStorageTypes(location)?'/Sonstiges':'')}])]);
    return {moved};
   }finally{if(locked)await client.query('SELECT pg_advisory_unlock(741963326)').catch(()=>{});client.release();}
  },
  async storageTypes(includeInactive=false):Promise<StorageType[]>{return (await pool.query(`SELECT key,label,sort,active FROM platform.sharepoint_storage_types ${includeInactive?'':'WHERE active'} ORDER BY sort,label`)).rows;},
  // Liste einer Akte: Ablagetypen-Ordner (feste Zuordnung bzw. Pfad), bei Aufträgen gefiltert nach Auftragsnummer,
  // dazu Dateien der bisherigen Hash-Ablage „heyelli-<scope>“, bis sie übernommen sind.
  async list(scope:string,signal?:AbortSignal,location?:DocumentLocation){const row=await settings();if(!row.enabled)return {enabled:false,items:[],truncated:false,types:[]};if(!row.config_id)throw new PlatformError('SharePoint-Zugangsdaten fehlen.',503);const config=readConfig(row.config_id),library=libraryKey(config),api=graph(config,transport,signal),types=await this.storageTypes(true);
   const mapping=(await pool.query('SELECT type_key,folder_id,path,name_prefix FROM platform.sharepoint_folders WHERE library_key=$1 AND scope_key=$2',[library,scope])).rows as {type_key:string;folder_id:string;path:string;name_prefix:string}[];
   let base:DriveItem|null=null;const prefix=mapping.find(entry=>entry.type_key==='')?.name_prefix??location?.namePrefix??'';const baseRow=mapping.find(entry=>entry.type_key==='');
   if(baseRow)base=await api.folderById(baseRow.folder_id);
   if(!base&&location){base=await api.ensurePath(locationSegments(location),false);if(base)await pool.query("INSERT INTO platform.sharepoint_folders(library_key,scope_key,type_key,folder_id,path,name_prefix) VALUES($1,$2,'',$3,$4,$5) ON CONFLICT (library_key,scope_key,type_key) DO UPDATE SET folder_id=excluded.folder_id,path=excluded.path",[library,scope,base.id,locationSegments(location).join('/'),prefix]);}
   const known=(await pool.query("SELECT id,remote_id,display_name,remote_name FROM platform.sharepoint_uploads WHERE scope_key=$1 AND library_key=$2 AND remote_id IS NOT NULL ORDER BY completed_at DESC LIMIT 500",[scope,library])).rows;
   const label=(item:DriveItem)=>known.find(entry=>entry.remote_id===item.id&&(item.name===entry.remote_name||item.name===entry.id+'-'+entry.display_name))?.display_name;
   const items:ReturnType<typeof publicItem>[]&{type?:string}[]=[];let truncated=false;
   if(base){const contract=location?.kind==='contract'||mapping.some(entry=>entry.type_key==='~');
    const folders=contract?[{folder:base,type:'Vertrag'}]:(await api.childFolders(base.id)).map(folder=>({folder,type:types.find(type=>type.label.toLocaleLowerCase('de')===folder.name.toLocaleLowerCase('de'))?.label??folder.name}));
    for(const {folder,type} of folders.slice(0,20)){const files=await api.children(folder.id);truncated||=files.truncated;for(const file of files.items)if(!prefix||file.name.startsWith(prefix))items.push({...publicItem(file,config,label(file)),type});}}
   const legacy=await api.folder(scope);if(legacy){const files=await api.children(legacy.id);truncated||=files.truncated;for(const file of files.items)items.push({...publicItem(file,config,label(file)),type:'Bisherige Ablage'});}
   return {enabled:true,library,folderUrl:base?safeLink(base.webUrl,config):legacy?safeLink(legacy.webUrl,config):null,items:items.slice(0,100),truncated:truncated||items.length>100,types:types.filter(type=>type.active).map(type=>({key:type.key,label:type.label}))};},
  async upload(actor:string,scope:string,requestId:string,name:string,bytes:Uint8Array,signal?:AbortSignal,target?:{location:DocumentLocation;typeKey:string}){
   if(!uuid.test(requestId)||! /^[a-f0-9]{64}$/.test(scope))throw new PlatformError('Uploadkennung ungültig.');validateFile(name,bytes);const hash=createHash('sha256').update(bytes).digest('hex'),client=await pool.connect();let locked=false;
   try{
    locked=(await client.query('SELECT pg_try_advisory_lock(741963326) AS locked')).rows[0].locked;if(!locked)throw new PlatformError('SharePoint wird gerade verwendet oder eingerichtet. Denselben Upload erneut versuchen.',429);
    const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Bitte zuerst anmelden.',401);if(!await appRoleRepository(pool).can(actor,'/servicehub','write'))throw new PlatformError('Schreibrecht im Service erforderlich.',403);
    const row=await settings();if(!row.enabled||!row.config_id)throw new PlatformError('SharePoint ist bis zur ausdrücklichen Freigabe deaktiviert.',409);
    const config=readConfig(row.config_id),library=libraryKey(config),api=graph(config,transport,signal);
    // Zielordner der neuen Ablage: Akte nach Vorgabe + Ablagetyp (Verträge ohne Ablagetyp).
    const location=target?.location;let typeKey:string|null=null,typeLabel='';
    if(location&&usesStorageTypes(location)){const type=(target!.typeKey?(await client.query('SELECT key,label FROM platform.sharepoint_storage_types WHERE key=$1 AND active',[target!.typeKey])).rows[0]:(await client.query("SELECT key,label FROM platform.sharepoint_storage_types WHERE active ORDER BY key='sonstiges' DESC,sort LIMIT 1")).rows[0]);/* ohne Angabe: Sonstiges */if(!type)throw new PlatformError('Bitte einen Ablagetyp auswählen.');typeKey=type.key;typeLabel=type.label;}
    else if(location)typeKey='~';
    let operation=(await client.query('SELECT * FROM platform.sharepoint_uploads WHERE id=$1',[requestId])).rows[0];
    if(operation&&(operation.actor_id!==actor||operation.scope_key!==scope||operation.library_key!==library||operation.content_hash!==hash||operation.display_name!==name||operation.size!==bytes.length||(operation.storage_type??null)!==typeKey))throw new PlatformError('Uploadkennung gehört zu einer anderen Datei, Akte oder Ablage.',409);
    if(!operation)operation=(await client.query("SELECT * FROM platform.sharepoint_uploads WHERE actor_id=$1 AND scope_key=$2 AND library_key=$3 AND content_hash=$4 AND display_name=$5 AND storage_type IS NOT DISTINCT FROM $6 AND state IN ('pending','complete') ORDER BY created_at DESC LIMIT 1",[actor,scope,library,hash,name,typeKey])).rows[0];
    // Ordner: neue Ablage über feste Zuordnung bzw. Pfad; ohne Ziel (Altaufrufe) die bisherige Hash-Ablage.
    const resolveFolder=async(create:boolean)=>{
     if(!location)return api.folder(scope,create);
     const segments=locationSegments(location),mapped=(await client.query('SELECT type_key,folder_id FROM platform.sharepoint_folders WHERE library_key=$1 AND scope_key=$2',[library,scope])).rows as {type_key:string;folder_id:string}[];
     let base=mapped.find(entry=>entry.type_key==='')?await api.folderById(mapped.find(entry=>entry.type_key==='')!.folder_id):null;
     if(!base){base=await api.ensurePath(segments,create);if(!base)return null;await client.query("INSERT INTO platform.sharepoint_folders(library_key,scope_key,type_key,folder_id,path,name_prefix) VALUES($1,$2,'',$3,$4,$5) ON CONFLICT (library_key,scope_key,type_key) DO UPDATE SET folder_id=excluded.folder_id,path=excluded.path,name_prefix=excluded.name_prefix",[library,scope,base.id,segments.join('/'),location.namePrefix??'']);}
     if(typeKey==='~')return base;
     let typed=mapped.find(entry=>entry.type_key===typeKey)?await api.folderById(mapped.find(entry=>entry.type_key===typeKey)!.folder_id):null;
     if(!typed){const name=folderName(typeLabel,'Sonstiges');typed=(await api.childFolders(base.id)).find(folder=>folder.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))??null;
      if(!typed&&create){typed=await api.json(api.drive+'/items/'+encodeURIComponent(base.id)+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})}).then(api.item).catch(async()=>(await api.childFolders(base!.id)).find(folder=>folder.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))??null);}
      if(!typed)return null;await client.query('INSERT INTO platform.sharepoint_folders(library_key,scope_key,type_key,folder_id,path) VALUES($1,$2,$3,$4,$5) ON CONFLICT (library_key,scope_key,type_key) DO UPDATE SET folder_id=excluded.folder_id,path=excluded.path',[library,scope,typeKey,typed.id,[...segments,name].join('/')]);}
     return typed;};
    const legacyOperation=operation&&operation.storage_type==null&&!operation.remote_name;
    let folder=legacyOperation||!location?await api.folder(scope):await resolveFolder(false);
    if(operation?.state==='complete'){
     const remote=folder?await api.find(folder.id,operation.remote_name??operation.id+'-'+name):null;
     if(remote&&remote.id===operation.remote_id&&remote.eTag===operation.etag)return {item:publicItem(remote,config,name),repeated:true};
     await client.query("UPDATE platform.sharepoint_uploads SET state=$2 WHERE id=$1",[operation.id,remote?'changed':'missing']);
     if(operation.id===requestId)throw new PlatformError('Die abgelegte Datei wurde inzwischen geändert oder entfernt. Datei erneut auswählen, um eine neue Kopie anzulegen; bestehende Änderungen bleiben erhalten.',409);operation=undefined;
    }
    if(operation&&!['pending','complete'].includes(operation.state))throw new PlatformError('Dieser Upload wurde bereits anderweitig abgeschlossen. Datei erneut auswählen.',409);
    if(!operation){const count=(await client.query("SELECT count(*)::int n FROM platform.sharepoint_uploads WHERE actor_id=$1 AND created_at>now()-interval '1 day'",[actor])).rows[0].n;const total=(await client.query("SELECT count(*)::int n FROM platform.sharepoint_uploads WHERE created_at>now()-interval '1 day'")).rows[0].n;if(total>=1000)throw new PlatformError('Gesamtkontingent von 1000 Uploads pro Tag erreicht. Bestehende Dateien bleiben erhalten.',429);if(count>=100)throw new PlatformError('Tageskontingent von 100 Uploads erreicht. Bestehende Dateien bleiben erhalten.',429);await client.query('INSERT INTO platform.sharepoint_uploads(id,actor_id,scope_key,library_key,display_name,content_hash,size,storage_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[requestId,actor,scope,library,name,hash,bytes.length,typeKey]);operation={id:requestId,storage_type:typeKey};}
    const legacy=operation.storage_type==null&&(!location||legacyOperation);
    if(!folder)folder=legacy?await api.folder(scope,true):await resolveFolder(true);if(!folder)throw new PlatformError('SharePoint-Aktenordner nicht verfügbar.',503);
    // Dateiname: alt „<Vorgang>-name“, neu lesbar (Präfix z. B. Auftragsnummer), bei Belegung durchnummeriert; einmal festgelegt.
    let remoteName:string=operation.remote_name??(legacy?operation.id+'-'+name:'');
    if(!remoteName){for(let attempt=1;attempt<=50&&!remoteName;attempt++){const candidate=remoteFileName(name,location?.namePrefix??'',attempt);if(!await api.find(folder.id,candidate))remoteName=candidate;}if(!remoteName)throw new PlatformError('Kein freier Dateiname gefunden. Datei umbenennen.',409);await client.query('UPDATE platform.sharepoint_uploads SET remote_name=$2 WHERE id=$1',[operation.id,remoteName]);}
    let remote=await api.find(folder.id,remoteName);
    if(remote){const existing=await api.verifiedContent(remote.id);if(createHash('sha256').update(existing).digest('hex')!==hash)throw new PlatformError('Die Datei wurde zwischenzeitlich verändert. In SharePoint prüfen; neuere Inhalte werden nicht überschrieben.',409);}
    else remote=await api.upload(folder.id,remoteName,bytes);
    if(remote.size!==bytes.length||!remote.file||!remote.eTag)throw new PlatformError('SharePoint-Datei nicht eindeutig bestätigt. Denselben Upload erneut versuchen.',503);
    await client.query('BEGIN');await client.query("UPDATE platform.sharepoint_uploads SET state='complete',remote_id=$2,etag=$3,completed_at=now() WHERE id=$1",[operation.id,remote.id,remote.eTag]);await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'sharepoint.document.uploaded',$2,$3::jsonb)",[actor,operation.id,JSON.stringify([{field:'document',label:'Dokument in SharePoint abgelegt',before:null,after:name}])]);await client.query('COMMIT');return {item:publicItem(remote,config,name),repeated:false};
   }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{if(locked)await client.query('SELECT pg_advisory_unlock(741963326)').catch(()=>{});client.release();}
  }
 };
}
