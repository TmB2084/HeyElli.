"use client";
import {SettingsPages,useSettingsPage,Notice} from "@/platform/shell";
import {useEffect,useEffectEvent,useId,useRef,useState} from "react";
import {useDraftNavigationGuard} from "../../../platform/shell/index";
import {vacationApprovalLabels,vacationDefaultColors,colorSources,defaultColorLayouts,type ColorLayouts,type ColorSource,contractDefaultColors,contractServiceLabels,fallbackColors,defaultColorsForCatalogs,colorRuleIdentity,typeLabels,unavailableStatusScopeLabels,statusScopeLabels,type CalendarCategory,type CalendarData,type CalendarColor,type StatusCatalog} from "./domain";
export function CalendarColorDialog({data={},onClose,onSaved,inline=false}:{data?:Pick<CalendarData,"statusCatalogs"|"categoryOptions"|"pdsColors"|"vacationApprovalSource">;onClose:()=>void;onSaved:()=>void;inline?:boolean}){
 const dialog=useRef<HTMLDialogElement & HTMLDivElement>(null);
 const Container=inline?"div":"dialog";
 const tabId=useId(),tabButtons=useRef<(HTMLButtonElement|null)[]>([]),[dialogTab,setDialogTab]=useState(0);
 const page=useSettingsPage('palette','colors',inline),activeTab=inline?(page.value?Number(page.value):-1):dialogTab;
 const setActiveTab=(index:number)=>inline?page.select(String(index)):setDialogTab(index);
 const tabs=["Termin-Konfiguration","Termin-Kategorien","Statusfarbe"];
 function activateTab(index:number){setActiveTab(index);tabButtons.current[index]?.focus();}
 const [rules,setRules]=useState<CalendarColor[]>([]),[catalogs,setCatalogs]=useState<StatusCatalog[]>(data.statusCatalogs??[]);
 const [colorLayouts,setColorLayouts]=useState<ColorLayouts>(defaultColorLayouts);
 const [version,setVersion]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [confirmed,setConfirmed]=useState({snapshot:'',rules:[] as CalendarColor[],layouts:defaultColorLayouts()});
 const [saveStatus,setSaveStatus]=useState('');
 const snapshot=JSON.stringify({rules,colorLayouts}),dirty=!!version&&snapshot!==confirmed.snapshot;
 const saved=useEffectEvent(onSaved);
 useDraftNavigationGuard(dirty,busy,()=>{setRules(confirmed.rules);setColorLayouts(confirmed.layouts);setError('');});
 useEffect(()=>{
  if(!dirty||busy||error)return;
  const timer=setTimeout(()=>{void (async()=>{
   setBusy(true);setSaveStatus('Wird gespeichert …');
   try{
    const response=await fetch('/api/ressourcenkalender/farben',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules,colorLayouts,expectedVersion:version})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    setConfirmed({snapshot,rules,layouts:colorLayouts});setVersion(result.version);setSaveStatus('Gespeichert');saved();
   }catch(problem){setError(problem instanceof Error?problem.message:'Speichern fehlgeschlagen. Ihre Änderungen bleiben im Formular erhalten.');setSaveStatus('Nicht gespeichert');}
   finally{setBusy(false);}
  })();},500);
  return()=>clearTimeout(timer);
 },[dirty,busy,error,snapshot,rules,colorLayouts,version]);
 const [categories,setCategories]=useState<CalendarCategory[]>(data.categoryOptions??[]);
 const configuredTypes=[{id:"VORGANG",name:"Vorgang"},{id:"PROJEKT",name:"Projekt"},{id:"TAETIGKEIT",name:"Tätigkeit"},{id:"SERVICEAUFTRAGEBENE",name:"Störung"},{id:"FREIER",name:"Freier Termin"},{id:"URLAUB",name:"Urlaub"},{id:"ABWESENHEIT",name:"Abwesenheit"},{id:"PRIVATE_ABWESENHEIT",name:"Private Abwesenheit"}];
 const [selectedType,setSelectedType]=useState("VORGANG"),typeButtons=useRef<(HTMLButtonElement|null)[]>([]);
 const selectedTypeName=configuredTypes.find(item=>item.id===selectedType)!.name;
 function activateType(index:number){setSelectedType(configuredTypes[index].id);typeButtons.current[index]?.focus();}
 const [scope,setScope]=useState("SERVICEAUFTRAG"),scopeButtons=useRef<(HTMLButtonElement|null)[]>([]);
 function activateScope(index:number){setScope(catalogs[index].type);scopeButtons.current[index]?.focus();}
 useEffect(()=>{if(!inline)dialog.current?.showModal();const controller=new AbortController();void fetch("/api/ressourcenkalender/farben",{signal:controller.signal,cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);setConfirmed({snapshot:JSON.stringify({rules:result.rules,colorLayouts:result.colorLayouts}),rules:result.rules,layouts:result.colorLayouts});setRules(result.rules);setColorLayouts(result.colorLayouts);setCatalogs(result.catalogs);setCategories(result.categories);setVersion(result.version);}).catch(problem=>{if(!controller.signal.aborted)setError(problem instanceof Error?problem.message:"Farben konnten nicht geladen werden.");});return ()=>controller.abort();},[inline]);
 const labels=new Map<string,string>();
 const key=(rule:CalendarColor)=>colorRuleIdentity(rule);
 for(const catalog of catalogs)for(const status of catalog.statuses)labels.set(key({orderType:catalog.type,orderStatus:status.id,farbe:""}),catalog.name+" · "+status.name);
 for(const vacationApproval of ["BEANTRAGT","GENEHMIGT"] as const)labels.set(key({vacationApproval,farbe:""}),"Urlaub · "+vacationApprovalLabels[vacationApproval]);
 for(const contractService of ["MIT","OHNE"] as const)labels.set(key({contractService,farbe:""}),contractServiceLabels[contractService]);
 for(const [typ,label]of Object.entries(typeLabels))labels.set(key({typ,farbe:""}),"Termintyp · "+label);
 for(const category of categories)labels.set(key({category:category.id,farbe:""}),"Kategorie · "+category.name);
 const label=(rule:CalendarColor)=>labels.get(key(rule))??(rule.orderType?`${statusScopeLabels[rule.orderType as keyof typeof statusScopeLabels]??rule.orderType} · Status nicht mehr in Liste`:rule.category?"Kategorie nicht mehr in Liste":key(rule));
 const catalog=catalogs.find(item=>item.type===scope),scoped=rules.filter(rule=>rule.orderType===scope),categoryRules=rules.filter(rule=>rule.category);
 const disabled=busy||!version;

 function row(rule:CalendarColor,displayLabel=label(rule),inputLabel=`Farbe für ${label(rule)}`,detail?:string){return <div className="calendar-color-row" key={key(rule)}><span>{displayLabel}{(rule.orderType||rule.category)&&<small>UUID: {rule.category??rule.orderStatus}</small>}{detail&&<small>{detail}</small>}</span><input type="color" aria-label={inputLabel} value={rule.farbe} disabled={disabled} onChange={event=>setRules(values=>values.some(value=>key(value)===key(rule))?values.map(value=>key(value)===key(rule)?{...value,farbe:event.target.value}:value):[{...rule,farbe:event.target.value},...values])}/><button type="button" disabled={disabled||!rules.some(value=>key(value)===key(rule))} aria-label={`${label(rule)} Farbregel entfernen`} onClick={()=>setRules(values=>values.filter(value=>key(value)!==key(rule)))}>×</button></div>;}

 function pdsRules(area:"type"|"category"|"status"){
  const values=(data.pdsColors??[]).filter(rule=>area==="type"?rule.typ===selectedType||selectedType==="URLAUB"&&rule.vacationApproval||selectedType==="SERVICEAUFTRAGEBENE"&&rule.contractService:area==="category"?rule.category:rule.orderType===scope&&rule.orderStatus);
  return !!values.length&&<details><summary>Farben aus PDS (Vorrang)</summary>{values.map(rule=><p key={key(rule)}><span style={{background:rule.farbe,padding:4,color:'#17212e'}}>{label(rule)} · {rule.farbe}</span></p>)}</details>;
 }

 return <Container ref={dialog} className={inline?"calendar-colors-inline":"calendar-edit-dialog calendar-color-dialog"} aria-labelledby="calendar-color-title" onCancel={event=>{if(busy||dirty)event.preventDefault();else onClose();}}>
  <div className={inline?"sr-only":"dialog-heading"}><h2 id="calendar-color-title" className={inline?"sr-only":undefined}>Kalenderfarben</h2>{!inline&&<button className="heyelli-close" aria-label="Dialog schließen" disabled={busy||dirty} onClick={onClose}>×</button>}</div>

  {inline?<SettingsPages namespace="palette" value={page.value} onChange={page.select} parent="Kalenderfarben"/>:(<div role="tablist" aria-label="Farbbereiche" className={inline?"admin-user-tabs calendar-color-subtabs":"calendar-color-tabs"}>{tabs.map((title,index)=><button key={title} ref={button=>{tabButtons.current[index]=button;}} type="button" role="tab" id={`${tabId}-tab-${index}`} aria-controls={`${tabId}-panel-${index}`} aria-selected={activeTab===index} tabIndex={activeTab===index?0:-1} disabled={busy} onClick={()=>setActiveTab(index)} onKeyDown={event=>{const next=event.key==="ArrowRight"?(index+1)%tabs.length:event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:event.key==="Home"?0:event.key==="End"?tabs.length-1:undefined;if(next!==undefined){event.preventDefault();activateTab(next);}}}>{title}</button>)}</div>)}

  <div role="tabpanel" id={`${tabId}-panel-0`} aria-label={inline?tabs[0]:undefined} aria-labelledby={inline?undefined:`${tabId}-tab-0`} hidden={activeTab!==0} tabIndex={0} className="calendar-color-panel">
   <div className="calendar-type-layout">
    <div><h3 id={`${tabId}-types-title`}>Termintypen</h3><div role="listbox" aria-labelledby={`${tabId}-types-title`} className="calendar-type-list">{configuredTypes.map((item,index)=><button key={item.id} ref={button=>{typeButtons.current[index]=button;}} role="option" type="button" aria-selected={selectedType===item.id} tabIndex={selectedType===item.id?0:-1} disabled={busy} onClick={()=>setSelectedType(item.id)} onKeyDown={event=>{const next=event.key==="ArrowDown"?(index+1)%configuredTypes.length:event.key==="ArrowUp"?(index+configuredTypes.length-1)%configuredTypes.length:event.key==="Home"?0:event.key==="End"?configuredTypes.length-1:undefined;if(next!==undefined){event.preventDefault();activateType(next);}}}>{item.name}</button>)}</div></div>
    <section className="calendar-type-colors" aria-label={`Farben für ${selectedTypeName}`}>
     <h3>{selectedTypeName} · Farbe</h3>
     {selectedType!=="URLAUB"?<fieldset className="calendar-color-order"><legend>Farbreihenfolge</legend><div className="calendar-option-grid">
      <label>Hauptfarbe<select disabled={disabled} value={colorLayouts[selectedType].main} onChange={event=>{const main=event.target.value as ColorSource;setColorLayouts(values=>({...values,[selectedType]:{main,secondary:values[selectedType].secondary===main?null:values[selectedType].secondary}}));}}>{Object.entries(colorSources).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Erste Nebenfarbe<select disabled={disabled} value={colorLayouts[selectedType].secondary??""} onChange={event=>setColorLayouts(values=>({...values,[selectedType]:{...values[selectedType],secondary:(event.target.value||null) as ColorSource|null}}))}><option value="">Leer</option>{Object.entries(colorSources).map(([id,name])=><option key={id} value={id} disabled={colorLayouts[selectedType].main===id}>{name}</option>)}</select></label>
     </div></fieldset>:<p>Urlaub verwendet die Termintypfarbe für „Beantragt“ oder „Genehmigt“.</p>}
     {selectedType==="URLAUB"?<>
      {(["BEANTRAGT","GENEHMIGT"] as const).map(vacationApproval=>row(rules.find(rule=>rule.vacationApproval===vacationApproval)??{vacationApproval,farbe:vacationDefaultColors[vacationApproval]},vacationApprovalLabels[vacationApproval]))}
      <small>{data.vacationApprovalSource==="view"?"Der Genehmigungsstatus wird über eine lesende PDS-Datenansicht zugeordnet.":"Ohne Genehmigungsstatus aus einer eingerichteten Datenansicht bleibt die Zuordnung offen."}</small>
     </>:selectedType==="SERVICEAUFTRAGEBENE"?<>
      {(["MIT","OHNE"] as const).map(contractService=>row(rules.find(rule=>rule.contractService===contractService)??{contractService,farbe:contractDefaultColors[contractService]}))}
      <small>Unbekannte Vertragszuordnungen verwenden die allgemeine Störungsfarbe oder eine neutrale Darstellung.</small>
      {rules.filter(rule=>rule.typ==="SERVICEAUFTRAGEBENE").map(rule=>row(rule,"Bei unbekannter Vertragsleistung"))}
     </>:<>
      {row(rules.find(rule=>rule.typ===selectedType)??{typ:selectedType,farbe:fallbackColors.find(rule=>rule.typ===selectedType)?.farbe??(["VORGANG","PROJEKT","TAETIGKEIT"].includes(selectedType)?"#cad0db":"#b9c2d1")},"Default",`Default-Farbe für ${selectedTypeName}`)}
      {!rules.some(rule=>rule.typ===selectedType)&&<small>Noch keine eigene Farbe für diesen Termintyp gespeichert.</small>}
     </>}
     {pdsRules("type")}
     {selectedType!=="URLAUB"&&<p className="calendar-type-hint">„Default“ gilt nur für den ausgewählten Termintyp. Die Farbreihenfolge oben bestimmt die Verwendung auf dem Balken.</p>}
    </section>
   </div>
  </div>
  <div role="tabpanel" id={`${tabId}-panel-1`} aria-label={inline?tabs[1]:undefined} aria-labelledby={inline?undefined:`${tabId}-tab-1`} hidden={activeTab!==1} tabIndex={0} className="calendar-color-panel">

   {pdsRules("category")}
   <div aria-label="Verfügbare Termin-Kategorien">{categories.map(category=>{
    const own=categoryRules.find(rule=>rule.category===category.id),pds=data.pdsColors?.find(rule=>rule.category===category.id);
    return row(own??{category:category.id,farbe:pds?.farbe??"#cad0db"},category.name,`Farbe für Kategorie · ${category.name}`,`Ganzer Tag: ${category.allDay?"Ja":"Nein"}${own?"":pds?" · Farbe aus PDS":" · Keine eigene Farbe festgelegt"}`);
   })}</div>
   {version&&!categories.length&&<p>Keine Kategorien aus PDS verfügbar.</p>}
   {!!categoryRules.filter(rule=>!categories.some(category=>category.id===rule.category)).length&&<details><summary>Zuordnungen zu nicht mehr verfügbaren Kategorien</summary>{categoryRules.filter(rule=>!categories.some(category=>category.id===rule.category)).map(rule=>row(rule))}</details>}

  </div>
  <div role="tabpanel" id={`${tabId}-panel-2`} aria-label={inline?tabs[2]:undefined} aria-labelledby={inline?undefined:`${tabId}-tab-2`} hidden={activeTab!==2} tabIndex={0} className="calendar-color-panel">
   <div className="calendar-type-layout calendar-status-layout">
    <div><h3 id={`${tabId}-scopes-title`}>Vorgangsart</h3><div role="listbox" aria-labelledby={`${tabId}-scopes-title`} className="calendar-type-list">
     {catalogs.map((item,index)=><button key={item.type} ref={button=>{scopeButtons.current[index]=button;}} role="option" type="button" aria-selected={scope===item.type} tabIndex={scope===item.type?0:-1} disabled={busy} onClick={()=>setScope(item.type)} onKeyDown={event=>{const next=event.key==="ArrowDown"?(index+1)%catalogs.length:event.key==="ArrowUp"?(index+catalogs.length-1)%catalogs.length:event.key==="Home"?0:event.key==="End"?catalogs.length-1:undefined;if(next!==undefined){event.preventDefault();activateScope(next);}}}>{item.name} ({item.statuses.length})</button>)}
    </div><details className="calendar-type-hint"><summary>Weitere Vorgangsarten</summary>{Object.entries(unavailableStatusScopeLabels).map(([type,name])=><p key={type}>{name} · API-Statusliste nicht dokumentiert</p>)}</details></div>
    <section className="calendar-type-colors" aria-label={`Statusfarben für ${catalog?.name??scope}`}>
     <h3>{catalog?.name??"Statusfarben werden geladen …"}</h3>

     {pdsRules("status")}
     {catalog?.statuses.map(status=>{
      const own=scoped.find(rule=>rule.orderStatus===status.id),pds=data.pdsColors?.find(rule=>rule.orderType===scope&&rule.orderStatus===status.id);
      return row(own??{orderType:scope,orderStatus:status.id,farbe:pds?.farbe??"#cad0db"},status.name,`Farbe für ${catalog.name} · ${status.name}`,own?undefined:pds?"Farbe aus PDS":"Keine eigene Farbe festgelegt");
     })}
     {version&&catalog&&!catalog.statuses.length&&<p>Keine Status für diese Vorgangsart verfügbar.</p>}
     {!!scoped.filter(rule=>!catalog?.statuses.some(status=>status.id===rule.orderStatus)).length&&<details><summary>Zuordnungen zu nicht mehr verfügbaren Status</summary>{scoped.filter(rule=>!catalog?.statuses.some(status=>status.id===rule.orderStatus)).map(rule=>row(rule))}</details>}
    </section>
   </div>
  </div>
  {error&&<Notice tone="error" role="alert">{error} {version&&<button type="button" disabled={busy} onClick={()=>setError("")}>Erneut versuchen</button>}</Notice>}
  <Notice tone={busy||dirty||error?"neutral":"success"} aria-live="polite">{busy?"Wird gespeichert …":dirty&&!error?"Änderungen werden automatisch gespeichert …":saveStatus}</Notice>
  <div className="discard-dialog-actions"><button type="button" className="skip-planning-button" disabled={disabled} onClick={()=>{setRules(defaultColorsForCatalogs(catalogs));setColorLayouts(defaultColorLayouts());}}>HeyElli-Standardfarben laden</button>{!inline&&<button type="button" className="skip-planning-button" disabled={busy||dirty} onClick={onClose}>Schließen</button>}</div>
 </Container>;
}
