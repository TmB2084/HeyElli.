import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOGIN_REASONS,loginFailureReason,loginRejectedLine,logLoginRejected} from '../login-log.ts';
import {PlatformError} from '../../store/model.ts';
import {verifyPassword,hashPassword} from '../password.ts';

test('Ablehnungsgrund: eigene Fehlermeldungen werden festen Gründen zugeordnet',()=>{
 const cases=[
  [new Error('Demoanmeldung in Produktion gesperrt.'),'Modus gesperrt'],
  [new Error('Anmeldung nicht konfiguriert.'),'nicht konfiguriert'],
  [new PlatformError('Benutzer nicht freigeschaltet.',403),'Benutzer nicht freigeschaltet'],
  [new Error('Anmeldung fehlgeschlagen.'),'falsches Passwort oder unbekannter Benutzer'],
  [new Error('Demoanmeldung fehlgeschlagen.'),'falsches Passwort oder unbekannter Benutzer'],
  [new Error('PDS-Zuordnung fehlt.'),'PDS-Zuordnung fehlt'],
  [new Error('Vertrauenswürdige Anmeldequelle fehlt.'),'Anmeldequelle (Header) fehlt oder ungültig'],
  [new Error('Ungültiger Header für die Anmeldequelle.'),'Anmeldequelle (Header) fehlt oder ungültig'],
  [new Error('Demobenutzer fehlen.'),'Verzeichnisdienst-Konfiguration unvollständig'],
  [new Error('Anmeldung erfolgt über Microsoft.'),'durch Microsoft ersetzt'],
  [Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'),{code:'ECONNREFUSED'}),'Anmeldequelle oder Datenbank nicht erreichbar'],
  [Object.assign(new Error('terminating connection'),{code:'57P01'}),'Anmeldequelle oder Datenbank nicht erreichbar'],
  [new Error('irgendetwas Unerwartetes mit Geheimnis hunter2'),'unbekannter Fehler'],
  ['kein Fehlerobjekt','unbekannter Fehler'],[undefined,'unbekannter Fehler'],
 ];
 for(const [error,reason] of cases){assert.equal(loginFailureReason(error),reason);assert.ok(LOGIN_REASONS.includes(reason));}
});
test('Logzeile enthält nur festen Grund, Modus und Status, nie Fehlertext, Benutzername oder Passwort',()=>{
 assert.equal(loginRejectedLine('Benutzer nicht freigeschaltet','demo-directory',401),'Anmeldung abgelehnt: Benutzer nicht freigeschaltet (Modus demo-directory, HTTP 401)');
 const gespeichert=[];logLoginRejected('falsches Passwort oder unbekannter Benutzer','simulator',401,l=>gespeichert.push(l));
 assert.deepEqual(gespeichert,['Anmeldung abgelehnt: falsches Passwort oder unbekannter Benutzer (Modus simulator, HTTP 401)']);
 // Eingeschleuste Werte (Passwort, Benutzername, Zeilenumbruch) landen nie in der Zeile
 const boese=loginRejectedLine('demo.alex hunter2\nFAKE: angemeldet','x y\nz',401.5);
 assert.equal(boese,'Anmeldung abgelehnt: unbekannter Fehler (Modus unbekannt, HTTP 0)');
 assert.ok(!/hunter2|demo\.alex|\n/.test(boese));
});
test('Kontoanmeldung: falsches Passwort und fehlende PDS-Zuordnung ergeben feste Gründe ohne Geheimnisse',async()=>{
 const stored=await hashPassword('fiktives-passwort-123');
 assert.equal(await verifyPassword('falsch-falsch-falsch',stored),false);assert.equal(await verifyPassword('fiktives-passwort-123',stored),true);
 assert.equal(loginFailureReason(new Error('Anmeldung fehlgeschlagen.')),'falsches Passwort oder unbekannter Benutzer');
 const line=loginRejectedLine(loginFailureReason(new Error('PDS-Zuordnung fehlt.')),'local',401);
 assert.equal(line,'Anmeldung abgelehnt: PDS-Zuordnung fehlt (Modus local, HTTP 401)');assert.ok(!line.includes('fiktives-passwort'));
});
test('Route: alle Ablehnungen laufen über rejected() mit Logzeile, es wird nichts aus der Eingabe protokolliert',()=>{
 const quelle=readFileSync(new URL('../../../app/api/simulator-session/route.ts',import.meta.url),'utf8');
 const post=quelle.slice(quelle.indexOf('export async function POST'),quelle.indexOf('export async function DELETE'));
 assert.ok(post.includes('rejected(')&&!/Response\.json\(\{error:[^)]*\},\{status:4\d\d|Response\.json\(\{error:[^)]*\},\{status:50\d/.test(post),'keine Fehlerantwort an rejected() vorbei');
 assert.ok(!/console\.(log|warn|error|info)\(/.test(quelle),'keine direkten console-Aufrufe in der Route');
 assert.ok(!/logLoginRejected\([^)]*(input|username|password|raw)/.test(quelle),'Eingabewerte nie an die Logzeile übergeben');
});
