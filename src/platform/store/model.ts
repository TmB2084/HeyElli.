import {ACCOUNT_ID} from "../accounts/core.ts";
export type Role = "admin" | "dispatcher" | "reader";
export type Permission = "read" | "write" | "admin";
export function permitted(identity: {role: Role} | null | undefined, permission: Permission) {
  if (!identity || !["admin","dispatcher","reader"].includes(identity.role)) return false;
  return identity.role === "admin" || permission === "read" || permission === "write" && identity.role === "dispatcher";
}
export type PlatformUser = {id:string; displayName:string; role:Role; appRoleId?:string|null; enabled:boolean; version:number; username?:string|null; microsoftUpn?:string|null};
export class PlatformError extends Error {
  status: number;
  constructor(message:string,status=400) { super(message); this.status=status; }
}
export function userInput(value:unknown): PlatformUser {
  if (!value || typeof value !== "object") throw new PlatformError("Benutzerdaten fehlen.");
  const row=value as Record<string,unknown>;
  // Ohne Kennung wird ein neues Konto angelegt (Kennung erzeugt der Server).
  if (row.id!==undefined && row.id!==null && (typeof row.id!=="string" || !ACCOUNT_ID.test(row.id))) throw new PlatformError("Ungültige Kontokennung.");
  if (typeof row.displayName!=="string" || !row.displayName.trim() || row.displayName.length>100 || /[\x00-\x1f]/.test(row.displayName)) throw new PlatformError("Ungültiger Anzeigename.");
  if (row.role!=="admin" && row.role!=="dispatcher" && row.role!=="reader") throw new PlatformError("Ungültige Rolle.");
  if (typeof row.enabled!=="boolean" || !Number.isSafeInteger(row.version) || Number(row.version)<0) throw new PlatformError("Ungültiger Benutzerstatus oder Versionsstand.");
  if(row.appRoleId!==undefined&&row.appRoleId!==null&&(typeof row.appRoleId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.appRoleId)))throw new PlatformError("Ungültige App-Rolle.");
  return {...(row.appRoleId!==undefined?{appRoleId:row.appRoleId as string|null}:{}),id:typeof row.id==="string"?row.id:"",displayName:row.displayName.trim(),role:row.role,enabled:row.enabled,version:Number(row.version),username:row.username as string|null|undefined,microsoftUpn:row.microsoftUpn as string|null|undefined};
}
