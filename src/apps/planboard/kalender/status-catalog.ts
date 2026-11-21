import {transactionTypes} from "./options.ts";
export const statusScopeLabels={SERVICEAUFTRAG:"Serviceauftrag / Störung",...transactionTypes,PROJEKT:"Projektakte",RUECKLAUF:"Rücklauf",ZAEHLLISTE:"Zählliste"};
export type StatusScope=keyof typeof statusScopeLabels;
export type CatalogStatus={id:string;name:string;category?:string};
export type StatusCatalog={type:StatusScope;name:string;statuses:CatalogStatus[]};
export function statusRuleKey(type:string,id:string){return JSON.stringify([type,id]);}
// Visible in PDS calendar settings, but not accepted by the documented liststatus APIs.
export const unavailableStatusScopeLabels={PREISANFRAGE:"Preisanfrage",RUECKLIEFERUNG:"Rücklieferung",AUFMASS:"Aufmaß",EINGANGSRECHNUNG:"Eingangsrechnung",AUFTRAGSBESTAETIGUNG:"Auftragsbestätigung",WARTUNGSAUFTRAG:"Wartungsauftrag",WARTUNGSANGEBOT:"Wartungsangebot"};
