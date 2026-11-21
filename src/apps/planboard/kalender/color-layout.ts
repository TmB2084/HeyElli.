import {CalendarError} from "./model.ts";
export const colorSources={type:"Termin-Konfiguration",category:"Termin-Kategorien",status:"Statusfarbe"} as const;
export type ColorSource=keyof typeof colorSources;
export const colorLayoutTypes=["VORGANG","PROJEKT","TAETIGKEIT","SERVICEAUFTRAGEBENE","FREIER","ABWESENHEIT","PRIVATE_ABWESENHEIT"] as const;
export type ColorLayouts=Record<string,{main:ColorSource;secondary:ColorSource|null}>;
// No implicit cross-area priority: new and legacy configurations start with type only.
export function defaultColorLayouts():ColorLayouts{return Object.fromEntries(colorLayoutTypes.map(type=>[type,{main:"type",secondary:null}])) as ColorLayouts;}
export function checkColorLayouts(raw:unknown):ColorLayouts {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new CalendarError("Farbreihenfolge je Termintyp fehlt.");
 const values=raw as Record<string,unknown>;
 if(Object.keys(values).length!==colorLayoutTypes.length||Object.keys(values).some(type=>!colorLayoutTypes.includes(type as typeof colorLayoutTypes[number])))throw new CalendarError("Farbreihenfolge nur für die sieben Termintypen außer Urlaub zulässig.");
 const result:ColorLayouts={};
 for(const type of colorLayoutTypes){const value=values[type] as ColorLayouts[string]|undefined;
  if(!value||typeof value!=="object"||!Object.hasOwn(colorSources,value.main)||value.secondary!==null&&!Object.hasOwn(colorSources,value.secondary)||value.main===value.secondary||Object.keys(value).some(key=>!["main","secondary"].includes(key)))throw new CalendarError("Bitte unterschiedliche Bereiche für Hauptfarbe und optionale Nebenfarbe wählen.");
  result[type]={main:value.main,secondary:value.secondary};
 }
 return result;
}
