// Herzschlag-Datei für Hintergrunddienste ohne Port: Der Dienst schreibt regelmäßig eine Datei, die Gesundheitsprüfung
// (scripts/health-check.mjs) prüft ihr Alter. Standardort ist das tmpfs /tmp im Container (HEYELLI_HEARTBEAT_DIR überschreibt).
import {statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const heartbeatFile=(name,dir=process.env.HEYELLI_HEARTBEAT_DIR||tmpdir())=>{
  if(!/^[a-z0-9-]{1,40}$/.test(name))throw new Error('Ungültiger Dienstname.');
  return join(dir,`heyelli-${name}.heartbeat`);
};
// Schreibt den Herzschlag. Ein Schreibfehler darf den Dienst nie beenden (die Prüfung meldet dann "nicht gesund").
export function beat(name,{dir}={}){try{writeFileSync(heartbeatFile(name,dir),String(Date.now()),{mode:0o600});return true;}catch{return false;}}
// Frisch heißt: Datei vorhanden und jünger als maxAgeSeconds (Standard 120 s). Eine fehlende Datei ist nicht gesund.
export function heartbeatFresh(name,maxAgeSeconds=120,{dir,now=Date.now()}={}){
  try{return (now-statSync(heartbeatFile(name,dir)).mtimeMs)/1000<maxAgeSeconds;}catch{return false;}
}
