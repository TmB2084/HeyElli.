"use client";

import {CalendarDateTimeField} from '@/apps/planboard/kalender/ui';
import {PlanningFields} from './planning-fields';
import {AlertDialog,Notice,GuardedLink,PopUpButton} from "@/platform/shell";
import {useDraftNavigationGuard} from "@/platform/shell";
import {reportingChannels} from "@/platform/pds/simulator/reporting";
import { useEffect, useRef, useState } from "react";
import { ExistingOrders, SearchPicker, TechnicalUnitPicker, type SearchItem } from "./search-picker";
import {openToolDrafts,type ToolDraftSession} from "./tool-draft-client";
import {linkMailOrder,useMailPrefill} from "./mail-prefill";
import {useSearchParams} from "next/navigation";
import type {IncidentState} from "./tool-drafts";
import styles from "./incident-workspace.module.css";

export function IncidentForm({canWrite=true,tool=false}:{canWrite?:boolean;tool?:boolean}) {
  if(tool)return <DurableIncidentForm canWrite={canWrite}/>;
  return <TransientIncidentForm canWrite={canWrite}/>;
}
function TransientIncidentForm({canWrite}:{canWrite:boolean}){
  const [revision,setRevision]=useState(0),mailId=useSearchParams().get('ausMail'),prefill=useMailPrefill(mailId),[linked,setLinked]=useState<''|'ok'|'failed'>('');
  if(mailId&&prefill.status==='loading')return <Notice tone="neutral">Mail aus MailDesk wird übernommen …</Notice>;
  // Aus MailDesk: vorausgefüllte Erfassung; nach dem Speichern wird der Auftrag mit der Mail verknüpft.
  return <>{mailId&&prefill.status==='ready'&&revision===0&&<Notice tone="neutral">Aus MailDesk: „{prefill.subject}“. Objekt, Beschreibung und die Mail als Dokument sind übernommen. Nach dem Speichern wird der Auftrag mit der Mail verknüpft.</Notice>}
   {prefill.error&&<Notice tone="error" role="alert">{prefill.error}</Notice>}
   {linked==='ok'&&<Notice tone="neutral" role="status">Auftrag mit der Mail in MailDesk verknüpft. <GuardedLink href={'/maildesk?'+new URLSearchParams({id:mailId??''})}>Zur Mail</GuardedLink></Notice>}
   {linked==='failed'&&<Notice tone="error" role="alert">Der Auftrag ist gespeichert, die Verknüpfung mit der Mail konnte aber nicht bestätigt werden. In MailDesk unter „Beim Kunden“ → „Mail anhängen“ nachholen.</Notice>}
   <IncidentDraft canWrite={canWrite} key={revision} initial={revision===0?prefill.initial:undefined} wasDiscarded={revision>0} onDiscard={()=>setRevision(value=>value+1)} onCompleted={number=>{if(mailId&&number&&revision===0)void linkMailOrder(mailId,number).then(ok=>setLinked(ok?'ok':'failed'));}}/></>;
}

function DurableIncidentForm({canWrite}:{canWrite:boolean}){
 const [session,setSession]=useState<ToolDraftSession|null>(null),[problem,setProblem]=useState(''),[attempt,setAttempt]=useState(0),[revision,setRevision]=useState(0),[preferred,setPreferred]=useState<string|undefined>();
 useEffect(()=>{const controller=new AbortController();let opened:ToolDraftSession|undefined;void openToolDrafts(controller.signal,text=>{if(!controller.signal.aborted)setProblem(text);},preferred).then(value=>{opened=value;if(!controller.signal.aborted){setSession(value);setProblem('');}}).catch(()=>{if(!controller.signal.aborted)setProblem('Die geschützte Auftragssicherung kann gerade nicht geöffnet werden. Vorhandene Eingaben bleiben erhalten. Bitte die Verbindung prüfen.');});return()=>{controller.abort();opened?.close();};},[attempt,preferred]);
 if(!session)return <Notice tone={problem?'error':'neutral'}>{problem||'Geschützte Auftragssicherung wird geöffnet …'}{problem&&<button type="button" onClick={()=>setAttempt(value=>value+1)}>Erneut prüfen</button>}</Notice>;
 return <>{problem&&<Notice tone="error" role="alert">{problem}</Notice>}{session.otherCount>0&&<Notice tone="neutral">Weitere Erfassungen sind getrennt gesichert. Bereits in anderen Tabs geöffnete Aufträge werden dort fortgesetzt.<PopUpButton label="Angefangenen Auftrag fortsetzen" value={session.branchId} options={[{value:session.branchId,label:'Aktuelle Erfassung'},...session.branches.filter(branch=>branch.id!==session.branchId).map((branch,index)=>({value:branch.id,label:`Erfassung vom ${new Date(branch.updatedAt).toLocaleString('de-DE')}`,separatorBefore:index===0}))]} onChange={value=>{setPreferred(value);setSession(null);setRevision(0);setAttempt(current=>current+1);}}/></Notice>}<IncidentDraft key={session.branchId+':'+revision} initial={revision?undefined:session.initial as IncidentState|undefined} canWrite={canWrite} wasDiscarded={revision>0} onDiscard={()=>{try{session.complete();setRevision(value=>value+1);}catch{setProblem('Die Erfassung konnte nicht sicher verworfen werden. Deine Eingaben bleiben geöffnet.');}}} onSnapshot={state=>{try{session.save(state as unknown as Record<string,unknown>);}catch{setProblem('Die Auftragssicherung ist fehlgeschlagen. Bitte dieses Fenster geöffnet lassen und die Verbindung oder den Browserspeicher prüfen.');throw Error('Auftragssicherung fehlgeschlagen.');}}} confirmSnapshot={()=>session.confirm()} onCompleted={()=>session.complete()} stageFile={(id,file)=>session.stageFile(id,file)} restoreFile={id=>session.restoreFile(id)}/></>;
}

function IncidentDraft({wasDiscarded,onDiscard,canWrite,initial,onSnapshot,confirmSnapshot,onCompleted,stageFile,restoreFile}:{canWrite:boolean;wasDiscarded:boolean;onDiscard:()=>void;initial?:IncidentState;onSnapshot?:(state:IncidentState)=>void;confirmSnapshot?:()=>Promise<void>;onCompleted?:(number?:string)=>void;stageFile?:(id:string,file:File)=>Promise<void>;restoreFile?:(id:string)=>Promise<File>}) {
  const discardDialog=useRef<HTMLDialogElement>(null);
  const discardButton=useRef<HTMLButtonElement>(null);
  const firstStep=useRef<HTMLButtonElement>(null);
  const [discardNotice,setDiscardNotice]=useState(wasDiscarded);
  const [dirty,setDirty]=useState(!!initial);
  useEffect(()=>{if(wasDiscarded)firstStep.current?.focus();},[wasDiscarded]);
  function keepDraft(){discardDialog.current?.close();discardButton.current?.focus();}

  const [object, setObject] = useState<SearchItem | null>(initial?.object??null);
  const objectId = object?.id ?? "";
  const [personScope,setPersonScope]=useState<"customer" | "all">(initial?.personScope??"customer");
  const [person, setPerson] = useState<SearchItem | null>(initial?.person??null);
  const [channel, setChannel] = useState(initial?.channel??"Telefon");
  const [contact, setContact] = useState(initial?.contact??"");
  const [upload, setUpload] = useState<{name:string;mime:string;uploadId:string} | null>(initial?.upload??null);
  const [reading, setReading] = useState(false);
  const [pendingUpload,setPendingUpload]=useState<{file:File;id:string}|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [pendingFile,setPendingFile]=useState(initial?.pendingFile??null),fileStaged=useRef(false);
  async function sendUpload(candidate:{file:File;id:string}){
    setReading(true);setError('');
    try{if(stageFile){await stageFile(candidate.id,candidate.file);fileStaged.current=true;}const response=await fetch('/api/pds-simulator/uploads',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(candidate.file.name),'X-Upload-Id':candidate.id},body:candidate.file});const result=await response.json();if(!response.ok)throw Error(result.error);setUpload(result);setPendingUpload(null);setPendingFile(null);}
    catch(error){setError(error instanceof Error?error.message:'Dokument konnte nicht hochgeladen werden.');}
    finally{setReading(false);}
  }

  const [bauleiter, setBauleiter] = useState<SearchItem | null>(initial?.bauleiter??null);
  const [unitListReady,setUnitListReady]=useState(false);
  const [unit, setUnit] = useState<SearchItem | null>(initial?.unit??null);
  const [technician, setTechnician] = useState<SearchItem | null>(initial?.technician??null);
  const [companions, setCompanions] = useState<SearchItem[]>(initial?.companions??[]);
  const requestKey=useRef<string|null>(initial?.requestKey??null);
  const [mobileIssue,setMobileIssue]=useState(initial?.mobileIssue??false);
  const [saveWarning,setSaveWarning]=useState('');
  const [planning, setPlanning] = useState(initial?.planning??false);
  const form = useRef<HTMLFormElement>(null);
  const projectAssignment = useRef<HTMLDivElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const dialogs = useRef<(HTMLDialogElement | null)[]>([]);
  const [activeStep,setActiveStep] = useState(initial?.activeStep??0);
  const [completed,setCompleted] = useState<string[]>(initial?.completed??["","",""]);
  function invalidate() {
    reloadSafe.current=false;setDirty(true);setDiscardNotice(false);
    setCompleted(previous=>previous.map((value,index)=>index>=activeStep ? "" : value));
    setPending(null);
  }
  function openStep(index:number) {setDiscardNotice(false);setActiveStep(index);setError("");dialogs.current[index]?.showModal();}
  function advanceStep(index:number) {
    dialogs.current[index]?.close();
    requestAnimationFrame(()=>{
      if(index<2)openStep(index+1);
      else if(bauleiter) saveButton.current?.focus();
      else projectAssignment.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }
  const [error, setError] = useState("");
  useEffect(()=>{if(!initial?.pendingFile||!restoreFile)return;let active=true;void restoreFile(initial.pendingFile.id).then(file=>{if(active){fileStaged.current=true;setPendingUpload({file,id:initial.pendingFile!.id});}}).catch(()=>{if(active)setError('Die ausgewählte Datei ist auf diesem Gerät nicht verfügbar. Bitte erneut auswählen. Alle übrigen Eingaben sind erhalten.');});return()=>{active=false;};},[initial,restoreFile]);

  const [pending, setPending] = useState<{payload: Record<string,unknown>; key:string} | null>(initial?.pending??null);
  const [fields,setFields]=useState(initial?.fields??{problem:'',externalOrderNumber:'',appointmentDuration:'60'});
  const [dates,setDates]=useState<IncidentState['dates']>(initial?.dates??{}),[queries,setQueries]=useState<Record<string,string>>(initial?.queries??{});
  const [attempted,setAttempted]=useState(initial?.attempted??false),attemptedRef=useRef(initial?.attempted??false);
  function query(name:string,value:string){setQueries(previous=>({...previous,[name]:value}));}
  function snapshot():IncidentState{return {object,personScope,person,channel,contact,upload,pendingFile,bauleiter,unit,technician,companions,mobileIssue,planning,activeStep,completed,requestKey:requestKey.current,pending,attempted:attemptedRef.current,fields,dates,queries};}
  const reloadSafe=useRef(false);
  function mayReload(){return reloadSafe.current;}
  const [saved, setSaved] = useState("");
  const [savedLinks,setSavedLinks]=useState<{service:string|null;calendar:string|null}>({service:null,calendar:null});
  useEffect(()=>{if(dirty&&!saved&&onSnapshot){try{reloadSafe.current=false;onSnapshot(snapshot());reloadSafe.current=(!reading||fileStaged.current)&&(!pendingFile||fileStaged.current);window.dispatchEvent(new Event('heyelli:tool-draft-state'));}catch{/* The durable parent reports the problem and the native leave guard retains the form. */}}});
  const [saving, setSaving] = useState(false);
  useDraftNavigationGuard(dirty && !saved,saving || reading,onDiscard,mayReload);
  async function save() {
    if (!pending || !completed.every(Boolean) || !bauleiter || saving || saved) return;
    setSaving(true); setError("");
    try {
      if(onSnapshot){attemptedRef.current=true;setAttempted(true);onSnapshot(snapshot());await confirmSnapshot?.();}
      const response = await fetch("/api/pds-simulator/orders", {method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":pending.key},body:JSON.stringify(pending.payload)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(result.number);setSavedLinks(result.links??{service:null,calendar:null});setSaveWarning(result.warning??'');onCompleted?.(result.number);
    } catch(error) { setError(error instanceof Error ? error.message : "Speichern nicht erreichbar. Wiederholen ist mit derselben Anfrage sicher möglich."); }
    finally { setSaving(false); }
  }
  function finishStep(index:number,skipPlanning=false) {
    if(!form.current || reading) return;
    const values = new FormData(form.current);
    const fields=dialogs.current[index]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea");
    if(fields && !(index===2 && skipPlanning)) for(const field of fields) if(!field.reportValidity()) return;
    if(index===0) {
      if(!object){setError("Bitte ein Objekt auswählen.");return;}
      if(!unitListReady){setError("Bitte warten, bis die technischen Einheiten geladen sind.");return;}
      setCompleted(previous=>previous.map((value,i)=>i===0 ? `${object.label}\n${unit?.label ?? "Technische Einheit noch offen"}` : value));
      setError("");advanceStep(0);return;
    }
    if(index===2 && !completed[1]){setError("Bitte zuerst die Meldung abschließen.");return;}
    if(index===1) {
    const fields = [ "problem", "reportedAt", "channel"];
    if (fields.some(key => !String(values.get(key) ?? "").trim())) {
      setError("Bitte alle Pflichtfelder ausfüllen; reine Leerzeichen reichen nicht aus.");
      return;
    }
    if (!object || !person) {setError("Bitte zuerst Objekt und meldende Kundenperson auswählen.");return;}
    if (reading) {setError("Bitte warten, bis das Dokument eingelesen ist.");return;}
    if (channel === "E-Mail" && (!upload||pendingUpload)) {setError("Bitte ein Dokument zur E-Mail hochladen.");return;}
    if (channel !== "E-Mail" && !/^[+0-9() /.-]{3,50}$/.test(contact.trim())) {setError("Bitte Rückrufnummer angeben.");return;}
    const reportSummary=`${String(values.get("problem")).trim()}\n${person.name??person.label.split(" · ")[0]} · ${channel}\n${String(values.get("reportedAt")).replace(/^(\d{4})-(\d{2})-(\d{2})T/,'$3.$2.$1 ')} · ${channel==='E-Mail'?upload?.name??'':contact}`;
    setCompleted(previous=>previous.map((value,i)=>i===1 ? reportSummary : value));
    setError("");advanceStep(1);return;
    }
    const planNow=!skipPlanning;
    if (planNow && (!technician || !values.get("appointment"))) {
      setError("Für die Einsatzplanung bitte Techniker und Datum/Uhrzeit auswählen.");
      return;
    }
    if(!object || !person){setError("Bitte Objekt und Kundenperson prüfen.");return;}
    const payload = {
      ...Object.fromEntries(["reporter","problem","reportedAt","channel","contact","externalOrderNumber"].map(key=>[key,String(values.get(key) ?? "")])),
      personScope,personId:person.id,document:channel === "E-Mail" ? upload : null,
      mobileIssue:planNow&&mobileIssue,companionTechnicianIds:planNow ? companions.map(item => item.id) : [],
      bauleiterId:bauleiter?.id ?? "",objectId,unitId:unit?.id ?? "",technicianId:planNow ? technician?.id ?? "" : "",appointment:planNow ? String(values.get("appointment") ?? "") : "",appointmentDuration:planNow ? String(values.get("appointmentDuration") ?? "60") : "",
    };
    setPlanning(planNow);if(!planNow)setMobileIssue(false);
    requestKey.current??=crypto.randomUUID();
    setPending(previous => previous && JSON.stringify(previous.payload) === JSON.stringify(payload) ? previous : {key:requestKey.current!,payload});
    setError("");
    setCompleted(previous=>previous.map((value,i)=>i===2 ? (planNow ? `${technician?.label}\n${String(values.get("appointment")).replace(/^(\d{4})-(\d{2})-(\d{2})T/,'$3.$2.$1 ')} · ${String(values.get("appointmentDuration"))} Min. · ${companions.length} Begleiter${companions.length ? `: ${companions.map(item=>item.label).join("; ")}` : ""}` : "Termin und Techniker müssen später zugeordnet werden.") : value));
    advanceStep(2);
  }

  return <div className={styles.form}>
    <div className="incident-toolbar">
      <div className={styles.captureTitle}><h2>Neuer Serviceauftrag</h2></div>
      {!saved && <button ref={discardButton} className="discard-order-button" type="button" disabled={!dirty || saving || reading} onClick={()=>discardDialog.current?.showModal()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>Auftrag verwerfen
      </button>}
    </div>
    {discardNotice && <Notice tone="neutral" className="discard-feedback" role="status">Erfassung verworfen. Sie können einen neuen Auftrag aufnehmen.</Notice>}
    <AlertDialog dialogRef={discardDialog} title="Auftrag verwerfen?" description="Alle Eingaben dieser Erfassung werden zurückgesetzt. Bereits gespeicherte Serviceaufträge und angelegte Ansprechpartner bleiben erhalten." onCancel={event=>{event.preventDefault();keepDraft();}} actions={<><button type="button" autoFocus onClick={keepDraft}>Weiter bearbeiten</button><button type="button" data-primary="true" disabled={saving||reading} onClick={()=>{if(!saving&&!reading)onDiscard();}}>Auftrag verwerfen</button></>}/>

    {saveWarning&&<Notice tone="error" role="alert">{saveWarning}</Notice>}
    {attempted&&!saved&&<Notice tone="neutral">Die Auftragserstellung wurde angefragt. „Speicherergebnis prüfen“ wiederholt ausschließlich denselben Vorgang und legt keinen zweiten Auftrag an.<button type="button" disabled={saving||reading} onClick={save}>Speicherergebnis prüfen</button></Notice>}
    <form ref={form} noValidate onSubmit={event=>event.preventDefault()} onChange={invalidate}>
    <fieldset disabled={attempted||saving} className="incident-draft-fields">
    <div className="incident-steps">
      {["Objekt & technische Einheit","Meldung & Kontakt","Techniker & Termin"].map((title,index)=><button key={title} ref={index===0 ? firstStep : undefined} type="button" className={`step-card ${completed[index] ? "complete" : ""} ${index===2 && completed[index] && !planning ? "planning-pending" : ""}`} disabled={saving || reading || !!saved || (index>0 && !completed[index-1])} onClick={()=>openStep(index)}>
        <span className="step-heading"><span className="step-number">{completed[index] ? <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{index===2 && !planning ? <path d="M10 4v7m0 4h.01"/> : <path d="m5 10 3 3 7-7"/>}</svg> : index+1}</span>{title}</span>
        <small className={index===1 ? "report-summary" : undefined} title={completed[index] || undefined}>{completed[index] || (index===0 ? "Objekt suchen und zuordnen" : completed[index-1] ? "Bereit zur Eingabe" : "Vorherigen Schritt abschließen")}</small>
        <span className="step-status">{completed[index] ? index===2 && !planning ? "Zuordnung ausstehend · Bearbeiten" : "Bearbeiten" : "Öffnen"}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
      </button>)}
    </div>
      <dialog className="step-dialog" ref={node=>{dialogs.current[0]=node;}} aria-labelledby="step-title-0" onCancel={event=>{event.preventDefault();if(!reading)dialogs.current[0]?.close();}}>
        <div className="dialog-heading"><h2 id="step-title-0">1 · Objekt und technische Einheit zuordnen</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" disabled={reading} onClick={()=>dialogs.current[0]?.close()}>×</button></div>
        <div className="step-dialog-body">
        <p>Objekt suchen und auswählen. Der Einsatzort ergibt sich aus dem Objekt.</p>
        <div className="incident-grid">
          <SearchPicker initialQuery={queries.object} onQueryChange={value=>query("object",value)} label="Objekt" resource="objects" selected={object} onChange={item => {
            setObject(item); setPersonScope("customer"); setUnit(null); setUnitListReady(false); setPerson(null); setContact(""); invalidate();
          }} />
          <TechnicalUnitPicker key={objectId} objectId={objectId} selected={unit} onReady={()=>setUnitListReady(true)} onChange={item => {setUnit(item);invalidate();}} />
        </div>
        {objectId && <ExistingOrders key={`${objectId}:${unit?.id??''}`} objectId={objectId} unitId={unit?.id??''} />}
        {!objectId && <small>Zuerst ein Objekt auswählen, um zugehörige technische Einheiten zu suchen.</small>}
        {error && activeStep===0 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>
        <div className="dialog-footer"><span className="step-progress">Schritt 1 von 3</span><button type="button" disabled={reading || (!!objectId && !unitListReady)} onClick={()=>finishStep(0)}>{reading ? "Upload läuft …" : "Weiter"}</button></div>
      </dialog>
      <dialog className="step-dialog" ref={node=>{dialogs.current[1]=node;}} aria-labelledby="step-title-1" onCancel={event=>{event.preventDefault();if(!reading)dialogs.current[1]?.close();}}>
        <div className="dialog-heading"><h2 id="step-title-1">2 · Meldung aufnehmen</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" disabled={reading} onClick={()=>dialogs.current[1]?.close()}>×</button></div>
        <div className="step-dialog-body">
        <p>Meldung und Kundenkontakt erfassen. * Pflichtangabe</p>
        <div className={styles.popUpField}><span id="incident-channel-label">Wie wird gemeldet? *</span><PopUpButton className={styles.channelPopUp} label="Wie wird gemeldet?" value={channel} disabled={!canWrite||reading} options={reportingChannels.map(item=>({value:item.value,label:item.label}))} onChange={value=>{setChannel(value);setUpload(null);invalidate();}}/><input type="hidden" name="channel" value={channel}/></div>
        <SearchPicker initialQuery={queries.person} onQueryChange={value=>query("person",value)} personScope={personScope} key={`person-${objectId}`} label="Wer meldet die Störung?" resource="persons" objectId={objectId} selected={person} disabled={!objectId} onChange={item => {
          if(item && (!object?.customerNumber || !item.customerNumbers?.includes(object.customerNumber)))setPersonScope("all");
          setPerson(item);setContact(item?.phones?.[0]?.number ?? "");invalidate();
        }} />
        <label className="person-scope-toggle"><input type="checkbox" className="heyelli-switch" role="switch" checked={personScope==="all"} disabled={!objectId || reading || saving || !!saved} onChange={event=>{setPersonScope(event.target.checked ? "all" : "customer");setPerson(null);setContact("");invalidate();}} />Alle Geschäftspartner durchsuchen</label>
        {person && personScope==="all" && <small>Die gewählte Person darf zu einem anderen Kunden gehören. Der Auftrag bleibt dem ausgewählten Objekt zugeordnet.</small>}
        {channel !== "E-Mail" && <>
          {(person?.phones?.length ?? 0) > 1 && <div className={styles.popUpField}><span>Hinterlegte Telefonnummer</span><PopUpButton className={styles.channelPopUp} label="Hinterlegte Telefonnummer auswählen" value={person?.phones?.some(phone=>phone.number===contact)?contact:''} options={[{value:'',label:'Andere Rückrufnummer'},...(person?.phones??[]).map((phone,index)=>({value:phone.number,label:`${phone.label}: ${phone.number}`,separatorBefore:index===0}))]} onChange={value=>{setContact(value);invalidate();}}/></div>}
          <label>Rückrufnummer *<input name="contact" type="tel" value={contact} onChange={event => setContact(event.target.value)} required maxLength={50} placeholder="Rückrufnummer eingeben" /></label>
        </>}
        {channel === "E-Mail" && <label>Dokument zur E-Mail *<input ref={fileInput} type="file" disabled={!canWrite||reading} required={!upload} onChange={event=>{
          const file=event.target.files?.[0];setError('');if(!file)return;
          if(file.size>100*1024*1024||!file.size){event.target.value='';setError('Bitte eine Datei mit maximal 100 MB auswählen.');return;}
          const candidate={file,id:crypto.randomUUID()};fileStaged.current=false;setPendingUpload(candidate);setPendingFile({id:candidate.id,name:file.name});void sendUpload(candidate);
        }}/><small>Maximal 100 MB. Erkennbare ausführbare Binärdateien sind ausgeschlossen.</small></label>}
        {pendingUpload&&!reading&&channel==='E-Mail'&&<div className="incident-actions"><button type="button" disabled={!canWrite} onClick={()=>void sendUpload(pendingUpload)}>Upload erneut versuchen</button>{upload&&<button type="button" onClick={()=>{setPendingUpload(null);setPendingFile(null);setError('');if(fileInput.current)fileInput.current.value='';}}>Bisheriges Dokument verwenden</button>}</div>}
        {reading && <Notice tone="neutral" role="status">Dokument wird hochgeladen …</Notice>}
        {upload && channel === "E-Mail" && <Notice tone="success" role="status">{pendingUpload?'Bisher bestätigt: ':'Hochgeladen: '}{upload.name}</Notice>}
        <label>Was ist die Störung? *<textarea value={fields.problem} onChange={event=>setFields(previous=>({...previous,problem:event.target.value}))} name="problem" required maxLength={4000} rows={3} placeholder="Störung, Symptome und bereits unternommene Maßnahmen" /></label>
        <div className="incident-grid">
          <CalendarDateTimeField draftValue={dates.reportedAt} onDraftChange={value=>setDates(previous=>({...previous,reportedAt:value}))} name="reportedAt" label="Gemeldet am" defaultNow required onValueChange={invalidate}/>
        </div>
        <label>Externe Auftragsnummer (optional)<input value={fields.externalOrderNumber} onChange={event=>setFields(previous=>({...previous,externalOrderNumber:event.target.value}))} name="externalOrderNumber" maxLength={160} placeholder="Auftragsnummer des Auftraggebers" /></label>
        {error && activeStep===1 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>
        <div className="dialog-footer"><span className="step-progress">Schritt 2 von 3</span><button type="button" disabled={reading} onClick={()=>finishStep(1)}>{reading ? "Upload läuft …" : "Weiter"}</button></div>
      </dialog>
      <dialog className="step-dialog" ref={node=>{dialogs.current[2]=node;}} aria-labelledby="step-title-2" onCancel={event=>{event.preventDefault();if(!reading)dialogs.current[2]?.close();}}>
        <div className="dialog-heading"><h2 id="step-title-2">3 · Techniker einplanen</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" disabled={reading} onClick={()=>dialogs.current[2]?.close()}>×</button></div>
        <div className="step-dialog-body">
        <PlanningFields searchDraft={queries} onSearchDraft={query} dateDraft={dates.appointment} onDateDraft={value=>setDates(previous=>({...previous,appointment:value}))} durationText={fields.appointmentDuration} onDurationText={value=>setFields(previous=>({...previous,appointmentDuration:value}))} onPlanningChange={invalidate} technician={technician} companions={companions} onTechnician={item=>{setTechnician(item);invalidate();}} onCompanions={items=>{setCompanions(items);invalidate();}}/>
        {error && activeStep===2 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>
        <div className="dialog-footer"><span className="step-progress">Schritt 3 von 3</span><div className="step-footer-actions"><button className="skip-planning-button" type="button" disabled={reading} onClick={()=>finishStep(2,true)}>Schritt überspringen</button><button type="button" disabled={reading} onClick={()=>finishStep(2)}>{reading ? "Upload läuft …" : "Weiter"}</button></div></div>
      </dialog>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <section className={styles.completion} aria-label="Serviceauftrag abschließen" aria-busy={saving}>
        {saved ? <div className={styles.savedResult}>
          <span className={styles.savedIcon} aria-hidden="true">✓</span>
          <div role="status"><h3>Auftrag {saved} gespeichert</h3><p>{mobileIssue ? "Mobil ausgegeben · Techniker und Termin zugeordnet." : planning ? "Techniker und Termin sind zugeordnet." : "Die Einsatzplanung kann später ergänzt werden."}</p></div>
          <div className={styles.savedActions}>
            {upload && channel === "E-Mail" && <a href={`/api/pds-simulator/orders/${saved}/document`}>Dokument herunterladen</a>}
            <a href="/casedesk">Weiteren Auftrag aufnehmen ›</a>
            {savedLinks.calendar&&<GuardedLink href={savedLinks.calendar} onClick={event=>{if(window.parent!==window&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();window.parent.postMessage({type:'heyelli:tool-navigate',href:savedLinks.calendar},location.origin);}}}>Termin im PlanBoard öffnen ›</GuardedLink>}
            {savedLinks.service&&<GuardedLink href={savedLinks.service} onClick={event=>{if(window.parent!==window&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();window.parent.postMessage({type:'heyelli:tool-navigate',href:savedLinks.service},location.origin);}}}>Serviceauftrag im Service öffnen ›</GuardedLink>}
          </div>
        </div> : <>
          <h3>Auftrag speichern</h3>
          <div className={styles.completionFields}>
            <div ref={projectAssignment} onChange={event=>{event.stopPropagation();setDirty(true);setDiscardNotice(false);}}>
              <SearchPicker initialQuery={queries.bauleiter} onQueryChange={value=>query("bauleiter",value)} label="Projektleiter" required resource="siteManagers" selected={bauleiter} disabled={saving || reading} onChange={item=>{
                if(item?.id===bauleiter?.id)return;
                setDirty(true);setDiscardNotice(false);setBauleiter(item);
                setPending(previous=>previous ? {key:previous.key,payload:{...previous.payload,bauleiterId:item?.id ?? ""}} : null);
              }} />
            </div>
            <label className={styles.mobileChoice}>
              <span><strong>Nach dem Anlegen mobil ausgeben</strong><small>{planning&&technician?`Haupttechniker: ${technician.label}`:'Mit Techniker und Termin aus Schritt 3 verfügbar.'}</small></span>
              <input type="checkbox" className="heyelli-switch" role="switch" checked={mobileIssue} disabled={!planning||!completed[2]||!technician||saving||reading} onChange={event=>{event.stopPropagation();const value=event.target.checked;setMobileIssue(value);setDirty(true);setPending(previous=>previous?{...previous,payload:{...previous.payload,mobileIssue:value}}:null);}}/>
            </label>
          </div>
          <div className={styles.completionActions}>
            <div id="save-requirements" className={styles.completionStatus} role="status">
              <strong>{saving ? "Auftrag wird gespeichert …" : !completed.every(Boolean) || !bauleiter ? `Noch offen: ${[...(["Objekt", "Meldung", "Einsatzplanung"].filter((_,index)=>!completed[index])),...(!bauleiter ? ["Projektleiter"] : [])].join(" · ")}` : "Alles bereit zum Speichern"}</strong>
              <small>Die Auftragsnummer wird automatisch vergeben.</small>
            </div>
            <button ref={saveButton} className="save-order-button" type="button" onClick={save} aria-describedby="save-requirements" disabled={!canWrite || !completed.every(Boolean) || !bauleiter || !pending || saving || reading}>{saving ? "Wird gespeichert …" : "Serviceauftrag speichern"}</button>
          </div>
        </>}
      </section>
    </fieldset></form>
  </div>;
}
