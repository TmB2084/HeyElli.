# SharePoint-Dokumentablage

SharePoint ist unter **Einstellungen → Integrationen → SharePoint** eingerichtet, zunächst **deaktiviert**. Die ausführliche Anleitung dort und ihr Markdown-Download verwenden gemeinsam `src/platform/sharepoint/guide.ts`. Keine Zugangsdaten in Umgebungsdateien kopieren oder bestehende lokale Dateien ersetzen: Einrichtung über das geschützte Administratorformular.

## Freigabe und Zugriff

Eigene Microsoft-Entra-App mit `Sites.Selected` (Anwendungsberechtigung), Administratorzustimmung und ausdrücklich erteiltem Schreibrecht auf genau die ausgewählte Website. Tenant-/Client-ID, Secret-Wert, vollständige Site-ID, Bibliotheks-ID und Stammordner-ID eintragen. Globales Microsoft Graph und `*.sharepoint.com` werden unterstützt. Keine globale Website-Schreibberechtigung und keine Freigabelinks durch HeyElli.

Speichern deaktiviert die Anbindung und entwertet den Test. Der Verbindungstest liest nur Website, Bibliothekszugehörigkeit und Stammordner; er erzeugt keine Dateien und beweist noch keine Schreibberechtigung. Freigabe erst nach erfolgreichem Test innerhalb von 24 Stunden und separater Bestätigung. Die lokale Installation bleibt bis zur ausdrücklichen Freigabe deaktiviert. Ausgeschaltet werden in Akten keine SharePoint-Aufrufe ausgeführt; eine bewusst gestartete administrative Verbindungsprüfung ist vorher möglich.

Service-Leserecht erlaubt Dokumentlisten; Service-Schreibrecht bzw. Administrator erlaubt manuelle Uploads. Rechte werden im Route Handler unabhängig vom Proxy geprüft. Die Akte muss serverseitig in der aktuellen PDS-/Simulatorquelle existieren. Vertragsdokumente benötigen zusätzlich einen nachgewiesenen Vertrag am gewählten Objekt. App-Rechte sind keine Datensatztrennung. Dateinamen werden über das technische Anwendungskonto gelesen; In SharePoint öffnen verwendet zusätzlich die dortigen Rechte des angemeldeten Microsoft-Benutzers. Diese Reichweite muss die Administration vor Freigabe bestätigen.

## Zuordnung und Dateiablage

Ordnerstruktur (Vorgabe 21.11.2026, `src/platform/sharepoint/layout.ts`): Alle Dokumente liegen nach Objekt und technischer Einheit, Kundendokumente ohne Einheit beim Kunden.

| Akte | Ordner unter dem Stammordner |
| --- | --- |
| Technische Einheit | `Objekte/<Stadt>/<straße_hausnummer>/<Gewerk>/<Einheit>_<dbid>/<Ablagetyp>/` |
| Objekt ohne Einheit | `Objekte/<Stadt>/<straße_hausnummer>/Allgemein/<Ablagetyp>/` |
| Serviceauftrag | beim Gewerk und der Einheit seines Einsatzes; Dateiname beginnt mit der Auftragsnummer |
| Kunde ohne Einheit | `Kunden/<kundenname>_<kundennummer>/<Ablagetyp>/` |
| Vertrag | `Kunden/<kundenname>_<kundennummer>/Verträge/<vertrag>/` (gilt ggf. für mehrere Objekte) |

Quellen, geprüft gegen PDS-OpenAPI und Anwenderdokumentation (21.11.2026):

- **Stadt, Straße mit Hausnummer**: `standort.ort` und `standort.strasse` des Objekts (`PdsAPIPostKommunikationswegDetailsRESTModel`; die Hausnummer ist Teil von `strasse`). Technische Einheiten übernehmen den Standort ihres übergeordneten Objekts (`parentUUID`).
- **Gewerk**: der **Fachbereich** der Anlage – in PDS das Gewerk einer Anlage/eines Bauteils (Anwenderdokumentation „Anlagen und Bauteile erstellen“: „Tragen Sie einen FACHBEREICH ein, zu dem die Anlage gehört“; Wartungsangebot: „Fachbereich (z. B. Klima)“). API: `fachbereichUUID` in `PdsAPIObjektDetailsRESTModel`, Bezeichnung über GET `/mitarbeiter/listfachbereiche`.
- **Einheit**: `bezeichnung` und `dbid`. Die PDS-Pflichtkennung „Kürzel“ wird von der API nicht geliefert; eine Objektnummer existiert nur als installationsspezifisches Infofeld (Anwenderdokumentation „Service-Import“). Die `dbid` macht gleichnamige Anlagen am selben Standort eindeutig.
- **Kunde**: `name` und `kundenRolle.kundennummer` (`PdsAPIPersonDetailsRESTModel`). Fehlende Angaben werden als `ohne_ort`, `ohne_adresse`, `ohne_gewerk` angelegt. Straße und Kundenname werden klein mit Unterstrich geschrieben; für SharePoint unzulässige Zeichen entfallen.

**Ablagetypen** (Einstellungen → SharePoint → Ablagestruktur; Tabelle `platform.sharepoint_storage_types`): Standard Mails, Berichte, Rückläufe, Fotos, Verträge, Angebote, Sonstiges. Administratoren können umbenennen, ergänzen, ausblenden und sortieren; gelöscht wird nie. Beim Hochladen wird der Ablagetyp gewählt; die Akte zeigt die Dateien nach Ablagetyp gruppiert.

**Feste Zuordnung**: Beim ersten Upload legt HeyElli den Pfad an und merkt sich je Akte (und Ablagetyp) die Ordnerkennung (`platform.sharepoint_folders`). Spätere Adress- oder Namensänderungen in PDS verschieben keine Dokumente und lassen keine verwaisen; umbenannte Ablagetypen gelten für neue Ordner, vorhandene behalten ihren Namen. Ordner entstehen weiterhin erst bei einem ausdrücklich gestarteten Upload; Listenlesen erzeugt keine Ordner. Simulator und echte PDS-Quellen bleiben über die Aktenkennung getrennt.

**Dateinamen**: lesbar (`<Auftragsnummer>_<Name>` bei Aufträgen, sonst der Originalname), bei Belegung `Name (2).pdf`. Der gewählte Name wird im Upload-Vorgang festgehalten; Wiederholung und Duplikatschutz arbeiten damit unverändert.

**Bisherige Ablage** `heyelli-<hash>`: bleibt sichtbar („Bisherige Ablage“), bis sie unter Einstellungen → SharePoint → Ablagestruktur → *Bisherige Ablage übernehmen* nach Vorschau und Bestätigung in die neue Struktur (`…/Sonstiges`) verschoben wird. Dateien werden verschoben, nicht kopiert oder gelöscht; Ordner, die keiner Akte in PDS zugeordnet werden können (z. B. Verträge), bleiben unverändert.

Pro Akte werden höchstens 100 Dateien angezeigt; der Ordnerlink führt zur vollständigen SharePoint-Ansicht. Listen aktualisieren im Hintergrund, solange keine Dateiauswahl oder Speicherung läuft.

Dateien: PDF, PNG, JPEG, DOCX, XLSX und UTF-8-Text bis **8 MiB**, Dateiname maximal 160 Zeichen. Dateisignaturen werden geprüft, Office-Dateien jedoch nicht entpackt oder als Makro-/Virenfreiheit zertifiziert. Höchstens 100 neue Vorgänge pro Benutzer und 1000 insgesamt pro Tag. Bestehende Dateien und unbestätigte Vorgänge werden bei Quote niemals entfernt. Ressourcenaufnahme, Benutzerbudget und globale Parallelitätsgrenzen gelten zusätzlich; aktive SharePoint-Schreibvorgänge werden mit Konfigurationsänderungen serialisiert. Der Streaming-Endpunkt ist vom Proxy-Klonpuffer ausgenommen und prüft Sitzung, App-Rechte, Ursprung und Übertragungsgröße selbst.

Der begrenzte Dateikörper wird stückweise gelesen (höchstens 8 MiB im Speicher) und über Microsoft-Upload-Sitzungen in Blöcken von 1,25 MiB übertragen. Keine lokale Dateikopie und kein unbeschränkter Upload. Die letzten Teilblöcke dürfen kleiner sein. Upload-Sitzungsadressen bleiben serverseitig; nur die konfigurierte SharePoint-Hostadresse wird akzeptiert. Downloads zur Wiederholungsprüfung folgen höchstens einem zulässigen SharePoint-Redirect und geben dabei kein Graph-Token weiter.

## Verbindungsfehler und neuere Änderungen

Vor der Dateiübertragung entsteht in PostgreSQL eine benutzergebundene Vorgangskennung mit Kontext, Inhalts-Hash, Dateiname und Größe. Remote-Dateinamen sind damit eindeutig; `conflictBehavior=fail` verhindert Überschreiben. Ein gleicher Inhalt/Name desselben Benutzers in derselben Akte und Bibliothek wird wiedererkannt, auch nach erneutem Auswählen der Originaldatei. Abweichende Inhalte mit derselben Vorgangskennung werden abgewiesen.

Nach unklarer Bestätigung wird zunächst geprüft, ob die feste Datei bereits existiert. Bei unbestätigtem Vorgang wird ihr Inhalt begrenzt gelesen und per SHA-256 abgeglichen. Bestätigte Dateien werden anhand ihrer Kennung und ihres eTags geprüft; ein neuerer Stand wird nie zurückgeschrieben. Entfernte/veränderte Dateien benötigen einen neuen manuell gewählten Vorgang und erhalten gegebenenfalls eine neue Kopie statt Überschreiben. Unbestätigte oder abgeschlossene Metadaten werden nicht altersbasiert gelöscht. Keine automatische Wiederholung bei bloßer Netzrückkehr; der Benutzer startet die Wiederholung bewusst.

Die ausgewählte Datei bleibt bei einem Fehler im geöffneten Fenster erhalten. Vor Neuladen/Schließen ist die Originaldatei nicht dauerhaft im Browser gesichert; sie muss danach erneut ausgewählt werden. Navigation mit ausgewählter Datei wird durch den vorhandenen Navigationsschutz abgesichert. Eine serverseitig gespeicherte Datei ist auch bei verlorener Antwort nicht verloren.

## Geheimnisse, Sicherung und Wiederherstellung

Unveränderliche verschlüsselte `.env.sharepoint.<UUID>.local`-Stände (0600), eigener Master-Schlüssel `.local/sharepoint-secrets/master.key`, aktive Referenz ausschließlich in PostgreSQL. Vorhandene Umgebungsdateien werden nicht überschrieben. Speichern, Archivierung, Bereinigung, Wiederherstellung und laufende Schreibvorgänge verwenden denselben Geheimnislock. Schlüsselverlust erzeugt bei vorhandenem Bestand keinen Ersatzschlüssel. Rücknahme und Rollback lassen die vorherige Referenz erhalten. Unter Sicherheit → Geschützte Zugangsdaten sind vorherige Stände wiederherstellbar; anschließend sind Anbindung und Testfreigabe deaktiviert.

Die bestehende Vollsicherung umfasst Konfiguration, Schlüssel und PostgreSQL-Metadaten. Isolierte Wiederherstellungen deaktivieren SharePoint vor einem App-Start. **Externe SharePoint-Dateiinhalte sind nicht Teil des HeyElli-Archivs.** Versionierung, Wiederherstellung, Aufbewahrung, Speicher, DLP/Malware-Prüfung und Datenschutz müssen für SharePoint separat eingerichtet werden. Uploadmetadaten sind gemeinsame Fach-/Wiederholungsnachweise; persönliche Bereinigungen löschen sie und die SharePoint-Dateien nicht automatisch.

Keine Tokens, Secrets oder signierten Sitzungsadressen in API-Antworten, Browser, Protokoll oder Markdown-Download. Konfigurations- und Freigabeänderungen sowie bestätigte Uploads werden mit Benutzer/Zeitpunkt protokolliert, ohne Geheimnisse. Bei der allgemeinen Überwachung wird die Lesbarkeit aktiver SharePoint-Konfigurationen mitgeprüft; der eigenständige Monitor muss nach Softwareaktualisierungen regulär neu gestartet werden.

## Prüfung

`node scripts/test-platform.mjs --sharepoint`: eigene Datenbank/Dateien und lokaler Graph-Testanbieter; Freigabesperre, Rollen, unbeklärter Upload, Deduplizierung, externe Änderungen, Schlüsselverlust, Rollback, Geheimnisarchiv und sichere Wiederherstellung. Fall ist im regulären Plattformtest registriert. Browserfall E12 in Chromium/WebKit prüft Setup, ungültiges Secret, erhaltene Daten, deaktivierte Freigabe, Leserechte und größeren Upload nach Fehlerantwort.

Chromium verwirft die Antwort nach erfolgreicher Speicherung über Browserinterzeption. WebKit sendet den echten Datei-Upload weiter; nur die isolierte Quellkopie antwortet danach absichtlich mit HTTP 503. Das umgeht die Testwerkzeuggrenze beim erneuten Senden abgefangener WebKit-Dateidaten. Testanbieter und Prüfheaderauswertung existieren ausschließlich in erzeugten Prüfumgebungen, nicht in der ausgelieferten Anwendung. Keine echte Microsoft-Verbindung oder Zustellung nachgewiesen; diese ist mit realen Mandantendaten erst durch die Administration abzunehmen.
