import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {permitted} from '../../../../platform/store/model.ts';
import {featureCatalog} from '../feature-catalog.ts';
import {elliDirectAnswer,readableFunctionality} from '../identity.ts';
import {helpTopics} from '../knowledge.ts';
import {searchHelp,retrieveHelp,groundedHelpAnswer,resolveHelpHash} from '../help-search.ts';

test('catalog covers all existing help areas with traceable source files and permission requirements',async()=>{
 const keys=new Set();
 for(const feature of featureCatalog){
  assert.ok(helpTopics.some(topic=>topic.id===feature.topicId));
  assert.ok(feature.steps.length&&feature.limitations.length&&feature.sourceFiles.length);
  assert.ok(['read','write','admin','linked','tool'].includes(feature.permission));
  assert.match(feature.route,/^\/(?!\/)/);
  const key=feature.topicId+':'+feature.title;assert.ok(!keys.has(key));keys.add(key);
  for(const source of feature.sourceFiles){assert.match(source,/^(?:src|scripts)\//);assert.ok(!source.split('/').includes('..'));await access(source);}
 }
 assert.ok(helpTopics.reduce((sum,topic)=>sum+topic.sections.length,0)>=70);
});

const cases=[
 ['Wie blende ich einzelne Kunden aus?','Kunden, Objekte und technische Einheiten ausblenden'],
 ['Wie mache ich ausgeblendete technische Einheiten wieder sichtbar?','Kunden, Objekte und technische Einheiten ausblenden'],
 ['Wie entsperre ich einen Termin?','Fixierung ändern'],
 ['Wie verstecke ich Samstag und Sonntag?','Wochenende ein- und ausblenden'],
 ['Wird Urlaub bei Bereitschaften berücksichtigt?','Urlaub und Sperrwochen'],
 ['Kann ich als Leser eine Sperrwoche ausschließen?','Urlaub und Sperrwochen'],
 ['Wie tausche ich Bereitschaften?','Tauschwunsch vorschlagen und freigeben'],
 ['Wie gebe ich alle Serviceaufträge heute aus?','Mehrere Serviceaufträge mobil ausgeben'],
 ['Wo sehe ich wer den Termin geändert hat?','Terminhistorie ansehen'],
 ['Wie kann ich einen bestehenden Auftrag ohne Techniker planen?','Terminvergabe ohne neuen Auftrag'],
 ['Muss ich PDS Datenansichten benutzen?','PDS-Anbindung sicher vorbereiten'],
 ['Kann ich zwei Wochen hintereinander Bereitschaft haben?','Bereitschaft direkt zuweisen'],
 ['Wo ist meine Rolle?','Profil und Mitarbeiterzuordnung'],
 ['Wie ändere ich die Sitzungsdauer?','Sitzungsdauer und Sitzungen'],
 ['Wie ändere ich die Kalenderfarben?','Kalenderfarben und Reihenfolge'],
 ['Wie lege ich eigene Rollen mit App-Zugriffen an?','Eigene Rollen und App-Zugriffe'],
];
test('independent operation questions and synonyms retrieve the verified workflow first',()=>{
 for(const [question,title]of cases){const first=searchHelp(question)[0];assert.equal(first?.title,title,question);assert.equal(resolveHelpHash('#'+first.id).sectionId,first.id);}
});

test('unknown functions have no invented context; only explicit follow-ups borrow recent question context',()=>{
 assert.deepEqual(retrieveHelp('Wie aktiviere ich den Quantenbananendrucker?','Wie tausche ich Bereitschaften?'),[]);
 assert.equal(retrieveHelp('Und wie geht das?','Wie tausche ich Bereitschaften?')[0].title,'Tauschwunsch vorschlagen und freigeben');
 assert.equal(retrieveHelp('Wie ändere ich die Sitzungsdauer?','Wie tausche ich Bereitschaften?')[0].title,'Sitzungsdauer und Sitzungen');
 for(const [question] of cases){const matches=retrieveHelp(question);assert.ok(matches.length<=4);assert.ok(matches.reduce((sum,item)=>sum+item.text.length,0)<=7000);}
});

test('grounded answers preserve role boundaries and personal-request exceptions',()=>{
 const question='Wie ändere ich die Sitzungsdauer?';
 assert.match(groundedHelpAnswer(question,retrieveHelp(question),false,false),/Administratorrechte/);
 const own=retrieveHelp('Kann ich als Leser eine Sperrwoche ausschließen?')[0];
 assert.equal(own.permission,'linked');assert.match(own.text,/Mitarbeiterzuordnung|Zuordnung/);
 const holiday=searchHelp('Weihnachten Ostern Pfingsten Neujahr Rückblick')[0];assert.match(holiday.text,/Neujahr/);
});

test('specific app permission questions reach knowledge retrieval instead of generic capability answers',()=>{
 const context=readableFunctionality(permission=>permission==='read');
 assert.ok(retrieveHelp('Welche Funktionen hat der PlanBoard?').every(section=>section.topicId==='ressourcen'));
 for(const question of ['Welche Funktionen hat der PlanBoard?','Welche Berechtigungen brauche ich für Kalenderfarben?'])assert.equal(elliDirectAnswer(question,context),null);
});

test('planning roles are distinct from current data-source limitations',()=>{
 for(const topic of helpTopics)for(const section of topic.sections){
  assert.doesNotMatch(section.text,/freigegeben\w* Simulator|Voraussetzung \/ Grenze:/i);
  if(section.permission==='write')assert.doesNotMatch(section.text,/Berechtigung:[^\n]*Simulator/);
 }
 const planning=searchHelp('Wie kann ich einen bestehenden Auftrag ohne Techniker planen?')[0];
 assert.match(planning.text,/Berechtigung: Schreibrecht in der jeweiligen App oder Administrator\./);
 assert.match(planning.text,/Datenanbindung/);
 assert.match(planning.text,/Änderung unterstützt/);
});

test('all user-facing knowledge excludes environment tiers and preserves actual prerequisites',()=>{
 const content=JSON.stringify(helpTopics.map(topic=>({title:topic.title,sections:topic.sections.map(({title,text,keywords,steps,limitations})=>({title,text,keywords,steps,limitations}))})));
 assert.doesNotMatch(content,/simulat|testbetrieb|testmodus|testebene|beispieldaten|echtbetrieb|produktivbetrieb/iu);
 const feature=title=>featureCatalog.find(item=>item.title===title);
 assert.match(feature('Störung in drei Schritten erfassen').steps.join(' '),/Schritt überspringen.*Projektleiter/s);
 assert.match(feature('Urlaub und Sperrwochen').steps.join(' '),/noch nicht begonnene/);
 assert.match(feature('Tauschwunsch vorschlagen und freigeben').limitations.join(' '),/keine eigene Mitarbeiterzuordnung/);
 assert.match(feature('Microsoft-Anmeldung vorbereiten').limitations.join(' '),/kennt den aktuellen Aktivierungsstatus nicht/);
 assert.match(feature('Sitzungsdauer und Sitzungen').limitations.join(' '),/ab der nächsten Anmeldung/);
 assert.match(feature('Elli, Gespräch und Neuer Chat').steps.join(' '),/Neuer Chat/);
 assert.match(helpTopics.find(topic=>topic.id==='hilfe').text,/bewertete Fragen und Antworten bleiben/);
 const article=helpTopics.find(topic=>topic.id==='ressourcen').sections.find(section=>section.title==='Termine bearbeiten');
 assert.equal(article.permission,'read');assert.match(article.text,/Speichern benötigt Schreibrecht in der jeweiligen App oder Administrator/);
 assert.deepEqual(resolveHelpHash('#mail--graph-testbetrieb-freigabe-und-warteschlange'),{topicId:'mail',sectionId:'mail--graph-versand-freigabe-und-warteschlange'});
});


test('catalog operation classes agree with the application role policy',()=>{
 const administrators=new Set(['SharePoint-Ablagestruktur pflegen','MailDesk-Postfach einrichten','Einstellungsfunktionen suchen','Standardpositionen für Störungsaufträge','SharePoint einrichten und freigeben','Betriebsstatus und Alarme','Browser-Schutz und Verletzungsmeldungen prüfen','Geschützte Zugangsdaten aufräumen','BMACloud einrichten','Eigene Rollen und App-Zugriffe','Copilot einrichten und freigeben','Benutzerrollen und Freischaltung','heyelli-Konto anlegen und PDS-Benutzer zuordnen','Sitzungsdauer und Sitzungen','Kalenderfarben und Reihenfolge','Zentrale Kalender-Anzeigevorgaben','Änderungsprotokoll filtern und exportieren','Outlook öffnen statt Graph versenden','Microsoft Graph einrichten und prüfen','Graph-Versand, Freigabe und Warteschlange','PDS-Anbindung sicher vorbereiten','Microsoft-Anmeldung vorbereiten','Ellis Antworten bewerten']);
 const planning=new Set(['Aufgabe anlegen und bearbeiten','Serviceauftrag aus einer Mail anlegen','Antworten, zuweisen, markieren und archivieren','Auftragsaktionen und Status wechseln','Terminbestätigung an Kunden','Dokument manuell nach SharePoint hochladen','Terminvergabe ohne neuen Auftrag','Störung in drei Schritten erfassen','Termin verschieben und verlängern','Fixierung ändern','Zeit, Dauer und ganztägige Termine','Kategorien, Status und PIM','Einzelnen Serviceauftrag mobil ausgeben','Mehrere Serviceaufträge mobil ausgeben','Serviceauftrag stornieren','Termin umbenennen oder löschen','Speicherung, Verbindungsabbruch und Konflikte','Planungshinweise und Überbuchung','Bereitschaft direkt zuweisen','Bereitschaft aufteilen oder löschen','Automatische Neuverteilung']);
 const personal=new Set(['Urlaub und Sperrwochen','Tauschwunsch vorschlagen und freigeben']);
 for(const item of featureCatalog){
  if(item.title==='Persönliche Notizen in der Menüleiste'){assert.equal(item.permission,'tool');assert.match(item.limitations.join(' '),/Rolle.*Notizen-Werkzeug freigeben/);continue;}
  const expected=administrators.has(item.title)?'admin':planning.has(item.title)?'write':personal.has(item.title)?'linked':'read';
  assert.equal(item.permission,expected,item.title);
  // A linked workflow starts with reading and adds ownership/assignment checks,
  // rather than requiring the global planning role for personal requests.
  const permission=expected==='linked'?'read':expected;
  for(const role of ['reader','dispatcher','admin'])assert.equal(permitted({role},permission),permission==='read'||role==='admin'||permission==='write'&&role==='dispatcher',item.title+' / '+role);
 }
});

test('compound swap-permission questions use the specific workflow without contradictory model paraphrasing',()=>{
 const question='Braucht die Person, die einen Bereitschaftstausch freigibt, selbst eine Mitarbeiterzuordnung? Erkläre die Berechtigungen.';
 const sections=retrieveHelp(question);assert.equal(sections[0].title,'Tauschwunsch vorschlagen und freigeben');
 const answer=groundedHelpAnswer(question,sections,true,true);
 assert.match(answer,/eigene Mitarbeiterzuordnung ist dafür nicht nötig/);
 assert.match(answer,/Tauschfreigabe brauchst du Schreibrecht in der jeweiligen App oder Administrator/);
});

test('mixed read/write and personal-rights questions use verified role facts',()=>{
 for(const [question,expected] of [
  ['Kann ich als Leser einen Termin öffnen und verschieben? Welche Rechte brauche ich jeweils?',/Verschieben oder Verlängern brauchst du Schreibrecht in der jeweiligen App oder Administrator/],
  ['Welche Berechtigungen brauche ich für Kalenderfarben? Darf ich sie mit meiner Rolle ändern?',/Administratorrechte/],
  ['Kann ich als Leser eine eigene Sperrwoche ausschließen? Welche Voraussetzungen muss ich erfüllen?',/Dafür brauchst du eine Mitarbeiterzuordnung/],
  ['Darf ich als Leser die persönliche Anzeige auf Hell stellen und wo?',/mit Leserecht/],
 ]){
  const answer=groundedHelpAnswer(question,retrieveHelp(question),false,false);
  assert.ok(answer,question);assert.match(answer,expected,question);
  assert.doesNotMatch(answer,/simulat|testbetrieb|testmodus/i);
 }
});

test('weak generic matches cannot invent an unsupported export workflow',()=>{
 for(const question of ['Wie richte ich in HeyElli einen automatischen DATEV-Rechnungsexport ein?','Wie aktiviere ich den Quantenbananendrucker in HeyElli?'])assert.deepEqual(retrieveHelp(question),[],question);
 const question='Warum darf ich die persönlichen Anzeigeeinstellungen ändern, aber keine Termine verschieben?';
 assert.match(groundedHelpAnswer(question,retrieveHelp(question),false,false),/Verschieben von Terminen brauchst du Schreibrecht in der jeweiligen App oder Administrator/);
});

test('concise answers omit unrelated roles and prerequisites without relaxing access rules',()=>{
 const colors='Wie ändere ich die Kalenderfarben?';
 const allowed=groundedHelpAnswer(colors,retrieveHelp(colors),true,true);
 assert.match(allowed,/Kalenderfarben öffnen/);assert.ok(allowed.length<400);
 assert.doesNotMatch(allowed,/Berechtigung:|Hinweis:|Sperrwochen|Mitarbeiterzuordnung|Administratorrechte/);
 const blocked=groundedHelpAnswer(colors,retrieveHelp(colors),false,false);
 assert.match(blocked,/Administratorrechte/);assert.doesNotMatch(blocked,/Sperrwochen|Mitarbeiterzuordnung|Disposition/);
 const own='Darf ich als Leser die persönliche Anzeige auf Hell stellen und wo?';
 const display=groundedHelpAnswer(own,retrieveHelp(own),false,false);
 assert.match(display,/Leserecht.*Benutzerkonto → Anzeige.*Hell/s);
 assert.doesNotMatch(display,/Termine|Sperrwochen|Mitarbeiterzuordnung|Administrator/);
 const approval='Braucht die Person, die einen Bereitschaftstausch freigibt, selbst eine Mitarbeiterzuordnung? Erkläre die Berechtigungen.';
 const answer=groundedHelpAnswer(approval,retrieveHelp(approval),true,true);
 assert.ok(answer.length<200);assert.doesNotMatch(answer,/Anzeige|Sperrwoche|Kalenderfarben|Tauschvorschlag/);
});

test('short follow-ups keep the verified existing-order route',()=>{
 const question='Und kann ich den Termin später vergeben?';
 const sections=retrieveHelp(question,'Warum kann ich beim Erfassen einer Störung die Terminplanung überspringen und was muss ich vor dem Speichern noch zuweisen?');
 const answer=groundedHelpAnswer(question,sections,true,true);
 assert.match(answer,/Service → Aufträge/);assert.match(answer,/Termin vergeben/);
 assert.doesNotMatch(answer,/Mitarbeiterzuordnung|Administratorrechte|Berechtigung:/);
});
