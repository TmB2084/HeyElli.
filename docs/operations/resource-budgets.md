# Ressourcenquoten, Abfragebudgets und Lastprüfung

Stand 13.11.2026. Lokale Entwicklung mit fiktiven Daten, kein Produktions-/Kapazitätsversprechen.

## Grenzen und Schutz des Bestands

Die Grenzen stehen versioniert in `src/platform/resource-budgets/model.ts`, `platform-store/config.ts` und `pds-simulator/upload-storage.ts`. Keine ungeprüften Clientvorgaben, keine globale Kalender-/Bearbeitungssperre. Bei Überlast wird ausschließlich die neue Anfrage abgewiesen. Bestehende Daten, Entwürfe, Schlüssel, Abschlussmarkierungen und akzeptierte Dateien werden niemals zum Freigeben von Quote gelöscht.

| Grenze | Vorgabe |
| --- | --- |
| Aktive geschützte API-Anfragen | 24 gemeinsam, höchstens 8 pro Konto |
| Große Datei-/Dokumentvorgänge | 2 gemeinsam, höchstens 1 pro Konto |
| Streaming-Exporte | 2 gemeinsam, höchstens 1 pro Konto; JSON-Protokollseiten zählen als normale Abfragen |
| Anfragen pro Minute | 600 pro Konto, 6.000 gemeinsam |
| Große Vorgänge / Exporte pro Minute | 60 pro Konto, 240 gemeinsam |
| Übertragungsdauer von Körpern | 60 Sekunden; Abbruch beendet das Lesen |
| Externe PDS-Anfragen pro Vorgang | höchstens 80, 30 Sekunden normal / 60 Sekunden große Vorgänge; einzelne PDS-Anfrage zusätzlich 15 Sekunden |
| SQL-Ausführungszeit / Sperrwartezeit | 10 Sekunden / 1,5 Sekunden je Abfrage |
| Inaktive SQL-Transaktion | 15 Sekunden; explizit begrenzter A03-Export setzt seinen dokumentierten eigenen Wert |
| Plattformpool | 10 Verbindungen in Entwicklung, 5 in Tests, maximal 24 wartende Verbindungsanforderungen |
| Datei | 100 MiB; 250 MiB akzeptierte plus laufende Uploads je Konto |
| Gemeinsame Dokumentquote | 1 GiB, einschließlich laufender Uploads und abgelegter PDS-Dokumentkopien |
| Freier Speicher vor neuen Uploadblöcken | 64 MiB Reserve plus neuer Block |
| Uploadblock im Arbeitsspeicher | 256 KiB; Eingangsnetzwerkpuffer zusätzlich |
| Service-Liste | maximal 20.000 Datensätze / 16 MiB je gelesener Liste; keine unbegrenzte Sammlung von Seiten |

Admission-Leases und Minutenzähler sind in PostgreSQL transaktional über Prozesse hinweg abgestimmt. Überzählige Anfragen werden mit 429 abgewiesen, erschöpfte SQL-/Verbindungsbudgets mit 503; `Retry-After` gibt einen kurzen Wiederholungsabstand an. Die anfrageeigene Lease bleibt bis zum Abschluss/Abbruch der Antwort bestehen. Technische verwaiste Leases laufen nach zehn Minuten aus; ihre Entfernung betrifft ausschließlich Admission-Tokens, niemals Fachdaten. Exporte besitzen zusätzlich ihr eigenes Fünf-Minuten-Limit. Freigabeversuche nach kurzem Datenbankengpass werden begrenzt wiederholt.

Die Herkunft/Identität wird weiter vor Fachzugriffen geprüft. Eine vorübergehend überlastete Sitzungsprüfung liefert 503 statt 401: Sie ist kein Sitzungswiderruf und darf keine erzwungene Abmeldung oder Eingabebereinigung auslösen. Wirklich ungültige Sitzungen bleiben gesperrt. Bereits vorhandene Zähler und spezifische Entwurfs-/Chat-/Meldungsgrenzen bleiben wirksam; keine Senkung gespeicherter Bestände auf einen neuen Grenzwert.

Next klont Proxy-Anfragekörper vor dem Handler. Nur die explizit dokumentierten Uploadwege sind deshalb vom Proxy-Matcher ausgenommen und werden direkt durch `withRouteAccess` samt Sitzung, App-Recht, Ursprung, Admission und Körpergrenzen geschützt. Sonstige Proxy-Puffer sind auf 512 KiB begrenzt; die fachlichen JSON-Grenzen liegen darunter und weisen Übergröße ab. Das ist keine öffentliche Uploadfreigabe.

## Uploadablage und Wiederholung

Migration `pds-simulator/007_chunked_uploads.sql` ergänzt ausschließlich neue Spalten/Tabellen. Bestehende BLOB-Dateien bleiben unverändert lesbar. Neue HTTP-Uploads werden in 256-KiB-Blöcken in derselben SQLite/WAL-Ablage geschrieben; kein vollständiger 100-MiB-Eingangspuffer und keine zusätzliche ungesicherte Dateiablage. Prüfsumme wird während des Lesens berechnet. Quoten zählen akzeptierte Dateien und laufende Transferblöcke; Blöcke werden transaktional geprüft und geschrieben. Erst nach vollständigem Lesen/Prüfen wird die akzeptierte Uploadkennung veröffentlicht.

Bei Unterbrechung, Zeitüberschreitung, Überschreitung oder vollem Speicher werden ausschließlich die zu dieser fehlgeschlagenen Anfrage gehörenden Zwischenblöcke entfernt. SQLite kann einen erschöpften Schreibvorgang selbst zurückrollen; die Fehlerbehandlung erhält den ursprünglichen Fehler. Erkannte volle Ablage liefert 507, Übergröße 413, erkennbarer ausführbarer Binärinhalt 415. Akzeptierte Uploads, fremde Transfers und zu offenen Entwürfen gehörende Dateien bleiben erhalten.

Eine bereits bestätigte Uploadkennung kann mit gleichem Besitzer, Namen und Inhalt auch bei nachträglich voller Quote erneut bestätigt werden, ohne ein zweites Dokument zu speichern. Andere Inhalte unter derselben Kennung werden abgewiesen. Der CaseDesk verwendet beim Knopf „Upload erneut versuchen“ dieselbe Kennung und dieselbe gehaltene Datei. Eine bisher bestätigte Datei bleibt bei fehlgeschlagenem Ersatz erhalten; die neue Auswahl muss erfolgreich übertragen werden oder ausdrücklich das bisherige Dokument gewählt werden. Weitere Formulareingaben werden nicht zurückgesetzt.

Keine automatische Altersbereinigung unfertiger Transfers nach einem Prozessabbruch: Unklare Restbestände zählen weiter zur Quote und erfordern fachliche Prüfung. Eine Quote ist kein Löschauftrag. Nach einem kompletten Browserverlust kann eine nicht bestätigte lokale Datei nicht aus einem unvollständigen Upload rekonstruiert werden. Zu Eingabesicherungen siehe [Datenlebenszyklus](data-lifecycle.md).

Bei späterer Auftrags-/PDS-Verarbeitung können vollständige, weiterhin auf 100 MiB begrenzte Dokumentpuffer nötig sein; diese Vorgänge unterliegen der kleinen Parallelitätsgrenze. Es wird kein vollständiger Ende-zu-Ende-Nullkopie-Versand behauptet. Persönlicher Export liest neue Uploadblöcke begrenzt; SQLite-Online-Sicherung erfasst sie automatisch mit. Keine bestehenden Dateien werden dafür konvertiert.

## Inhaltsprüfung

Dateinamen/Größe, Prüfsumme und bekannte ausführbare Binärsignaturen werden geprüft. Dateien werden weder serverseitig ausgeführt noch inline im Browser angezeigt; Downloads bleiben Binäranhänge mit `nosniff`/Sandbox. Das ist **kein Viren-/Makro-/Archivscanner**. PDF, MSG, EML und sonstige Dokumente bleiben opake Anhänge. Eine echte Dateityp-/Schadsoftware- und Quarantänefreigabe für Echtdaten muss separat erfolgen; der bestehende Umfang bleibt lokale Fiktion. Keine neue externe Scannerübertragung, keine stillen Änderungen der Integrationsfreigaben.

## Lastprofil und Messung

Vom Benutzer gewählt: **größeres Team, 16 gleichzeitige normale Anfragen und 64 Spitzenanfragen**. Vor der Messung gesetzte Grenzen in `tests/resource-load.mjs`: normale p95 < 1.000 ms, Spitze p95 < 3.000 ms; Überlastantworten dürfen 429/503 sein. Alle 16 anschließenden Erholungsanfragen müssen gelingen. Konservativer summierter RSS von Prüfserverprozessen < 1,5 GiB, separater Uploadprozess < 192 MiB. Kein Verändern der Grenzwerte anhand des Ergebnisses.

Prüfablauf in der registrierten isolierten Plattformprüfung:

- Frische eigene Datenbank, neue fiktive Konten/Sitzungen, eigene Ports/SQLite-Ablage und Quellkopie, keine Entwicklungsdateien/-Zugangsdaten übernommen.
- Aufwärmen, 64 normale Anfragen in Gruppen zu 16, danach 64 parallele Spitzenanfragen und 16 Erholungsanfragen. Status/Latenz und Antwortgröße kontrollieren. Vorher gesicherter verschlüsselter Entwurf danach bytegleich und entschlüsselbar.
- RSS der eigenen Node-Prüfserverprozesse alle 50 ms abtasten und konservativ summieren. Separater frischer Prozess speichert 64 MiB stückweise, misst RSS und entfernt seinen eigenen Testbestand.
- 100.000 fiktive Protokollzeilen mit unterschiedlich häufigen Akteuren; selektive Cursorabfrage und tatsächlichen Plan prüfen. Neue Indizes für Akteur, Aktion und Zeitpunkt. Datumsfilter verwenden indexierbare Zeitgrenzen statt Spaltenumwandlung; deutsche Tagesgrenzen bleiben erhalten. Freitextsuche bleibt durch das SQL-Zeitbudget begrenzt, keine Behauptung eines Volltextindex für JSON-Felder.
- Parallelitäts-/Minutenbudgets, andere Konten trotz erschöpftem Nutzerbudget, echte `pg_sleep`-Zeitüberschreitung und gesperrte Zeile, begrenzte Poolwarteschlange sowie Erholung prüfen.
- Langsame/abgebrochene Körper, Quotenüberschreitung, freie-Speicher-Verweigerung und SQLite-Seitenlimit zur Simulation von `SQLITE_FULL`; gespeicherte Altdaten danach unverändert lesbar.

Messergebnisse und vollständiger Prüflauf stehen unmittelbar im Auditbericht A06 (Prüfnachweis in der Git-Historie). Die Lastprüfung ist im isolierten Plattformlauf von `npm run verify` registriert. Messwerte enthalten keine Tokens oder Benutzerkennungen.

## Betrieb und Grenzen

Neue Poolvorgaben werden beim regulären Start einer Server-/Workerinstanz wirksam. Bereits laufende Pools werden nicht während aktiver Schreibvorgänge ausgetauscht; für die vollständige Aktivierung ist ein regulärer Neustart nötig. Migration 036 fügt Budgettabellen und Indizes hinzu, keine Datenbereinigung. Allgemeine Datenbankdateigröße, Langzeitwachstum anderer Fachhistorien, Laufzeit von rein lokalem synchronem Code und die Kapazität externer Anbieter sind damit nicht vollständig kontrolliert. Admission schützt API-Arbeit; die Anmeldung behält ihre getrennten Schutzgrenzen.

Die Entwicklungsservermessung ist kein Produktionsbenchmark, kein Dauer-/Mehrmaschinenversuch und keine Zusicherung für unbekannte Rechner oder reale PDS-/Microsoft-Latenzen. Erschöpfter physischer Datenträger wird über kontrollierte SQLite- und Freispeichersimulation geprüft, nicht durch Füllen des Macs. Alarmierung/Aufräumzuständigkeit und langfristige Kapazitätsplanung bleiben A07/Betreiberaufgaben. Bei dauerhaft voller Quote keine pauschale Löschung von Uploads oder Entwürfen durchführen.

### Service-Kostenträgersuche

Die Service-Leseteile `cost-catalog` und `cost-objects` verwenden weiterhin die gemeinsame/kontobezogene Aufnahme von `/api/service`. Die Suche startet erst bei aktiver Eingabe, liest höchstens zwölf Objekte pro Anfrage und maximal drei Vertragslisten gleichzeitig. Ein kompletter neuer Suchlauf ersetzt keine normale Übersicht und blockiert keine Eingabe. Zusätzlich begrenzt: 20 Sekunden je serverseitiger Suchanfrage, 25 Sekunden im Browser; bestehendes Upstream-Aufrufbudget; 8 MiB projizierter Katalog; maximal 1.000 Verträge/1 MiB Vertragsantwort und 8 KiB Suchtext pro Objekt; vier Millionen Suchtextzeichen pro Browseransicht. Bei Quell-, Rechte- oder Budgetfehlern ausdrücklicher Hinweis auf unvollständige Suchergebnisse statt stiller Teil-/Nulltreffer oder View-Fallback. Keine bestehende Datei, Datenbankzeile oder offene Eingabe wird zur Quotenbehandlung entfernt. Tatsächliche isolierte Suchprüfungen: `src/apps/servicehub/akten/tests/service-workspace.test.mjs`, Browserfall E16 und den Prüfnachweis in der Git-Historie.

### Service-Wartungsübersicht

`GET /api/service?part=maintenance` benötigt die bestehende Service-Leseberechtigung und gemeinsame/kontobezogene Aufnahme. Ein Objekt pro Anfrage, höchstens acht Intervall-Details pro Seite und drei parallele GET-Abrufe, gebundener Quellenstand und Indexcursor. Vertragssuche auf 1.000 Verträge/1 MiB je Objekt begrenzt; höchstens 5.000 Intervallreferenzen, 16 KiB je projizierter Wartung, 20.000 Wartungen/vier Millionen Zeichen je Browseransicht. Server-Timeout 20 Sekunden, Browser 25 Sekunden, bestehendes Upstream-Budget zusätzlich wirksam. Seitenfehler stoppen mit sichtbarem Hinweis auf unvollständige Daten; keine leere Erfolgsmeldung, kein View-Fallback und keine Löschung. Nur der geöffnete Reiter lädt. Abbruch beim Verlassen; erneute Hintergrundaktualisierung 60 Sekunden nach Abschluss. Es gibt keinen Wartungs-Schreibweg oder Generierungsworker; die Auftragsvorschau schreibt nichts. Prüfungen: `src/apps/servicehub/akten/tests/service-maintenance.test.mjs`, Browserfall E17.

### Einsatzmappe

Metadaten und Auswahl nutzen die normalen Service-Aufnahmebudgets; der explizite PDS-Download ist ein schwerer Zugriff. Je PDS-Dokumentliste maximal 500 Metadaten/1 MiB; binärer Transfer maximal 100 MiB. SharePoint zeigt maximal 100 Dateien je zugeordnetem Ordner. Je Auftrag maximal 100 ausgewählte und 500 verwaltete Referenzen, keine Alterslöschung. Kontextauflösung: zwölf direkte Objektzuordnungen, maximal acht Hierarchieebenen/24 Objekte/20 Verträge. Quellenteilbereiche laden unabhängig; Akteneingaben werden dadurch nicht ersetzt.

### Terminbestätigungen

Der Service-Schreibweg nutzt bestehende Aufnahme-/Parallelitätsbudgets. Anfrage-JSON auf 8 KiB begrenzt, Betreff 200/Nachricht 4.000 Zeichen, einzelner Empfänger maximal 254 Zeichen. PDS-Vorbereitung maximal 20 Sekunden, Browser 25 Sekunden; bestehende paginierte Mitarbeiterbudgets gelten zusätzlich. Je Objekt maximal acht Elternschritte; Kundendetail maximal 1 MiB und 100 Einträge je Kontaktliste/100 E-Mail-Vorschläge. Neue Graph-Bestätigungen maximal 20 je Benutzer und Stunde/200 insgesamt. Identische Wiederholungen verbrauchen keinen neuen Quotenplatz. Die Warteschlange und Nachweise werden bei Überlast nicht gelöscht. Konkurrierende Einreihungen serialisieren innerhalb der dedizierten Transaktionssperre; Fach- und Mail-Einstellungsrechte werden dabei erneut geprüft.

### Anlagenchronik

Rein lesender Service-Zugriff mit bestehenden Aufnahme-/Parallelitätsbudgets. Jede Anfrage prüft technische Einheit und gebundene Quelle; 20 Sekunden Upstream-/25 Sekunden Browserzeit. Einsätze über vorhandene begrenzte PDS-Paginierung lesen, maximal 500 je Einheit. Wartungen acht Details pro Seite (bestehende Dreierparallelität), maximal 256 Einträge in der Chronik. Dokumentquellen auf maximal vier bestätigte Aufträge je Anfrage, 100 Aufträge/1.000 PDS-Unterlagen beziehungsweise 1 MiB projizierte PDS-Unterlagen je Ansicht begrenzen. SharePoint höchstens 100 Dateien. Vordergrunddarstellung jeweils 80 Einträge, manuell erweiterbar; laufende Aktualisierung serialisiert und beim Verlassen abgebrochen. Keine Dokumentbytes für die Chronik abrufen. Überschreitungen als unvollständige Ansicht anzeigen, keine Bestände löschen und keine externen Freigaben ändern.

### Material- und Leistungsliste

Vorhandener geschützter Einsatzmappen-GET/Service-Lesepfad, keine neue Schreibquote. Rohantworten unterliegen dem bestehenden PDS-Übertragungsbudget; serverseitige Whitelist-Projektion maximal 100 Einsatzgruppen, 1.000 Positionen/1 MiB, acht Unterebenen. Je Feld begrenzen: Name 400, Kurztext 2.000, Langtext 16.000, Zusatztext 8.000, Kennnummern 160 Zeichen. Keine Preis-/Kalkulationsdaten an den Browser übertragen. Jeweils 80 Zeilen rendern und manuell erweitern. Alle 30 Sekunden/Fokus/Online seriell aktualisieren, beim Schließen/Verlassen abbrechen. Ausfälle erhalten den ausdrücklich als zuletzt geladen markierten Stand; Quotenüberschreitungen oder unprüfbare Gruppen niemals als bestätigte leere Liste ausgeben. Keine Dokumentbytes oder neuen Ablagekopien.

Rücklaufkontrolle: Ein bekannter Rücklauf pro Anfrage, 25 Sekunden Gesamtbudget der bestehenden Einsatzmappenroute. Höchstens 100 Ebenen, 1.000 Positionen, acht Unterpositionsebenen und 2 MiB projizierte Rücklaufantwort. Dokumente aus höchstens zwölf zugeordneten Ebenen plus eindeutig auftragsgebundenen Grunddaten; pro Liste 500 Einträge/1 MiB. Budget-/Teilfehler sichtbar, keine automatische Abschlussbuchung. Dokumentdownload erneut zuordnungsgeprüft, bestehendes 100-MiB-Übertragungsbudget. Keine Datensätze, Entwürfe oder bestätigten Dateien werden bei Grenzverletzung entfernt.

Automatische Rücklaufzuordnung: expliziter Ansichtsvertrag mit zwei Kennungsfeldern, Metadaten 2.000 Einträge/1 MiB, Datenseiten 500 Zeilen, höchstens 20.000 Zeilen/8 MiB und 41 Seiten inklusive leerem Abschluss. Pro Auftrag höchstens 20 native Kandidaten/8 MiB Antwortdaten; vorhandenes 25-Sekunden-Gesamtbudget gilt auch hier. Dokumente werden erst für den geöffneten Rücklauf gelesen. Grenzverletzung ist ein sichtbarer Fehler, keine leere erfolgreiche Zuordnung; offene Daten/Entwürfe werden nicht verändert.
