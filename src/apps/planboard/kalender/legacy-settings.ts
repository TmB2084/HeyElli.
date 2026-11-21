import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {initialColorRules,readLegacyColorRules} from "./colors.ts";
import {checkColorLayouts,defaultColorLayouts} from "./color-layout.ts";
import {defaultPreferences,patchPreferences,type CalendarPreferences} from "./preferences.ts";
import {CalendarError} from "./model.ts";
export function settingsOwner(identity:string){return createHash("sha256").update(identity).digest("hex");}
export function settingsRoot() {
  // Automated tests never read the development files, even when run from the repository.
  if(process.env.APP_ENV==="test") {
    if(!process.env.HEYELLI_TEST_SETTINGS_DIR)throw new CalendarError("Getrenntes Testverzeichnis für Einstellungen fehlt.");
    return resolve(process.env.HEYELLI_TEST_SETTINGS_DIR);
  }
  return resolve(".local/heyelli");
}
function jsonFile(file:string):unknown|undefined {
  try {return JSON.parse(readFileSync(/* turbopackIgnore: true */ file,"utf8"));}
  catch(error) {
    if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;
    throw new CalendarError("Bestehende Einstellungsdatei ist nicht lesbar oder ungültig. Übernahme abgebrochen; Originaldatei bleibt erhalten.",503);
  }
}
export function legacyColors(root:string) {
  const raw=jsonFile(resolve(root,"calendar-colors.json"));
  const object=raw as {rules?:unknown;colorLayouts?:unknown}|undefined;
  const rules=readLegacyColorRules(raw===undefined?initialColorRules:Array.isArray(raw)?raw:object?.rules);
  const colorLayouts=raw===undefined||Array.isArray(raw)||object?.colorLayouts===undefined?defaultColorLayouts():checkColorLayouts(object.colorLayouts);
  return {rules,colorLayouts};
}
export function legacyPreferences(root:string,owner:string,defaults:CalendarPreferences=defaultPreferences()) {
  if(!/^[a-f0-9]{64}$/.test(owner))throw new CalendarError("Ungültige Einstellungszuordnung.");
  const raw=jsonFile(resolve(root,"resource-selections",owner+".json"));
  // Legacy files always contain selection, including [] and null.
  if(raw!==undefined&&(!raw||typeof raw!=="object"||!("selection" in raw)))throw new CalendarError("Bestehende Ressourcenauswahl ist unvollständig. Übernahme abgebrochen.",503);
  return raw===undefined?defaults:patchPreferences(defaultPreferences(),raw);
}
export function legacyOwners(root:string) {
  try {return readdirSync(/* turbopackIgnore: true */ resolve(root,"resource-selections")).filter(file=>/^[a-f0-9]{64}\.json$/.test(file)).map(file=>file.slice(0,-5));}
  catch(error) {if((error as NodeJS.ErrnoException).code==="ENOENT")return [];throw new CalendarError("Bestehende Benutzereinstellungen sind nicht lesbar.",503);}
}
