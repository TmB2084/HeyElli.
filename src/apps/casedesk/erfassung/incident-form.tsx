"use client";

import {Button,Card,Input,Switch,Textarea} from '@/platform/ui';
import {CalendarDateTimeField} from '@/apps/planboard/kalender/ui';
import {PlanningFields} from './planning-fields';
import {AlertDialog,Notice,GuardedLink,PopUpButton} from "@/platform/shell";
import {useDraftNavigationGuard} from "@/platform/shell";
import {formatReportSummary,maxOrderRemarkLength,reportingChannels} from "@/platform/pds/simulator/reporting";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {Chronicle} from '@/apps/servicehub/akten/chronicle';
import { SearchPicker, TechnicalUnitPicker, type SearchItem } from "./search-picker";
import {openToolDrafts,type ToolDraftSession} from "./tool-draft-client";
import {linkMailOrder,useMailPrefill} from "./mail-prefill";
import {useSearchParams} from "next/navigation";
import type {IncidentState} from "./tool-drafts";
import styles from "./incident-workspace.module.css";

type IncidentProps={canWrite:boolean;chronicleRevision?:string};

export function IncidentForm({canWrite=true,tool=false,chronicleRevision}:{canWrite?:boolean;tool?:boolean;chronicleRevision?:string}) {
  if(tool)return <DurableIncidentForm canWrite={canWrite} chronicleRevision={chronicleRevision}/>;
  return <TransientIncidentForm canWrite={canWrite} chronicleRevision={chronicleRevision}/>;
}
function TransientIncidentForm({canWrite,chronicleRevision}:IncidentProps){
  const [revision,setRevision]=useState(0),mailId=useSearchParams().get('ausMail'),prefill=useMailPrefill(mailId),[linked,setLinked]=useState<''|'ok'|'failed'>('');
  if(mailId&&prefill.status==='loading')return <Notice tone="neutral">Mail aus MailDesk wird übernommen …</Notice>;
  // Aus MailDesk: vorausgefüllte Erfassung; nach dem Speichern wird der Auftrag mit der Mail verknüpft.
  return <>{mailId&&prefill.status==='ready'&&revision===0&&<Notice tone="neutral">Aus MailDesk: „{prefill.subject}“. Objekt, Beschreibung und die Mail als Dokument sind übernommen. Nach dem Speichern wird der Auftrag mit der Mail verknüpft.</Notice>}
   {prefill.error&&<Notice tone="error" role="alert">{prefill.error}</Notice>}
   {linked==='ok'&&<Notice tone="neutral" role="status">Auftrag mit der Mail in MailDesk verknüpft. <GuardedLink href={'/maildesk?'+new URLSearchParams({id:mailId??''})}>Zur Mail</GuardedLink></Notice>}
   {linked==='failed'&&<Notice tone="error" role="alert">Der Auftrag ist gespeichert, die Verknüpfung mit der Mail konnte aber nicht bestätigt werden. In MailDesk unter „Beim Kunden“ → „Mail anhängen“ nachholen.</Notice>}
   <IncidentDraft chronicleRevision={chronicleRevision} canWrite={canWrite} key={revision} initial={revision===0?prefill.initial:undefined} wasDiscarded={revision>0} onDiscard={()=>setRevision(value=>value+1)} onCompleted={number=>{if(mailId&&number&&revision===0)void linkMailOrder(mailId,number).then(ok=>setLinked(ok?'ok':'failed'));}}/></>;
}

function DurableIncidentForm({canWrite,chronicleRevision}:IncidentProps){
 const [session,setSession]=useState<ToolDraftSession|null>(null),[problem,setProblem]=useState(''),[attempt,setAttempt]=useState(0),[revision,setRevision]=useState(0),[preferred,setPreferred]=useState<string|undefined>();
 useEffect(()=>{const controller=new AbortController();let opened:ToolDraftSession|undefined;void openToolDrafts(controller.signal,text=>{if(!controller.signal.aborted)setProblem(text);},preferred).then(value=>{opened=value;if(!controller.signal.aborted){setSession(value);setProblem('');}}).catch(()=>{if(!controller.signal.aborted)setProblem('Die geschützte Auftragssicherung kann gerade nicht geöffnet werden. Vorhandene Eingaben bleiben erhalten. Bitte die Verbindung prüfen.');});return()=>{controller.abort();opened?.close();};},[attempt,preferred]);
 if(!session)return <Notice tone={problem?'error':'neutral'}>{problem||'Geschützte Auftragssicherung wird geöffnet …'}{problem&&<Button variant="outline" shape="capsule" onClick={()=>setAttempt(value=>value+1)}>Erneut prüfen</Button>}</Notice>;
 return <>{problem&&<Notice tone="error" role="alert">{problem}</Notice>}{session.otherCount>0&&<Notice tone="neutral">Weitere Erfassungen sind getrennt gesichert. Bereits in anderen Tabs geöffnete Aufträge werden dort fortgesetzt.<PopUpButton label="Angefangenen Auftrag fortsetzen" value={session.branchId} options={[{value:session.branchId,label:'Aktuelle Erfassung'},...session.branches.filter(branch=>branch.id!==session.branchId).map((branch,index)=>({value:branch.id,label:`Erfassung vom ${new Date(branch.updatedAt).toLocaleString('de-DE')}`,separatorBefore:index===0}))]} onChange={value=>{setPreferred(value);setSession(null);setRevision(0);setAttempt(current=>current+1);}}/></Notice>}<IncidentDraft chronicleRevision={chronicleRevision} key={session.branchId+':'+revision} initial={revision?undefined:session.initial as IncidentState|undefined} canWrite={canWrite} wasDiscarded={revision>0} onDiscard={()=>{try{session.complete();setRevision(value=>value+1);}catch{setProblem('Die Erfassung konnte nicht sicher verworfen werden. Deine Eingaben bleiben geöffnet.');}}} onSnapshot={state=>{try{session.save(state as unknown as Record<string,unknown>);}catch{setProblem('Die Auftragssicherung ist fehlgeschlagen. Bitte dieses Fenster geöffnet lassen und die Verbindung oder den Browserspeicher prüfen.');throw Error('Auftragssicherung fehlgeschlagen.');}}} confirmSnapshot={()=>session.confirm()} onCompleted={()=>session.complete()} stageFile={(id,file)=>session.stageFile(id,file)} restoreFile={id=>session.restoreFile(id)}/></>;
}

const stepTitles=["Objekt & technische Einheit","Meldung & Kontakt","Techniker & Termin","Abschluss"] as const;
const outlineIcons=[
  "M4 20V9l8-5 8 5v11M9 20v-6h6v6",
  "M5 5h14v11H9l-4 4zM8 9h8m-8 3h6",
  "M4 5h16v15H4zM4 10h16M8 3v4m8-4v4",
  "M9 4H5v17h14V4h-4M9 2h6v4H9zM8 11h8m-8 4h8",
];
function StepIcon({index}:{index:number}){
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={outlineIcons[index]}/></svg>;
}

function IncidentDraft({wasDiscarded,onDiscard,canWrite,chronicleRevision,initial,onSnapshot,confirmSnapshot,onCompleted,stageFile,restoreFile}:IncidentProps & {wasDiscarded:boolean;onDiscard:()=>void;initial?:IncidentState;onSnapshot?:(state:IncidentState)=>void;confirmSnapshot?:()=>Promise<void>;onCompleted?:(number?:string)=>void;stageFile?:(id:string,file:File)=>Promise<void>;restoreFile?:(id:string)=>Promise<File>}) {
  const discardDialog=useRef<HTMLDialogElement>(null);
  const discardButton=useRef<HTMLButtonElement>(null);
  const stepButtons=useRef<(HTMLButtonElement|null)[]>([]);
  const panels=useRef<(HTMLElement|null)[]>([]);
  const stepsId=useId();
  const [discardNotice,setDiscardNotice]=useState(wasDiscarded);
  const [dirty,setDirty]=useState(!!initial);
  useEffect(()=>{if(wasDiscarded)stepButtons.current[0]?.focus();},[wasDiscarded]);
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
  const [activeStep,setActiveStep] = useState(initial?.pending&&initial.completed.every(Boolean)?3:initial?.activeStep??0);
  const focusStep=useRef<number|null>(null);
  useLayoutEffect(()=>{
    if(focusStep.current!==activeStep)return;
    focusStep.current=null;
    stepButtons.current[activeStep]?.focus();
  },[activeStep]);
  const [completed,setCompleted] = useState<string[]>(initial?.completed??["","",""]);
  function invalidate() {
    reloadSafe.current=false;setDirty(true);setDiscardNotice(false);
    setCompleted(previous=>previous.map((value,index)=>index>=activeStep ? "" : value));
    setPending(null);
  }
  function openStep(index:number) {
    setDiscardNotice(false);
    focusStep.current=index;
    setActiveStep(index);
    setError("");
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
    const remark=fields.remark?.trim();
    if(!form.current || reading) return;
    const values = new FormData(form.current);
    const panelFields=panels.current[index]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea");
    if(panelFields && !(index===2 && skipPlanning)) for(const field of panelFields) if(!field.reportValidity()) return;
    if(index===0) {
      if(!object){setError("Bitte ein Objekt auswählen.");return;}
      if(!unitListReady){setError("Bitte warten, bis die technischen Einheiten geladen sind.");return;}
      setCompleted(previous=>previous.map((value,i)=>i===0 ? `${object.label}\n${unit?.label ?? "Technische Einheit noch offen"}` : value));
      setError("");openStep(1);return;
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
    setError("");openStep(2);return;
    }
    const planNow=!skipPlanning;
    if (planNow && (!technician || !values.get("appointment"))) {
      setError("Für die Einsatzplanung bitte Techniker und Datum/Uhrzeit auswählen.");
      return;
    }
    if(!object || !person){setError("Bitte Objekt und Kundenperson prüfen.");return;}
    const payload = {
      ...Object.fromEntries(["reporter","problem","reportedAt","channel","contact","externalOrderNumber"].map(key=>[key,String(values.get(key) ?? "")])),
      ...(remark?{remark}:{}),personScope,personId:person.id,document:channel === "E-Mail" ? upload : null,
      mobileIssue:planNow&&mobileIssue,companionTechnicianIds:planNow ? companions.map(item => item.id) : [],
      bauleiterId:bauleiter?.id ?? "",objectId,unitId:unit?.id ?? "",technicianId:planNow ? technician?.id ?? "" : "",appointment:planNow ? String(values.get("appointment") ?? "") : "",appointmentDuration:planNow ? String(values.get("appointmentDuration") ?? "60") : "",
    };
    setPlanning(planNow);if(!planNow)setMobileIssue(false);
    requestKey.current??=crypto.randomUUID();
    setPending(previous => previous && JSON.stringify(previous.payload) === JSON.stringify(payload) ? previous : {key:requestKey.current!,payload});
    setError("");
    setCompleted(previous=>previous.map((value,i)=>i===2 ? (planNow ? `${technician?.label}\n${String(values.get("appointment")).replace(/^(\d{4})-(\d{2})-(\d{2})T/,'$3.$2.$1 ')} · ${String(values.get("appointmentDuration"))} Min. · ${companions.length} Begleiter${companions.length ? `: ${companions.map(item=>item.label).join("; ")}` : ""}` : "Termin und Techniker müssen später zugeordnet werden.") : value));
    openStep(3);
  }

  const reportText=pending&&person?formatReportSummary({
    reporter:person.name??person.label.split(" · ")[0],
    channel:String(pending.payload.channel??channel),
    contact:String(pending.payload.contact??contact),
    reportedAt:String(pending.payload.reportedAt??"").trim(),
    problem:String(pending.payload.problem??""),
    externalOrderNumber:String(pending.payload.externalOrderNumber??""),
  }):'';
  const summaries=[completed[0],completed[1]&&fields.problem.trim(),completed[2],saved?'Gespeichert':'Auftrag prüfen und speichern'];
  function step(index:number,children:ReactNode){
    const current=activeStep===index,available=completed.slice(0,index).every(Boolean)&&(index!==3||!!pending);
    const done=index===3?Boolean(saved):Boolean(completed[index]);
    const headingId=stepsId+'-heading-'+index,panelId=stepsId+'-panel-'+index;
    const statusId=stepsId+'-status-'+index;
    const planningDeferred=index===2&&done&&!planning;
    return <div className={styles.accordionStep} data-current={current||undefined} data-deferred={planningDeferred||undefined} data-complete={done&&!planningDeferred||undefined}>
      <Button ref={node=>{stepButtons.current[index]=node;}} variant="ghost" className={styles.stepHeader}
        id={headingId} aria-label={stepTitles[index]} aria-expanded={current} aria-controls={panelId} aria-describedby={statusId}
        disabled={saving||reading||!!saved||!available} onClick={()=>{if(!current)openStep(index);}}>
        <span className={styles.stepNumber}>{index+1}</span>
        <span className={styles.stepIcon}><StepIcon index={index}/></span>
        <span className={styles.stepTitle}>{stepTitles[index]}</span>
        <span id={statusId} className="sr-only">{planningDeferred?"Später planen":done?"Abgeschlossen":current?"In Bearbeitung":available?"Bereit zur Eingabe":"Ausstehend"}</span>
        {!current&&!planningDeferred&&<small className={styles.stepSummary}>{summaries[index]||(!available?'Ausstehend':'Bereit zur Eingabe')}</small>}
        {!current&&done&&<span className={styles.stepComplete} aria-hidden="true">{planningDeferred?"Später planen":"✓"}</span>}
      </Button>
      <section id={panelId} ref={node=>{panels.current[index]=node;}} className={styles.stepPanel}
        aria-labelledby={headingId} hidden={!current}>{children}</section>
    </div>;
  }
  function footer(index:number){
    return <footer className={styles.stepFooter}><span className={styles.stepProgress}>Schritt {index+1} von 4</span>
      <div className={styles.stepActions}>
        {index>0&&<Button variant="ghost" shape="capsule" disabled={reading} onClick={()=>openStep(index-1)}>Zurück</Button>}
        {index===2&&<Button variant="outline" shape="capsule" disabled={reading} onClick={()=>finishStep(2,true)}>Schritt überspringen</Button>}
        <Button shape="capsule" disabled={reading||index===0&&!!objectId&&!unitListReady} onClick={()=>finishStep(index)}>
          {reading?"Upload läuft …":index===2?"Weiter zum Abschluss":"Weiter"}
        </Button>
      </div>
    </footer>;
  }

  return <Card className={styles.form}>
    <div className="incident-toolbar">
      <div className={styles.captureTitle}><h2>Neuer Serviceauftrag</h2></div>
      {!saved && <Button ref={discardButton} className="discard-order-button" variant="outline" shape="capsule" disabled={!dirty || saving || reading} onClick={()=>discardDialog.current?.showModal()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>Auftrag verwerfen
      </Button>}
    </div>
    {discardNotice && <Notice tone="neutral" className="discard-feedback" role="status">Erfassung verworfen. Sie können einen neuen Auftrag aufnehmen.</Notice>}
    <AlertDialog dialogRef={discardDialog} title="Auftrag verwerfen?" description="Alle Eingaben dieser Erfassung werden zurückgesetzt. Bereits gespeicherte Serviceaufträge und angelegte Ansprechpartner bleiben erhalten." onCancel={event=>{event.preventDefault();keepDraft();}} actions={<><Button variant="outline" shape="capsule" autoFocus onClick={keepDraft}>Weiter bearbeiten</Button><Button shape="capsule" data-primary="true" disabled={saving||reading} onClick={()=>{if(!saving&&!reading)onDiscard();}}>Auftrag verwerfen</Button></>}/>

    {saveWarning&&<Notice tone="error" role="alert">{saveWarning}</Notice>}
    {attempted&&!saved&&<Notice tone="neutral">Die Auftragserstellung wurde angefragt. „Speicherergebnis prüfen“ wiederholt ausschließlich denselben Vorgang und legt keinen zweiten Auftrag an.<Button variant="outline" shape="capsule" disabled={saving||reading} onClick={save}>Speicherergebnis prüfen</Button></Notice>}
    <form ref={form} noValidate onSubmit={event=>event.preventDefault()} onChange={invalidate}>
    <fieldset disabled={attempted||saving} className="incident-draft-fields">
    <div className={styles.accordion} data-active-step={activeStep} aria-label="Schritte der Auftragserfassung">
      {step(0,<><div className={styles.stepBody}>
        <p>Objekt suchen und auswählen. Der Einsatzort ergibt sich aus dem Objekt.</p>
        <div className="incident-grid">
          <SearchPicker initialQuery={queries.object} onQueryChange={value=>query("object",value)} label="Objekt" resource="objects" selected={object} onChange={item => {
            setObject(item); setPersonScope("customer"); setUnit(null); setUnitListReady(false); setPerson(null); setContact(""); invalidate();
          }} />
          <TechnicalUnitPicker key={objectId} objectId={objectId} selected={unit} onReady={()=>setUnitListReady(true)} onChange={item => {setUnit(item);invalidate();}} />
        </div>
        {activeStep===0&&unit&&chronicleRevision&&<Chronicle key={unit.id} id={unit.id} revision={chronicleRevision} pageSize={5} defaultOpen={false}/>}
        {!objectId && <small>Zuerst ein Objekt auswählen, um zugehörige technische Einheiten zu suchen.</small>}
        {error && activeStep===0 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>{footer(0)}</>)}
      {step(1,<><div className={styles.stepBody}>
        <p>Meldung und Kundenkontakt erfassen. * Pflichtangabe</p>
        <div className={styles.popUpField}><span id="incident-channel-label">Wie wird gemeldet? *</span><PopUpButton className={styles.channelPopUp} label="Wie wird gemeldet?" value={channel} disabled={!canWrite||reading} options={reportingChannels.map(item=>({value:item.value,label:item.label}))} onChange={value=>{setChannel(value);setUpload(null);invalidate();}}/><input type="hidden" name="channel" value={channel}/></div>
        <SearchPicker initialQuery={queries.person} onQueryChange={value=>query("person",value)} personScope={personScope} key={`person-${objectId}-${personScope}`} label="Wer meldet die Störung?" resource="persons" objectId={objectId} selected={person} disabled={!objectId} onChange={item => {
          if(item && (!object?.customerNumber || !item.customerNumbers?.includes(object.customerNumber)))setPersonScope("all");
          setPerson(item);setContact(item?.phones?.[0]?.number ?? "");invalidate();
        }} />
        <label className="person-scope-toggle"><Switch checked={personScope==="all"} disabled={!objectId || reading || saving || !!saved} onChange={event=>{setPersonScope(event.target.checked ? "all" : "customer");setPerson(null);setContact("");invalidate();}} />Alle Geschäftspartner durchsuchen</label>
        {person && personScope==="all" && <small>Die gewählte Person darf zu einem anderen Kunden gehören. Der Auftrag bleibt dem ausgewählten Objekt zugeordnet.</small>}
        {channel !== "E-Mail" && <>
          {(person?.phones?.length ?? 0) > 1 && <div className={styles.popUpField}><span>Hinterlegte Telefonnummer</span><PopUpButton className={styles.channelPopUp} label="Hinterlegte Telefonnummer auswählen" value={person?.phones?.some(phone=>phone.number===contact)?contact:''} options={[{value:'',label:'Andere Rückrufnummer'},...(person?.phones??[]).map((phone,index)=>({value:phone.number,label:`${phone.label}: ${phone.number}`,separatorBefore:index===0}))]} onChange={value=>{setContact(value);invalidate();}}/></div>}
          <label>Rückrufnummer *<Input name="contact" type="tel" value={contact} onChange={event => setContact(event.target.value)} required maxLength={50} placeholder="Rückrufnummer eingeben" /></label>
        </>}
        {channel === "E-Mail" && <label>Dokument zur E-Mail *<Input ref={fileInput} type="file" disabled={!canWrite||reading} required={!upload} onChange={event=>{
          const file=event.target.files?.[0];setError('');if(!file)return;
          if(file.size>100*1024*1024||!file.size){event.target.value='';setError('Bitte eine Datei mit maximal 100 MB auswählen.');return;}
          const candidate={file,id:crypto.randomUUID()};fileStaged.current=false;setPendingUpload(candidate);setPendingFile({id:candidate.id,name:file.name});void sendUpload(candidate);
        }}/><small>Maximal 100 MB. Erkennbare ausführbare Binärdateien sind ausgeschlossen.</small></label>}
        {pendingUpload&&!reading&&channel==='E-Mail'&&<div className="incident-actions"><Button variant="outline" shape="capsule" disabled={!canWrite} onClick={()=>void sendUpload(pendingUpload)}>Upload erneut versuchen</Button>{upload&&<Button variant="outline" shape="capsule" onClick={()=>{setPendingUpload(null);setPendingFile(null);setError('');if(fileInput.current)fileInput.current.value='';}}>Bisheriges Dokument verwenden</Button>}</div>}
        {reading && <Notice tone="neutral" role="status">Dokument wird hochgeladen …</Notice>}
        {upload && channel === "E-Mail" && <Notice tone="success" role="status">{pendingUpload?'Bisher bestätigt: ':'Hochgeladen: '}{upload.name}</Notice>}
        <label>Was ist die Störung? *<Textarea value={fields.problem} onChange={event=>setFields(previous=>({...previous,problem:event.target.value}))} name="problem" required maxLength={4000} rows={3} placeholder="Störung, Symptome und bereits unternommene Maßnahmen" /></label>
        <div className="incident-grid">
          <CalendarDateTimeField draftValue={dates.reportedAt} onDraftChange={value=>setDates(previous=>({...previous,reportedAt:value}))} name="reportedAt" label="Gemeldet am" defaultNow required onValueChange={invalidate}/>
        </div>
        <label>Externe Auftragsnummer (optional)<Input value={fields.externalOrderNumber} onChange={event=>setFields(previous=>({...previous,externalOrderNumber:event.target.value}))} name="externalOrderNumber" maxLength={160} placeholder="Auftragsnummer des Auftraggebers" /></label>
        {error && activeStep===1 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>{footer(1)}</>)}
      {step(2,<><div className={styles.stepBody}>
        <PlanningFields searchDraft={queries} onSearchDraft={query} dateDraft={dates.appointment} onDateDraft={value=>setDates(previous=>({...previous,appointment:value}))} durationText={fields.appointmentDuration} onDurationText={value=>setFields(previous=>({...previous,appointmentDuration:value}))} onPlanningChange={invalidate} technician={technician} companions={companions} onTechnician={item=>{setTechnician(item);invalidate();}} onCompanions={items=>{setCompanions(items);invalidate();}}/>
        {error && activeStep===2 && <Notice tone="error" role="alert">{error}</Notice>}
        </div>{footer(2)}</>)}
      {step(3,<div className={styles.stepBody}><section className={styles.completion} aria-label="Serviceauftrag abschließen" aria-busy={saving}>
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
          <h3>Auftrag prüfen</h3>
          <dl className={styles.reviewFacts}>
            <div><dt>Objekt & technische Einheit</dt><dd>{completed[0]}</dd></div>
            <div><dt>Techniker & Termin</dt><dd>{completed[2]}</dd></div>
            {upload&&channel==='E-Mail'&&<div><dt>Dokument zur E-Mail</dt><dd>{upload.name}</dd></div>}
          </dl>
          <Card className={styles.reviewReport} role="region" aria-label="Vollständiger Meldungstext">
            <h3>Meldungstext</h3><p className={styles.reportText}>{reportText}</p>
          </Card>
          {error&&activeStep===3&&<Notice tone="error" role="alert">{error}</Notice>}
          <Card className={styles.reviewReport}>
            <label className={styles.remarkField}>PDS-Bemerkung <span className="required-label">· optional</span>
              <Textarea value={fields.remark??""} maxLength={maxOrderRemarkLength} rows={3} onChange={event=>{
                event.stopPropagation();
                const remark=event.currentTarget.value;
                setFields(previous=>({...previous,remark}));
                reloadSafe.current=false;setDirty(true);setDiscardNotice(false);
                setPending(previous=>previous?{...previous,payload:{...previous.payload,remark}}:null);
              }}/>
            </label>
          </Card>
          <Card className={styles.completionFields}>
            <div onChange={event=>{event.stopPropagation();setDirty(true);setDiscardNotice(false);}}>
              <SearchPicker initialQuery={queries.bauleiter} onQueryChange={value=>query("bauleiter",value)} label="Projektleiter" required resource="siteManagers" selected={bauleiter} disabled={saving || reading} onChange={item=>{
                if(item?.id===bauleiter?.id)return;
                setDirty(true);setDiscardNotice(false);setBauleiter(item);
                setPending(previous=>previous ? {key:previous.key,payload:{...previous.payload,bauleiterId:item?.id ?? ""}} : null);
              }} />
            </div>
            <label className={styles.mobileChoice}>
              <span><strong>Nach dem Anlegen mobil ausgeben</strong><small>{planning&&technician?`Haupttechniker: ${technician.label}`:'Mit Techniker und Termin aus Schritt 3 verfügbar.'}</small></span>
              <Switch checked={mobileIssue} disabled={!planning||!completed[2]||!technician||saving||reading} onChange={event=>{event.stopPropagation();const value=event.target.checked;setMobileIssue(value);setDirty(true);setPending(previous=>previous?{...previous,payload:{...previous.payload,mobileIssue:value}}:null);}}/>
            </label>
          </Card>
          <div className={styles.completionActions}>
            <div id="save-requirements" className={styles.completionStatus} role="status">
              <strong>{saving ? "Auftrag wird gespeichert …" : !completed.every(Boolean) || !bauleiter ? `Noch offen: ${[...(["Objekt", "Meldung", "Einsatzplanung"].filter((_,index)=>!completed[index])),...(!bauleiter ? ["Projektleiter"] : [])].join(" · ")}` : "Alles bereit zum Speichern"}</strong>
              <small>Die Auftragsnummer wird automatisch vergeben.</small>
            </div>
            <div className={styles.stepActions}><Button variant="ghost" shape="capsule" onClick={()=>openStep(2)}>Zurück</Button>
            <Button shape="capsule" onClick={save} aria-describedby="save-requirements" disabled={!canWrite || !completed.every(Boolean) || !bauleiter || !pending || saving || reading}>{saving ? "Wird gespeichert …" : "Serviceauftrag speichern"}</Button></div>
          </div>
        </>}
      </section></div>)}
    </div>
    </fieldset></form>
  </Card>;
}
