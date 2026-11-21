import {CalendarError,type CalendarEvent} from "./model.ts";
export type CalendarAddress={urPostkommunikationswegUUID:string;name?:string;strasse?:string;plz?:string;ort?:string;land?:string;zusatz?:string};
export type CalendarOptions={status?:"GEPLANT"|"FREI"|"VORGEMERKT";allDay?:boolean;fixed?:boolean;pimSync?:boolean;categories?:string[];objectId?:string;address?:CalendarAddress};
export type CalendarCategory={id:string;name:string;allDay:boolean};
export type CalendarLink={id:string;type:string;name:string;number?:string};
export type OrderStatus={id:string;name:string};
export type CalendarReference={id:string;label:string;address?:CalendarAddress};
export const creationTypes={FREIER:"Freier Termin",VORGANG:"Vorgang",PROJEKT:"Projektakte",ABWESENHEIT:"Abwesenheit",PRIVATE_ABWESENHEIT:"Private Abwesenheit"};
export const typeLabels={...creationTypes,SERVICEAUFTRAGEBENE:"Störung / Serviceeinsatz",TAETIGKEIT:"Tätigkeit",URLAUB:"Urlaub"};
export const transactionTypes={AUFTRAG:"Auftrag",ANGEBOT:"Angebot",BEDARFSMELDUNG:"Bedarfsmeldung",RECHNUNG:"Rechnung",LIEFERSCHEIN:"Lieferschein",BESTELLUNG:"Bestellung",WARENEINGANG:"Wareneingang",ABRUFAUFTRAG:"Abrufauftrag",GUTSCHRIFT:"Gutschrift",RUECKNAHME:"Rücknahme"};
export function checkOptions(raw:unknown):CalendarOptions{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new CalendarError("Ungültige Terminoptionen.");
 const value=raw as CalendarOptions,result:CalendarOptions={};
 if(value.status!==undefined){if(!["GEPLANT","FREI","VORGEMERKT"].includes(value.status))throw new CalendarError("Ungültiger Terminstatus.");result.status=value.status;}
 for(const key of ["allDay","fixed","pimSync"] as const)if(value[key]!==undefined){if(typeof value[key]!=="boolean")throw new CalendarError("Ungültiger Terminschalter.");result[key]=value[key];}
 if(value.categories!==undefined){if(!Array.isArray(value.categories)||value.categories.length>100||value.categories.some(id=>typeof id!=="string"||!id||id.length>100)||new Set(value.categories).size!==value.categories.length)throw new CalendarError("Ungültige Kategorien.");result.categories=[...value.categories];}
 if(value.objectId!==undefined){if(typeof value.objectId!=="string"||value.objectId.length>100)throw new CalendarError("Ungültiger Einsatzort.");result.objectId=value.objectId;}
 if(value.address!==undefined){
  if(!value.address||typeof value.address!=="object"||typeof value.address.urPostkommunikationswegUUID!=="string"||!value.address.urPostkommunikationswegUUID||value.address.urPostkommunikationswegUUID.length>100)throw new CalendarError("Bitte eine vorhandene PDS-Anschrift auswählen.");
  const address:CalendarAddress={urPostkommunikationswegUUID:value.address.urPostkommunikationswegUUID};
  for(const key of ["name","strasse","plz","ort","land","zusatz"] as const)if(value.address[key]!==undefined){if(typeof value.address[key]!=="string"||value.address[key]!.length>300)throw new CalendarError("Ungültige Anschrift.");address[key]=value.address[key];}
  result.address=address;
 }
 return result;
}
export function eventOptions(event:CalendarEvent):CalendarOptions{return {status:event.status,allDay:event.allDay,fixed:event.fixed,pimSync:event.pimSync??false,categories:[...event.categories],objectId:event.objectId??"",...(event.address?{address:event.address}:{})};}
export function optionKey(options:CalendarOptions){return JSON.stringify({...options,categories:options.categories?[...options.categories].sort():undefined,address:options.address?Object.fromEntries(Object.entries(options.address).sort(([a],[b])=>a.localeCompare(b))):undefined});}
export function nativeOptions(options:CalendarOptions){return {...(options.status!==undefined?{status:options.status}:{}),...(options.allDay!==undefined?{ganzerTag:options.allDay}:{}),...(options.fixed!==undefined?{fix:options.fixed}:{}),...(options.pimSync!==undefined?{pimSynchronisation:options.pimSync}:{}),...(options.categories!==undefined?{kategorienUUIDs:options.categories}:{}),...(options.objectId!==undefined?{objektUUID:options.objectId}:{}),...(options.address?{anschrift:options.address}:{})};}
export function optionChanges(before:CalendarEvent,after:CalendarEvent){return optionKey(eventOptions(before))===optionKey(eventOptions(after))?undefined:eventOptions(after);}

export function applyOptions(event:CalendarEvent,options:CalendarOptions):CalendarEvent{return {...event,...options,status:options.status??event.status,allDay:options.allDay??event.allDay,fixed:options.fixed??event.fixed,categories:options.categories??event.categories};}
