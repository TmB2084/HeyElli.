# Arbeitszeitmodelle und Restkapazität

Stand: 04.11.2026. Implementiert und geprüft im lokalen Simulator. Kein echtes PDS angeschlossen.

## Befund aus der bereitgestellten Dokumentation

- `PdsAPIMitarbeiterDetailsRESTModel` enthält `ressourcenplanzeit` als `PdsAPIZeitraumRESTModel` (grundsätzlicher Planungszeitraum). Wochenarbeitszeit, tägliche Sollstunden, Uhrzeitfenster, Pausen und die Feiertagsgruppen-Zuordnung des Mitarbeiters fehlen. In der bereitgestellten OpenAPI-Datei ist kein Arbeitszeitmodell-Leseendpunkt dokumentiert.
- Das Ressourcenplanungshandbuch, Version 69, Seiten 8–9, beschreibt Arbeitszeiten aus den allgemeinen Lohndaten. Seite 24 unterscheidet ausdrücklich Tagesstunden für die Kapazität von Von-/Bis-Zeiten für die Darstellung. Seite 23 beschreibt Restzeiten und rote Minus-Planzeiten bei Überplanung. Die Implementierung hält daher Sollminuten und Darstellungsfenster getrennt.
- Das Administrationshandbuch, Version 375, Kapitel 1.28, Seiten 68–72, beschreibt individuelle lesende Datenansichten und deren API-Abruf. Es bestätigt keine konkrete SQL-Tabelle für Arbeitszeitmodelle.
- Feiertage und Gruppen sind dokumentiert: `GET /administration/listfeiertage`, `PdsAPIFeiertagRESTModel` (`uuid`, `bezeichnung`, `aktiv`, `naechstesDatum`, `halberTag`) und `GET /administration/listfeiertagsgruppen`, `PdsAPIFeiertagsGruppeRESTModel` (`uuid`, `aktiveFeiertage`). Diese Daten werden aus der API gelesen.

Die Quellen liegen unter `../Datenquellen/PDS/` in den bereitgestellten Ressourcenplanungs-/Administrations-PDFs sowie `openapi.yaml`; Vertrags-Snapshot: `src/platform/pds/api/contract.json`.

## Lesender View-Vertrag für die Feldlücke

Adapteroption `workingTimeView`. Im Simulator: `sim_calendar_working_times`. Der Name und die folgenden Spalten sind ein individueller Integrationsentwurf und keine behaupteten PDS-Datenbanknamen:

| Spalte | Inhalt |
| --- | --- |
| `mitarbeiterUUID` | UUID aus der Mitarbeiter-API |
| `modellUUID`, `modellBezeichnung` | Stabile Modellidentität, lesbarer Name |
| `gueltigVon`, `gueltigBis` | Inklusive ISO-Datumsgrenzen der Modellzuweisung |
| `wochentag` | ISO-Wochentag 1–7 |
| `sollMinuten` | Eigenständige tägliche Sollzeit, je Tagesmodell in allen Intervallzeilen identisch |
| `beginn`, `ende` | Ein Netto-Arbeitszeitfenster HH:mm; Ende darf 24:00 sein. Pausen werden durch getrennte Fenster abgebildet. |
| `feiertagsgruppeUUID` | Fehlende Zuordnung zur Feiertagsgruppen-API |

Ein Wochentag ohne Arbeit muss ausdrücklich eine Zeile mit leerem Beginn/Ende und Sollzeit 0 besitzen. Fehlende Tage sind unbekannt und werden nicht als arbeitsfrei interpretiert. Fenster dürfen sich nicht überschneiden, Modellzuweisungen dürfen für denselben Tag nicht widersprüchlich sein. Nachtschichten müssen an der Tagesgrenze aufgeteilt werden. Ein Modell kann mehrere Gültigkeitsperioden besitzen.

Abruf ausschließlich über `GET /datenansichten/list` und paginiert `POST /datenansichten/listdaten` mit `name`, `page`, `entriesPerPage=500`. Die View liefert im vereinbarten Simulatorformat ein JSON-Zeilenarray. Keine direkte Datenbankverbindung, keine View-Schreibvorgänge. Fehlende konfigurierte View, falsche Werte, fehlende referenzierte Feiertagsgruppen/Feiertage sowie API-Fehler führen zu einem Fehler, nicht zu erfundenen Arbeitszeiten. Ohne konfigurierte View bleibt die Kapazität unbekannt.

## Darstellung und Berechnung in HeyElli

- Die feste Orientierung 07–17 Uhr wurde entfernt. Je Ressource erscheinen die konkreten Netto-Arbeitszeitfenster hell; Pausen und Zeiten außerhalb der Fenster bleiben dunkel. Feiertage und Tage außerhalb der API-Ressourcenplanzeit schließen die Fenster.
- Feiertage werden nur anhand ihres exakt gelieferten `naechstesDatum` angewendet, nicht durch jährliches Wiederholen geraten. Volle Feiertage schließen den Tag. Bei halben Tagen verwendet der Simulator zunächst 12:00 als Trennung zwischen Vormittag/Nachmittag. Die Sollzeit wird bei teilweisem Wegfall proportional zur verbleibenden Netto-Fensterdauer reduziert.
- **Rest = Soll − bestätigte Abwesenheit − belegte Zeit.** Soll kommt ausdrücklich aus `sollMinuten`, nicht aus der Fensterlänge. Die Anzeige ist die Restkapazität des gewählten gesamten Zeitraums, nicht nur die ab jetzt verbleibende Zeit.
- Geplante (`GEPLANT`) Abwesenheiten und private Abwesenheiten sowie genehmigter Urlaub blockieren den überlappenden Anteil der Arbeitszeit. Dieser Anteil wird auf die Tages-Sollzeit bezogen. Überlappende Abwesenheiten werden vereinigt, damit sie die Sollzeit nicht doppelt vermindern.
- Geplante reguläre Termine reduzieren die Kapazität mit ihrer Dauer innerhalb des sichtbaren Datumsbereichs abzüglich der Modellpausen. Auch Zeiten außerhalb der Arbeitszeit und parallele Termine zählen jeweils: Überplanung wird dadurch negativ und rot dargestellt. Rest ist eine rechnerische Stundenbilanz und keine Zusage konfliktfreier einzelner Zeitfenster.
- Beantragter Urlaub, freie (`FREI`) und vorgemerkte (`VORGEMERKT`) Termine reservieren zunächst keine Kapazität. Diese fachlichen Regeln sind HeyElli-Simulatorregeln; ihr Gleichlauf mit der konkreten PDS-Installation muss noch bestätigt werden. Kategorienamen werden nicht als Abwesenheit erraten.
- Ein unbekannter Urlaubsgenehmigungsstatus kann eine verlässliche Restbilanz verhindern; dann wird sie als unvollständig angezeigt. Fehlendes Arbeitszeitmodell oder fehlende Tage erzeugen ebenfalls keine scheinbar freie Kapazität.
- Termintextfilter und das Ausblenden vorgemerkter Termine verändern die Bilanz nicht. Der Ressourcenfilter begrenzt die angezeigte Gesamtsumme auf die gewählten Ressourcen. Haupt- und Begleittechniker werden jeweils als zugeordnete Ressource berücksichtigt.

## Nachtrag 19.11.2026 (Anwenderdokumentation v9)

S. 225–227: Feiertage sind mandantenbezogen, halbe Feiertage möglich. Eine Feiertagsgruppe am Mitarbeiter (optional mit Gültigkeit) hat Vorrang vor den Mandantenfeiertagen, unter anderem für Arbeitszeiten und die Störungsebene im Serviceauftrag; die Ressourcenplanung zeigt aber weiterhin die Mandantenfeiertage. S. 289–290, 557: Arbeitszeitmodelle mit Gültigkeit und Wochenarbeitszeit, Zuordnung im Mitarbeiter mit Gültigkeitszeitraum. Tagesfenster, Pausen und Rundung bleiben offen. Abgleich mit den PDS-Handbüchern vom November 2026: [handbuch-abgleich-2026-11.md](handbuch-abgleich-2026-11.md).

## Fiktive Beispiele und offene echte Zuordnung

JSON-Seeds: Service 38 h (Alex), Service 40 h (Kim), Teilzeit 21 h (Robin). Wochenenden explizit arbeitsfrei, unterschiedliche Tagesfenster und Pausen. Fiktiver Betriebsruhetag am 05.11.2026 in der Servicegruppe und ein fiktiver freier Nachmittag am 06.11.2026 in der Teilzeitgruppe; dies sind keine behaupteten gesetzlichen Feiertage. Keine DB-Strukturänderung. Seeds werden beim Lesen reproduzierbar bereitgestellt und überschreiben keine gespeicherten Terminänderungen.

Vor realer Anbindung mit PDS klären: genaue Tabellen/Relationen zu Mitarbeiter-UUID und Lohndaten, Arbeitszeitmodell-Versionen und Ausnahmen, Feiertagsgruppen-Zuordnung, vollständige historische/jährliche Feiertagsvorkommen (die API liefert nur `naechstesDatum`), Bedeutung der Halbtaggrenze und Sollzeitkürzung, bezahlte/unbezahlte Pausen, Rundungsregeln und Behandlung von Vorgemerkt/Frei/Abwesenheiten. Individuelle Arbeitszeit-Ausnahmen, Schichtrotationen und automatische Terminverteilung sind noch nicht implementiert. Ohne vollständige Feiertagsvorkommen kann eine reale langfristige/historische Berechnung nicht als vollständig gelten.

Die reale View muss die zulässigen Mandanten/Mitarbeiter begrenzen. Kein ausführbares SQL mit geratenen PDS-Tabellennamen angelegt. Ein künftig nachgewiesener fachlicher API-Endpunkt ersetzt vorrangig die entsprechende View-Spalte. Vor Echtnutzung sind das JSON-Format und die konkreten Rechte mit PDS zu prüfen.
