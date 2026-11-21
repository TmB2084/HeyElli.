# Verbindliche Projektregeln

Diese Regeln gelten für die gesamte Anwendung und alle Änderungen durch Menschen und Codex.

## Repository und reproduzierbare Umgebung

- Pro Anwendung genau ein Git-Repository verwenden. Dieses Repository umfasst Oberfläche, Fachmodule, Datenbankmigrationen und lokale Infrastruktur. Keine verschachtelten Repositories für einzelne Module anlegen.
- Das zentrale Repository ist `https://gitlab.elomech-gruppe.de/webapps/heyelli.git`. Git-Remote und Clone-Anleitungen auf diese Adresse ausrichten; für das Verzeichnis `HeyElli` beim Klonen den Zielnamen ausdrücklich angeben.
- Änderungen mit Git nachvollziehbar halten. Bestehende, nicht eingecheckte Änderungen anderer nicht überschreiben.
- Die konkrete Node-Version in `.node-version` und die npm-Abhängigkeiten in `package-lock.json` versionieren. Abhängigkeiten mit `npm ci` installieren; bei bewussten Abhängigkeitsänderungen `package.json` und Lockdatei gemeinsam aktualisieren.

## Zugangsdaten und Konfiguration

- Zugangsdaten ausschließlich aus lokalen, von Git ausgeschlossenen Umgebungsdateien laden. Keine Schlüssel oder Passwörter in Quellcode, Migrationen, Dokumentation, Testdaten oder Protokollen speichern.
- `.env.example` versionieren und mit den benötigten Variablennamen aktuell halten. Nur eindeutig fiktive Beispielwerte oder Platzhalter verwenden, niemals echte Zugangsdaten.
- Bestehende lokale Umgebungsdateien nicht überschreiben. Geheimnisse nicht ausgeben und nicht über `NEXT_PUBLIC_` oder Client-Komponenten veröffentlichen.

## Datenbank und getrennte Umgebungen

- Jede Änderung an der Datenbankstruktur über eine neue, fortlaufend nummerierte SQL-Datei in `database/migrations/` vornehmen. Bereits angewendete Migrationen nicht verändern; Korrekturen durch weitere Migrationen vornehmen.
- Beispieldaten separat in `database/seeds/` pflegen. Seeds müssen wiederholbar sein und dürfen bestehende Daten nicht unbeabsichtigt überschreiben.
- Entwicklung, Tests und Produktion strikt trennen: eigene Datenbanken, Zugangsdaten und persistente Volumes je Umgebung. Testläufe dürfen weder die Entwicklungsdatenbank noch eine Produktivdatenbank verändern.
- Die vorhandene Compose-Konfiguration und die `db:*`-Skripte sind ausschließlich für lokale Entwicklung mit Beispieldaten vorgesehen. Sie nicht gegen Test- oder Produktivsysteme verwenden. Vor dem Einrichten weiterer Umgebungen deren getrennte Konfiguration ausdrücklich ergänzen.
- Eine Erststartprüfung neben einer bestehenden Umgebung ausschließlich in einem separaten Checkout mit `compose.checkout.yaml`, eindeutigem Compose-Projektnamen, eigenem Volume, eigenen Ports und neu erzeugten lokalen Zugangsdaten durchführen. Keine bestehenden Umgebungsdateien oder `.local/`-Bestände übernehmen. Beim Aufräumen ausschließlich die eindeutig zugeordneten Prüfressourcen entfernen.
- Bis zu einer ausdrücklichen Änderung des Projektumfangs ausschließlich erfundene Beispieldaten verwenden. Keine Produktivdaten oder Kopien echter personenbezogener Daten importieren.
- Änderung des Projektumfangs (17.11.2026, Containerbetrieb seit 18.11.2026): HeyElli läuft auf dem Server in zwei getrennten Instanzen. **Testinstanz** `https://heyelli-test.elomech.de`: automatisch nach jedem Merge in `main`, mit Testschutz (Hinweisbalken, kein Mailversand, keine Schreibzugriffe auf Microsoft 365); nicht als Ablage für echte Produktivdaten verwenden. **Produktion** `https://heyelli.elomech.de`: Produktions-Build (`next start`), nur über ein Release (Tag `vX.Y.Z`); Anmeldung übergangsweise mit Demo-Benutzern bis Entra ID. Echte Datensätze ausschließlich auf den Serverinstanzen; lokale Entwicklung, Seeds und automatisierte Tests bleiben bei erfundenen Beispieldaten. Ablauf: `docs/ablauf.md`, Technik: `docs/ci-deploy.md`.

## Serverseitiger Zugriffsschutz

- Berechtigungen auf dem Server für jeden geschützten Lese- und Schreibzugriff prüfen, einschließlich Route Handlers und Server Actions. Eine ausgeblendete Schaltfläche oder eine Prüfung im Browser ist kein Zugriffsschutz.
- Identität aus der serverseitig geprüften Sitzung ableiten. Rollen, Benutzer- oder Mandantenzugehörigkeit nicht ungeprüft aus Client-Eingaben übernehmen. Ohne passende Berechtigung Zugriff verweigern.
- Eingaben serverseitig validieren, Datenbankabfragen parametrisieren und nur die für den jeweiligen Zugriff erforderlichen Daten zurückgeben. Datenbankzugriff und Geheimnisse auf den Server beschränken.
- Die gesamte Anwendung einschließlich des fiktiven Beispielkatalogs erfordert eine gültige, serverseitig geprüfte Sitzung, auch bei direkten Links und Datenabrufen. Der Beispielkatalog ist nicht öffentlich zugänglich. Öffentlich bleiben ausschließlich der Anmeldebildschirm, die notwendigen Anmelde-Endpunkte und statische Darstellungsdateien. Fachschreibzugriffe erfordern Schreibrecht in der jeweiligen App oder Administrator; geschützte Lesezugriffe mindestens Lesezugriff. Benutzerverwaltung, Rollenänderungen, Sitzungswiderruf, globale Kalenderfarben und zentrale Systemvorgaben erfordern Administratorrechte. Prüfungen immer serverseitig durchführen.
- PostgreSQL verwaltet Plattformbenutzer, Sitzungen, Kalenderfarben und benutzerbezogene Anzeigeeinstellungen zentral. Bestehende Einstellungsdateien nur lesend übernehmen; bereits gespeicherte PostgreSQL-Werte niemals durch einen wiederholten Import überschreiben. Originaldateien erhalten. Keine automatische Administratorvergabe beim ersten Login. Der letzte aktive Administrator muss erhalten bleiben; Rollenänderungen/Sperrungen widerrufen bestehende Sitzungen. Der aktuelle Datenbankbetrieb bleibt auf lokale Entwicklungs- und ausdrücklich isolierte Testumgebungen beschränkt.

- Einzige Identität ist das heyelli-Konto (`platform.users`). Anmeldung mit Benutzername und Passwort (scrypt-Hash, Startpasswort nur einmal angezeigt und bei der ersten Anmeldung zu ändern), bis die Microsoft-Anmeldung aktiviert ist; danach ausschließlich über das verknüpfte Microsoft-Konto. Keine Demo-, Simulator- oder Verzeichnisanmeldung und kein automatisches Anlegen von Konten aus Microsoft. Jedes Konto braucht zum Anmelden einen PDS-Benutzer der aktiven Quelle (`platform.pds_user_mappings`, Administratoren ausgenommen); der PDS-Bearbeiter wird ausschließlich aus dieser Zuordnung abgeleitet. Details: `docs/auth/accounts.md`.

- Geschützte API-Exporte mit `withRouteAccess` unabhängig vom Proxy absichern. Neue Endpunkte im expliziten Inventar `src/platform/app-access/access-policy.ts` klassifizieren und den Inventartest ausführen. Persönliche gemeinsame Plattformwege ausdrücklich benennen; sie erlauben ausschließlich eigene Daten. Externe Antworten und Uploads während des Lesens begrenzen; vollständige Protokollexporte seitenweise streamen.
- App-Lese- und Schreibrechte serverseitig getrennt durchsetzen. Die internen Rollenkennungen bleiben nur für Kompatibilität/Administration erhalten und ersetzen keine App-Schreibprüfung. Neue Apps und API-Wege in `src/platform/app-access/model.ts` zuordnen. Gemeinsam genutzte Quellen explizit dokumentieren; App-Freigaben sind keine Datensatztrennung. Administrativer Vollzugriff bleibt geschützt. Rollenänderungen versionieren, protokollieren und betroffene Sitzungen widerrufen.

- Browser-Schutzrichtlinien mit anfragegebundenen Nonces und dynamischem HTML durchsetzen; keine Wiederverwendung einer vorgerenderten Nonce-Schale. Fremde Nonce-/CSP-Header ersetzen. Keine pauschale Inline-Skriptfreigabe, Eval ausschließlich in Entwicklung. Sicherheitsmeldungen nur sitzungsgebunden, größen-/ratenbegrenzt und auf feste Diagnoseklassen reduziert speichern; keine Roh-URLs, Samples, Richtlinien/Nonces oder Geheimnisse protokollieren. Native und Ereigniszustellung einschließlich ihrer Grenzen unter `docs/operations/browser-protection.md` dokumentieren.

- Ressourcenbudgets serverseitig vor Facharbeit prüfen: gemeinsame/kontobezogene Aufnahme und Parallelität, begrenzte SQL-/Sperr-/Übertragungszeiten, eigene Datei-/Exportkontingente. Bestehende Daten, offene Entwürfe und bestätigte Dateien bei Quote niemals löschen. Uploads stückweise und kontogebunden speichern; Wiederholung mit unveränderter Kennung bestätigen, nur eigene fehlgeschlagene Zwischenstände bereinigen. Überlast von ungültiger Sitzung unterscheiden. Isoliertes Lastprofil und tatsächliche Messwerte unter `docs/operations/resource-budgets.md` und im aktuellen Auditbericht nachführen.

- Betriebsdiagnosen ausschließlich mit festen Klassen und serverseitig erzeugten Kennungen ausgeben; keine Rohfehler, URLs, Cookies, Geheimnisse oder Fachtexte protokollieren. Monitoring darf keine unklaren Fachaktionen oder Sendungen wiederholen. Status und Alarmbestätigung bleiben administrativ geschützt. Nur neue Betriebsaggregate rollierend begrenzen; Fachhistorien, offene Entwürfe und Sicherungen erhalten. Lokale Alarmierung und spätere externe Betriebsüberwachung unter `docs/operations/monitoring.md` getrennt dokumentieren.

## Geheimnis- und Entwurfslebenszyklus

- SharePoint-/BMACloud-/Copilot-/PDS-/Graph-Konfigurationen ausschließlich referenzgestützt über den gemeinsamen Geheimnislebenszyklus verwalten. Aktive Referenzen, geschützte Archive und Master-Schlüssel niemals durch Dateialter oder pauschale Dateimuster bereinigen. Veröffentlichung und Bereinigung verwenden dieselbe Datenbanksperre; Wiederherstellung deaktiviert die Integration und entwertet die Prüfung. Fehlende Master-Schlüssel bei vorhandenem Bestand nicht still neu erzeugen.
- Kalenderentwürfe ausschließlich über die geschützte, benutzergebundene Browserablage lesen/schreiben. Bestehende Klartextbestände erst nach erfolgreicher verschlüsselter Übernahme ersetzen; getrennte Tabzweige, Vorgangskennungen und Abschlussmarkierungen erhalten. Keine Alterslöschung offener Entwürfe. Lokale Kopien nur nach bestätigter Sicherung und ausdrücklich bestätigter Gerätebereinigung entfernen; zwischenzeitlich veränderte Kopien erhalten. Schlüssel niemals im Browser dauerhaft ablegen oder protokollieren.
- Sichtbare Fachbegriffe, Ellis Funktionskatalog, Hilfe, Suchbegriffe und Integrationsanleitung bei Funktionsänderungen gemeinsam prüfen. Wissensquellen mit tatsächlichen Implementierungsdateien belegen; unbekannte Funktionen oder Freigabezustände nicht erfinden.

- Personenbezogene Aufbewahrung liefert ausschließlich Prüfhinweise, keine automatische Löschung bestehender Daten. Bereinigung erfordert eine serverseitig gebundene Vorschau und ausdrückliche Bestätigung; geänderte Bestände, fremde Konten und aktive Aufbewahrungssperren abweisen. Offene Entwürfe, Wiederholungsschutz, gemeinsame Fachnachweise und Sicherungen schützen. Persönliche Exporte ohne Geheimnisse/Schlüssel ausgeben; Entwurfsinhalte ausschließlich für den geprüften Inhaber entschlüsseln. Umfang und Grenzen unter `docs/operations/data-lifecycle.md` nachführen.

## App-Versionen und Veröffentlichungen

- Öffentliche Versionsangaben pro App zentral in `src/platform/shell/app-releases.ts` pflegen. Schema JJ.V: JJ ist das zweistellige Kalenderjahr, V die Veröffentlichungsnummer innerhalb dieses Jahres. Ausgangspunkt ist 26.1 für alle Apps. Beim Jahreswechsel beginnt das neue Versionsjahr mit Veröffentlichung 1. Das Veröffentlichungsdatum ist das tatsächliche Datum.
- Bei jeder abgeschlossenen Änderung die Veröffentlichungsnummer der betroffenen Apps um eins erhöhen und deren Veröffentlichungsdatum aktualisieren. Versionen und Veröffentlichungsdaten strikt pro App führen: ausschließlich den eigenen Eintrag der fachlich geänderten App aktualisieren. Änderungen an App-Auswahl, Symbolzuordnung oder gemeinsamen Darstellungsbausteinen lösen keine pauschale Erhöhung anderer Apps aus. Kein gemeinsamer veränderlicher Versions-Ausgangswert und kein Massen-Bump. Die korrigierte erstmalige Einführung startet mit 26.1 und erhöht noch nicht auf 26.2. Keine automatische Erhöhung bei Rendern, Neuladen oder einzelnen Speichervorgängen.
- Über-Dialoge zeigen App-Symbol (soweit vorhanden), App-Name, Beschreibung, Version, Veröffentlichungsdatum ohne erneute Veröffentlichungsnummer und Tim Braun als Ersteller. Version, Veröffentlichungsdatum und Ersteller in normaler Schrift darstellen. Ein beschriftetes X oben rechts schließt den Dialog; die kleine HeyElli-Wortmarke steht ganz unten.

- HeyElli selbst besitzt den separaten `platformRelease` in `app-releases.ts`, beginnend mit 26.1. Er bewertet Techstack, gemeinsame Plattforminfrastruktur und Menüleiste. Nur solche abgeschlossenen Änderungen erhöhen diese Veröffentlichung; reine Fach-App-Änderungen erhöhen ausschließlich die jeweilige App-Version. Unter Einstellungen → Allgemein → Info anzeigen.

## Arbeitsweise und Prüfung

- Vollsicherungen nur lesend aus der Quelle erstellen: PostgreSQL-Snapshot, SQLite-Online-Backup und geprüfter gemeinsamer Dateistand. Archive authentifiziert verschlüsseln, Entsperrschlüssel separat geschützt und außerhalb von Git halten; bestehende Archive/Schlüssel nie ersetzen. Wiederherstellungen ausschließlich auf ausdrücklich getrennten Zielbeständen prüfen; vor Start der Kopie Sitzungen widerrufen, externe Integrationen und Versand deaktivieren. Niemals die Entwicklungsdatenbank als automatisches Wiederherstellungsziel verwenden. Browser-Eingaben ohne bestätigte Serversicherung ausdrücklich als Grenze benennen.

- Bei allen Oberflächenänderungen den verbindlichen [CI-/UI-Leitfaden](docs/design/ci-ui.md) beachten. Service (Variante V1), PlanBoard (Variante R1) und Menüleiste sind die aktuellen Gestaltungsreferenzen; die „Formensprache macOS 26“ im Leitfaden ist verbindlich. Neue Module und überarbeitete Ansichten daran ausrichten; gemeinsame Bausteine und Theme-Variablen verwenden, Modulnamen konsistent halten und Desktop, schmale Ansicht sowie Tastaturbedienung prüfen. Neue gemeinsame Gestaltungsmuster im Leitfaden nachführen; bestehende Abweichungen nicht ungeprüft als Vorlage übernehmen.

- Projektstruktur (21.11.2026): Jede App hat einen eigenen Ordner unter `src/apps/<app>/` (askelli, servicehub, casedesk, planboard, dutyboard, maildesk, taskhub, missioncontrol; eigenständige Werkzeuge wie `notizen` ebenso), Systemapps unter `src/system/<app>/` (einstellungen, benutzerkonto, hilfe, anmeldung, start), gemeinsame Infrastruktur unter `src/platform/` (Shell, Datenhaltung, Rechte, Sitzung, Sicherheit, PDS, Mail, SharePoint, BMACloud …). Werkzeuge gehören zu ihrer App. `src/app/` enthält nur die von Next.js verlangten Einstiege (Seiten, API-Wege) und importiert aus diesen Ordnern. Modultests liegen im Ordner `tests/` neben dem getesteten Code; das oberste `tests/` enthält nur app-übergreifende Datenbank-, Browser- und Prüfabläufe.
- Kein Ordner enthält direkt mehr als 99 Dateien; größere Bestände in sinnvolle Unterordner teilen.
- Fachbereiche kapseln und über ihren öffentlichen Einstiegspunkt (`index.ts`) verwenden. Fachmodell, Datenzugriff und Oberfläche trennen.
- Projektregeln in dieser `AGENTS.md` pflegen; Einrichtungs- und Betriebsanleitung in `README.md` aktuell halten. Den folgenden von Next.js verwalteten Block erhalten.
- Den vollständigen lokalen Erststart einschließlich `npm ci`, lokaler Konfiguration, Datenbankstart, Migrationen, Seed und `npm run auth:admin` dokumentieren. PostgreSQL ist zur Laufzeit erforderlich. `npm run dev` ist der freigegebene lokale Startweg; ein erfolgreicher Build gibt weder `npm start` für die Demo noch den Produktionsbetrieb frei. PDS-Simulator, deaktivierte Microsoft-Anmeldung und Graph-Testbetrieb bis zur ausdrücklichen Freigabe beibehalten.
- Bei einem frischen Checkout den ersten Build vor dem separaten Typecheck ausführen, damit die Next.js-Routentypen vorliegen. Erststartprüfungen und deren Grenzen im Merge Request nachvollziehbar dokumentieren (frühere Prüfberichte unter `docs/testing/` wurden am 21.11.2026 entfernt und liegen in der Git-Historie).
- Nach Codeänderungen die passenden Prüfungen ausführen: `npm run lint`, `npm run typecheck` und `npm run build`. Bei Datenbankänderungen zusätzlich Migrationen, wiederholbaren Seed und Datenpersistenz in einer geeigneten lokalen Umgebung prüfen.
- Entwicklungs-Startsperren ausschließlich mit der nativen Betriebssystemsperre der festgelegten Next-Version prüfen. Keine Löschfreigabe allein aus Dateialter, PID oder Portstatus ableiten; aktive Sperrdateien niemals vorzeitig entfernen. Gleichzeitige Starter über eine außerhalb des bereinigten Entwicklungs-Caches gehaltene Sperre koordinieren. Nur erzeugten Entwicklungs-Cache bereinigen, persistente Daten und Konfiguration erhalten. Bei fehlender nativer Sperrunterstützung oder unklaren Dateitypen Start verweigern; bei Next-Updates die nativen Sperrtests erneut ausführen.
- `npm run dev` startet den lokalen Überwachungsdienst automatisch mit dem expliziten Web-Port und hält die Startsperre bis zum Ende aller eigenen Kindprozesse. Monitor-Doppelstarts mit nativer Betriebssystemsperre außerhalb des Entwicklungs-Caches verhindern; keine Freigabe aufgrund von Alter, PID oder Port. Bereits separat gestartete Dienste nicht übernehmen oder beenden. Beim Stoppen laufende Prüfungen und Datenbankpool sauber beenden sowie geplante Neustarts verwerfen.
- Vor einer Veröffentlichung `npm run verify` verwenden: frische isolierte Quellkopie/Lockinstallation, vollständige Modultests, getrennte Plattform-/Chat-Datenbanktests, Lint, Build, Typecheck, isolierte Chromium-/WebKit-Browserregression mit gezielten Navigations-/Rechtefehlern und npm-Audit. Browsernachweise ausschließlich bereinigt aufbewahren; Rohtraces, Cookies und Zugangsdaten dürfen nicht in Artefakte gelangen. Für einen freigegebenen Git-Stand anschließend `npm run verify -- --commit <SHA>` ausführen und die tatsächlich geprüfte Kennung dokumentieren. Neue Datenbanktests im isolierten Prüfverfahren registrieren. Arbeitsbaumtest, Commitnachweis, Push und tatsächlich ausgeführten GitLab-Lauf ausdrücklich unterscheiden; keine grüne Pipeline behaupten, wenn nur die Workflowdatei vorliegt.
- Nur tatsächlich ausgeführte Prüfungen als erfolgreich melden. Einschränkungen und noch nicht implementierte Funktionen ausdrücklich benennen.

## PDS-Anbindung: API hat Vorrang

- Die bereitgestellte OpenAPI-Spezifikation ist der maßgebliche Vertrag. Daten und Schreibfunktionen vorrangig über dokumentierte API-Endpunkte anbinden. Keine realen API-Adressen oder Tokens aus Beispielen übernehmen.
- Datenansichten nur für nachgewiesene Feldlücken einsetzen, vorzugsweise über `/datenansichten/list` und `/datenansichten/listdaten`. Kein direkter Datenbankzugriff der Serviceplattform. API-Fehler oder fehlende Berechtigungen dürfen keinen stillen View-Fallback auslösen.
- Views ausschließlich lesend verwenden. Fehlende API-Schreibfelder, unklare Pflichtfelder und Spezifikationswidersprüche ausdrücklich als offen dokumentieren, nicht durch erfundene Endpunkte oder Datenbankschreibzugriffe ersetzen.
- Bei jeder PDS-bezogenen Änderung `docs/pds/integration-matrix.md` aktualisieren: Feld/Funktion, konkreter API-Pfad und Schema, gegebenenfalls benötigter View, Vorrangregel, Implementierungsstand und offene Fragen. Dokumentierte API, implementierter Simulator und tatsächlich angeschlossenes PDS klar unterscheiden.

## Ablauf, Releases und KI-Agenten

- Änderungen kommen nur über Branch und Merge Request nach `main`; niemals direkt nach `main` pushen. Den Weg bis zum Release beschreibt `docs/ablauf.md`.
- KI-Agenten (Claude Code, Codex) dürfen Branches pushen und Merge Requests öffnen, aber **nicht mergen** und **keine Tags oder Releases anlegen**; das macht immer ein Mensch. Ihre Branches heißen `claude/…` bzw. `codex/…`.
- KI-Agenten ändern keine CI-Variablen, Server oder Runner, melden keine eigenen Runner an und halten die Pipeline ihres Branches grün.
- Die Pipeline läuft ausschließlich auf dem zentralen Runner (Tag `docker`). `npm run verify` (Datenbank- und Browsertests) läuft lokal beim Entwickler.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
