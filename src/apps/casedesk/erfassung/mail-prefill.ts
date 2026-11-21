'use client';
import {useEffect,useState} from 'react';
import type {SearchItem} from './search-picker';
import type {IncidentState} from './tool-drafts';
// Übernahme einer zugeordneten MailDesk-Mail in eine neue Störungsaufnahme: Objekt/Einheit, Beschreibung,
// Meldeweg „E-Mail“ mit der Mail als Dokument. Nach dem Speichern wird der Auftrag mit der Mail verknüpft.
type Template={messageId:string;subject:string;from:{name:string;address:string};objectId:string|null;objectName:string|null;unitId:string|null;unitName:string|null;urgent:boolean;problem:string;document:{name:string;text:string}};
export type MailPrefill={status:'idle'|'loading'|'ready'|'error';initial?:IncidentState;subject?:string;error?:string};
async function find(resource:'objects'|'units',query:string,id:string,objectId?:string):Promise<SearchItem|null>{
 const response=await fetch('/api/pds-simulator?'+new URLSearchParams({resource,q:query,limit:'50',offset:'0',personScope:'customer',...(objectId?{objectId}:{})}),{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)return null;const result=await response.json();return (result.items as SearchItem[]).find(item=>item.id===id)??null;
}
// Eine Übernahme je Mail und Seitenaufruf: doppelte Effektläufe teilen dasselbe Ergebnis (kein zweiter Upload).
const running=new Map<string,Promise<MailPrefill>>();
async function prepare(mailId:string):Promise<MailPrefill>{try{
 const response=await fetch('/api/maildesk/vorlage?'+new URLSearchParams({id:mailId}),{cache:'no-store',signal:AbortSignal.timeout(30000)}),template=await response.json() as Template&{error?:string};
 if(!response.ok)throw Error(template.error);
 const object=template.objectId&&template.objectName?await find('objects',template.objectName,template.objectId):null;
 const unit=object&&template.unitId&&template.unitName?await find('units',template.unitName,template.unitId,object.id):null;
 const uploadId=crypto.randomUUID(),file=new Blob([template.document.text],{type:'text/plain'});
 const upload=await fetch('/api/pds-simulator/uploads',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(template.document.name),'X-Upload-Id':uploadId},body:file});
 const uploaded=upload.ok?await upload.json():null;
 const initial:IncidentState={object,personScope:'customer',person:null,channel:uploaded?'E-Mail':'Telefon',contact:'',upload:uploaded,pendingFile:null,bauleiter:null,unit,technician:null,companions:[],mobileIssue:false,planning:false,
  activeStep:0,completed:['','',''],requestKey:null,pending:null,attempted:false,fields:{problem:(template.urgent?'DRINGEND – ':'')+template.problem,externalOrderNumber:'',appointmentDuration:'60'},dates:{},queries:{}};
 return {status:'ready',initial,subject:template.subject,...(uploaded?{}:{error:'Die Mail konnte nicht als Dokument beigefügt werden. Bitte als Meldeweg ein Dokument wählen oder die Rückrufnummer ergänzen.'})};
}catch(problem){running.delete(mailId);return {status:'error',error:problem instanceof Error&&problem.message?problem.message:'Die Mail konnte nicht übernommen werden. Die Erfassung ist trotzdem möglich.'};}}
export function useMailPrefill(mailId:string|null):MailPrefill{
 const [state,setState]=useState<MailPrefill>({status:mailId?'loading':'idle'});
 useEffect(()=>{if(!mailId)return;let active=true;let task=running.get(mailId);if(!task){task=prepare(mailId);running.set(mailId,task);}
  void task.then(value=>{if(active)setState(value);});return()=>{active=false;};},[mailId]);
 return state;
}
export async function linkMailOrder(mailId:string,orderNumber:string){
 for(let attempt=0;attempt<3;attempt++){try{const response=await fetch('/api/maildesk/aktion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:mailId,action:'order',version:0,orderNumber}),signal:AbortSignal.timeout(20000)});if(response.ok)return true;if(response.status<500&&response.status!==404)return false;}catch{/* erneut versuchen */}await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}
 return false;
}
