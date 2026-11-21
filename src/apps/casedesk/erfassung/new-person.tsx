"use client";
import {Notice} from "@/platform/shell";
import {useEffect,useId,useRef,useState} from "react";
import {SearchPicker} from "./search-picker";
import type {SearchItem} from "./search-picker";
export function NewPerson({objectId,initialName,onCreated}:{objectId:string;initialName:string;onCreated:(person:SearchItem)=>void}) {
  const [customer,setCustomer]=useState<SearchItem | null>(null);
  const [customerLoading,setCustomerLoading]=useState(true);
  const [customerError,setCustomerError]=useState("");
  const [open,setOpen]=useState(false);
  const [name,setName]=useState(initialName);
  const [personFunction,setPersonFunction]=useState<SearchItem | null>(null);
  const [landline,setLandline]=useState("");const [mobile,setMobile]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const controller=useRef<AbortController | null>(null);
  const dialog=useRef<HTMLDialogElement>(null);const title=useId();
  useEffect(()=>{
    const request=new AbortController();
    fetch(`/api/pds-simulator?resource=customers&objectId=${encodeURIComponent(objectId)}`,{signal:request.signal}).then(async response=>{
      if(!response.ok)throw new Error();
      const result=await response.json();if(!result.items?.[0])throw new Error();
      if(!request.signal.aborted)setCustomer(result.items[0]);
    }).catch(()=>{if(!request.signal.aborted)setCustomerError("Objektkunde konnte nicht vorbelegt werden. Bitte einen Kunden auswählen.");}).finally(()=>{if(!request.signal.aborted)setCustomerLoading(false);});
    return ()=>request.abort();
  },[objectId]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  function close(){if(busy)return;controller.current?.abort();dialog.current?.close();setOpen(false);setBusy(false);}
  async function create() {
    if(busy || customerLoading || !customer)return;setBusy(true);setError("");controller.current=new AbortController();
    try {
      const response=await fetch("/api/pds-simulator/persons",{method:"POST",signal:controller.current.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({objectId,name,function:personFunction?.label ?? "",landline,mobile,customerNumber:customer.id})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(!controller.current.signal.aborted){dialog.current?.close();onCreated(result);setOpen(false);}
    }catch(error){if(!controller.current.signal.aborted)setError(error instanceof Error ? error.message : "Person konnte nicht gespeichert werden.");}
    finally{setBusy(false);}
  }
  return <>
    <button type="button" onClick={()=>setOpen(true)}>„{initialName}“ nicht gefunden – Person anlegen</button>
    {open && <dialog ref={dialog} aria-labelledby={title} onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{
      if(event.key==="Enter" && event.target instanceof HTMLInputElement && event.target.getAttribute("role")!=="combobox"){event.preventDefault();if(customer && name.trim() && personFunction && (landline.trim() || mobile.trim()))void create();}
    }}>
      <h2 id={title}>Neue Kundenperson</h2>
      <p>Der Objektkunde ist vorausgewählt. Für eine abweichende Zuordnung die Pille per X entfernen und einen anderen Kunden auswählen. Mindestens eine geschäftliche Telefonnummer ist erforderlich.</p>
      <SearchPicker label="Kunde" required resource="customers" selected={customer} onChange={item=>{setCustomer(item);setCustomerError("");}} disabled={busy || customerLoading} />
      {customerLoading && <Notice as="small" tone="neutral" role="status">Objektkunde wird geladen …</Notice>}
      {customerError && <Notice tone="error" role="alert">{customerError}</Notice>}
      <label>Name *<input value={name} maxLength={160} disabled={busy} onChange={event=>setName(event.target.value)} autoComplete="off" /></label>
      <SearchPicker label="Funktion" required resource="functions" selected={personFunction} onChange={setPersonFunction} disabled={busy} />
      <label>Geschäftliche Festnetznummer<input type="tel" value={landline} maxLength={50} disabled={busy} onChange={event=>setLandline(event.target.value)} /></label>
      <label>Geschäftliche Mobilnummer<input type="tel" value={mobile} maxLength={50} disabled={busy} onChange={event=>setMobile(event.target.value)} /></label>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <div className="incident-actions"><button type="button" disabled={busy || customerLoading || !customer || !name.trim() || !personFunction || !(landline.trim() || mobile.trim())} onClick={create}>{busy ? "Wird angelegt …" : "Person speichern und auswählen"}</button><button type="button" disabled={busy} onClick={close}>Abbrechen</button></div>
    </dialog>}
  </>;
}
