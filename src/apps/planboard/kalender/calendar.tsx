"use client";
import {useRouter,useSearchParams} from "next/navigation";
import {useServiceRead} from "./use-service-read";
import {calendarTextColor} from './contrast';
import {openPrivateDrafts,isDraftStorageLocked} from '../entwuerfe/browser';
import type {DraftStorage} from './drafts';

import {Notice} from "@/platform/shell";
import {saveFailure,notifySaveFailure} from "./background-saving";
import {recoverDraft,type Recovery} from "./draft-recovery";
import {GuardedLink} from "@/platform/shell";
import {TeamOverview} from "./team-overview";
import {BulkMobile} from "./bulk-mobile";
import {CancelOrder} from "./cancel-order";
import {CalendarColorPreview} from "./color-preview";
import {CalendarQuickMenu} from "./quick-menu";
import {MobileIssue} from "./mobile-issue";
import {CalendarHistory} from "./history";
import {CalendarPeriodPicker} from "./period-picker";
import {CalendarConflictDialog} from "./conflict-dialog";
import {listDrafts,replaceDraft,completeDraft,removeSavedDrafts,draftPrefix,type CalendarDraft} from "./drafts";
import {mergeCalendarEvents,fieldValue,mergeLabels,type ConflictProvenance,type MergeField,draftAuthors} from "./domain";
import {useCalendarSynchronization} from "./use-synchronization";
import {CalendarReadError} from "./synchronization";
import {ResourceSelectionDialog} from "./resource-selection-dialog";
import {ContinuationDialog} from "./continuation-dialog";
import type {ContinuationPlan} from "./domain";
import {PlanningWarningDialog} from "./planning-warning-dialog";
import type {PlanningWarning} from "./domain";
import {CalendarOptionFields} from "./option-fields";
import {CalendarLegendDialog} from "./legend-dialog";
import {visibleLegendEvents} from "./legend";
import {contractServiceLabels,applyOptions,eventOptions,optionChanges,typeLabels,type CalendarOptions} from "./domain";
import {CreateCalendarDialog,type CreationSeed} from "./create-dialog";
import {CompanionPicker,MainTechnicianPicker,ResourcePicker} from "./companion-picker";
import {useCallback,useEffect,useEffectEvent,useLayoutEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from "react";
import {visibleDayOffsets,weekday,isWeekend} from "./domain";
import {resourceCapacity,type ResourceWorkingTime,addDays,berlinWall,wallInstant,wallMinutes,moveEvent,vacationApprovalLabels,calendarWeekLabel,workingTimeWindow,axisPosition,axisDragMinutes,axisSlot,type TimeWindow,eventColors,statusLabels,type CalendarData,type CalendarEvent} from "./domain";
type View="day"|"week"|"month";
type Edit={event:CalendarEvent;resourceId:string};
type Drag={event:CalendarEvent;resourceId:string;operation:"move"|"start"|"end";x:number;y:number;pointer:number;preview:CalendarEvent;offsetY:number;moved:boolean;error:string};
const time=(value:string)=>berlinWall(value).slice(11);
const dayLabel=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat("de-DE",{timeZone:"UTC",...options}).format(new Date(value+"T12:00:00Z"));
function interval(anchor:string,view:View){
  if(view==="day")return {from:anchor,days:1};
  const date=new Date(anchor+"T12:00:00Z");
  if(view==="week")return {from:addDays(anchor,-((date.getUTCDay()+6)%7)),days:7};
  return {from:anchor.slice(0,8)+"01",days:new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()};
}
function lanes(events:CalendarEvent[]){const ends:number[]=[];return [...events].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id)).map(event=>{let lane=ends.findIndex(end=>end<=Date.parse(event.start));if(lane<0)lane=ends.length;ends[lane]=Date.parse(event.end);return {event,lane};});}
export function ResourceCalendar(){
  const dataSourceRef=useRef<string|null>(null);
  const quickTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(quickTimer.current)clearTimeout(quickTimer.current);},[]);
  const [quick,setQuick]=useState<{event:CalendarEvent;resourceId:string;anchor:{left:number;right:number;top:number;bottom:number}}|null>(null);
  const [teamOpen,setTeamOpen]=useState(false);
  const [historyVersion,setHistoryVersion]=useState(0);
  const [scrollRequest,setScrollRequest]=useState(0);
  const appliedScroll=useRef<{board:HTMLDivElement;request:number}|null>(null);
  const [currentWall,setCurrentWall]=useState("");
  useEffect(()=>{
    const refresh=()=>setCurrentWall(berlinWall(new Date().toISOString()));
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{refresh();timer=setTimeout(tick,60000-Date.now()%60000);};
    const frame=requestAnimationFrame(tick);
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return ()=>{cancelAnimationFrame(frame);clearTimeout(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  const today=currentWall.slice(0,10);
  const router=useRouter(),queryString=useSearchParams().toString();
  const [linkedResource,setLinkedResource]=useState<string|null>(null),[linkedIncident,setLinkedIncident]=useState<string|null>(null);
  const jumpApplied=useRef("");
  const [anchor,setAnchor]=useState(""),[view,setView]=useState<View>("week");
  const {sync,data,loading,refreshing,pendingIds,error:refreshError}=useCalendarSynchronization();
  const serviceRead=useServiceRead(!!data,data?.permissions?.serviceRead);
  const [error,setError]=useState(""),[draftError,setDraftError]=useState("");
  const [resourceSelection,setResourceSelection]=useState<string[]|null>(null),[selectionOpen,setSelectionOpen]=useState(false);
  const [selectionReady,setSelectionReady]=useState(false),[selectionSaving,setSelectionSaving]=useState(false);
  const [searchDraft,setSearchDraft]=useState(""),[searchPick,setSearchPick]=useState(0),[toolMenu,setToolMenu]=useState<""|"view"|"more">("");
  const [filter,setFilter]=useState(""),[termFilter,setTermFilter]=useState(""),[showTentative,setShowTentative]=useState(true),[showWeekends,setShowWeekends]=useState(true),[showTechnicianBadges,setShowTechnicianBadges]=useState(true),[limitWorkingHours,setLimitWorkingHours]=useState(false);
  const protectedStorage=useRef<DraftStorage|null>(null);
  const storageSignal=useRef<AbortSignal|null>(null),storageRecovery=useRef<{epoch:number;task:Promise<void>}|null>(null);
  function draftStorage(){if(!protectedStorage.current)throw Error('Geschützte Entwurfssicherung wird vorbereitet.');return protectedStorage.current;}
  const selectionVersion=useRef<number|null>(null);
  const selectionOwner=useRef(""),selectionDisplayName=useRef("Angemeldeter Benutzer"),selectionEpoch=useRef(0);
  useEffect(()=>{
    const epochCounter=selectionEpoch;
    let controller:AbortController;
    const refresh=()=>{
      controller?.abort();controller=new AbortController();storageSignal.current=controller.signal;const epoch=++selectionEpoch.current;
      setResourceSelection(null);setShowTentative(true);setShowWeekends(true);setShowTechnicianBadges(true);setLimitWorkingHours(false);setSelectionOpen(false);setSelectionReady(false);setSelectionSaving(false);selectionOwner.current="";selectionVersion.current=null;
      void fetch("/api/ressourcenkalender/ressourcenauswahl",{cache:"no-store",signal:controller.signal}).then(async response=>{
        const result=await response.json();if(!response.ok)throw new Error(result.error);
        if(epoch===selectionEpoch.current&&!controller.signal.aborted){protectedStorage.current=await openPrivateDrafts(result.owner,controller.signal,text=>setDraftError(text),()=>window.dispatchEvent(new Event('heyelli:drafts-restored')));if(epoch!==selectionEpoch.current||controller.signal.aborted)return;setResourceSelection(result.selection);setShowTentative(result.showTentative);setShowWeekends(result.showWeekends??true);setShowTechnicianBadges(result.showTechnicianBadges);setLimitWorkingHours(result.limitWorkingHours);setScrollRequest(value=>value+1);selectionOwner.current=result.owner;selectionDisplayName.current=result.displayName??"Angemeldeter Benutzer";selectionVersion.current=result.version;setSelectionReady(true);}
      }).catch(problem=>{if(epoch===selectionEpoch.current&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:"Ressourcenauswahl konnte nicht geladen werden.");});
    };
    const frame=requestAnimationFrame(refresh);window.addEventListener("heyelli:session-change",refresh);window.addEventListener("heyelli:preferences-change",refresh);
    return ()=>{cancelAnimationFrame(frame);controller?.abort();epochCounter.current++;window.removeEventListener("heyelli:session-change",refresh);window.removeEventListener("heyelli:preferences-change",refresh);};
  },[]);
  async function saveResourceSelection(ids:string[]|null){
    setLinkedResource(null);
    const epoch=selectionEpoch.current;setSelectionOpen(false);setSelectionSaving(true);
    try{
      const response=await fetch("/api/ressourcenkalender/ressourcenauswahl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selection:ids,owner:selectionOwner.current,expectedVersion:selectionVersion.current})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(epoch===selectionEpoch.current){selectionVersion.current=result.version;setResourceSelection(result.selection);}
    }catch(problem){if(epoch===selectionEpoch.current)setError(problem instanceof Error?problem.message:"Ressourcenauswahl konnte nicht gespeichert werden.");}
    finally{if(epoch===selectionEpoch.current)setSelectionSaving(false);}
  }
  async function saveTechnicianBadges(visible:boolean){
    const epoch=selectionEpoch.current;setSelectionSaving(true);
    try{
      const response=await fetch("/api/ressourcenkalender/ressourcenauswahl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({showTechnicianBadges:visible,owner:selectionOwner.current,expectedVersion:selectionVersion.current})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(epoch===selectionEpoch.current){selectionVersion.current=result.version;setShowTechnicianBadges(result.showTechnicianBadges);}
    }catch(problem){if(epoch===selectionEpoch.current)setError(problem instanceof Error?problem.message:"Badge-Einstellung konnte nicht gespeichert werden.");}
    finally{if(epoch===selectionEpoch.current)setSelectionSaving(false);}
  }
  async function saveWorkingHoursLimit(enabled:boolean){
    const epoch=selectionEpoch.current;setSelectionSaving(true);
    try{
      const response=await fetch("/api/ressourcenkalender/ressourcenauswahl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limitWorkingHours:enabled,owner:selectionOwner.current,expectedVersion:selectionVersion.current})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(epoch===selectionEpoch.current){selectionVersion.current=result.version;setLimitWorkingHours(result.limitWorkingHours);setScrollRequest(value=>value+1);}
    }catch(problem){if(epoch===selectionEpoch.current)setError(problem instanceof Error?problem.message:"Arbeitszeit-Einstellung konnte nicht gespeichert werden.");}
    finally{if(epoch===selectionEpoch.current)setSelectionSaving(false);}
  }
  async function saveTentativeVisibility(visible:boolean){
    const epoch=selectionEpoch.current;setSelectionSaving(true);
    try{
      const response=await fetch("/api/ressourcenkalender/ressourcenauswahl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({showTentative:visible,owner:selectionOwner.current,expectedVersion:selectionVersion.current})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(epoch===selectionEpoch.current){selectionVersion.current=result.version;setShowTentative(result.showTentative);}
    }catch(problem){if(epoch===selectionEpoch.current)setError(problem instanceof Error?problem.message:"Vormerkungs-Einstellung konnte nicht gespeichert werden.");}
    finally{if(epoch===selectionEpoch.current)setSelectionSaving(false);}
  }
  async function saveWeekendVisibility(visible:boolean){
    const epoch=selectionEpoch.current;setSelectionSaving(true);
    try{const response=await fetch("/api/ressourcenkalender/ressourcenauswahl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({showWeekends:visible,owner:selectionOwner.current,expectedVersion:selectionVersion.current})});const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(epoch===selectionEpoch.current){selectionVersion.current=result.version;setShowWeekends(result.showWeekends??visible);if(!visible&&view==='day')setAnchor(value=>weekday(value));setScrollRequest(value=>value+1);}
    }catch(problem){if(epoch===selectionEpoch.current)setError(problem instanceof Error?problem.message:'Wochenendanzeige konnte nicht gespeichert werden.');}finally{if(epoch===selectionEpoch.current)setSelectionSaving(false);}
  }
  const [preview,setPreview]=useState<Drag|null>(null),gesture=useRef<Drag|null>(null),suppressClick=useRef(false);
  type Proposal=CalendarDraft;
  type PlanningProposal=Proposal&{warnings:PlanningWarning[]};
  type ContinuationProposal=Proposal&{plan:ContinuationPlan};
  const [confirmations,setConfirmations]=useState<((PlanningProposal&{kind:"planning"})|(ContinuationProposal&{kind:"continuation"}))[]>([]);
  const planningConfirmation=confirmations[0]?.kind==="planning"?confirmations[0]:null;
  const continuationConfirmation=confirmations[0]?.kind==="continuation"?confirmations[0]:null;
  function setPlanningConfirmation(value:PlanningProposal|null){setConfirmations(queue=>value?[...queue,{...value,kind:"planning"}]:queue.slice(1));}
  function setContinuationConfirmation(value:ContinuationProposal|null){setConfirmations(queue=>value?[...queue,{...value,kind:"continuation"}]:queue.slice(1));}
  const [failedEdits,setFailedEdits]=useState<Record<string,Proposal>>({});
  const durable=useRef<Record<string,Proposal>>({}),draftOwner=useRef(''),draftWriter=useRef('');
  const [recoveryConflict,setRecoveryConflict]=useState<{state:Recovery;draft:Proposal;remaining:Proposal[];fields:MergeField[];resourceId:string}|null>(null);
  const [conflict,setConflict]=useState<{proposal:Proposal;current:CalendarEvent;fields:MergeField[];provenance?:ConflictProvenance}|null>(null);
  const persistDraft=useCallback((proposal:Proposal|null,id:string)=>{
    if(!selectionOwner.current||draftOwner.current!==selectionOwner.current)throw new Error('Entwurf kann noch nicht sicher zugeordnet werden. Bitte kurz warten.');
    const previous=durable.current[id];
    if(proposal){
      const editedAt={...previous?.editedAt,...proposal.editedAt};
      for(const field of Object.keys(mergeLabels) as MergeField[])if(fieldValue(previous?.changed??proposal.original,field)!==fieldValue(proposal.changed,field))editedAt[field]=new Date().toISOString();
      const contentChanged=Object.keys(mergeLabels).some(key=>fieldValue(previous?.changed??proposal.original,key as MergeField)!==fieldValue(proposal.changed,key as MergeField));
      const next={...previous,...proposal,displayName:selectionDisplayName.current,failure:contentChanged?undefined:proposal.failure??previous?.failure,draftId:crypto.randomUUID(),writerId:proposal.writerId??previous?.writerId??draftWriter.current,updatedAt:new Date().toISOString(),editedAt};
      replaceDraft(draftStorage(),draftOwner.current,previous?.draftId,next);durable.current[id]=next;
    }else if(previous?.draftId){completeDraft(draftStorage(),draftOwner.current,previous);delete durable.current[id];}
  },[]);
  const refreshDraftList=useCallback(()=>{
    if(draftOwner.current&&draftOwner.current===selectionOwner.current){
      let records:ReturnType<typeof listDrafts>;
      try{records=listDrafts(draftStorage(),draftOwner.current);}catch{setDraftError('Die geschützte Entwurfssicherung wird erneut verbunden. Vorhandene Eingaben bleiben erhalten.');return;}
      for(const [id,active] of Object.entries(durable.current))if(active.draftId&&!records[active.draftId]&&editingId.current!==id&&!sync.getSnapshot().pendingIds.has(id))delete durable.current[id];
      setFailedEdits(Object.fromEntries(Object.entries(records).filter(([,draft])=>notifySaveFailure(draft.failure))));
    }
  },[sync]);
  useEffect(()=>{
    if(!selectionReady)return;
    const owner=selectionOwner.current;draftOwner.current=owner;
    if(!draftWriter.current)draftWriter.current=crypto.randomUUID();
    const frame=requestAnimationFrame(refreshDraftList);
    const update=(event:StorageEvent)=>{if(!event.key||event.key.startsWith(draftPrefix(owner)))refreshDraftList();};
    window.addEventListener('storage',update);window.addEventListener('heyelli:drafts-restored',refreshDraftList);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('storage',update);window.removeEventListener('heyelli:drafts-restored',refreshDraftList);};
  },[selectionReady,refreshDraftList]);

  const [deleteConfirm,setDeleteConfirm]=useState(false),[legendOpen,setLegendOpen]=useState(false);
  const [editOptions,setEditOptions]=useState<CalendarOptions>({});
  const deleteCancel=useRef<HTMLButtonElement>(null);
  const [creation,setCreation]=useState<(CreationSeed&{epoch:number})|null>(null);
  const [editing,setEditing]=useState<Edit|null>(null),[editStart,setEditStart]=useState(""),[editEnd,setEditEnd]=useState(""),[editResource,setEditResource]=useState("");
  const [editTitle,setEditTitle]=useState(""),[editNotes,setEditNotes]=useState("");
  const [editCompanions,setEditCompanions]=useState<string[]>([]),[editResources,setEditResources]=useState<string[]>([]);
  const dialog=useRef<HTMLDialogElement>(null),board=useRef<HTMLDivElement>(null),editingId=useRef<string|null>(null);
  const pending=!!editing&&pendingIds.has(editing.event.id);
  const closeEditing=useCallback(()=>{if(editingId.current)sync.unprotect(editingId.current);editingId.current=null;dialog.current?.close();setEditing(null);refreshDraftList();},[sync,refreshDraftList]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const query=new URLSearchParams(queryString),date=query.get('datum');jumpApplied.current='';setLinkedIncident(query.get('einsatz'));if(query.get('einsatz')){setView('day');setFilter('');setTermFilter('');}setAnchor(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?date:berlinWall(new Date().toISOString()).slice(0,10));setLinkedResource(query.get('mitarbeiter'));});return ()=>cancelAnimationFrame(frame);},[queryString]);
  const range=useMemo(()=>interval(anchor||"2026-11-02",view),[anchor,view]);
  const dayOffsets=useMemo(()=>visibleDayOffsets(range.from,range.days,showWeekends),[range.from,range.days,showWeekends]);
  const visibleDates=dayOffsets.map(day=>addDays(range.from,day));
  useEffect(()=>{if(!linkedIncident&&!showWeekends&&view==='day'&&anchor&&isWeekend(anchor)){const frame=requestAnimationFrame(()=>setAnchor(weekday(anchor)));return ()=>cancelAnimationFrame(frame);}},[showWeekends,view,anchor,linkedIncident]);
  const endDay=addDays(range.from,range.days-1),dayWidth=view==="day"?1440:view==="week"?360:72,totalWidth=dayWidth*dayOffsets.length;
  const resourceSearch=linkedResource?(data?.resources.find(resource=>resource.id===linkedResource)?.name??linkedResource):filter;
  function searchResources(value:string){
    if(linkedResource||linkedIncident){
      setLinkedResource(null);setLinkedIncident(null);jumpApplied.current=queryString;
      const query=new URLSearchParams(queryString);for(const name of ['mitarbeiter','einsatz','auftrag'])query.delete(name);if(anchor)query.set('datum',anchor);
      router.replace('/planboard'+(query.size?'?'+query.toString():''),{scroll:false});
    }
    setFilter(value);
  }
  const resources=(data?.resources??[]).filter(item=>(linkedResource?linkedResource===item.id:resourceSelection===null||resourceSelection.includes(item.id))&&`${item.name} ${item.number} ${item.group}`.toLocaleLowerCase("de").includes(filter.toLocaleLowerCase("de")));
  const timeWindow=limitWorkingHours?workingTimeWindow(data?.workingTime?.resources,resources.map(resource=>resource.id),range.from,addDays(range.from,range.days-1),visibleDates):{start:0,end:1440};
  const visibleMinutes=timeWindow.end-timeWindow.start,hourStep=view==="day"?60:limitWorkingHours?120:240;
  useLayoutEffect(()=>{
    if(!linkedIncident||!selectionReady||!data||loading||refreshing)return;
    const query=new URLSearchParams(queryString),target=data.events.find(event=>event.serviceIncidentId===linkedIncident&&event.link?.type==='SERVICEAUFTRAG'&&event.link.id===query.get('auftrag'));
    if(!target)return;
    const resource=target.mainTechnicianId??target.resourceIds[0];
    if(linkedResource!==resource||!showWeekends||limitWorkingHours||!showTentative){const frame=requestAnimationFrame(()=>{setLinkedResource(resource??null);setShowWeekends(true);setLimitWorkingHours(false);setShowTentative(true);});return()=>cancelAnimationFrame(frame);}
    const node=Array.from(board.current?.querySelectorAll<HTMLElement>('[data-service-incident]')??[]).find(node=>node.dataset.serviceIncident===linkedIncident&&node.dataset.serviceOrder===query.get('auftrag'));
    const button=node?.querySelector<HTMLButtonElement>('.calendar-bar-body');if(!button)return;
    node!.dataset.jumpTarget='true';if(jumpApplied.current!==queryString){jumpApplied.current=queryString;if(board.current)appliedScroll.current={board:board.current,request:scrollRequest};button.scrollIntoView({block:'center',inline:'center',behavior:'auto'});button.focus({preventScroll:true});}
    return()=>{node?.removeAttribute('data-jump-target');};
  },[linkedIncident,linkedResource,selectionReady,data,loading,refreshing,queryString,showWeekends,limitWorkingHours,showTentative,scrollRequest]);
  useLayoutEffect(()=>{
    const element=board.current;
    if(linkedIncident&&jumpApplied.current!==queryString)return;
    if(!data||!anchor||!element||appliedScroll.current?.board===element&&appliedScroll.current.request===scrollRequest)return;
    const now=berlinWall(new Date().toISOString()),dayOffset=(Date.parse(now.slice(0,10)+"T00:00:00Z")-Date.parse(range.from+"T00:00:00Z"))/86400000;
    const visibleIndex=dayOffsets.indexOf(dayOffset);if(visibleIndex<0)return;
    const minutes=Number(now.slice(11,13))*60+Number(now.slice(14,16));
      const visibleTimeline=Math.max(0,element.clientWidth-224);
      element.scrollTo({left:Math.max(0,(visibleIndex+Math.max(0,Math.min(1,(minutes-timeWindow.start)/visibleMinutes)))*dayWidth-visibleTimeline/2),behavior:"auto"});
      appliedScroll.current={board:element,request:scrollRequest};
  },[data,anchor,range.from,range.days,dayOffsets,dayWidth,scrollRequest,timeWindow.start,visibleMinutes,linkedIncident,queryString]);
  function goToToday(nextView=view){const day=berlinWall(new Date().toISOString()).slice(0,10);setAnchor(!showWeekends&&nextView==='day'?weekday(day):day);setScrollRequest(value=>value+1);}

  const reconnectDraftStorage=useCallback((owner:string)=>{
    const epoch=selectionEpoch.current,signal=storageSignal.current;
    if(!owner||owner!==selectionOwner.current||!signal||signal.aborted||storageRecovery.current?.epoch===epoch)return;
    setSelectionReady(false);
    const task=(async()=>{try{
      const store=await openPrivateDrafts(owner,signal,text=>setDraftError(text),()=>window.dispatchEvent(new Event('heyelli:drafts-restored')));
      if(signal.aborted||epoch!==selectionEpoch.current||owner!==selectionOwner.current)return;
      protectedStorage.current=store;setDraftError('');setSelectionReady(true);
    }catch{if(!signal.aborted&&epoch===selectionEpoch.current)setDraftError('Die geschützte Entwurfssicherung kann gerade nicht verbunden werden. Vorhandene Eingaben bleiben erhalten; die Verbindung wird erneut geprüft.');}})();
    storageRecovery.current={epoch,task};void task.finally(()=>{if(storageRecovery.current?.task===task)storageRecovery.current=null;});
  },[]);
  const draftReadProblem=useCallback((problem:unknown,owner:string)=>{
    if(isDraftStorageLocked(problem))reconnectDraftStorage(owner);
    else {setSelectionReady(false);setDraftError('Gesicherte Entwürfe konnten nicht gelesen werden. Vorhandene Eingaben und Sicherungen bleiben erhalten.');}
  },[reconnectDraftStorage]);
  const load=useCallback(async(signal?:AbortSignal,replace=false)=>{
    if(!anchor)return;
    const owner=draftOwner.current,epoch=selectionEpoch.current;
    let candidates:CalendarDraft[]=[];let draftSnapshotReady=true;
    try{if(owner)candidates=Object.values(listDrafts(draftStorage(),owner));}catch(problem){draftSnapshotReady=false;draftReadProblem(problem,owner);}
    const confirmed=await sync.load(async signal=>{
      const response=await fetch(`/api/ressourcenkalender?from=${range.from}&to=${endDay}`,{cache:"no-store",signal});
      const result=await response.json();if(!response.ok)throw new CalendarReadError(result.error??"Kalender konnte nicht geladen werden.",response.status);const nextSource=JSON.stringify(result.source??{mode:"simulator",id:null});if(dataSourceRef.current!==null&&dataSourceRef.current!==nextSource){dataSourceRef.current=nextSource;window.dispatchEvent(new Event("heyelli:session-change"));throw new CalendarReadError("PDS-Quelle gewechselt. Kalender wird neu geladen.",409);}dataSourceRef.current=nextSource;return result;
    },{signal,replace});
    if(confirmed&&draftSnapshotReady&&owner&&owner===draftOwner.current&&owner===selectionOwner.current&&epoch===selectionEpoch.current){try{removeSavedDrafts(draftStorage(),owner,candidates,confirmed);refreshDraftList();}catch(problem){draftReadProblem(problem,owner);}}
  },[anchor,range.from,endDay,sync,refreshDraftList,draftReadProblem]);
  useEffect(()=>{
    const controller=new AbortController();const frame=requestAnimationFrame(()=>void load(controller.signal,true));
    const refresh=()=>{sync.reset();setTeamOpen(false);setQuick(null);closeEditing();gesture.current=null;setPreview(null);setCreation(null);setConfirmations([]);setFailedEdits({});setRecoveryConflict(null);setConflict(null);durable.current={};draftOwner.current="";setError("");void load(controller.signal,true);};
    window.addEventListener("heyelli:session-change",refresh);
    return ()=>{cancelAnimationFrame(frame);controller.abort();sync.cancelRead();window.removeEventListener("heyelli:session-change",refresh);};
  },[load,sync,closeEditing]);
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=()=>{if(!document.hidden)void load(controller.signal);};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    const timer=setInterval(refresh,30000);
    return ()=>{controller.abort();clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[load]);
  useEffect(()=>sync.subscribe(()=>{const current=sync.getSnapshot();if(current.error&&!current.data){closeEditing();gesture.current=null;setPreview(null);setCreation(null);setConfirmations([]);setFailedEdits({});setRecoveryConflict(null);setConflict(null);}}),[sync,closeEditing]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==="Escape"&&gesture.current){sync.unprotect(gesture.current.event.id);gesture.current=null;setPreview(null);}};window.addEventListener("keydown",cancel);return ()=>window.removeEventListener("keydown",cancel);},[sync]);
  useEffect(()=>{if(!toolMenu)return;const close=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==="Escape":!(event.target as Element|null)?.closest?.(".calendar-menu-wrap"))setToolMenu("");};document.addEventListener("pointerdown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",close);};},[toolMenu]);
  // Terminfilter blendet nicht passende Termine ab statt aus (Belegung bleibt sichtbar, Kapazität ungefiltert).
  const termMatches=(item:CalendarEvent)=>`${item.title} ${statusLabels[item.status]}`.toLocaleLowerCase("de").includes(termFilter.toLocaleLowerCase("de"));
  const events=(data?.events??[]).filter(item=>showTentative||item.status!=="VORGEMERKT");
  const matchedEvents=termFilter?events.filter(termMatches):events;
  const origin=Date.parse(range.from+"T00:00:00Z")/60000;
  const x=(instant:string)=>axisPosition(wallMinutes(instant)-origin,dayWidth,timeWindow,dayOffsets);
  const dayBounds=visibleDates.map(day=>({start:Date.parse(wallInstant(day+'T00:00')),end:Date.parse(wallInstant(addDays(day,1)+'T00:00'))}));
  const dayVisible=(event:CalendarEvent)=>dayBounds.some(day=>Date.parse(event.start)<day.end&&Date.parse(event.end)>day.start);
  const hours=(items:CalendarEvent[])=>items.reduce((sum,event)=>sum+dayBounds.reduce((total,day)=>total+Math.max(0,Math.min(Date.parse(event.end),day.end)-Math.max(Date.parse(event.start),day.start))/3600000,0),0);
  const formatHours=(value:number)=>`${new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(value)} h`;
  const capacities=new Map(resources.map(resource=>[resource.id,resourceCapacity(data?.workingTime?.resources.find(item=>item.resourceId===resource.id),(data?.events??[]).filter(event=>event.resourceIds.includes(resource.id)&&dayVisible(event)),range.from,endDay,visibleDates)]));
  const totalCapacity=resources.length&&resources.every(resource=>capacities.get(resource.id))?resources.reduce((sum,resource)=>{const value=capacities.get(resource.id)!;return {scheduled:sum.scheduled+value.scheduled,absence:sum.absence+value.absence,booked:sum.booked+value.booked,remaining:sum.remaining+value.remaining};},{scheduled:0,absence:0,booked:0,remaining:0}):null;

  function changePeriod(direction:number){
    if(view==="month"){const date=new Date(anchor+"T12:00:00Z");setAnchor(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+direction,1,12)).toISOString().slice(0,10));}
    else {const day=addDays(anchor,direction*(view==="day"?1:7));setAnchor(!showWeekends&&view==='day'?weekday(day,direction):day);}
  }
  async function commit(original:CalendarEvent,changed:CalendarEvent,companions?:string[],acceptPlanningWarnings=false,choice:"single"|"split"|undefined=durable.current[original.id]?.choice,operationId=durable.current[original.id]?.operationId??crypto.randomUUID(),hash:string|undefined=durable.current[original.id]?.hash){
    if(pendingIds.has(original.id)||!data||(original.fixed&&changed.fixed))return;
    let options=optionChanges(original,changed);
    if(Date.parse(original.start)===Date.parse(changed.start)&&Date.parse(original.end)===Date.parse(changed.end)&&original.resourceIds.join("|")===changed.resourceIds.join("|")&&original.mainTechnicianId===changed.mainTechnicianId&&original.title===changed.title&&(original.notes??"")===(changed.notes??"")&&!options){persistDraft(null,original.id);refreshDraftList();if(editingId.current===original.id)closeEditing();return;}
    if(!(data?.permissions?.write&&selectionReady))return;
    try{persistDraft({original,changed,companions,choice,operationId,hash,auto:true},original.id);}catch{setError('Der Entwurf konnte nicht dauerhaft auf diesem Gerät gesichert werden. Bitte den Browserspeicher prüfen.');return;}
    const ticket=sync.begin(original.id);if(!ticket)return;setError("");sync.apply([changed],ticket.epoch);
    let status:number|undefined;
    if(editingId.current===original.id&&!(original.fixed&&!changed.fixed))closeEditing();
    try{
      if(original.fixed&&changed.fixed===false){
        const unlock=await fetch("/api/ressourcenkalender",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(15000),body:JSON.stringify({operationId:crypto.randomUUID(),id:original.id,start:original.start,end:original.end,resourceIds:original.resourceIds,options:{fixed:false},expected:{start:original.start,end:original.end,resourceIds:original.resourceIds,options:eventOptions(original)}})});
        if(!unlock.ok){status=unlock.status;const problem=await unlock.json();throw new Error(problem.error??"Fixierung konnte nicht aufgehoben werden.");}
        original={...original,fixed:false};options=optionChanges(original,changed);
        persistDraft({...durable.current[original.id],original,changed,companions,choice,operationId,hash,auto:true},original.id);
      }
      const candidatesBeforeSave=Object.values(listDrafts(draftStorage(),draftOwner.current));
      const response=await fetch("/api/ressourcenkalender",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(15000),body:JSON.stringify({operationId,editedAt:durable.current[original.id]?.editedAt,continuationChoice:choice,continuationHash:hash,acceptPlanningWarnings,id:original.id,start:changed.start,end:changed.end,resourceIds:changed.resourceIds,...(options?{options}:{}),...(original.title!==changed.title?{title:changed.title}:{}),...((original.notes??"")!==(changed.notes??"")?{notes:changed.notes??""}:{}),...(companions!==undefined?{companionTechnicianIds:companions,mainTechnicianId:changed.mainTechnicianId}:{}),expected:{start:original.start,end:original.end,resourceIds:original.resourceIds,...(options?{options:eventOptions(original)}:{}),...(original.title!==changed.title?{title:original.title}:{}),...((original.notes??"")!==(changed.notes??"")?{notes:original.notes??""}:{}),...(companions!==undefined?{mainTechnicianId:original.mainTechnicianId}:{})}})});
      status=response.status;const result=await response.json();if(!sync.valid(ticket))return;
      if(response.status===409&&result.continuationPlan){persistDraft({...durable.current[original.id],auto:false},original.id);sync.apply([original],ticket.epoch);if(editingId.current===original.id)closeEditing();setContinuationConfirmation({original,changed,companions,plan:result.continuationPlan,operationId:result.operationId,hash:result.continuationHash});return;}
      if(response.status===409&&Array.isArray(result.planningWarnings)){persistDraft({...durable.current[original.id],auto:false},original.id);sync.apply([original],ticket.epoch);if(editingId.current===original.id)closeEditing();setPlanningConfirmation({original,changed,companions,choice,operationId,hash,warnings:result.planningWarnings});return;}
      if(response.status===409&&result.current&&Array.isArray(result.conflicts)){
        const proposal={original,changed,companions,choice,operationId,hash,auto:false};persistDraft(proposal,original.id);
        sync.apply([result.current],ticket.epoch);refreshDraftList();setConflict({proposal,current:result.current,fields:result.conflicts,provenance:result.provenance});return;
      }
      if(!response.ok){if(response.status<500)persistDraft({...durable.current[original.id],auto:false},original.id);throw new Error(result.error);}
      const savedEvents:CalendarEvent[]=result.continuationEvents??[result];
      persistDraft(null,original.id);removeSavedDrafts(draftStorage(),draftOwner.current,candidatesBeforeSave,savedEvents);
      refreshDraftList();sync.apply(savedEvents,ticket.epoch);
      if(editingId.current===original.id){const saved=savedEvents.find(event=>event.id===original.id);if(saved)openDetails(saved,saved.mainTechnicianId??saved.resourceIds[0],saved,true);}
    }catch(problem){
      if(!sync.valid(ticket))return;
      const previous=durable.current[original.id];
      const failure=saveFailure(previous?.failure,problem instanceof Error?problem.message:'Speicherung fehlgeschlagen.',status);
      try{persistDraft({...previous,original,changed,companions,choice,operationId,hash,failure,auto:!failure.blocked},original.id);}catch{setError('Die Änderung konnte nicht zuverlässig gesichert werden. Bitte den Kalender geöffnet lassen.');}
      refreshDraftList();sync.apply([original],ticket.epoch);
      if(editingId.current===original.id)openDetails(original,changed.mainTechnicianId??changed.resourceIds[0],changed);

    }finally{sync.finish(ticket);}
  }
  const replayDrafts=useEffectEvent(()=>{
    if(!selectionReady||!(data?.permissions?.write&&selectionReady)||draftOwner.current!==selectionOwner.current)return;
    if(!navigator.onLine)return;
    const owner=draftOwner.current,epoch=selectionEpoch.current;let proposals:CalendarDraft[];
    try{refreshDraftList();proposals=Object.values(listDrafts(draftStorage(),owner));}catch(problem){draftReadProblem(problem,owner);return;}
    for(const proposal of proposals){
      if(!proposal.auto||!proposal.draftId||editingId.current===proposal.original.id||sync.getSnapshot().pendingIds.has(proposal.original.id)||confirmations.some(item=>item.original.id===proposal.original.id))continue;
      const active=durable.current[proposal.original.id];
      if(active&&active.draftId!==proposal.draftId)continue;
      const replay=async()=>{
        if(epoch!==selectionEpoch.current||owner!==selectionOwner.current||owner!==draftOwner.current)return;
        let latest:CalendarDraft|undefined;
        try{latest=listDrafts(draftStorage(),draftOwner.current)[proposal.draftId!];}catch(problem){draftReadProblem(problem,owner);return;}
        if(!latest?.auto||editingId.current===latest.original.id||sync.getSnapshot().pendingIds.has(latest.original.id))return;
        const local=durable.current[latest.original.id];if(local&&local.draftId!==latest.draftId)return;
        durable.current[latest.original.id]=latest;
        await commit(latest.original,latest.changed,latest.companions,false,latest.choice,latest.operationId,latest.hash);
      };
      if(navigator.locks)void navigator.locks.request('heyelli:calendar-retry:'+draftOwner.current+':'+proposal.operationId,{ifAvailable:true},lock=>lock?replay():undefined);
      else if(proposal.writerId===draftWriter.current)void replay();
    }
  });
  useEffect(()=>{const retry=()=>replayDrafts();window.addEventListener('online',retry);const timer=setInterval(retry,15000);return ()=>{window.removeEventListener('online',retry);clearInterval(timer);};},[]);
  useLayoutEffect(()=>{
    if(!editing||pending||!selectionReady)return;
    try{
      const original=editing.event,team=!!original.mainTechnicianId&&!!original.serviceIncidentId;
      const instant=(value:string,fallback:string)=>{try{return wallInstant(value);}catch{return fallback;}};
      const changed={...applyOptions(original,editOptions),title:editTitle,notes:editNotes,start:instant(editStart,original.start),end:instant(editEnd,original.end),resourceIds:team?[editResource,...editCompanions]:editResources,...(team?{mainTechnicianId:editResource,companionTechnicianIds:editCompanions}:{})};
      if(!mergeCalendarEvents(original,changed,original).changed&&editStart===berlinWall(original.start)&&editEnd===berlinWall(original.end)){if(durable.current[original.id]&&!durable.current[original.id].auto)persistDraft(null,original.id);return;}
      const existing=durable.current[original.id];
      if(existing&&!mergeCalendarEvents(existing.changed,changed,existing.changed).changed&&(!existing.form||(existing.form.start===editStart&&existing.form.end===editEnd)))return;
      persistDraft({original,changed,companions:team?editCompanions:undefined,operationId:existing?.operationId??crypto.randomUUID(),auto:false,form:{start:editStart,end:editEnd}},original.id);
    }catch{requestAnimationFrame(()=>setError('Der Entwurf konnte nicht dauerhaft auf diesem Gerät gesichert werden. Bitte den Browserspeicher prüfen.'));}
  },[persistDraft,editing,pending,selectionReady,editOptions,editTitle,editNotes,editStart,editEnd,editResource,editCompanions,editResources]);
  async function deleteCurrent(target=editing?.event,fromQuick=false){
    if(!(data?.permissions?.write&&selectionReady)||!target||pendingIds.has(target.id)||target.fixed)return;
    const original=target,ticket=sync.begin(original.id);if(!ticket)return;setError("");if(!fromQuick)closeEditing();
    try{
      const response=await fetch("/api/ressourcenkalender",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:original.id,expected:{start:original.start,end:original.end,resourceIds:original.resourceIds}})});
      const result=await response.json();if(!sync.valid(ticket))return;if(!response.ok)throw new Error(result.error);
      sync.remove(ticket);if(fromQuick)setQuick(null);if(editingId.current===original.id){setDeleteConfirm(false);closeEditing();}
    }catch(problem){if(sync.valid(ticket))setError(problem instanceof Error?problem.message:"Termin konnte nicht gelöscht werden.");}
    finally{sync.finish(ticket);}
  }
  function pointerDown(event:ReactPointerEvent<HTMLButtonElement>,item:CalendarEvent,resourceId:string,operation:Drag["operation"]){
    if(event.button!==0)return;
    event.preventDefault();
    if(!(data?.permissions?.write&&selectionReady)||pendingIds.has(item.id)||item.fixed)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const state:Drag={event:item,resourceId,operation,x:event.clientX,y:event.clientY,pointer:event.pointerId,preview:item,offsetY:0,moved:false,error:""};gesture.current=state;
  }
  function pointerMove(event:ReactPointerEvent<HTMLButtonElement>){
    const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
    let target=current.resourceId,offsetY=0;
    if(current.operation==="move"){
      const tracks=Array.from(board.current?.querySelectorAll<HTMLElement>("[data-track]")??[]);
      const row=tracks.find(track=>{const bounds=track.getBoundingClientRect();return event.clientY>=bounds.top&&event.clientY<bounds.bottom;});
      if(row&&resources.some(resource=>resource.id===row.dataset.track)){
        target=row.dataset.track!;const original=tracks.find(track=>track.dataset.track===current.resourceId);
        if(original)offsetY=row.getBoundingClientRect().top-original.getBoundingClientRect().top;
      }
    }
    const moved=current.moved||Math.abs(event.clientX-current.x)>3||Math.abs(event.clientY-current.y)>3;
    if(!moved)return;
    if(!current.moved)sync.protect(current.event.id);
    try{
      const proposed=moveEvent(current.event,current.operation,axisDragMinutes(wallMinutes(current.operation==="end"?current.event.end:current.event.start)-origin,event.clientX-current.x,dayWidth,timeWindow,current.operation==="end",dayOffsets),current.resourceId,target);
      if(x(proposed.end)<=0||x(proposed.start)>=totalWidth)throw new Error("Bitte innerhalb des sichtbaren Zeitraums verschieben.");
      const next={...current,preview:proposed,offsetY,moved,error:""};gesture.current=next;setPreview(next);
    }catch(problem){const next={...current,moved,error:problem instanceof Error?problem.message:"Ungültige Änderung."};gesture.current=next;setPreview(next);}
  }
  function pointerUp(event:ReactPointerEvent<HTMLButtonElement>){
    const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
    if(current.moved)sync.unprotect(current.event.id);gesture.current=null;if(current.moved)setPreview(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(current.moved){suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);if(current.error)setError(current.error);else void commit(current.event,current.preview);}
  }
  function resumeStored(state:Recovery,remaining:Proposal[],resourceId:string){
    while(remaining.length){const draft=remaining[0],result=recoverDraft(state,draft);if(result.conflicts.length){setRecoveryConflict({state,draft,remaining:remaining.slice(1),fields:result.conflicts,resourceId});return;}state=result.state;remaining=remaining.slice(1);}
    const sourceIds=state.sources.flatMap(p=>[...(p.sourceDraftIds??[]),...(p.draftId?[p.draftId]:[])]);
    const last=state.sources.at(-1)!;const sameOperation=state.sources.every(p=>p.operationId===last.operationId);const restored:Proposal={original:state.original,changed:state.changed,companions:state.changed.mainTechnicianId?state.changed.companionTechnicianIds:undefined,operationId:sameOperation?last.operationId:crypto.randomUUID(),choice:sameOperation?last.choice:undefined,hash:sameOperation?last.hash:undefined,auto:sameOperation&&!!last.auto,failure:sameOperation?last.failure:undefined,sourceDraftIds:sourceIds,editedAt:Object.fromEntries(Object.entries(state.authors).filter(([,author])=>author?.at).map(([field,author])=>[field,author!.at!])),form:last.form&&(last.form.start!==berlinWall(last.changed.start)||last.form.end!==berlinWall(last.changed.end))?last.form:undefined};
    durable.current[state.original.id]=restored;try{persistDraft(restored,state.original.id);openDetails(state.original,resourceId,state.changed,true);}catch{setError('Die gesicherten Eingaben konnten nicht geöffnet werden. Bitte den Browserspeicher prüfen.');}
  }
  function openDetails(item:CalendarEvent,resourceId:string,draft:CalendarEvent=item,skipRecovery=false){if(suppressClick.current)return;
    if(!skipRecovery&&draft===item&&!pendingIds.has(item.id)){let records:ReturnType<typeof listDrafts>;try{records=listDrafts(draftStorage(),draftOwner.current);}catch(problem){draftReadProblem(problem,draftOwner.current);return;}const saved=Object.values(records).filter(p=>p.original.id===item.id).map(p=>({...p,displayName:p.displayName??selectionDisplayName.current})).sort((a,b)=>(a.updatedAt??'').localeCompare(b.updatedAt??''));if(saved.length){resumeStored({original:item,changed:item,authors:{},sources:[]},saved,resourceId);return;}}
if(draft===item&&durable.current[item.id]&&!pendingIds.has(item.id)){const saved=durable.current[item.id];draft=saved.changed;item=saved.original;}editingId.current=item.id;sync.protect(item.id);setDeleteConfirm(false);setEditing({event:item,resourceId});setEditOptions(eventOptions(draft));setEditTitle(draft.title);setEditNotes(draft.notes??"");setEditStart(draft!==item?durable.current[item.id]?.form?.start??berlinWall(draft.start):berlinWall(draft.start));setEditEnd(draft!==item?durable.current[item.id]?.form?.end??berlinWall(draft.end):berlinWall(draft.end));setEditResource(draft.mainTechnicianId??resourceId);setEditCompanions([...(draft.companionTechnicianIds??[])]);setEditResources([...draft.resourceIds]);setError("");requestAnimationFrame(()=>dialog.current?.showModal());}
  function openNew(start:string,end:string,resourceId:string){if(!(data?.permissions?.write&&selectionReady))return;setError("");setCreation({start,end,resourceId,key:crypto.randomUUID(),epoch:sync.currentEpoch()});}
  function doubleClickSlot(event:ReactMouseEvent<HTMLDivElement>){
    if(!data||loading||preview||editing||creation)return;
    const target=event.target as HTMLElement;if(target.closest(".calendar-bar"))return;
    const track=target.closest<HTMLElement>("[data-track]");if(!track||!resources.some(resource=>resource.id===track.dataset.track))return;
    try{
      const slot=axisSlot(range.from,dayWidth,event.clientX-track.getBoundingClientRect().left,view,dayOffsets.length,timeWindow,dayOffsets);
      const occupied=data.events.some(item=>item.resourceIds.includes(track.dataset.track!)&&Date.parse(item.start)<=Date.parse(slot.start)&&Date.parse(item.end)>Date.parse(slot.start));
      if(occupied){setError("Zu dieser Uhrzeit ist bereits ein Termin eingetragen. Bitte eine freie Stelle wählen.");return;}
      openNew(slot.start,slot.end,track.dataset.track!);
    }catch(problem){setError(problem instanceof Error?problem.message:"Die gewählte Uhrzeit ist ungültig.");}
  }
  function created(item:CalendarEvent,epoch:number){if(epoch!==sync.currentEpoch())return;const saved=item.continuationEvents??[item];sync.apply(saved,epoch);setCreation(null);setAnchor(berlinWall(item.start).slice(0,10));setFilter("");setTermFilter("");}
  function keyboard(item:CalendarEvent,resourceId:string,operation:Drag["operation"],key:string,shift:boolean){
    if(!(data?.permissions?.write&&selectionReady)||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(key)||pendingIds.has(item.id)||item.fixed)return;
    const current=resources.findIndex(resource=>resource.id===resourceId),next=current+(key==="ArrowUp"?-1:key==="ArrowDown"?1:0);
    const target=operation==="move"&&resources[next]?resources[next].id:resourceId;
    try{let changed=moveEvent(item,operation,key==="ArrowLeft"?-(item.allDay?1440:shift?60:15):key==="ArrowRight"?(item.allDay?1440:shift?60:15):0,resourceId,target);if(!showWeekends&&(key==='ArrowLeft'||key==='ArrowRight')){const edge=operation==='end'?changed.end:changed.start,wall=berlinWall(edge),exclusive=item.allDay&&operation==='end',day=exclusive?addDays(wall.slice(0,10),-1):wall.slice(0,10);if(isWeekend(day)){const targetDay=weekday(day,key==='ArrowLeft'?-1:1),next=wallInstant((exclusive?addDays(targetDay,1):targetDay)+wall.slice(10));changed=moveEvent(changed,operation,wallMinutes(next)-wallMinutes(edge),target,target);}}void commit(item,changed);}catch(problem){setError(problem instanceof Error?problem.message:"Ungültige Änderung.");}
  }
  const shownFrom=visibleDates[0]??range.from,shownTo=visibleDates.at(-1)??endDay;
  const periodWeek=anchor?calendarWeekLabel(shownFrom,shownTo):'Kalender';
  const periodLabel=!anchor?'Datum auswählen':shownFrom===shownTo?dayLabel(shownFrom,{day:'2-digit',month:'short',year:'numeric'}):`${dayLabel(shownFrom,{day:'2-digit',month:'short',...(shownFrom.slice(0,4)!==shownTo.slice(0,4)?{year:'numeric'}:{})})} – ${dayLabel(shownTo,{day:'2-digit',month:'short',year:'numeric'})}`;
  return <>
    {data?.source?.mode==='pds-readonly'&&<Notice tone="neutral">Echtes PDS · Nur Lesezugriff. Schreibfunktionen sind bis zur fachlichen Freigabe gesperrt.</Notice>}
    {draftError&&<Notice tone="error" role="alert">{draftError} Die verschlüsselte Sicherung auf diesem Gerät bleibt erhalten.</Notice>}
    {data&&!data.permissions?.write&&<p className="incident-notice">Lesezugriff · Termine können angesehen, aber nicht verändert werden.</p>}
    <div className="calendar-toolbar calendar-toolbar-r1">
      <div className="calendar-toolbar-start"><CalendarPeriodPicker anchor={anchor} weekLabel={periodWeek} rangeLabel={periodLabel} view={view} from={range.from} to={endDay} disabled={!!preview} onPrevious={()=>changePeriod(-1)} onNext={()=>changePeriod(1)} onToday={()=>goToToday()} onChange={day=>{setAnchor(!showWeekends&&view==='day'?weekday(day):day);setScrollRequest(request=>request+1);}}/></div>
      <div className="calendar-views" role="group" aria-label="Kalenderansicht">{([["day","Tag"],["week","Woche"],["month","Monat"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={view===value} disabled={!!preview} onClick={()=>{setView(value);if(!showWeekends&&value==='day')setAnchor(day=>weekday(day));setScrollRequest(request=>request+1);}}>{label}</button>)}</div>
      <div className="calendar-toolbar-end">
        {/* Token-Suche: Ressourcen (grün) und Termine (blau) getrennt oder gleichzeitig; Tokens bleiben bearbeitbar. */}
        <div className="calendar-token-search heyelli-field" role="group" aria-label="Kalender durchsuchen" data-active={!!resourceSearch||!!termFilter||undefined}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          {!!resourceSearch&&<span className="calendar-token is-resource"><i>Ressource</i><input aria-label="Ressourcen" type="search" value={resourceSearch} style={{width:`${Math.min(18,Math.max(3,resourceSearch.length))+1}ch`}} disabled={!!preview} onChange={event=>searchResources(event.target.value)}/><button className="calendar-search-clear" type="button" aria-label="Ressourcenfilter entfernen" title="Ressourcenfilter entfernen" disabled={!!preview} onClick={()=>searchResources("")}>×</button></span>}
          {!!termFilter&&<span className="calendar-token is-term"><i>Termin</i><input aria-label="Termine" type="search" value={termFilter} style={{width:`${Math.min(18,Math.max(3,termFilter.length))+1}ch`}} disabled={!!preview} onChange={event=>setTermFilter(event.target.value)}/><button className="calendar-search-clear" type="button" aria-label="Terminfilter entfernen" title="Terminfilter entfernen" disabled={!!preview} onClick={()=>setTermFilter("")}>×</button></span>}
          <input className="calendar-token-input" aria-label="Ressourcen oder Termine suchen" type="search" role="combobox" aria-expanded={!!searchDraft.trim()} aria-controls="calendar-search-suggestions" aria-autocomplete="list" placeholder={resourceSearch||termFilter?"Weiter suchen …":"Ressourcen und Termine"} value={searchDraft} disabled={!!preview} onChange={event=>{setSearchDraft(event.target.value);setSearchPick(0);}} onKeyDown={event=>{const text=searchDraft.trim();if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setSearchPick(value=>value?0:1);}else if(event.key==="Enter"&&text){event.preventDefault();if(searchPick)setTermFilter(text);else searchResources(text);setSearchDraft("");}else if(event.key==="Escape"){setSearchDraft("");}else if(event.key==="Backspace"&&!searchDraft){if(termFilter)setTermFilter("");else if(resourceSearch)searchResources("");}}}/>
          {!!searchDraft.trim()&&<div id="calendar-search-suggestions" className="calendar-search-suggestions" role="listbox" aria-label="Suchen in">{([["Ressource","is-resource"],["Termin","is-term"]] as const).map(([label,tone],index)=><button key={label} type="button" role="option" aria-selected={searchPick===index} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(index)setTermFilter(searchDraft.trim());else searchResources(searchDraft.trim());setSearchDraft("");}}><span className={`calendar-token ${tone}`}><i>{label}</i>{searchDraft.trim()}</span><small>{index?"Termine hervorheben":"Ressourcen eingrenzen"}</small></button>)}<small className="calendar-search-hint">↑↓ wählen · ↵ als Filter übernehmen · ⌫ letzten Filter entfernen</small></div>}
        </div>
        <div className="calendar-menu-wrap"><button type="button" className="calendar-tool-button" aria-label="Darstellung" title="Darstellung" aria-haspopup="true" aria-expanded={toolMenu==="view"} onClick={()=>setToolMenu(value=>value==="view"?"":"view")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>{toolMenu==="view"&&<div className="calendar-menu calendar-display-menu" role="group" aria-label="Darstellung"><label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={showWeekends} disabled={!!preview||!selectionReady||selectionSaving} onChange={event=>void saveWeekendVisibility(event.target.checked)}/>Wochenende (Sa + So)</label><label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={showTentative} disabled={!!preview||!selectionReady||selectionSaving} onChange={event=>void saveTentativeVisibility(event.target.checked)}/>Vorgemerkte Termine</label><label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={showTechnicianBadges} disabled={!!preview||!selectionReady||selectionSaving} onChange={event=>void saveTechnicianBadges(event.target.checked)}/>Haupttechniker-/Begleiter-Badges</label><label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={limitWorkingHours} disabled={!!preview||!selectionReady||selectionSaving} onChange={event=>void saveWorkingHoursLimit(event.target.checked)}/>Auf Arbeitszeiten begrenzen{limitWorkingHours&&` (${String(Math.floor(timeWindow.start/60)).padStart(2,"0")}:${String(timeWindow.start%60).padStart(2,"0")}–${String(Math.floor(timeWindow.end/60)).padStart(2,"0")}:${String(timeWindow.end%60).padStart(2,"0")})`}</label></div>}</div>
        <div className="calendar-menu-wrap"><button type="button" className="calendar-tool-button" aria-label="Mehr" title="Mehr" aria-haspopup="true" aria-expanded={toolMenu==="more"} onClick={()=>setToolMenu(value=>value==="more"?"":"more")}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg></button>{toolMenu==="more"&&<div className="calendar-menu" role="group" aria-label="Weitere Werkzeuge"><button type="button" disabled={!data||!!preview} onClick={()=>{setToolMenu("");setTeamOpen(true);}}>Teamübersicht</button><button type="button" disabled={!data||!!preview||loading||!selectionReady||selectionSaving} onClick={()=>{setToolMenu("");setSelectionOpen(true);}}>Ressourcenauswahl</button><button type="button" disabled={!data||!!preview} onClick={()=>{setToolMenu("");setLegendOpen(true);}}>Legende</button><hr/><GuardedLink className="calendar-duty-link" href="/dutyboard">Bereitschaft öffnen ↗</GuardedLink></div>}</div>
        <BulkMobile events={visibleLegendEvents(matchedEvents,resources.map(item=>item.id),range.from,range.days,timeWindow,dayOffsets)} resources={data?.resources??[]} disabled={!(data?.permissions?.write&&selectionReady)||loading||!!preview||pendingIds.size>0} onIssued={()=>{setHistoryVersion(value=>value+1);void load();}}/>
        <button className="calendar-new-event" type="button" disabled={!(data?.permissions?.write&&selectionReady)||!anchor||loading||!!preview||!resources.length} onClick={event=>{event.currentTarget.focus({preventScroll:true});try{const start=wallInstant(anchor+"T08:00");openNew(start,new Date(Date.parse(start)+3600000).toISOString(),resources[0].id);}catch(problem){setError(problem instanceof Error?problem.message:"Datum ungültig.");}}}><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>Neuer Termin</button>
      </div>
    </div>
    {(!!resourceSearch||!!termFilter)&&<div className="calendar-filter-hint" role="status"><b>{resources.length} {resources.length===1?"Ressource":"Ressourcen"}{termFilter?` · ${matchedEvents.length} von ${events.length} Terminen`:""}</b><span>{[resourceSearch&&`Ressource „${resourceSearch}“`,termFilter&&`Termin „${termFilter}“`].filter(Boolean).join(" und ")}</span><button type="button" disabled={!!preview} onClick={()=>{searchResources("");setTermFilter("");}}>Alle Filter entfernen</button></div>}

    {(error||(!data&&refreshError))&&<Notice tone="error" role="alert" className="calendar-error">{error||refreshError}</Notice>}
    {Object.values(failedEdits).map(p=><Notice as="div" tone="error" key={p.draftId} role="alert" className="calendar-error"><p>Die Änderung „{p.changed.title}“ konnte {p.failure?.blocked?'nicht':'auch nach mehreren Versuchen nicht'} gespeichert werden. Deine Eingaben bleiben gesichert.{p.failure?.blocked&&` ${p.failure.message}`}</p><button type="button" disabled={pendingIds.has(p.original.id)||!(data?.permissions?.write&&selectionReady)} onClick={()=>{durable.current[p.original.id]=p;void commit(p.original,p.changed,p.companions,false,p.choice,p.operationId,p.hash);}}>Erneut versuchen</button><button type="button" disabled={pendingIds.has(p.original.id)||!(data?.permissions?.write&&selectionReady)} onClick={()=>{durable.current[p.original.id]=p;openDetails(p.original,p.changed.mainTechnicianId??p.changed.resourceIds[0],p.changed,true);}}>Änderung prüfen</button></Notice>)}

    {(preview?.moved||pendingIds.size>0)&&<Notice tone={preview?.error?"error":"neutral"} className="calendar-message">{preview?.moved?preview.error||`${time(preview.preview.start)}–${time(preview.preview.end)} · ${resources.find(resource=>preview.preview.resourceIds.includes(resource.id)&&resource.id!==preview.resourceId)?.name??resources.find(resource=>resource.id===preview.resourceId)?.name}`:`${pendingIds.size} ${pendingIds.size===1?"Termin wird":"Termine werden"} gespeichert …`}</Notice>}
    {data&&<div ref={board} className="calendar-board" aria-label="Ressourcenplanung" onDoubleClick={doubleClickSlot}><div className="calendar-grid" style={{gridTemplateColumns:`224px ${totalWidth}px`}}>
      <div className="calendar-corner">Ressourcen<small>Deutsche Ortszeit</small></div>
      <div className="calendar-time-head" style={{width:totalWidth}}><CurrentQuarter from={range.from} days={range.days} dayOffsets={dayOffsets} dayWidth={dayWidth} timeWindow={timeWindow} currentWall={currentWall}/>{dayOffsets.map(index=>{const day=addDays(range.from,index),weekend=[0,6].includes(new Date(day+"T12:00:00Z").getUTCDay());return <div key={day} className={`calendar-day-head ${weekend?"weekend":""} ${day===today?"is-today":""}`} style={{width:dayWidth}}><strong aria-current={day===today?"date":undefined}>{dayLabel(day,view==="month"?{weekday:"short",day:"2-digit"}:{weekday:"short",day:"2-digit",month:"2-digit"})}</strong>{view!=="month"&&<div className="calendar-hour-head">{Array.from({length:Math.ceil(visibleMinutes/hourStep)},(_,i)=>{const minute=timeWindow.start+i*hourStep;return <span key={minute} style={{left:`${(minute-timeWindow.start)/visibleMinutes*100}%`}}>{String(Math.floor(minute/60)).padStart(2,"0")}:{String(minute%60).padStart(2,"0")}</span>;})}</div>}</div>;})}</div>
      {resources.map(resource=>{const entries=lanes(events.filter(item=>item.resourceIds.includes(resource.id)&&x(item.end)>x(item.start)&&x(item.end)>0&&x(item.start)<totalWidth));const height=Math.max(112,60+Math.max(0,...entries.map(entry=>entry.lane))*44);return <ResourceRow key={resource.id} id={resource.id} name={resource.name} number={resource.number} group={resource.group} hours={formatHours(hours(entries.map(entry=>entry.event)))} capacity={capacities.get(resource.id)??null} working={data.workingTime?.resources.find(item=>item.resourceId===resource.id)} height={height} totalWidth={totalWidth} dayWidth={dayWidth} days={range.days} dayOffsets={dayOffsets} from={range.from} view={view} timeWindow={timeWindow} currentWall={currentWall}>{entries.map(({event,lane})=><CalendarBar write={!!(data?.permissions?.write&&selectionReady)} key={event.id} item={event} lane={lane} resourceId={resource.id} active={preview?.event.id===event.id&&preview.resourceId===resource.id?preview:null} totalWidth={totalWidth} dayWidth={dayWidth} origin={origin} dayOffsets={dayOffsets} timeWindow={timeWindow} pending={pendingIds.has(event.id)} colors={data.colors} colorLayouts={data.colorLayouts} showTechnicianBadges={showTechnicianBadges} dimmed={!!termFilter&&!termMatches(event)} onPointerStart={pointerDown} onPointerMove={pointerMove} onPointerEnd={pointerUp} onPointerCancel={()=>{if(gesture.current)sync.unprotect(gesture.current.event.id);gesture.current=null;setPreview(null);}} onKeyboard={keyboard} onDetails={(event,resourceId,anchor)=>{if(suppressClick.current)return;if(quickTimer.current)clearTimeout(quickTimer.current);quickTimer.current=setTimeout(()=>{setQuick({event,resourceId,anchor});quickTimer.current=null;},300);}} onFullEdit={(event,resourceId)=>{if(quickTimer.current)clearTimeout(quickTimer.current);quickTimer.current=null;setQuick(null);openDetails(event,resourceId);}}/>)}</ResourceRow>;})}
    </div>{!resources.length&&<p className="calendar-empty">Keine passenden Ressourcen im gewählten Zeitraum.</p>}</div>}
    {!data&&!loading&&!error&&!refreshError&&<p>Planung wird vorbereitet …</p>}
    {/* Statusleiste: Quelle, Aktualisierung und Summen; Erläuterung der Restkapazität als Tooltip. */}
    <div className="calendar-statusbar" title={data?.workingTime?"Rest = Soll − bestätigte Abwesenheiten − geplante Termine. Terminfilter verändern die Einzelkapazität nicht.":"Arbeitszeitmodelle sind nicht verfügbar; Restkapazitäten können nicht berechnet werden."}><span className="calendar-status-dot" aria-hidden="true"/><span>{data?.source?.mode==='pds-readonly'?"Echtes PDS · Lesebetrieb, Änderungen gesperrt":"Automatisch gespeichert"} · Aktualisierung alle 30 s · fixierte Termine geschützt</span><span aria-hidden="true">·</span><span className="calendar-summary"><span>{resources.length} Ressourcen · {totalCapacity?`Soll ${formatHours(totalCapacity.scheduled/60)} · Abwesend ${formatHours(totalCapacity.absence/60)} · Belegt ${formatHours(totalCapacity.booked/60)} · Rest ${formatHours(totalCapacity.remaining/60)}`:"Restkapazität nicht verfügbar"}</span></span><button type="button" className="calendar-refresh" disabled={loading||refreshing||!!preview} onClick={()=>{window.dispatchEvent(new Event("heyelli:preferences-change"));void load();}}>{loading?"Wird geladen …":refreshing?"Wird aktualisiert …":"Neu laden"}</button></div>
    {recoveryConflict&&<CalendarConflictDialog key={recoveryConflict.draft.draftId} current={recoveryConflict.state.changed} desired={recoveryConflict.draft.changed} fields={recoveryConflict.fields} provenance={{current:recoveryConflict.state.authors,mine:draftAuthors(recoveryConflict.fields,recoveryConflict.draft.displayName??selectionDisplayName.current,recoveryConflict.draft.editedAt,recoveryConflict.draft.updatedAt??new Date().toISOString())}} confirmLabel="Auswahl übernehmen" onCancel={()=>setRecoveryConflict(null)} onResolve={choices=>{const p=recoveryConflict;setRecoveryConflict(null);resumeStored(recoverDraft(p.state,p.draft,choices).state,p.remaining,p.resourceId);}}/>}
    {conflict&&<CalendarConflictDialog current={conflict.current} desired={conflict.proposal.changed} fields={conflict.fields} provenance={conflict.provenance} onCancel={()=>setConflict(null)} onResolve={choices=>{const p=conflict.proposal,current=conflict.current;const {merged}=mergeCalendarEvents(p.original,p.changed,current,choices);setConflict(null);void commit(current,merged,p.companions!==undefined?merged.companionTechnicianIds:undefined,false,p.choice,p.operationId,p.hash);}}/>}
    {quick&&data&&<CalendarQuickMenu key={quick.event.id} anchor={quick.anchor} event={events.find(item=>item.id===quick.event.id)??quick.event} resources={data.resources} serviceRead={serviceRead} write={!!(data.permissions?.write&&selectionReady)} pending={pendingIds.has(quick.event.id)} onClose={()=>setQuick(null)} onEdit={()=>{const event=events.find(item=>item.id===quick.event.id)??quick.event;setQuick(null);openDetails(event,quick.resourceId);}} duty={data.categoryOptions?.some(category=>category.name.trim().toLocaleLowerCase("de")==="bereitschaft"&&quick.event.categories.includes(category.id))} deleteError={error} onDelete={()=>{const event=events.find(item=>item.id===quick.event.id)??quick.event;void deleteCurrent(event,true);}} onChange={changed=>void commit(events.find(item=>item.id===quick.event.id)??quick.event,changed)} onIssued={()=>setHistoryVersion(value=>value+1)} onOrderChanged={()=>{setQuick(null);void load();}}/>}
    {selectionOpen&&data&&<ResourceSelectionDialog resources={data.resources} groups={data.resourceGroups??[]} selected={resourceSelection} onCancel={()=>setSelectionOpen(false)} onApply={ids=>void saveResourceSelection(ids)}/>}
    {continuationConfirmation&&<ContinuationDialog plan={continuationConfirmation.plan} title={continuationConfirmation.changed.title} onCancel={()=>setContinuationConfirmation(null)} onSingle={()=>{const p=continuationConfirmation;setContinuationConfirmation(null);void commit(p.original,p.changed,p.companions,false,"single",p.operationId);}} onSplit={()=>{const p=continuationConfirmation;setContinuationConfirmation(null);void commit(p.original,p.changed,p.companions,false,"split",p.operationId,p.hash);}}/>}
    {planningConfirmation&&<PlanningWarningDialog split={planningConfirmation.choice==="split"} appointment={planningConfirmation.changed} warnings={planningConfirmation.warnings} onCancel={()=>setPlanningConfirmation(null)} onConfirm={()=>{const proposal=planningConfirmation;setPlanningConfirmation(null);void commit(proposal.original,proposal.changed,proposal.companions,true,proposal.choice,proposal.operationId,proposal.hash);}}/>}
    {creation&&<CreateCalendarDialog seed={creation} colors={data?.colors??[]} resources={data?.resources??[]} categories={data?.categoryOptions??[]} onClose={()=>setCreation(null)} onCreated={item=>created(item,creation.epoch)}/>}
    {teamOpen&&data&&<TeamOverview resources={resources} anchor={anchor} weekends={showWeekends} showTentative={showTentative} termFilter={termFilter} onClose={()=>setTeamOpen(false)}/>}
    {legendOpen&&data&&<CalendarLegendDialog data={data} events={visibleLegendEvents(matchedEvents,resources.map(resource=>resource.id),range.from,range.days,timeWindow,dayOffsets)} badgesVisible={showTechnicianBadges} onClose={()=>setLegendOpen(false)}/>}
    <dialog ref={dialog} className="calendar-edit-dialog" aria-labelledby="calendar-edit-title" onCancel={event=>{if(deleteConfirm){event.preventDefault();setDeleteConfirm(false);}else closeEditing();}}>
      <div className="dialog-heading"><h2 id="calendar-edit-title">{!pending&&(data?.permissions?.write&&selectionReady)?"Termin bearbeiten":"Termindetails"}</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" onClick={()=>{closeEditing();}}>×</button></div>
      {pending&&<Notice tone="neutral" className="calendar-save-status" role="status"><span className="calendar-save-spinner" aria-hidden="true"/>Termin wird gespeichert. Die Felder sind vorübergehend deaktiviert.</Notice>}
      {editing&&!deleteConfirm&&<form onSubmit={event=>{event.preventDefault();try{if(!editTitle.trim())throw new Error("Bitte einen Titel eingeben.");if(editing.event.address&&!editOptions.address)throw new Error("Bitte die vorhandene PDS-Anschrift ersetzen. Das Leeren der Anschrift ist nicht dokumentiert.");if(editing.event.mainTechnicianId&&editing.event.serviceIncidentId){if(!editResource)throw new Error("Bitte einen Haupttechniker auswählen.");void commit(editing.event,{...applyOptions(editing.event,editOptions),title:editTitle.trim(),notes:editNotes,start:wallInstant(editStart),end:wallInstant(editEnd),resourceIds:[editResource,...editCompanions],mainTechnicianId:editResource,companionTechnicianIds:editCompanions},editCompanions);return;}if(!editResources.length)throw new Error("Bitte mindestens eine Ressource auswählen.");void commit(editing.event,{...applyOptions(editing.event,editOptions),title:editTitle.trim(),notes:editNotes,start:wallInstant(editStart),end:wallInstant(editEnd),resourceIds:editResources});}catch(problem){setError(problem instanceof Error?problem.message:"Ungültiger Termin.");}}}>
        <p className="calendar-edit-kind">{typeLabels[editing.event.type as keyof typeof typeLabels]??editing.event.type}{editing.event.type==="SERVICEAUFTRAGEBENE"&&` · ${contractServiceLabels[editing.event.contractService??"UNBEKANNT"]}`}</p>
        {editing.event.continuation?.serviceCopy&&<p>Fortsetzung zur bestehenden Serviceauftragsebene. Technikerrollen werden in HeyElli geführt; die Mobilitätszuweisung des ursprünglichen Einsatzes bleibt eigenständig.</p>}
        <label>Titel *<input required maxLength={200} value={editTitle} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending} onChange={event=>setEditTitle(event.target.value)}/></label>
        <label>Beschreibung<textarea maxLength={4000} rows={3} value={editNotes} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending} onChange={event=>setEditNotes(event.target.value)}/></label>
        <CalendarOptionFields key={`options:${editing.event.id}`} value={editOptions} onChange={setEditOptions} start={editStart} end={editEnd} onStart={setEditStart} onEnd={setEditEnd} categories={data?.categoryOptions??[]} colors={data?.colors??[]} location={editing.event.location} fixedDisabled={!(data?.permissions?.write&&selectionReady)||pending} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending}/>
        <CalendarColorPreview event={applyOptions(editing.event,editOptions)} colors={data?.colors??[]} layouts={data?.colorLayouts}/>
        {(editing.event.link||editing.event.customer)&&<details className="calendar-section calendar-record-context"><summary>Auftrag &amp; Kunde</summary><dl>{editing.event.link&&<><dt>Auftrag</dt><dd>{[editing.event.link.number,editing.event.link.name].filter(Boolean).join(' · ')}</dd></>}{editing.event.orderStatus&&<><dt>Auftragsstatus</dt><dd>{editing.event.orderStatus.name}</dd></>}{editing.event.customer&&<><dt>Kunde</dt><dd>{editing.event.customer.name}</dd></>}</dl></details>}
        {editing.event.type==="URLAUB"&&editing.event.vacationApproval&&<p>Urlaub: <strong>{vacationApprovalLabels[editing.event.vacationApproval]}</strong></p>}
        <fieldset className="calendar-edit-group"><legend>Zuordnung</legend>
        {editing.event.mainTechnicianId&&editing.event.serviceIncidentId?<>
          <MainTechnicianPicker labelOverride={editing.event.continuation?.serviceCopy?"Haupttechniker · HeyElli-Fortsetzung":undefined} resources={data?.resources??[]} companionIds={editCompanions} selected={editResource} onChange={setEditResource} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending}/>
          <CompanionPicker resources={data?.resources??[]} mainId={editResource} selected={editCompanions} onChange={setEditCompanions} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending}/>
        </>:<>
          <ResourcePicker resources={data?.resources??[]} selected={editResources} onChange={setEditResources} disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending}/>
        </>}
        </fieldset>
        {editing.event.type==='SERVICEAUFTRAGEBENE'&&editing.event.link?.type==='SERVICEAUFTRAG'&&editing.event.mainTechnicianId&&!editing.event.continuation?.serviceCopy&&<details className="calendar-section calendar-edit-mobile"><summary>Mobile Ausgabe</summary><MobileIssue key={`mobile:${editing.event.id}`} id={editing.event.id} mainId={editing.event.mainTechnicianId} technician={data?.resources.find(item=>item.id===editing.event.mainTechnicianId)?.name??editing.event.mainTechnicianId} disabled={!(data?.permissions?.write&&selectionReady)||pending} onIssued={()=>setHistoryVersion(value=>value+1)}/></details>}
        <CancelOrder event={editing.event} disabled={!(data?.permissions?.write&&selectionReady)||pending} onSaved={()=>{setHistoryVersion(value=>value+1);closeEditing();void load();}}/>
        <CalendarHistory key={`history:${editing.event.id}`} eventId={editing.event.id} version={historyVersion+JSON.stringify(editing.event)} names={Object.fromEntries([...(data?.resources??[]).map(item=>[item.id,item.name]),...(data?.categoryOptions??[]).map(item=>[item.id,item.name])])}/>
        {error&&<Notice tone="error" role="alert">{error}</Notice>}
        <div className="discard-dialog-actions"><button type="button" className="discard-order-button" style={{marginRight:"auto"}} disabled={!(data?.permissions?.write&&selectionReady)||editing.event.fixed||pending} onClick={()=>{setError("");setDeleteConfirm(true);requestAnimationFrame(()=>deleteCancel.current?.focus());}}>Termin löschen</button><button type="button" className="skip-planning-button" onClick={()=>{closeEditing();}}>Schließen</button><button type="submit" disabled={!(data?.permissions?.write&&selectionReady)||(editing.event.fixed&&editOptions.fixed!==false)||pending||!editTitle.trim()||(editing.event.mainTechnicianId&&editing.event.serviceIncidentId?!editResource:!editResources.length)}>{pending?"Wird gespeichert …":"Änderung speichern"}</button></div>
      </form>}
      {editing&&deleteConfirm&&<div role="alertdialog" aria-labelledby="calendar-delete-title" aria-describedby="calendar-delete-description">
        <h3 id="calendar-delete-title">Termin wirklich löschen?</h3>
        <p><strong>{editing.event.title}</strong><br/>{berlinWall(editing.event.start).replace("T"," ")} – {berlinWall(editing.event.end).replace("T"," ")}</p>
        <p id="calendar-delete-description">Der Termin wird bei allen zugeordneten Ressourcen gelöscht. Dies kann in HeyElli nicht rückgängig gemacht werden.</p>
        {editing.event.continuation?.serviceCopy&&<p>Fortsetzung zur bestehenden Serviceauftragsebene. Technikerrollen werden in HeyElli geführt; die Mobilitätszuweisung des ursprünglichen Einsatzes bleibt eigenständig.</p>}
        {editing.event.type==="SERVICEAUFTRAGEBENE"&&<p>Der Serviceauftrag bleibt erhalten. Nur der Termin wird entfernt.</p>}
        {error&&<Notice tone="error" role="alert">{error}</Notice>}
        <div className="discard-dialog-actions"><button ref={deleteCancel} type="button" className="skip-planning-button" disabled={pending} onClick={()=>setDeleteConfirm(false)}>Weiter bearbeiten</button><button type="button" disabled={pending} onClick={()=>void deleteCurrent()}>{pending?"Wird gelöscht …":"Ja, Termin löschen"}</button></div>
      </div>}
    </dialog>
  </>;
}
function ResourceRow({id,name,number,group,hours,capacity,working,height,totalWidth,dayWidth,days,dayOffsets,from,view,timeWindow,currentWall,children}:{id:string;name:string;number:string;group:string;hours:string;capacity:ReturnType<typeof resourceCapacity>;working:ResourceWorkingTime|undefined;height:number;totalWidth:number;dayWidth:number;days:number;dayOffsets:number[];from:string;view:View;timeWindow:TimeWindow;currentWall:string;children:React.ReactNode}){
  return <><div className="calendar-resource" data-resource-row={id} style={{minHeight:height}}><strong>{name}</strong><small className="calendar-resource-group" title={group}>{[group,number].filter(Boolean).join(' · ')}</small>{capacity?(()=>{const h=(value:number)=>(value/60).toLocaleString("de-DE",{maximumFractionDigits:1}),available=Math.max(1,capacity.scheduled-capacity.absence),used=Math.min(100,Math.max(0,capacity.booked/available*100));return <><span className="calendar-capacity-bar" role="img" aria-label={`${h(capacity.booked)} h von ${h(available)} h belegt`} data-over={capacity.remaining<0||undefined}><i style={{width:`${Math.max(used,capacity.booked>0?4:0)}%`}}/></span><span className="calendar-resource-times"><strong className={capacity.remaining<0?"calendar-capacity-negative":"calendar-capacity-free"}>Rest {h(capacity.remaining)} h</strong> von {h(capacity.scheduled)} h{capacity.absence>0?` · abwesend ${h(capacity.absence)} h`:''}</span></>;})():<span className="calendar-resource-times">{hours} Terminstunden · Restkapazität unvollständig</span>}</div><div className="calendar-track" data-resource-row={id} data-track={id} style={{minHeight:height,height:"100%",width:totalWidth}}>{dayOffsets.map((offset,index)=>{const day=addDays(from,offset),weekend=[0,6].includes(new Date(day+"T12:00:00Z").getUTCDay());return <div key={day} title={working?.days.find(item=>item.date===day)?.holiday??undefined} className={`calendar-day-background ${weekend?"weekend":""} ${day===currentWall.slice(0,10)?"is-today":""} ${view==="month"?"month":""}`} style={{left:index*dayWidth,width:dayWidth,...(view!=="month"?{backgroundSize:`${dayWidth/(timeWindow.end-timeWindow.start)*60}px 100%, ${dayWidth}px 100%`}:{})}}/>;})}{working?.days.flatMap(day=>{const index=dayOffsets.indexOf((Date.parse(day.date)-Date.parse(from))/86400000);if(index<0)return [];return day.intervals.filter(interval=>interval.end>timeWindow.start&&interval.start<timeWindow.end).map((interval,indexInDay)=><div key={`${day.date}-${indexInDay}`} className="calendar-work-window" title={`${day.date} · ${day.modelName}`} aria-hidden="true" style={{left:(index+(Math.max(timeWindow.start,interval.start)-timeWindow.start)/(timeWindow.end-timeWindow.start))*dayWidth,width:(Math.min(timeWindow.end,interval.end)-Math.max(timeWindow.start,interval.start))/(timeWindow.end-timeWindow.start)*dayWidth}}/>);})}<CurrentQuarter from={from} days={days} dayOffsets={dayOffsets} dayWidth={dayWidth} timeWindow={timeWindow} currentWall={currentWall}/>{children}</div></>;
}

function CurrentQuarter({from,days,dayOffsets,dayWidth,timeWindow,currentWall}:{from:string;days:number;dayOffsets:number[];dayWidth:number;timeWindow:TimeWindow;currentWall:string}){
 if(!currentWall)return null;
 const dayOffset=(Date.parse(currentWall.slice(0,10)+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/86400000;
 if(dayOffset<0||dayOffset>=days)return null;const visibleIndex=dayOffsets.indexOf(dayOffset);if(visibleIndex<0)return null;
 const minutes=Number(currentWall.slice(11,13))*60+Number(currentWall.slice(14,16)),quarter=Math.floor(minutes/15)*15;
 if(quarter<timeWindow.start||quarter>=timeWindow.end)return null;
 return <div className="calendar-current-quarter" aria-hidden="true" style={{left:(visibleIndex+(quarter-timeWindow.start)/(timeWindow.end-timeWindow.start))*dayWidth,width:dayWidth*15/(timeWindow.end-timeWindow.start)}}/>;
}

function CalendarBar({write,item,lane,resourceId,active,totalWidth,dayWidth,origin,dayOffsets,timeWindow,pending,colors,colorLayouts,showTechnicianBadges,onPointerStart,onPointerMove,onPointerEnd,onPointerCancel,onKeyboard,onDetails,onFullEdit,dimmed}:{dimmed?:boolean;
  write:boolean;item:CalendarEvent;lane:number;resourceId:string;active:Drag|null;totalWidth:number;dayWidth:number;origin:number;dayOffsets:number[];timeWindow:TimeWindow;pending:boolean;showTechnicianBadges:boolean;colors:CalendarData["colors"];colorLayouts:CalendarData["colorLayouts"];
  onPointerStart:(event:ReactPointerEvent<HTMLButtonElement>,item:CalendarEvent,resourceId:string,operation:Drag["operation"])=>void;
  onPointerMove:(event:ReactPointerEvent<HTMLButtonElement>)=>void;onPointerEnd:(event:ReactPointerEvent<HTMLButtonElement>)=>void;onPointerCancel:()=>void;
  onKeyboard:(item:CalendarEvent,resourceId:string,operation:Drag["operation"],key:string,shift:boolean)=>void;onFullEdit:(item:CalendarEvent,resourceId:string)=>void;onDetails:(item:CalendarEvent,resourceId:string,anchor:{left:number;right:number;top:number;bottom:number})=>void;
}){
    const x=(instant:string)=>axisPosition(wallMinutes(instant)-origin,dayWidth,timeWindow,dayOffsets);
    const shown=active?.preview??item;
    const left=Math.max(0,x(shown.start)),right=Math.min(totalWidth,x(shown.end));if(right<=left||right<=0||left>=totalWidth)return null;
    const role=item.mainTechnicianId===resourceId?{short:"H",label:"Haupttechniker"}:item.companionTechnicianIds?.includes(resourceId)?{short:"B",label:"Begleitender Techniker"}:null;
    const barColors=eventColors(item,colors,colorLayouts);
    const style={left,width:Math.max(8,right-left),top:24+lane*44,transform:active?`translateY(${active.offsetY}px)`:undefined,background:barColors.main,color:calendarTextColor(barColors.main),zIndex:active?25:2};
    const props=(operation:Drag["operation"])=>!write?{}:({onPointerDown:(event:ReactPointerEvent<HTMLButtonElement>)=>onPointerStart(event,item,resourceId,operation),onPointerMove,onPointerUp:onPointerEnd,onPointerCancel,onKeyDown:(event:React.KeyboardEvent<HTMLButtonElement>)=>{if(event.key.startsWith("Arrow")){event.preventDefault();onKeyboard(item,resourceId,operation,event.key,event.shiftKey);}}});
    return <div key={item.id} aria-busy={pending} data-service-incident={item.serviceIncidentId} data-service-order={item.link?.type==="SERVICEAUFTRAG"?item.link.id:undefined} className={`calendar-bar ${dimmed?"is-dimmed":""} ${!write?"is-readonly":""} ${pending?"is-saving":""} ${item.fixed?"is-fixed":""} ${active?"is-dragging":""}`} style={style} title={`${item.title}\n${berlinWall(shown.start).replace("T"," ")} – ${berlinWall(shown.end).replace("T"," ")}\n${statusLabels[item.status]}${item.vacationApproval?` · Urlaub ${vacationApprovalLabels[item.vacationApproval]}`:""}${item.type==="SERVICEAUFTRAGEBENE"?` · ${contractServiceLabels[item.contractService??"UNBEKANNT"]}`:""}${role?` · ${role.label}`:""}${item.continuation?" · Fortsetzung":""}${item.fixed?" · Fixiert":""}`}>
      {barColors.secondary&&<span aria-hidden="true" className="calendar-secondary-color" style={{background:barColors.secondary}}/>}
      {showTechnicianBadges&&role&&<span aria-hidden="true" className={`calendar-technician-role ${role.short==="H"?"is-main":"is-companion"}`}>{role.short}{right-left>=150&&<span> · {role.short==="H"?"Haupttechniker":"Begleiter"}</span>}</span>}
      {!item.fixed&&dayOffsets.includes(Math.floor((wallMinutes(item.start)-origin)/1440))&&x(item.start)>=0&&<button type="button" className="calendar-grip grip-start" disabled={!write||pending} aria-label={`Beginn von ${item.title} ändern`} {...props("start")}/>}
      <button type="button" className="calendar-bar-body" aria-haspopup="menu" aria-label={`${item.title}, ${time(shown.start)} bis ${time(shown.end)}, ${statusLabels[item.status]}${item.vacationApproval?`, Urlaub ${vacationApprovalLabels[item.vacationApproval]}`:""}${role?`, ${role.label}`:""}${item.fixed?", fixiert":""}${pending?", wird gespeichert, Details öffnen":""}`} {...props("move")} onDoubleClick={event=>{event.stopPropagation();onFullEdit(item,resourceId);}} onClick={event=>{event.currentTarget.focus({preventScroll:true});const rect=event.currentTarget.getBoundingClientRect();onDetails(item,resourceId,{left:Math.max(8,rect.left),right:Math.min(window.innerWidth-8,rect.right),top:rect.top,bottom:rect.bottom});}}><span>{pending&&<span className="calendar-save-spinner" aria-hidden="true"/>}{item.fixed&&<svg className="calendar-fixed-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/></svg>}{item.title}</span>{right-left>95&&<small>{time(shown.start)}–{time(shown.end)}</small>}</button>
      {!item.fixed&&dayOffsets.includes(Math.floor((wallMinutes(new Date(Date.parse(item.end)-1).toISOString())-origin)/1440))&&x(item.end)<=totalWidth&&<button type="button" className="calendar-grip grip-end" disabled={!write||pending} aria-label={`Ende von ${item.title} ändern`} {...props("end")}/>}
    </div>;
  }
