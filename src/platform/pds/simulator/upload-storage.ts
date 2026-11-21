import type {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {statfsSync} from 'node:fs';
import {dirname} from 'node:path';
import {ResourceError} from '../../resource-budgets/model.ts';
import {MAX_DOCUMENT_BYTES,documentName} from './document.ts';
export const uploadLimits={userBytes:250*1024*1024,totalBytes:1024*1024*1024,reserveBytes:64*1024*1024,chunkBytes:256*1024};
export function uploadStorage(db:DatabaseSync,path:string,options:{limits?:typeof uploadLimits;free?:()=>number}={}){
 const rollback=()=>{try{db.exec('ROLLBACK');}catch{/* SQLite may already have rolled back after SQLITE_FULL. */}};
 const limits=options.limits??uploadLimits,free=options.free??(()=>{const info=statfsSync(dirname(path));return info.bavail*info.bsize;});
 function quota(user:string,bytes:number){
  if(free()<limits.reserveBytes+bytes)throw new ResourceError('Nicht genügend freier Speicher. Bestehende Dateien und Eingaben bleiben erhalten.',507);
  const uploaded=db.prepare('SELECT coalesce(sum(coalesce(chunked_size,length(content))),0) AS total,coalesce(sum(CASE WHEN created_by=? THEN coalesce(chunked_size,length(content)) ELSE 0 END),0) AS own FROM uploads').get(user)!;
  const pending=db.prepare("SELECT coalesce(sum(bytes),0) AS total,coalesce(sum(CASE WHEN created_by=? THEN bytes ELSE 0 END),0) AS own FROM upload_transfers WHERE state='pending'").get(user)!;
  const replicated=Number(db.prepare('SELECT coalesce(sum(length(content)),0) AS n FROM pds_api_entities').get()?.n??0);
  if(Number(uploaded.own)+Number(pending.own)+bytes>limits.userBytes||Number(uploaded.total)+Number(pending.total)+replicated+bytes>limits.totalBytes)throw new ResourceError('Dateiquote erreicht. Vorhandene Dateien und offene Entwürfe bleiben erhalten; bitte die Administration kontaktieren.',507);
 }
 function bytes(row:{content?:unknown;transfer_id?:unknown;chunked_size?:unknown}){return row.transfer_id?Buffer.concat(db.prepare('SELECT content FROM upload_chunks WHERE transfer_id=? ORDER BY position').all(row.transfer_id as string).map(r=>Buffer.from(r.content as Uint8Array)),Number(row.chunked_size)):Buffer.from(row.content as Uint8Array);}
 async function receive(id:string,name:string,user:string,body:ReadableStream<Uint8Array>|null){
  documentName(name);if(!/^[a-f0-9-]{36}$/i.test(id)||!body)throw new ResourceError('Ungültige Datei.',400);
  const existing=db.prepare('SELECT created_by,name,checksum FROM uploads WHERE id=?').get(id);
  if(existing&&(existing.created_by!==user||existing.name!==name))throw new ResourceError('Upload-Kennung ist bereits vergeben.',409);
  const transfer=randomUUID(),reader=body.getReader(),hash=createHash('sha256'),buffer=Buffer.alloc(limits.chunkBytes);let total=0,filled=0,position=0,complete=false;
  function flush(){if(!filled)return;db.exec('BEGIN IMMEDIATE');try{quota(user,filled);db.prepare('INSERT INTO upload_chunks VALUES(?,?,?)').run(transfer,position,buffer.subarray(0,filled));db.prepare('UPDATE upload_transfers SET bytes=bytes+? WHERE id=?').run(filled,transfer);db.exec('COMMIT');position+=filled;filled=0;}catch(error){rollback();throw error;}}
  try{
   if(!existing){quota(user,1);db.prepare('INSERT INTO upload_transfers(id,upload_id,created_by) VALUES(?,?,?)').run(transfer,id,user);}
   while(true){const result=await reader.read();if(result.done)break;const value=result.value;total+=value.length;if(total>MAX_DOCUMENT_BYTES)throw new ResourceError('Maximal 100 MB pro Datei.',413);hash.update(value);
    if(!existing)for(let offset=0;offset<value.length;){const n=Math.min(buffer.length-filled,value.length-offset);buffer.set(value.subarray(offset,offset+n),filled);filled+=n;offset+=n;if(filled===buffer.length)flush();}
   }
   if(!total)throw new ResourceError('Datei ist leer.',400);const checksum=hash.digest('hex');
   if(existing){if(existing.checksum!==checksum)throw new ResourceError('Upload-Kennung enthält andere Daten.',409);complete=true;return {uploadId:id,name,mime:'application/octet-stream',category:'Grunddaten' as const};}
   flush();const first=db.prepare('SELECT content FROM upload_chunks WHERE transfer_id=? AND position=0').get(transfer)?.content as Uint8Array;
   // No execution/inline preview. Reject recognizable executable payloads; this is not antivirus.
   const signature=Buffer.from(first).subarray(0,4).toString('hex');if(signature.startsWith('4d5a')||['7f454c46','cffaedfe','cefaedfe','feedfacf','feedface'].includes(signature))throw new ResourceError('Ausführbare Dateien sind hier nicht zulässig.',415);
   db.exec('BEGIN IMMEDIATE');try{
    const winner=db.prepare('SELECT created_by,name,checksum FROM uploads WHERE id=?').get(id);
    if(winner){if(winner.created_by!==user||winner.name!==name||winner.checksum!==checksum)throw new ResourceError('Upload-Kennung enthält andere Daten.',409);db.prepare('DELETE FROM upload_chunks WHERE transfer_id=?').run(transfer);db.prepare('DELETE FROM upload_transfers WHERE id=?').run(transfer);}
    else {db.prepare('INSERT INTO uploads(id,name,content,checksum,created_by,transfer_id,chunked_size) VALUES(?,?,zeroblob(0),?,?,?,?)').run(id,name,checksum,user,transfer,total);db.prepare("UPDATE upload_transfers SET state='complete' WHERE id=?").run(transfer);}
    db.exec('COMMIT');complete=true;return {uploadId:id,name,mime:'application/octet-stream',category:'Grunddaten' as const};
   }catch(error){rollback();throw error;}
  }catch(error){void reader.cancel().catch(()=>{});if(((error as {code?:string;errcode?:number}).code?.includes('SQLITE_FULL')||(error as {errcode?:number}).errcode===13))throw new ResourceError('Speicher voll. Bestehende Daten und Eingaben bleiben erhalten.',507);throw error;
  }finally{reader.releaseLock();if(!complete&&!existing){db.prepare('DELETE FROM upload_chunks WHERE transfer_id=?').run(transfer);db.prepare("DELETE FROM upload_transfers WHERE id=? AND state='pending'").run(transfer);}}
 }
 return {quota,bytes,receive};
}
