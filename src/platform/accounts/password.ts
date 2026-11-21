import {randomBytes,scrypt,timingSafeEqual} from "node:crypto";
import {PlatformError} from "../store/model.ts";

// Passwörter der heyelli-Konten (gültig bis zur Aktivierung der Microsoft-Anmeldung).
// scrypt aus Node, Format: scrypt$N$r$p$<Salz base64url>$<Schlüssel base64url>. Keine Klartexte in Datenbank oder Protokoll.
const N=32768,R=8,P=1,KEY_LENGTH=64,MAX_MEMORY=128*1024*1024;
export const MIN_PASSWORD_LENGTH=12,MAX_PASSWORD_LENGTH=256;
const STORED=/^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/;

function derive(password:string,salt:Buffer,n:number,r:number,p:number){
 return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,KEY_LENGTH,{N:n,r,p,maxmem:MAX_MEMORY},(error,key)=>error?reject(error):resolve(key)));
}
export function validateNewPassword(password:unknown):string{
 if(typeof password!=="string"||password.length<MIN_PASSWORD_LENGTH)throw new PlatformError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
 if(password.length>MAX_PASSWORD_LENGTH||/[\x00-\x1f\x7f]/.test(password))throw new PlatformError("Ungültiges Passwort.");
 if(!password.trim())throw new PlatformError("Ungültiges Passwort.");
 return password;
}
export async function hashPassword(password:unknown){
 const value=validateNewPassword(password),salt=randomBytes(16);
 const key=await derive(value,salt,N,R,P);
 return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
// Vergleich in konstanter Zeit; ohne gespeicherten Hash wird trotzdem gerechnet (keine Auskunft über vorhandene Konten).
const dummySalt=randomBytes(16);
export async function verifyPassword(password:unknown,stored:string|null|undefined){
 const candidate=typeof password==="string"&&password.length>0&&password.length<=MAX_PASSWORD_LENGTH?password:"";
 const match=STORED.exec(stored??"");
 if(!match||!candidate){await derive(candidate||"-",dummySalt,N,R,P);return false;}
 const [,n,r,p,salt,expected]=match;
 if(Number(n)!==N||Number(r)!==R||Number(p)!==P)return false;
 const key=await derive(candidate,Buffer.from(salt,"base64url"),N,R,P),want=Buffer.from(expected,"base64url");
 return key.length===want.length&&timingSafeEqual(key,want);
}
// Startpasswort für neue oder zurückgesetzte Konten: 24 Zeichen, nur einmal angezeigt.
export function generateInitialPassword(){return randomBytes(18).toString("base64url");}
export function usernameInput(value:unknown):string{
 if(typeof value!=="string")throw new PlatformError("Benutzername fehlt.");
 const name=value.trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(name))throw new PlatformError("Benutzername: 3 bis 80 Zeichen, Kleinbuchstaben, Ziffern, Punkt, Bindestrich oder Unterstrich.");
 return name;
}
export function upnInput(value:unknown):string|null{
 if(value===null||value===undefined||value==="")return null;
 if(typeof value!=="string")throw new PlatformError("Ungültige Microsoft-Anmeldeadresse.");
 const upn=value.trim().toLowerCase();
 if(upn.length<3||upn.length>254||!/^[^\s@]+@[^\s@]+$/.test(upn))throw new PlatformError("Ungültige Microsoft-Anmeldeadresse.");
 return upn;
}
