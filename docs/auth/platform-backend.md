# Zentrales HeyElli-Backend: erste Ausbaustufe

Stand: 05.11.2026. Ausschließlich lokale Entwicklung mit erfundenen Beispieldaten. Der Produktivbetrieb ist im PostgreSQL-Verbindungsmodul ausdrücklich gesperrt. Getrennte Produktionsinfrastruktur, Echtdaten und echte PDS-Anbindung sind nicht eingerichtet.

## Einrichtung

Node-Version aus `.node-version` verwenden. Bestehende Umgebungsdateien erhalten; keine Zugangsdaten in Befehle oder Protokolle kopieren.

```sh
npm ci
test -e .env || cp .env.example .env
# Neue lokale .env vor dem Start konfigurieren; bestehende Dateien erhalten.
npm run db:up
npm run db:migrate
npm run db:seed
npm run auth:admin
npm run dev
```

Die Anwendung verbindet sich ausschließlich lokal über `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` und `POSTGRES_PORT` aus den ausgeschlossenen Umgebungsdateien. `APP_ENV=development` ist optional explizit möglich. Die Compose-Konfiguration und `db:*`-Skripte bleiben nur für Entwicklung bestimmt. Der PostgreSQL-Port muss mit der Compose-Konfiguration übereinstimmen; Verbindungswerte in `.env.development.local` dürfen nicht versehentlich von `.env` abweichen.

Migration `002_platform_identity.sql` ergänzt das Schema `platform` mit Benutzern, Sitzungen, Verwaltungsprotokoll und gemeinsamem Loginbegrenzer. Das bestehende Schema und alle früheren Migrationen bleiben unverändert. `platform_examples.sql` wird von `db:seed` separat nach dem Katalogseed ausgeführt. Wiederholen überschreibt weder Rollen noch Sperrungen oder sonstige bestehende Benutzerdaten.

## Erste Administration

`npm run auth:admin` legt den festen Administrator `admin` mit einem einmalig ausgegebenen Startpasswort an, das bei der ersten Anmeldung geändert werden muss. Die Beispieldaten legen zusätzlich die fiktiven Konten `alex` (Administrator), `kim` (Disposition) und `service` an, ohne Passwörter, mit PDS-Benutzern des Simulators. Konten, Passwörter, Microsoft-Verknüpfung und PDS-Benutzer: [heyelli-Konten](accounts.md). Den Server für seine Verwendung nicht auf Produktion umstellen.

Als Administrator im Benutzermenü „Verwaltung öffnen“ wählen oder `/verwaltung` öffnen. Die Seite und sämtliche `/api/verwaltung`-Endpunkte prüfen die serverseitige Sitzung. Anonyme API-Aufrufe erhalten 401, Benutzer ohne Administratorrolle 403. Die Oberfläche allein stellt keinen Zugriffsschutz dar.

## Rollen und Verwaltung

| Funktion | Lesezugriff | Disposition | Administrator |
| --- | --- | --- | --- |
| Geschützte Kalender-/Auftrags-/Kontaktdaten lesen | ja | ja | ja |
| Persönliche Kalender-Anzeigeeinstellungen speichern | ja | ja | ja |
| Termine, Aufträge und Kontakte bearbeiten / Dateien hochladen | nein | ja | ja |
| Globale Kalenderfarben ändern | nein | nein | ja |
| Benutzer, Rollen und Sitzungen verwalten | nein | nein | ja |

Der Administrator kann Verzeichniskennungen mit Anzeigename, Rolle und Aktivstatus anlegen, Rollen ändern, Konten sperren und einzelne aktive Sitzungen widerrufen. Rollenänderungen und Sperrungen beenden alle Sitzungen des Zielkontos; erneute Anmeldung übernimmt die aktuelle Rolle. Jede Sitzungsprüfung liest Benutzerstatus und Rolle neu aus PostgreSQL. Der letzte aktive Administrator darf nicht gesperrt oder herabgestuft werden, auch bei gleichzeitigen Anfragen. Ein Versionsstand schützt vor dem Überschreiben zwischenzeitlicher Änderungen. Benutzer werden nicht gelöscht.

Die AD-Kennung wird als `ad:<objectGUID>`, eine Demokennung als `demo-ad:<objectGUID>` gespeichert. Das Anlegen in der Verwaltung ersetzt weder AD-Mitgliedschaft noch die bestehende freigegebene PDS-Zuordnungsdatei. Für AD bleiben Gruppenprüfung und die administrative PDS-Zuordnung erforderlich. Es werden keine AD-/PDS-Konten oder Passwörter angelegt oder geändert. Die Standardanzeige listet höchstens 200 aktive Sitzungen und die letzten 30 Verwaltungsereignisse.

## Dauerhafte Sitzungen

Der Browser erhält nur einen zufälligen, undurchsichtigen Sitzungstoken im HttpOnly-/SameSite-Strict-Cookie. PostgreSQL speichert ausschließlich dessen SHA-256-Hash. Die Sitzung gilt weiterhin genau eine Stunde; sie wird nicht bei jeder Anfrage verlängert. Server-/Datenbankneustarts erhalten aktive Sitzungen innerhalb ihrer Laufzeit. Der Datenbankbestand muss dafür erhalten bleiben. Abmelden widerruft die Sitzung serverseitig. Ein neuer Login ersetzt die bisherige Sitzung desselben Browsers. Browsercookies der alten Arbeitsspeicherverwaltung sind ungültig und erfordern eine neue Anmeldung.

Sitzungen behalten den geprüften Anmeldemodus und die PDS-Bearbeiterkennung. Ein Wechsel des Modus oder ein Entzug/Wechsel der lokalen PDS-Zuordnung wird weiterhin geprüft. Änderungen im echten AD wirken weiterhin spätestens nach Ablauf der einstündigen Sitzung; es gibt keine AD-Push-Widerrufsanbindung. Bei einem PostgreSQL-Ausfall wird kein alternativer Sitzungsspeicher verwendet.

Der gemeinsame Loginbegrenzer erlaubt höchstens 30 Versuche je festem 15-Minuten-Fenster für die gesamte Anwendung, einschließlich erfolgreicher Versuche. Er übersteht Neustarts und gilt für alle Prozesse. Ein gezielter Benutzer-/IP-basierter Begrenzer und Betriebsschutz gegen verteilte Angriffe sind noch nicht implementiert. Abgelaufene oder widerrufene Sitzungen werden beim nächsten erfolgreichen Login bereinigt. Das Verwaltungsprotokoll enthält Akteur, Aktion, Ziel und Zeitpunkt, jedoch keine Passwörter, Cookies oder Tokenhashes; es ist kein manipulationssicheres externes Revisionsarchiv.

## Isolierte Prüfung

```sh
npm run test:platform
npm run lint
npm run typecheck
npm run build
```

`test:platform` startet `compose.test.yaml` unter einem einmaligen Projektnamen mit eigener Datenbank `heyelli_test`, eigenem Volume und dynamischem Loopback-Port. Das temporäre Passwort wird im Prozess erzeugt, nicht ausgegeben, und der Datenbankcontainer liest keine Projekt-`.env`. Tests verwenden ausdrücklich keine Entwicklungsdatenbank. Der Testserver verwendet `APP_ENV=test`, einen ausschließlich vom Runner gesetzten `HEYELLI_TEST_DATABASE_URL` und eine temporäre Anwendungskopie mit eigenem Buildverzeichnis. In diesem Modus akzeptiert der Verbindungsbaustein ausschließlich die Testdatenbank und den Testbenutzer auf Loopback. Testcontainer und Testvolume werden abschließend entfernt.

Geprüft werden wiederholbare Migrationen/Seeds, Rollenbegrenzung, verweigerte Freigabe unbekannter Benutzer, Hashspeicherung, Ablauf und Widerruf, konkurrierende Administratoränderungen, Versionskonflikte, der gemeinsame Loginbegrenzer und Sitzungserhalt nach Datenbank- und Anwendungsneustart. HTTP-Prüfungen umfassen anonyme/lesende Verwaltungszugriffe, Ursprungsprüfung, Größenlimit, gefälschte Clientrollen und verbotene Fachschreibzugriffe. Die erweiterten Einstellungs-HTTP-Tests lesen den PDS-Simulator ausschließlich in der temporären Anwendungskopie mit eigener SQLite-Datei; es wird keine Entwicklungsdatei verwendet.

## Bewusste Grenzen dieser Ausbaustufe

PostgreSQL ist jetzt der zentrale Speicher für Plattformidentitäten, Rollen, Sitzungen, Anmeldebegrenzung, Verwaltungsprotokoll, globale Kalenderfarben und persönliche Anzeigeeinstellungen einschließlich Hell/Dunkel. Vorhandene Kalenderdateien werden mit Migration 003 und `npm run settings:import` übernommen; siehe [Einstellungsübernahme](settings-storage.md). Der PDS-Simulator bleibt separat in seiner Entwicklungs-SQLite-Datenbank. Dessen Überführung ist nicht Teil dieser Stufe. Mehrinstanzbetrieb der gesamten Anwendung ist trotz zentraler Plattformdaten weiterhin nicht freigegeben.

Vor Echtbetrieb sind getrennte Produktionsdatenbank/-Zugangsdaten/-Volumes, Transportabsicherung, Sicherung und geprüfte Wiederherstellung sowie echte AD-/PDS-Integration ausdrücklich einzurichten. Fachschreibvorgänge bleiben Simulatorabläufe. HeyElli-Rollen ändern keine Rechte des zentralen technischen PDS-API-Zugangs.
