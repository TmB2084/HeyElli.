import type {StatusCatalog} from "./status-catalog.ts";
import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync,unlinkSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {CalendarError} from "./model.ts";
import {checkColorRules,readLegacyColorRules,initialColorRules,isSupportedColorRule,normalizeColorRules} from "./colors.ts";
import {checkColorLayouts,defaultColorLayouts} from "./color-layout.ts";
export function colorSettingsStore(file=resolve(".local/heyelli/calendar-colors.json")){
 function rawRead(){
  const raw=existsSync(/* turbopackIgnore: true */ file)?JSON.parse(readFileSync(/* turbopackIgnore: true */ file,"utf8")):initialColorRules;
  const rules=readLegacyColorRules(Array.isArray(raw)?raw:raw.rules),colorLayouts=Array.isArray(raw)?defaultColorLayouts():checkColorLayouts(raw.colorLayouts);
  return {rules,colorLayouts,version:createHash("sha256").update(JSON.stringify({rules,colorLayouts})).digest("hex")};
 }
 function read(){const raw=rawRead();return {...raw,rules:raw.rules.filter(isSupportedColorRule)};}
 const store={read,readWithCatalogs(catalogs:StatusCatalog[]){const current=rawRead(),rules=normalizeColorRules(current.rules,catalogs);return JSON.stringify(rules)===JSON.stringify(current.rules)?current:store.write(rules,current.version,current.colorLayouts);},write(raw:unknown,expectedVersion:unknown,layoutInput?:unknown){
  const current=rawRead();if(expectedVersion!==current.version)throw new CalendarError("Farben wurden zwischenzeitlich geändert. Bitte neu laden.",409);
  const rules=checkColorRules(raw),colorLayouts=checkColorLayouts(layoutInput??current.colorLayouts);
  mkdirSync(dirname(file),{recursive:true});const temp=file+"."+randomUUID()+".tmp";
  try{writeFileSync(temp,JSON.stringify({rules,colorLayouts},null,2)+"\n",{mode:0o600});renameSync(temp,file);}finally{if(existsSync(temp))unlinkSync(temp);}return read();
 }};
 return store;
}
