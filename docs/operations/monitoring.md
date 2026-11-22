# Lokale Überwachung und Alarmierung

## Start und Zuständigkeit

Nur lokale Entwicklung bzw. ausdrücklich getrennte Prüfumgebungen. `npm run dev` bleibt der freigegebene App-Start. Nach Migration 037 startet `npm run dev` den lokalen Überwachungsprozess automatisch und startet ihn bei unerwartetem Prozessende nach drei Sekunden erneut. Die Überwachung selbst prüft alle 30 Sekunden; sie führt keine Fachaktionen oder Sendungen aus. Der Entwicklungsstarter übergibt seinen tatsächlichen Web-Port aus `--port`/`-p`, sonst `PORT`, sonst 3000. Er macht auch den Standardport explizit, damit Next nicht unbemerkt auf einen anderen Port ausweicht. Ein veralteter `HEYELLI_MONITOR_PORT` wird beim verwalteten Start dadurch übersteuert. Beim ersten verwalteten Start wartet die Überwachung höchstens 15 Sekunden auf den lokalen Listener, bevor sie Prüfungen/Alarme veröffentlicht. Für einen bewusst separaten Start bleibt `npm run monitor` verfügbar; dort bestimmt `HEYELLI_MONITOR_PORT` den lokalen Web-Port (Standard 3000; Prüfadresse über `HEYELLI_MONITOR_HOST`, standardmäßig `localhost`). Vorhandene Umgebungsdateien nicht ersetzen. Der Dienst verwendet dieselbe lokale Konfiguration wie die Anwendung, öffnet aber einen eigenen kleinen Datenbankpool mit kurzen Zeitgrenzen. Doppelstarts werden durch dieselbe native Betriebssystemsperre wie beim Entwicklungsstart verhindert; die Sperre liegt außerhalb des bereinigbaren Next-Caches unter `.local/operations-runtime/monitor.lock`. Aktive Sperren werden niemals aufgrund von Alter, PID oder Port gelöscht. Nach einem erzwungenen Prozessende kann die vom Betriebssystem freigegebene Sperre erneut erworben werden. Unsichere Dateitypen werden abgewiesen. Ein separater Doppelstart beendet sich mit Kennung 75, ohne eine Prüfung oder Änderung auszuführen. Der Entwicklungsstarter erzeugt daraus keine Neustartschleife. Eine vorher separat gestartete Überwachung bleibt im Besitz ihres Starters und wird nicht durch HeyElli beendet oder übernommen; nach deren Ende ist ein neuer separater Start oder ein Entwicklungsneustart erforderlich.

Administratoren sehen **Einstellungen → Sicherheit → Betriebsstatus**. Automatische Aktualisierung alle 15 Sekunden. Keine öffentliche Status- oder Metrikadresse: GET/POST `/api/verwaltung/betriebsstatus` benötigen serverseitig Administratorrechte; Änderungen zusätzlich denselben Ursprung. Bestätigen protokolliert die Kenntnisnahme mit Benutzer und Zeitpunkt und schließt keinen weiterhin aktiven Alarm.

`npm run monitor:check` liefert Exitcode 0 nur bei einem höchstens 90 Sekunden alten Monitor-Lebenszeichen ohne aktive Alarme, sonst 1. Dies ist eine lokale Kontrollschnittstelle für eine später separat freizugebende externe Überwachung. Auch bestätigte aktive Alarme bleiben dabei fehlerhaft. Der Abfrageweg selbst schreibt keine Daten.

## Signale und feste Schwellen

| Signal | Alarm |
| --- | --- |
| Datenbankabfrage | nicht möglich; lokaler Alarm funktioniert auch ohne Datenbank |
| Web-Lebensprüfung | TCP-Port auf Loopback nicht erreichbar, Verbindungszeit maximal 1,5 Sekunden |
| E-Mail-Dienst | fehlendes/über 120 Sekunden altes Lebenszeichen oder letzter Durchlauf fehlerhaft |
| Warteschlange | älteste wartende, erneut geplante oder laufende Mail älter als 15 Minuten |
| Fachlich unklar | mindestens eine Mail `unknown` oder eine Elli-Aktion `uncertain` |
| Versandfehler | mindestens eine Mail `failed` |
| API-Fehler | mindestens 20 Anfragen im aktuellen und den vier vorherigen Minuten, mindestens 10 % HTTP 5xx |
| API-Zeit | bei mindestens 20 Anfragen mindestens 20 % mit Antwortkopfzeit ab 3 Sekunden |
| Lokaler Datenträger | unter 100 MiB oder unter 5 % verfügbar am Konfigurations-/Anwendungsstandort |
| Geheimnisablage | gespeicherte PDS-/Graph-/BMACloud-/Copilot-Referenz nicht sicher lesbar/entschlüsselbar |

Der TCP-Check verwendet ausschließlich die literalen Loopback-Adressen `127.0.0.1` und `::1`, ohne konfigurierbare DNS-Auflösung. `localhost` prüft beide Familien parallel innerhalb von höchstens 1,5 Sekunden. Beim verwalteten Start wird die gewählte lokale Bind-Adresse aus sämtlichen unterstützten `--hostname`-/`-H`-Schreibweisen übergeben; ein veralteter `HEYELLI_MONITOR_HOST` wird übersteuert. Eine explizite IPv6-Prüfung wird nicht durch einen anderen IPv4-Listener erfolgreich. Die Wildcard-Bindungen `0.0.0.0` und `::` verwenden ihre entsprechende Loopback-Familie. Individuelle LAN-Interface-Bindungen liegen weiterhin außerhalb der reinen Loopback-Prüfung.

Der TCP-Check beweist einen offenen Listener, keine funktionierende Fachantwort. Bereitschaft bewertet zusätzlich Datenbank, Dienst, Fehler, Warteschlange und Ablage. Kein öffentlicher HTTP-Readiness-Endpunkt und kein automatischer externer Anbieter-Ping. Hängende Anbieter werden über vorhandene Aufrufbudgets, API-Fehler/-Zeiten, Dienstalter und unklare Ergebnisse sichtbar; bei wenig Verkehr greift bewusst keine statistische Fehlerrate. Die geschützte Oberfläche und der Exitcode zeigen einen ausgefallenen Monitor über sein überaltertes Lebenszeichen an. Ein komplett ausgeschalteter Rechner kann sich nicht selbst alarmieren.

## Datenschutz, Begrenzung und Korrelation

API-Antworten erhalten eine frisch serverseitig erzeugte `X-HeyElli-Request-ID`; gleichnamige Clientwerte werden nicht übernommen. Bei HTTP 5xx entstehen strukturierte Diagnosen mit Kennung, festem Bereich, Methode, Status und begrenzter Dauer. Keine Rohfehler, URLs/Parameter, Benutzerkennungen, Tokens, Cookies, Header oder Fachtexte. Gemessen wird die Zeit bis zum Antwortkopf nach Zugriffsschutz/Handler; die anschließende Streamdauer ist nicht enthalten. Loginantworten außerhalb des geschützten Wrappers und Netzwerkfehler vor der Anwendung sind nicht vollständig erfasst.

Zähler werden je Minute und einem von acht festen Bereichen zusammengefasst, maximal 24 Stunden. Nur diese neu eingeführten Betriebsaggregate werden rollierend entfernt; niemals Fachhistorien, Sicherungen, Entwürfe oder Dateien. Die Telemetrie verwendet höchstens eine zusätzliche Datenbankverbindung, maximal 16 vorgemerkte Schreibvorgänge und 500-ms-Verbindungs-/SQL-Grenzen. Bei Ausfall/Überlast kann Telemetrie verloren gehen; Fachantworten werden dadurch nicht abgelehnt oder verändert. Datenbankausfälle werden unabhängig über den Monitor gemeldet.

Alarme besitzen feste Diagnoseklassen und Vorgangskennungen. Pro Klasse bleibt nur der letzte Vorfall mit erstem/letztem Auftreten, Zähler, Bestätigung und Entwarnungszeit erhalten (maximal elf gespeicherte Klassen). Wiederholte Prüfungen senden keine neuen Konsoleneinträge; echte Erholung und erneuter Ausfall erzeugen neue Zustandsmeldungen. Ausgabe ausschließlich lokal als bereinigte JSON-Zeile (`raised`/`recovered`). Bei Datenbankausfall zunächst im Prozesszustand und Standardfehlerausgang; nach Rückkehr werden Vorfall und Erholung mit derselben Kennung nachgetragen. Ein Neustart während des Ausfalls kann diesen noch nicht gesicherten Zustand verlieren. Kein externer Versand und keine zusätzliche Kopie fachlicher Inhalte. Konsolenausgaben archiviert/rotiert der Betreiber außerhalb der Anwendung.

Beim Beenden des Entwicklungsstarters per Strg+C/SIGINT, SIGTERM oder durch das Ende des Webdiensts erhalten ausschließlich seine eigenen Kindprozesse SIGTERM. Die Überwachung beendet ihre laufende Prüfung, schließt den Datenbankpool und gibt dann ihre Sperre frei. Der Starter hält seine Startsperre, bis die eigenen Dienste beendet sind; ausstehende Neustarts werden verworfen. Ausschließlich für einen nicht reagierenden eigenen Überwachungsprozess gibt es nach 30 Sekunden eine erzwungene Beendigung. Web-, E-Mail- und Elli-Dienst erhalten SIGTERM und dürfen ihre laufenden Aufgaben abschließen; für Facharbeit wird keine neue erzwungene Unterbrechung eingeführt. Externe Prozesse und bestehende Daten werden dabei nicht gesucht, beendet oder bereinigt.

## Reaktion und Wiederanlauf

1. Administrator übernimmt die Erstprüfung: Zeitpunkt, Vorgangskennung, betroffener Bereich. Bestätigen dokumentiert nur die Übernahme. Keine Geheimnisse in Supportnachrichten.
2. Datenbank/Datenträger/Dienst prüfen; bei fehlendem Schlüssel geschützte Sicherung und Referenz prüfen. Keine Neuanlage von Schlüsseln oder pauschale Datei-/Entwurfsbereinigung auslösen.
3. Bei `unknown` zuerst im zentralen Absenderpostfach bzw. in Exchange anhand von Empfänger, Betreff und Zeitpunkt prüfen. HeyElli kann eine tatsächlich erfolgte Zustellung ohne Anbieterabgleich nicht verbindlich feststellen. Bei unklarem Ergebnis keinen neuen Versand anlegen; Microsoft-Administration einbeziehen. Nur eindeutig fehlgeschlagene Nachrichten können über den vorhandenen fachlichen Ablauf erneut eingereiht werden.
4. Bei `uncertain` Termin/Auftrag und Historie im PlanBoard bzw. Zielsystem abgleichen; PDS-/Microsoft-Administration hinzunehmen. Erst nach Klärung eine fachlich notwendige neue Aktion ausdrücklich bestätigen. Keine automatische Wiederholung, kein direkter Statuswechsel in der Datenbank über das Monitoring.
Ein extern bestätigtes Ergebnis ändert den gespeicherten Status `unknown`/`uncertain` derzeit nicht automatisch. Das Monitoring bietet dafür keine fachliche Abschlussfunktion. Solche Alarme bleiben sichtbar; Kenntnisnahme ist keine technische Auflösung. Ein verbindlicher Anbieterabgleich und gegebenenfalls die gesonderte Fachfunktion zum Abschluss müssen vor echtem Betrieb abgestimmt werden; nicht per direktem SQL zurücksetzen.

5. Nach Wiederherstellung prüfen, dass das nächste Monitor-Lebenszeichen aktuell ist, der Alarm tatsächlich aufgelöst wird und kein doppelter Versand/Termin entstanden ist. Bestehende Integrationsfreigaben und Graph-Testbetrieb unverändert lassen.

## Prüfungen und Grenzen

Der isolierte A07-Lauf enthält zusätzlich `checkDevelopmentMonitor`: echter Entwicklungsstarter und echter Überwachungsprozess mit eigener Datenbank, kontrollierten Web-/Mail-/Elli-Prüfprozessen und eigenen Dateibeständen. Geprüft werden automatischer Start mit eigenem Port und reinem IPv6-Listener, korrekte Bind-Adresse einschließlich veraltetem Override, localhost-Fallback und explizit falscher Adressfamilie, wiederholtes Lebenszeichen, separater und paralleler Doppelstart, Wiederanlauf nach SIGKILL, SIGTERM/SIGINT, Erhalt eines vorher separat gestarteten Beobachters und unveränderte persistente Prüfdateien. Modultests ergänzen native Sperren, unsichere Pfade, Portargumente, Neustartabbruch und begrenztes Beenden. Diese Prozessprüfung startet keinen weiteren echten Next-/Ollama-/Versandbetrieb.

`node scripts/test-platform.mjs --operations` erzeugt eigene Datenbank/Volume/Zugangsdaten, prüft echte Datenbankpause und Erholung, geschlossenen Webdienst, veralteten Maildienst, hängenden lokalen Anbieter ohne echte Zustellung, unklare Ergebnisse, Wiederholungsschutz, Schlüsselverlust, Schwellen, Zugriffsschutz und Bestätigung. Der Fall ist außerdem im regulären Plattformtest registriert. Browserfall E10 prüft die geschützte Anzeige bei Desktop-/Handybreite und ungültige Zugriffe. Modulprüfungen kontrollieren feste Diagnoseklassen und Schwellen.

Keine Produktionsfreigabe: externes unabhängiges Monitoring mit eigenem Dienstkonto, Alarmempfänger/Rufbereitschaft, Zustellkanal, Vertretung, Eskalationsfristen, Host-/Containerüberwachung, TLS und Prozesssupervisor müssen vor einem echten Betriebswechsel gesondert eingerichtet und mit den Verantwortlichen abgenommen werden. Es wurde keine Nachricht an Dritte versandt und kein Betriebssystemdienst installiert. Lokale Alarmierung und Betreiberaufgaben sind ausdrücklich getrennt.

### Gesicherte Historien nachliefern

Der lokale Dienst überträgt nach jedem Überwachungstakt bis zu 100 bereits bestätigte Historienaufträge aus der lokalen SQLite-Ablage nach PostgreSQL. Die Fachänderung wird niemals wiederholt. Benutzer, ursprünglicher Änderungszeitpunkt sowie alte und neue Werte stammen aus dem unveränderlichen Auftrag. Ein PostgreSQL-Beleg verhindert Duplikate auch bei Abbruch nach erfolgreicher Übertragung und vor lokaler Bestätigung. Ausfälle erhalten den ausstehenden Auftrag; der nächste Takt versucht die Übertragung erneut. Nach Neustart setzt der Dienst dies fort. Die Fachendpunkte versuchen ebenfalls eine sofortige Nachlieferung. Das Nachholen setzt die neuen Migrationen voraus; zuvor schon verlorene Historien ohne Auftrag lassen sich nicht verlässlich rekonstruieren.


## Abgebrochene Anfragen und Antwortdaten

Ein Clientabbruch ist kein Ausfall einer Fachquelle. Ist die Anfrage bereits abgebrochen, erzeugt die Antwortüberwachung weder einen Fehlerlogeintrag noch Ausfallmetriken. Echte Antworten ab Status 500 werden weiterhin mit fester Bereichsklasse und serverseitiger Diagnosekennung erfasst.

Die Überwachung liest oder ersetzt den Antwort-Stream nicht. Die Diagnosekennung wird nur gesetzt, wenn die vorhandenen Header veränderbar sind; bei unveränderlichen Fetch-/Redirect-Headern bleibt die ursprüngliche Antwort vollständig erhalten. Status, Nutzdaten und Cookies dürfen durch die Beobachtung nicht verloren gehen.

Die Belegung des Anfragebudgets endet genau einmal bei Abschluss, Lesefehler oder Abbruch. Bei einem frühen Abbruch wird der ursprüngliche Stream verworfen und nicht erneut als Antwort verwendet. Während einer laufenden Übertragung wird auch ein wartender Lesevorgang beendet. Eine hängende Quellstornierung hält die Aufnahmebelegung nicht fest; Fachaktionen werden dabei nicht erneut ausgeführt.

Modultests prüfen diese Fälle ohne Datenbank. Die registrierte isolierte HTTP-Prüfung ergänzt echte Verbindungsabbrüche vor den Headern und während paralleler Übertragungen, anonyme Zugriffsverweigerung und weiterhin protokollierte echte Serverfehler. Zusätzliche Browser-Serverdiagnosen zählen ausschließlich feste Stream-Fehlerklassen. Bei solchen Fehlern schlägt die automatische Browserabnahme auch dann fehl, wenn die Oberfläche wieder bedienbar ist. Rohprotokolle werden dabei nicht als Artefakt gespeichert.
