import {contractDefaultColors} from "./contract-service.ts";
import {typeLabels} from "./options.ts";
import {CalendarError,fallbackColors,vacationDefaultColors,type CalendarColor} from "./model.ts";
export const defaultColorRules:CalendarColor[]=[...fallbackColors,{vacationApproval:"BEANTRAGT",farbe:vacationDefaultColors.BEANTRAGT},{vacationApproval:"GENEHMIGT",farbe:vacationDefaultColors.GENEHMIGT},{contractService:"MIT",farbe:contractDefaultColors.MIT},{contractService:"OHNE",farbe:contractDefaultColors.OHNE}];
const initialStatusColors:CalendarColor[]=[{orderStatusName:"Offen",farbe:"#91bfff"},{orderStatusName:"Ausgegeben",farbe:"#c7a1ee"},{orderStatusName:"In Bearbeitung",farbe:"#f2d685"},{orderStatusName:"Erledigt",farbe:"#94d9b8"},{orderStatusName:"Abgeschlossen",farbe:"#94d9b8"},{orderStatusName:"Storniert",farbe:"#b9c2d1"}];
export const initialColorRules=[...defaultColorRules,...initialStatusColors];
export function isSupportedColorRule(rule:CalendarColor){
 if(rule.status!==undefined||rule.orderStatusName!==undefined)return false;
 if(rule.vacationApproval!==undefined)return ["BEANTRAGT","GENEHMIGT"].includes(rule.vacationApproval)&&!rule.orderType;
 if(rule.typ!==undefined)return Object.hasOwn(typeLabels,rule.typ)&&!rule.orderType;
 if(rule.category!==undefined)return !!rule.category&&!rule.orderType;
 if(rule.contractService!==undefined)return ["MIT","OHNE"].includes(rule.contractService)&&!rule.orderType;
 return !!rule.orderStatus&&rule.orderStatus!=="*"&&!!rule.orderType;
}
export function checkColorRules(raw:unknown):CalendarColor[]{return parseColorRules(raw,false);}
// Only for reading old configuration/API views before migration; never accepts new writes.
export function readLegacyColorRules(raw:unknown):CalendarColor[]{return parseColorRules(raw,true);}
function parseColorRules(raw:unknown,legacy:boolean):CalendarColor[]{
 if(!Array.isArray(raw)||raw.length>1000)throw new CalendarError("Maximal 1000 Farbregeln sind zulässig.");
 const seen=new Set<string>();
 return raw.map(value=>{
  if(!value||typeof value!=="object"||typeof value.farbe!=="string"||!/^#[0-9a-fA-F]{6}$/.test(value.farbe))throw new CalendarError("Bitte gültige Hex-Farben wählen.");
  const keys=(["status","typ","category","orderStatus","orderStatusName","contractService","vacationApproval"] as const).filter(key=>value[key]!==undefined);
  if(keys.length!==1)throw new CalendarError("Jede Farbe benötigt genau ein Kriterium.");
  const key=keys[0],match=value[key];
  if(typeof match!=="string"||!match.trim()||match.length>120)throw new CalendarError("Ungültiges Farbkriterium.");
  if(key==="vacationApproval"&&!["BEANTRAGT","GENEHMIGT"].includes(match))throw new CalendarError("Ungültiger Urlaubsgenehmigungsstatus.");
  if(key==="contractService"&&!["MIT","OHNE"].includes(match))throw new CalendarError("Ungültige Vertragsleistungs-Farbregel.");
  if(key==="status"&&!["GEPLANT","FREI","VORGEMERKT"].includes(match))throw new CalendarError("Unbekannter Terminstatus.");
  if(value.orderType!==undefined&&(key!=="orderStatus"||typeof value.orderType!=="string"||!value.orderType||value.orderType.length>100||!/^[_A-Z]+$/.test(value.orderType)))throw new CalendarError("Eine Vorgangsart benötigt eine Status-UUID.");
  const id=String(value.orderType??"")+":"+key+":"+match;if(seen.has(id))throw new CalendarError("Doppelte Farbregel.");seen.add(id);
  const rule:CalendarColor={[key]:match,...(value.orderType?{orderType:value.orderType}:{}),farbe:value.farbe.toLowerCase()};
  if(!legacy&&!isSupportedColorRule(rule))throw new CalendarError("Farbregeln sind nur für Termin-Konfiguration, Termin-Kategorien und Statusfarbe mit Vorgangsart und UUID zulässig.");
  return rule;
 });
}

// Convert former global UUID/name rules once to the API identities of each scope.
// Existing scoped assignments (including orphaned ones) survive renames/removals.
export function resolveStatusRules(rules:CalendarColor[],catalogs:import("./status-catalog.ts").StatusCatalog[]):CalendarColor[]{
 const result:CalendarColor[]=[],seen=new Set<string>();
 const explicit=new Set(rules.filter(rule=>rule.orderType&&rule.orderStatus).map(colorRuleIdentity));
 function add(rule:CalendarColor,migrated=false){const key=colorRuleIdentity(rule);if(seen.has(key)||migrated&&explicit.has(key))return;seen.add(key);result.push(rule);}
 for(const rule of rules){
  if(rule.orderType||rule.orderStatus==="*"||!rule.orderStatus&&!rule.orderStatusName){add(rule);continue;}
  const id=rule.orderStatus==="sim-status-offen"?"sim-open":rule.orderStatus;
  const matches=catalogs.flatMap(catalog=>catalog.statuses.filter(status=>id?status.id===id:status.name===rule.orderStatusName).map(status=>({orderType:catalog.type,orderStatus:status.id,farbe:rule.farbe})));
  if(matches.length)for(const match of matches)add(match,true);else add(rule);
 }
 return result;
}
export function colorRuleIdentity(rule:CalendarColor){const key=(["orderStatus","orderStatusName","category","typ","status","contractService","vacationApproval"] as const).find(key=>rule[key]!==undefined)!;return JSON.stringify([rule.orderType??"",key,rule[key]]);}

export function normalizeColorRules(rules:CalendarColor[],catalogs:import("./status-catalog.ts").StatusCatalog[]){return checkColorRules(resolveStatusRules(rules,catalogs).filter(isSupportedColorRule));}
export function defaultColorsForCatalogs(catalogs:import("./status-catalog.ts").StatusCatalog[]){return normalizeColorRules(initialColorRules,catalogs);}
