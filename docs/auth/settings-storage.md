# Kalenderfarben und Benutzerpräferenzen in PostgreSQL

Stand: 06.11.2026. Lokale Entwicklung mit erfundenen Beispieldaten. Keine echte PDS-Datenbank wird angebunden.

## Umstellung und Erhalt vorhandener Werte

```sh
npm run db:up
npm run db:migrate
npm run settings:import
npm run dev
```

Migration `003_platform_settings.sql` ergänzt `platform.calendar_colors` und `platform.user_preferences`. Sie verändert keine bereits angewendete Migration. Alle Zugriffe verwenden denselben lokalen PostgreSQL-Verbindungsbaustein wie Benutzer und Sitzungen. Test-/Produktionsabgrenzung bleibt unverändert.

`settings:import` liest ausschließlich `.local/heyelli/calendar-colors.json` und gültige SHA-256-Dateinamen unter `.local/heyelli/resource-selections/`. Die Quelldateien bleiben unverändert. Übernommen werden sämtliche Farbregeln, die Haupt-/Nebenfarben-Zuordnung je Termintyp sowie Ressourcenauswahl, Techniker-Badges, Arbeitszeitbegrenzung und die Sichtbarkeit vorgemerkter Termine. Ältere reine Farbregel-Arrays und fehlende Haupt-/Nebenfarben-Zuordnungen erhalten die bisherige Standardzuordnung. Fehlende ältere Checkboxfelder erhalten ihre bisherigen Standardwerte. Explizite `false`, leere Ressourcenlisten und `null` für dynamisch alle Ressourcen bleiben unterscheidbar.

Der Import ist transaktional und wiederholbar. Existierende PostgreSQL-Zeilen haben immer Vorrang. Eine ungültige oder unlesbare noch nicht übernommene Datei bricht den gesamten Import ab; es werden keine fehlerhaften Werte durch Vorgaben ersetzt. Bereits vorhandene PostgreSQL-Werte benötigen die alte Datei nicht mehr. Scheitert eine Übernahme, Datei nach Prüfung korrigieren und denselben Befehl wiederholen. Die betroffenen Originaldateien nicht löschen.

Alle gültig benannten Benutzerdateien werden übernommen, auch wenn ihr Benutzer noch nicht in `platform.users` angelegt ist. Dafür bleibt der bisherige SHA-256-Hash der serverseitigen Benutzerkennung als Eigentümerschlüssel erhalten. Die API kann nur das Profil der geprüften Sitzung lesen/schreiben. Der Hash im Browser ist lediglich eine zusätzliche Benutzerwechselprüfung, keine Zugriffsberechtigung.

Fehlt beim späteren Zugriff eine PostgreSQL-Zeile, wird diese einmalig aus der zugehörigen alten Datei bzw. bei tatsächlich fehlender Datei mit den bisherigen Vorgaben initialisiert. Das verhindert, dass auch bei ausgelassenem manuellen Import bestehende Einstellungen verloren gehen. Nach der Initialisierung ist ausschließlich PostgreSQL maßgeblich. Datenbankfehler führen zu einer Fehlermeldung, niemals zu Dateischreibzugriffen oder einem stillen alternativen Speicher. Die alten Dateischreibbausteine werden nur noch in bestehenden isolierten Altformat-Tests verwendet.

Statusregeln werden wie bisher anhand der API-Kataloge normalisiert. Die Speicherumstellung ändert weder die Farbzuordnung noch API-/View-Vorrangregeln. Unzulässige historische Regelarten werden weiterhin nach den vorhandenen fachlichen Regeln bereinigt; die unveränderte Quelldatei bleibt als Sicherung erhalten.

## Persönliche Darstellung

`GET/POST /api/einstellungen` speichert Hell, Dunkel oder Wie Gerät für den serverseitig angemeldeten Benutzer. Lesezugriff genügt für die eigenen Einstellungen. Die erste Anmeldung mit noch leerer Darstellungspräferenz übernimmt den bisherigen Browserwert `heyelli:appearance` (ohne Wert: Dunkel). Ein vorhandener PostgreSQL-Profilwert hat Vorrang, auch wenn ein anderer Browser beim Import gleichzeitig einen anderen Wert anbietet. Der Browserwert wird beim angemeldeten Speichern nicht überschrieben und steht nach Abmeldung weiterhin als unabhängige lokale Auswahl zur Verfügung.

Benutzerwechsel und Abmeldung laden das passende Profil bzw. den lokalen Browserwert neu. Veraltete Antworten werden nicht auf einen inzwischen gewechselten Benutzer angewendet. Ohne erreichbare persönliche Einstellungen wird die Darstellungsauswahl vorübergehend gesperrt; es gibt keine unbemerkte Speicherung nur im Browser. „Wie Gerät“ speichert die Auswahl und folgt weiterhin dem jeweiligen Gerätefarbschema.

## Gleichzeitige Änderungen und Rechte

Globale Kalenderfarben dürfen weiterhin nur Administratoren ändern. Alle aktiven Rollen dürfen ihre eigenen Anzeigeeinstellungen speichern. Jede Route prüft Sitzung, Berechtigung und bei Schreibzugriffen denselben Ursprung. Die Identität wird nicht aus Clientdaten übernommen.

PostgreSQL-Zeilensperren und Versionsvergleiche verhindern verlorene Änderungen zwischen mehreren Prozessen/Fenstern. Veraltete Schreibversuche erhalten 409 und verlangen erneutes Laden. Die Schaltfläche „Neu laden“ im Kalender lädt auch die persönlichen Einstellungen und ihren Versionsstand. Kalenderoptionen und Darstellung haben unabhängige Versionen und überschreiben sich nicht. Ein Farbwechsel speichert Regeln und Haupt-/Nebenfarben gemeinsam.

## Prüfung und Betrieb

`npm run test:platform` verwendet ausschließlich eine eigene temporäre PostgreSQL-Datenbank mit eigenem Volume und eigene temporäre Einstellungsdateien. Die HTTP-Testanwendung läuft in einer separaten Anwendungskopie, einschließlich eigener SQLite-Simulatordatei für Katalogabfragen. Geprüft werden wiederholbare Übernahme, unveränderte Quelldateien, noch nicht provisionierte Profile, ungültige Dateien und Rollback, leere/dynamische Auswahlen, ausgeschaltete Optionen, Farbzuordnungen, konkurrierende Schreibzugriffe, Benutzertrennung, Darstellungsübernahme und Datenpersistenz nach Datenbank-/Anwendungsneustart.

Nach der Übernahme PostgreSQL einschließlich `platform` sichern. Die alten Dateien sind Sicherungen des Übernahmezeitpunkts und enthalten keine späteren Änderungen. Beim Serverumzug ist deshalb die aktuelle PostgreSQL-Datenbank maßgeblich. Der Simulator bleibt in SQLite; Produktivbetrieb und Mehrinstanzbetrieb der gesamten Anwendung sind weiterhin nicht freigegeben.


## Zentrale Vorgaben in der Verwaltung

Seit Migration 004 verwaltet `/verwaltung` zusätzlich zentrale Vorgaben in `platform.system_settings`. Der Bereich **Kalenderfarben** verwendet unverändert den zentralen Kalenderfarben-Editor. **Systemeinstellungen** bietet Standarddarstellung, Techniker-Badges, Arbeitszeitbegrenzung und vorgemerkte Termine. `GET/POST /api/verwaltung/einstellungen` erfordert Administratorrechte, Schreibzugriffe zusätzlich denselben Ursprung. Versionskonflikte erhalten 409; „Neu laden“ verwirft die lokalen Formulareingaben und liest den aktuellen Stand. Änderungen werden als `settings.updated` im Verwaltungsprotokoll erfasst.

Für noch nicht initialisierte Kalenderpräferenzen gelten die zentralen Vorgaben. Existiert eine alte Benutzerdatei, werden diese Werte und die bisherigen Altformat-Vorgaben übernommen. Bereits gespeicherte PostgreSQL-Profile werden nicht verändert. Bei der Darstellung haben gespeicherte Profilwerte und vorhandene Browserwerte weiterhin Vorrang; nur ohne solche Werte wird die zentrale Standarddarstellung übernommen. Anonyme Browser verwenden weiterhin ihre lokale Wahl.

Die drei Verwaltungsbereiche behalten ihre Formulareingaben beim Bereichswechsel. Globale Zugangsdaten, AD-/PDS-Verbindungsdaten und Sicherheitseinstellungen sind nicht über diese Oberfläche editierbar.

## Aufbewahrung und persönliche Daten

Migration 034 ergänzt zentrale `platform.retention_rules`, kurz gültige Bestätigungsvorschauen (`privacy_plans`), nachvollziehbare Ausführungen (`privacy_executions`) und dauerhafte Antwort-Sperrkennungen (`removed_chat_turns`). `mail_queue.content_cleared_at` kennzeichnet die ausdrücklich bestätigte Entfernung abgeschlossener Mailinhalte. Es gibt keinen automatischen Löschlauf; initial sind alle Prüffristen leer. Bestehende Fachdaten, Kalenderentwürfe und Schlüssel bleiben unangetastet.

Eigener Datenexport und Vorschau: `/api/benutzerkonto/daten` und `/export`, ausschließlich eigenes Konto aus der Sitzung. Administration: `/api/verwaltung/datenschutz` und `/export`, zusätzliche Administratorprüfung. Exporte enthalten keine Plattformgeheimnisse; private Kalenderentwürfe werden ausschließlich für den Inhaber entschlüsselt. [Datenklassen, Aufbewahrung, Export- und Wiederherstellungsgrenzen](../operations/data-lifecycle.md).


## Browserdiagnose

Migration 035 ergänzt Tagesaggregate in `platform.browser_reports` unter eigener serverseitiger Benutzerkennung sowie technische Minutenbudgets in `platform.browser_report_budgets`. Keine Rohberichte, vollständigen URLs, Skripttexte oder Geheimnisse speichern. Gruppen bleiben als Sicherheitsnachweise erhalten und sind im eigenen Datenexport enthalten; administrative Übersicht unter Allgemein → Sicherheit. Details: [Browser-Schutz](../operations/browser-protection.md).

## Persönlich ausgeblendete Service-Einträge

`platform.service_hidden_entries` (Migration 040) enthält ausschließlich Benutzerreferenz, Datenquellenbereich, Aktenart, Datensatzkennung und Zeitpunkt. `/api/service/sichtbarkeit` benötigt Service-Leserecht und bindet alle Operationen an die geprüfte Sitzung sowie die aktive Datenquelle. Der Client bestätigt Kontokennung und Quellbereich, er bestimmt sie nicht. Einzeloperationen statt Ersetzen der Gesamtliste erhalten Änderungen aus anderen Tabs. Ausblenden/Einblenden ist wiederholbar; pro Benutzer sind maximal 2.000 Einträge gespeichert. Keine Löschung von Fachdatensätzen oder automatische Alterslöschung. Einblenden entfernt ausschließlich die betreffende persönliche Auswahl; der persönliche Export enthält die gespeicherten Ausblendungen.

`platform.service_pinned_customers` (Migration 048) enthält ausschließlich Benutzerreferenz, Datenquellenbereich, PDS-Kundenkennung und Zeitpunkt der persönlich angehefteten Kunden (Service-Seitenleiste „Angeheftet“, höchstens 200 je Quelle). Lesen und Ändern nur für das eigene Konto mit Service-Leserecht über `/api/service/angeheftet`; Teil des persönlichen Datenexports; Konto löschen entfernt die Einträge (ON DELETE CASCADE).

`platform.maildesk_messages`, `platform.maildesk_senders` und `platform.maildesk_replies` (Migration 049) speichern für MailDesk ausschließlich Entscheidungen je Nachricht (Kunde, Objekt, Auftragsnummer, Zuständigkeit, Markierung, Archiv, Version), gelernte Absenderadressen je Postfach und Datenquelle sowie Verweise auf Antworten in der zentralen Mail-Warteschlange – keine Mailinhalte. Lesen mit MailDesk-Leserecht, Ändern mit MailDesk-Schreibrecht; Details in `docs/maildesk.md`.

`platform.maildesk_settings` (Migration 050) hält die MailDesk-Postfachquelle (Beispielpostfach oder Microsoft 365), die Adresse des geteilten Postfachs und das Ergebnis der letzten Verbindungsprüfung; nur Administratoren über `/api/verwaltung/maildesk`, versioniert und protokolliert. Keine Zugangsdaten (diese liegen bei Microsoft Graph).

`platform.task_extras` (Migration 052) speichert zu PDS-Aufgaben nur Ergänzungen, die PDS nicht kennt: Checkliste (≤ 50 Schritte), Verknüpfungen (≤ 20, nur interne Verweise) und den Verlauf der in heyelli ausgelösten Änderungen (≤ 100 Einträge), je Datenquelle getrennt, mit Versionszähler gegen gleichzeitige Änderungen und Audit je Änderung. Die Aufgabe selbst liegt in PDS. Migration 053 ergänzt MailDesk und Aufgaben in der Prüfbedingung von `platform.app_usage`.

`platform.customer_notes` (Migration 054) speichert Notizen am Kunden für Kunde 360 (≤ 2000 Zeichen, je Datenquelle getrennt, nur Anlegen und Löschen durch den Verfasser, Audit je Änderung).

`platform.mission_plan`, `platform.mission_focus` und `platform.mission_notes` (Migration 055) speichern für MissionControl die persönliche Planung je Aufgabe (Tag, wichtig – höchstens drei je Tag –, Reihenfolge, Schätzung), Fokussitzungen (höchstens eine laufende je Benutzer, Dauer serverseitig berechnet) und Notizen zur Aufgabe (≤ 2000 Zeichen, nur der Verfasser löscht, Audit). Die Aufgaben selbst kommen aus der App Aufgaben. Migration 056 ergänzt Uhrzeit, Kalenderkennung und Kalenderfehler je Plan sowie `platform.mission_settings` (persönlicher Schalter für den Outlook-Abgleich). Migration 057 legt `platform.mission_goals` (Teamziele mit Versionszähler und Audit), `platform.mission_goal_values` (ein Wert je Ziel und Tag), `platform.mission_goal_items` (ein Ziel je Aufgabe) und `platform.mission_done` (in MissionControl erledigte Aufgaben) an.

## Menüleisten-Werkzeuge

Migration `043_menu_tools.sql` ergänzt `platform.app_roles.tools` und `platform.tool_preferences` mit benutzergebundener ausgeblendeter Auswahl und Versionsstand. Bestehende nichtadministrative Rollen erhalten zunächst keine Werkzeugfreigabe. Administratoren besitzen alle Werkzeuge; weitere Rollen werden unter Einstellungen → Benutzer & Zugriff → Rollen & App-Zugriffe freigegeben. Ein Werkzeug erfordert zusätzlich Zugriff auf seine App. Die App-Schreibrechte gelten unverändert; Rollenänderungen werden mit alten/neuen Werkzeugwerten protokolliert und widerrufen betroffene Sitzungen.

`/api/benutzerkonto/werkzeuge` ist ein explizit gemeinsamer, sitzungsgebundener Plattformweg: GET liefert ausschließlich eigene Sichtbarkeit und serverseitig ermittelte Freigaben; POST ändert ausschließlich die eigene Auswahl, prüft Ursprung, Besitzer, begrenzten Inhalt und Versionsstand. Fremde Besitzer sowie konkurrierende Änderungen werden abgewiesen. Persönliche Sichtbarkeit erteilt keine Berechtigungen. Der persönliche Datenexport enthält diese Einstellungen. Es gibt keine automatische Löschung.

Die Einbettungsroute `/werkzeuge/casedesk` prüft Sitzung, Rollenfreigabe und App-Zugriff erneut auf dem Server. Nur diese Route erlaubt Einbettung durch dieselbe Herkunft (`SAMEORIGIN`, `frame-ancestors 'self'`); andere Seiten einschließlich Anmeldung bleiben gegen Einbettung gesperrt. Die übergeordnete CSP erlaubt ausschließlich gleichursprüngliche Fenster, keine fremden Einbettungen. Das Formular verwendet unverändert die App-API mit ihren Lese-/Schreibprüfungen. Die Instanz bleibt beim Zuklappen, persönlichen Ausblenden und App-Wechsel montiert. Ungespeicherte Erfassungen werden dadurch nicht dauerhaft gesichert: Schließen/Neuladen des gesamten Browserfensters kann sie verwerfen; der vorhandene Browser-Verlassensschutz bleibt aktiv.

## Wiederverbinden der geschützten Kalenderablage

Eine gesperrte lokale Entwurfsablage darf frische Kalenderdaten und die serverseitig ermittelten Leserechte nicht blockieren. Der Kalender lädt diese unabhängig weiter und öffnet die geschützte Ablage erneut über den sitzungsgebundenen Schlüsselabruf. Benutzerkennung, Lebensdauer und Auswahlgeneration werden vor der Übernahme geprüft; gleichzeitige Wiederverbindungen werden zusammengefasst. Währenddessen bleiben vorhandene Formulareingaben erhalten und Schreibaktionen warten auf den gültigen Entwurfsschutz. Ein Terminöffnen während der Vorbereitung oder Sperre erzeugt keinen unbehandelten Speicherfehler.

Ohne erfolgreich gelesenen eigenen Entwurfsbestand werden keine Entwürfe als erledigt entfernt. Auch Wiederholungen von Speicheraktionen setzen einen lesbaren eigenen Entwurf voraus. Schlüssel werden weder dauerhaft im Browser gespeichert noch neu erzeugt; ungültige Sitzungen bleiben gesperrt.

## Dauerhafte CaseDesk-Werkzeugaufträge

`/api/benutzerkonto/auftragsentwuerfe` ist ein expliziter persönlicher Plattformweg: ausschließlich die Identität der geprüften Sitzung und der serverseitig ermittelte Arbeitsbereich bestimmen Schlüssel und zugängliche Erfassungen. Derselbe Ursprung ist für Sicherungsänderungen erforderlich. Dieser Weg erteilt keinerlei Auftrags-Schreibrecht. Die tatsächliche Anlage bleibt durch `/api/pds-simulator/orders` und dessen CaseDesk-Schreibprüfung geschützt.

Die vorhandenen `private_draft_keys` und `private_draft_copies` enthalten zusätzlich unveränderliche verschlüsselte `incident-draft:v1`-Stände. Keine neue Tabellenstruktur, kein Import und keine Änderung bestehender Kalenderentwürfe. Dieselben privaten Schlüssel, Grenzen, Abschlussmarkierungen, persönlichen Exporte und Aufbewahrungssperren gelten. Browser-Schlüssel bleiben ausschließlich im Arbeitsspeicher und werden bei Sitzungsende gesperrt. Neue Serverstände werden vor dem Entfernen ersetzter Revisionen bestätigt; fehlerhafte Sicherungen werden nicht überschrieben oder nach Alter gelöscht. Unterschiedliche Browser-Tabs eines Profils koordinieren Zweige mit Web Locks. Alte Zweige bleiben getrennt auswählbar.

Gesichert werden die gewählten Stammdateneinträge, Suchtexte, Rohwerte von Datum/Uhrzeit, Meldung, Kontakt, Planung, Begleiter, Projektleitung, Ausgabeoption und die unveränderte Speicherkennung mit eingefrorenem Nutzinhalt bei einer bereits angefragten Anlage. Das Wiederöffnen allein legt keinen Auftrag an. Eine verlorene Antwort wird mit exakt derselben Kennung geprüft; Änderungen bleiben dafür gesperrt. Bestätigte Anlage oder ausdrücklich bestätigtes Verwerfen beendet ausschließlich den eigenen Zweig.

Noch nicht bestätigte Dateien werden auf dem Browsergerät in `heyelli-protected-tool-files` separat per AES-GCM geschützt abgelegt; Besitzer, Zweig und Uploadkennung sind an die Verschlüsselung gebunden. Der dauerhafte Entwurf referenziert diese Datei und behält die Uploadkennung für Wiederholungen. Vollständig hochgeladene Dateien liegen bereits im bestehenden geschützten Uploadspeicher. Die browserlokale Dateikopie wird ausschließlich bei bestätigter Anlage oder ausdrücklichem Verwerfen des zugehörigen Zweigs entfernt. Solange die lokale Dateisicherung noch nicht abgeschlossen ist, bleibt der Neuladeschutz aktiv.

Grenzen: Browserdaten dürfen nicht gelöscht werden, solange noch keine zusätzliche Serversicherung bestätigt ist. Noch nicht hochgeladene Dateiinhalte sind nur auf dem ursprünglichen Browsergerät verfügbar und gehören nicht zu PostgreSQL-Sicherungen oder persönlichen Serverexporten; dort ist der Dateiverweis enthalten. Das vollständige eigenständige CaseDesk-Fenster verwendet weiterhin seinen bisherigen Navigationsschutz; diese Sicherung betrifft das Menüleisten-Werkzeug. Gleichzeitige Browserprofile oder Geräte werden durch die lokalen Web Locks nicht gegenseitig gesperrt; sie dürfen einen bereits angefragten Vorgang ausschließlich mit unverändertem Nutzinhalt wiederholen. Unveränderliche Sicherungsstände und serverseitige Wiederholungskennung bleiben erhalten.


`platform.sharepoint_storage_types` und `platform.sharepoint_folders` (Migration 051) halten die von Administratoren gepflegten SharePoint-Ablagetypen sowie die feste Zuordnung Akte (+ Ablagetyp) → SharePoint-Ordnerkennung und Pfad. `sharepoint_uploads` erhält Ablagetyp und festgelegten Dateinamen. Keine Dateiinhalte; Details in `docs/operations/sharepoint.md`.


**Migration 058 (21.11.2026, neue App-Adressen):** `/service` → `/servicehub`, `/stoerungsmeister` → `/casedesk`, `/ressourcenmeister` → `/planboard`, `/bereitschaftsmeister` → `/dutyboard`, `/aufgaben` → `/taskhub`. Die Migration schreibt die Pfade in `platform.app_roles` (`apps`, `write_apps`) und `platform.app_usage` um und setzt **vorübergehend alle Rollen auf alle Apps mit Lese- und Schreibrecht** (Einstellungen bleiben Administratoren vorbehalten); Sitzungen der Nicht-Administratoren werden dabei widerrufen, die Änderung ist im Audit vermerkt. Einschränkungen je Rolle werden danach wieder unter Einstellungen → Benutzer & Zugriff → Rollen gepflegt. Alte Adressen leiten dauerhaft weiter (`next.config.ts`); API-Wege (`/api/service/…`, `/api/aufgaben/…`, `/api/verwaltung/stoerungsmeister`) bleiben unverändert.
