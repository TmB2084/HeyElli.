import {createHash,randomUUID} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {CalendarError} from "./model.ts";
export function checkResourceSelection(value:unknown):string[]|null {
 if(value===null)return null;
 if(!Array.isArray(value)||value.length>5000||value.some(id=>typeof id!=="string"||!id.trim()||id.length>200))throw new CalendarError("Ungültige Ressourcenauswahl.");
 return [...new Set(value)] as string[];
}
export function selectionOwner(identity:string){return createHash("sha256").update(identity).digest("hex");}
export function resourceSelectionStore(directory=resolve(".local/heyelli/resource-selections")) {
 function file(identity:string){return resolve(directory,selectionOwner(identity)+".json");}
 function readSettings(identity:string){
  const path=file(identity);
  if(!existsSync(/* turbopackIgnore: true */ path))return {selection:null as string[]|null,showTechnicianBadges:true,limitWorkingHours:false,showTentative:true};
  const raw=JSON.parse(readFileSync(/* turbopackIgnore: true */ path,"utf8"));
  if(raw.showTechnicianBadges!==undefined&&typeof raw.showTechnicianBadges!=="boolean")throw new CalendarError("Ungültige Badge-Einstellung.");
  if(raw.limitWorkingHours!==undefined&&typeof raw.limitWorkingHours!=="boolean")throw new CalendarError("Ungültige Arbeitszeit-Einstellung.");
  if(raw.showTentative!==undefined&&typeof raw.showTentative!=="boolean")throw new CalendarError("Ungültige Vormerkungs-Einstellung.");
  return {selection:checkResourceSelection(raw.selection),showTechnicianBadges:raw.showTechnicianBadges??true,limitWorkingHours:raw.limitWorkingHours??false,showTentative:raw.showTentative??true};
 }
 function update(identity:string,patch:{selection?:unknown;showTechnicianBadges?:unknown;limitWorkingHours?:unknown;showTentative?:unknown}){
  const current=readSettings(identity);
  const selection=patch.selection===undefined?current.selection:checkResourceSelection(patch.selection);
  if(patch.showTechnicianBadges!==undefined&&typeof patch.showTechnicianBadges!=="boolean")throw new CalendarError("Ungültige Badge-Einstellung.");
  if(patch.limitWorkingHours!==undefined&&typeof patch.limitWorkingHours!=="boolean")throw new CalendarError("Ungültige Arbeitszeit-Einstellung.");
  if(patch.showTentative!==undefined&&typeof patch.showTentative!=="boolean")throw new CalendarError("Ungültige Vormerkungs-Einstellung.");
  const settings={showTentative:patch.showTentative===undefined?current.showTentative:patch.showTentative as boolean,limitWorkingHours:patch.limitWorkingHours===undefined?current.limitWorkingHours:patch.limitWorkingHours as boolean,selection,showTechnicianBadges:patch.showTechnicianBadges===undefined?current.showTechnicianBadges:patch.showTechnicianBadges as boolean};
  mkdirSync(directory,{recursive:true});const path=file(identity),temp=path+"."+randomUUID()+".tmp";
  try{writeFileSync(temp,JSON.stringify(settings),{mode:0o600});renameSync(temp,path);}finally{if(existsSync(temp))unlinkSync(temp);}
  return settings;
 }
 return {readSettings,update,read(identity:string){return readSettings(identity).selection;},write(identity:string,value:unknown){return update(identity,{selection:checkResourceSelection(value)}).selection;}};
}
