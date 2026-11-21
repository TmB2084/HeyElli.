"use client";
import {Notice} from "@/platform/shell";
import {ContinuationDialog} from "./continuation-dialog";
import type {ContinuationPlan} from "./domain";
import {PlanningWarningDialog} from "./planning-warning-dialog";
import type {PlanningWarning} from "./domain";
import {useEffect,useRef,useState} from "react";
import {berlinWall,wallInstant,type CalendarColor,type CalendarEvent,type Resource} from "./domain";
import {CalendarOptionFields} from "./option-fields";
import {ReferencePicker} from "./reference-picker";
import {creationTypes,transactionTypes,type CalendarOptions,type CalendarCategory,type CalendarReference} from "./domain";
import {ResourcePicker} from "./companion-picker";
export type CreationSeed={start:string;end:string;resourceId:string;key:string};
export function CreateCalendarDialog({seed,resources,categories,colors=[],onClose,onCreated}:{seed:CreationSeed;resources:Resource[];categories:CalendarCategory[];colors?:CalendarColor[];onClose:()=>void;onCreated:(event:CalendarEvent)=>void}){
  const [continuation,setContinuation]=useState<{body:Record<string,unknown>;plan:ContinuationPlan;hash:string;operationId:string}|null>(null);
  const [warning,setWarning]=useState<{body:Record<string,unknown>;warnings:PlanningWarning[]}|null>(null);
  const [type,setType]=useState("FREIER"),[referenceType,setReferenceType]=useState("AUFTRAG"),[reference,setReference]=useState<CalendarReference|null>(null);
  const [options,setOptions]=useState<CalendarOptions>({status:"GEPLANT",allDay:false,fixed:false,pimSync:false,categories:[],objectId:""});
  const needsReference=type==="VORGANG"||type==="PROJEKT";
  const dialog=useRef<HTMLDialogElement>(null);
  const [title,setTitle]=useState(""),[notes,setNotes]=useState("");
  const [start,setStart]=useState(()=>berlinWall(seed.start)),[end,setEnd]=useState(()=>berlinWall(seed.end));
  const [selected,setSelected]=useState([seed.resourceId]),[saving,setSaving]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    const node=dialog.current,previous=document.activeElement as HTMLElement|null;
    node?.showModal();
    const input=node?.querySelector<HTMLInputElement>("input");
    input?.focus({preventScroll:true});
    if(node&&input){
      const field=input.getBoundingClientRect(),bounds=node.getBoundingClientRect();
      if(field.bottom>bounds.bottom-8)node.scrollTop+=field.bottom-bounds.bottom+8;
      else if(field.top<bounds.top+8)node.scrollTop-=bounds.top+8-field.top;
    }
    return()=>{
      node?.close();
      requestAnimationFrame(()=>{
        if(previous?.isConnected&&!document.querySelector("dialog[open]")&&
          (document.activeElement===document.body||document.activeElement===previous)){
          previous.focus({preventScroll:true});
        }
      });
    };
  },[]);
  async function save(){
    if(saving)return;
    let body;
    try{if(!title.trim()||!selected.length)throw new Error("Bitte Titel und mindestens eine Ressource angeben.");if(needsReference&&!reference)throw new Error("Bitte einen Vorgang bzw. eine Projektakte auswählen.");body={title:title.trim(),notes,start:wallInstant(start),end:wallInstant(end),resourceIds:selected,type,options,...(needsReference?{referenceId:reference!.id,...(type==="VORGANG"?{referenceType}:{})}:{})};}catch(problem){setError(problem instanceof Error?problem.message:"Bitte die Angaben prüfen.");return;}
    await send(body);
  }
  async function send(body:Record<string,unknown>,acceptPlanningWarnings=false){
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/ressourcenkalender/termine",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":seed.key},body:JSON.stringify({...body,acceptPlanningWarnings})});
      const result=await response.json();
      if(response.status===409&&result.continuationPlan){setContinuation({body,plan:result.continuationPlan,hash:result.continuationHash,operationId:result.operationId});setSaving(false);return;}
      if(response.status===409&&Array.isArray(result.planningWarnings)){setWarning({body,warnings:result.planningWarnings});setSaving(false);return;}
      if(!response.ok)throw new Error(result.error);
      onCreated(result);
    }catch(problem){setError(problem instanceof Error?problem.message:"Termin konnte nicht angelegt werden.");setSaving(false);}
  }
  return <><dialog ref={dialog} className="calendar-edit-dialog" aria-labelledby="calendar-create-title" onCancel={event=>{if(saving)event.preventDefault();else onClose();}}>
    <div className="dialog-heading"><h2 id="calendar-create-title">Neuen Termin anlegen</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" disabled={saving} onClick={onClose}>×</button></div>
    <form onSubmit={event=>{event.preventDefault();void save();}}>
      <p>Datum, Uhrzeit und Ressource sind vorausgewählt. Zeiten werden in deutscher Ortszeit angezeigt.</p>
      <label>Titel *<input required maxLength={200} value={title} disabled={saving} onChange={event=>setTitle(event.target.value)}/></label>
      <label>Termintyp<select value={type} disabled={saving} onChange={event=>{setType(event.target.value);setReference(null);}}>{Object.entries(creationTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {type==="VORGANG"&&<label>Vorgangstyp<select value={referenceType} disabled={saving} onChange={event=>{setReferenceType(event.target.value);setReference(null);}}>{Object.entries(transactionTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
      {needsReference&&<ReferencePicker key={type+referenceType} label={type==="PROJEKT"?"Projektakte *":"Vorgang *"} kind={type==="PROJEKT"?"PROJEKT":referenceType} selected={reference} onChange={setReference} disabled={saving}/>}
      <CalendarOptionFields value={options} onChange={setOptions} start={start} end={end} onStart={setStart} onEnd={setEnd} categories={categories} colors={colors} disabled={saving}/>
      <ResourcePicker resources={resources} selected={selected} onChange={setSelected} disabled={saving}/>
      <label>Beschreibung (optional)<textarea maxLength={4000} value={notes} disabled={saving} onChange={event=>setNotes(event.target.value)}/></label>
      {error&&<Notice tone="error" role="alert">{error}</Notice>}
      <div className="discard-dialog-actions"><button type="button" className="skip-planning-button" disabled={saving} onClick={onClose}>Abbrechen</button><button type="submit" disabled={saving||!title.trim()||!selected.length||(needsReference&&!reference)}>{saving?"Wird angelegt …":"Termin anlegen"}</button></div>
    </form>
  </dialog>{continuation&&<ContinuationDialog plan={continuation.plan} title={String(continuation.body.title)} onCancel={()=>setContinuation(null)} onSingle={()=>{const body={...continuation.body,continuationChoice:"single"};setContinuation(null);void send(body);}} onSplit={()=>{const body={...continuation.body,continuationChoice:"split",continuationHash:continuation.hash,operationId:continuation.operationId};setContinuation(null);void send(body);}}/>}{warning&&<PlanningWarningDialog split={warning.body.continuationChoice==="split"} appointment={{title:String(warning.body.title),start:String(warning.body.start),end:String(warning.body.end)}} warnings={warning.warnings} onCancel={()=>setWarning(null)} onConfirm={()=>{const body=warning.body;setWarning(null);void send(body,true);}}/>}</>;
}
