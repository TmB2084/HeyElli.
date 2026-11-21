import "server-only";
import {platformDatabase} from "../../../platform/store/index.ts";
import {postgresSettings} from "./postgres-settings.ts";
import {settingsRoot} from "./legacy-settings.ts";
import {settingsOwner} from "./legacy-settings.ts";
import {pdsSource,calendarSourcePool} from "../../../platform/pds/connection";
import {resolve} from "node:path";
export const appearanceOwner=settingsOwner;
export async function selectionOwner(identity:string){const source=await pdsSource();return settingsOwner(source.mode==='simulator'?identity:`${source.workspaceId}:${identity}`);}
function stores(){return postgresSettings(platformDatabase(),settingsRoot());}
async function sourceStores(selected?:Awaited<ReturnType<typeof pdsSource>>){const source=selected??await pdsSource();return source.mode==='simulator'?stores():postgresSettings(calendarSourcePool(platformDatabase(),source.workspaceId!),resolve(settingsRoot(),'pds',source.workspaceId!));}
export function colorSettingsStore(){return {readWithCatalogs:async(...args:Parameters<ReturnType<typeof postgresSettings>['colorStore']['readWithCatalogs']>)=>(await sourceStores()).colorStore.readWithCatalogs(...args),write:async(...args:Parameters<ReturnType<typeof postgresSettings>['colorStore']['write']>)=>(await sourceStores()).colorStore.write(...args)};}
export function resourceSelectionStore(){return {readSettings:async(identity:string)=>{const source=await pdsSource();return {...await (await sourceStores(source)).selectionStore.readSettings(identity),owner:settingsOwner(source.mode==='simulator'?identity:`${source.workspaceId}:${identity}`)};},update:async(...args:Parameters<ReturnType<typeof postgresSettings>['selectionStore']['update']>)=>{const source=await pdsSource(),expected= settingsOwner(source.mode==='simulator'?args[0]:`${source.workspaceId}:${args[0]}`);if(args[1]&&typeof args[1]==='object'&&'owner' in args[1]&&args[1].owner!==expected)throw new Error('PDS-Quelle wurde gewechselt. Auswahl neu öffnen.');return (await sourceStores(source)).selectionStore.update(...args);}};}
export function appearanceSettingsStore(){return stores().appearanceStore;}

import {calendarChangeAudit} from "./change-audit.ts";
export function calendarAuditStore(){return calendarChangeAudit(platformDatabase());}
