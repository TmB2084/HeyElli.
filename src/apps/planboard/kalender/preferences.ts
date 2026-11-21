import {CalendarError} from "./model.ts";
export type CalendarPreferences={selection:string[]|null;showTechnicianBadges:boolean;limitWorkingHours:boolean;showTentative:boolean;showWeekends?:boolean};
export type PreferencePatch={selection?:unknown;showTechnicianBadges?:unknown;limitWorkingHours?:unknown;showTentative?:unknown;showWeekends?:unknown};
export function defaultPreferences():CalendarPreferences {return {selection:null,showTechnicianBadges:true,limitWorkingHours:false,showTentative:true};}
export function checkSelection(value:unknown):string[]|null {
  if(value===null)return null;
  if(!Array.isArray(value)||value.length>5000||value.some(id=>typeof id!=="string"||!id.trim()||id.length>200))throw new CalendarError("Ungültige Ressourcenauswahl.");
  return [...new Set(value)] as string[];
}
export function patchPreferences(current:CalendarPreferences,input:unknown):CalendarPreferences {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new CalendarError("Ungültige Anzeigeeinstellungen.");
  const patch=input as PreferencePatch;
  for(const key of ["showTechnicianBadges","limitWorkingHours","showTentative","showWeekends"] as const)if(patch[key]!==undefined&&typeof patch[key]!=="boolean")throw new CalendarError("Ungültige Anzeigeeinstellung.");
  return {...(patch.showWeekends!==undefined?{showWeekends:patch.showWeekends as boolean}:current.showWeekends!==undefined?{showWeekends:current.showWeekends}:{}),selection:patch.selection===undefined?current.selection:checkSelection(patch.selection),showTechnicianBadges:patch.showTechnicianBadges===undefined?current.showTechnicianBadges:patch.showTechnicianBadges as boolean,limitWorkingHours:patch.limitWorkingHours===undefined?current.limitWorkingHours:patch.limitWorkingHours as boolean,showTentative:patch.showTentative===undefined?current.showTentative:patch.showTentative as boolean};
}
export type Appearance="dark"|"light"|"system";
export function checkAppearance(value:unknown):Appearance {
  if(value!=="dark"&&value!=="light"&&value!=="system")throw new CalendarError("Ungültige Darstellung.");
  return value;
}
