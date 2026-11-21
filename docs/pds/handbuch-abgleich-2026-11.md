# PDS-Handbücher November 2026: Abgleich mit den offenen Punkten

Stand: 19.11.2026. Reine Dokumentationsprüfung, keine Codeänderung.

## Quellen

| Quelle | Umfang | Bemerkung |
| --- | --- | --- |
| `Datenquellen/PDS/openapi.yaml` (Version 1.0) | 193 Operationen | **Byte-identisch** mit dem bisherigen Vertrag: SHA-256 `6395b0f6…77df` wie in `src/platform/pds/api/contract.json`. Kein Anpassungsbedarf. |
| Anwenderdokumentation v9 (06.11.2026) | 3632 Seiten | Ersetzt als Quelle die bisher zitierten Einzelhandbücher (Haupthandbuch v126, Administration v375, Ressourcenplanung v69). Seitenzahlen unten beziehen sich auf diese Ausgabe. |
| Releasedokumentation v7 (November 2026) | 555 Seiten | Releases 4.0 (Juli 2024) bis 4.6.2. |
| Kompaktwissen v4 (06.11.2026) | 36 Seiten | Überblick, für diesen Abgleich nicht ausgewertet. |

Die Handbücher beschreiben die PDS-Oberfläche. Sie beantworten fachliche Regeln, aber **nicht**, wie sich die REST-API verhält (Idempotenz, Transaktionen, automatische Folgeaktionen eines Endpunkts). Diese Fragen bleiben offen und müssen mit PDS geklärt werden.

## Geklärt oder präzisiert

### Status eines Serviceauftrags aus seinen Störungen

Anwenderdokumentation S. 1431: Der Status eines Serviceauftrags ergibt sich aus der Störung mit dem **niedrigsten** Status. Rangfolge von niedrig nach hoch:

teilerledigt → Mobil storniert → Manuell storniert → offen → Ausgegeben Mobil → Mobil abgeholt → Ausgegeben → Erledigt

„Teilerledigt“ kann pro Störung manuell gesetzt werden. „Material ausstehend“ (Screenshot) kommt im Handbuch nicht vor und ist damit als kundenspezifischer Status einzuordnen.

### Mobile Ausgabe, Auftragspool und Storno der Ausgabe

- S. 1430: Mehrere Monteure können einer Störung zugeordnet werden, aber **nur ein Monteur** erhält den Auftrag mobil (Haken „Mobil“).
- S. 1436: Mobile Ausgabe setzt einen zugeordneten Monteur voraus. Status wechselt auf „Ausgegeben Mobil“, nach Abholung durch das Gerät automatisch auf „Mobil abgeholt“.
- S. 1437: Bei „Ausgegeben Mobil“ ist der Auftrag noch änderbar. Bei **„Mobil abgeholt“ sind nur noch Datum und Uhrzeit änderbar**. Aufträge oder Störungen im Pool haben den Status „Auftragspool“; die Übernahme durch einen Monteur setzt „Mobil abgeholt“.
- S. 1437: Beim **Stornieren der Ausgabe** wählt man zwischen „manuell stornieren“ und „aus dem Auftragspool entfernen“. **„Mobil abgeholt“ verhindert diese Stornierung.**

**Auswirkung auf HeyElli:** Die Stornoregel „Mobil abgeholt → Manuell storniert“ (`integration-matrix.md`, Abschnitt Service-Stornostatus; `src/app/api/ressourcenkalender/stornieren/route.ts`) steht im Widerspruch zu S. 1437, sofern „Manuell storniert“ dort die Storno-Variante der Ausgabe meint. Die Rangfolge oben (beide Stornozustände direkt unter „offen“) spricht dafür. Vor einer echten Anbindung zwingend mit PDS klären (offene Frage „Mobilität & Storno“ in `src/system/einstellungen/pds-guide.ts`). Ebenso offen: ob HeyElli nach „Mobil abgeholt“ Techniker, Texte oder Begleiter über `/service/updatestoerung` ändern darf; die Oberfläche von PDS erlaubt dann nur noch Datum und Uhrzeit.

### Statusfarben und Farbreihenfolge

- S. 2188: Statusfarben gibt es je Vorgangsart für **19 Vorgangsarten**: Angebot, Preisanfrage, Bedarfsmeldung, Bestellung, Wareneingang, Rücklieferung, Serviceauftrag/Störung, Rechnung, Rücklauf, Auftrag, Gutschrift, Aufmaß, Lieferschein, Eingangsrechnung, Rücknahme, Auftragsbestätigung, Abrufauftrag, Wartungsauftrag, Wartungsangebot.
- Damit sind die „sieben fehlenden Vorgangsarten“ aus `status-catalogs.md` benannt: **Preisanfrage, Rücklieferung, Aufmaß, Eingangsrechnung, Auftragsbestätigung, Wartungsauftrag, Wartungsangebot**. Sie haben in PDS Statusfarben, aber `/vorgang/liststatus` (Enum `PdsAPIVorgangsStatusSucheRESTModel`) bietet sie nicht an.
- S. 2089/2189: Die Farbreihenfolge ist in PDS **konfigurierbar**: Hauptfarbe (z. B. Status), erste Nebenfarbe (z. B. Kategorie), zweite Nebenfarbe (z. B. Termintyp). Die Nebenfarben werden **gleichzeitig** als Markierung in der oberen Ecke angezeigt. HeyElli bildet dagegen eine feste Fallback-Kette (Status → Kategorie → Termin-Konfiguration). Das ist eine bewusste Vereinfachung, keine Abbildung der PDS-Darstellung.
- Ein Farbwert ist weiterhin in keinem API-DTO enthalten. Seit Release 4.6 lassen sich lesende Datenansichten in PDS selbst anlegen (siehe unten); damit ist eine freigegebene Farb-Datenansicht technisch möglich.

### Datenansichten (Release 4.6)

Releasedokumentation S. 16–19, „Individuelle Datenansichten“:

- Angelegt unter *Einstellungen → Firmeneinstellungen → Administration → Individuelle Datenansichten*. Typen: **Tabelle** (live), **View** (SQL, live, nur für kleine Abfragen), **Materialized View** (SQL, zwischengespeichert, **nächtliche Aktualisierung**).
- Nur aktive Datenansichten sind über die API erreichbar. Abfrage-Timeout höchstens **300 Sekunden**.
- Berechtigung je Benutzer/Team. Für den API-Abruf muss derselbe Benutzer einem pds-API-Key mit dem relevanten Mandanten zugeordnet sein.
- Tabellenpräfixe: `b_` pds Branche, `k_` Finanz-/Personalwesen (progdb), `ks_` Finanz-/Personalwesen (sysdb).
- Empfehlung von PDS: auf einem Testsystem erstellen, per Export/Import ins Produktivsystem übernehmen.
- Abruf über `/datenansichten/list` und `/datenansichten/listdaten`. Die Releasedokumentation schreibt an einer Stelle `datenansicht/listdaten`; maßgeblich ist die OpenAPI (`/datenansichten/listdaten`), so wie HeyElli es verwendet.

**Auswirkung auf HeyElli:** Bei einer Materialized View sind Daten bis zu einem Tag alt. Für Farben und Arbeitszeitmodelle ist das unkritisch, für Urlaub/Abwesenheiten oder Status nicht. Pro benötigter Datenansicht deshalb den Typ festlegen und dokumentieren.

### Feiertage und Feiertagsgruppen

Anwenderdokumentation S. 225–227:

- Feiertage sind **mandantenbezogen**; es gibt „halbe Feiertage“ (Spalte „Halber Tag“).
- Mitarbeiter können einer **Feiertagsgruppe** zugeordnet werden, optional mit Gültigkeitszeitraum (GÜLTIG VON/BIS). Deren Feiertage haben **Vorrang** vor denen des Mandanten, und zwar für Urlaubsworkflow, Regelwerk Stundenerfassung und Zeitbuchungen, Zeitkontoregeln, Arbeitszeiten sowie die Störungsebene im Serviceauftrag.
- In der Ressourcen- und Projektplanung werden **weiterhin die Feiertage des Mandanten** angezeigt.
- Bei mandantenübergreifend gepoolten Mitarbeitern werden auch die Feiertagsgruppen gepoolt.

Die offene Frage nach vollständigen historischen Feiertagsvorkommen (API liefert nur `naechstesDatum`) bleibt bestehen.

### Arbeitszeitmodelle

S. 289–290 und S. 557: Arbeitszeitmodelle werden unter *Firmeneinstellungen → Firma → Stundenerfassung → Arbeitszeiten* mit Bezeichnung, Gültigkeit und Wochenarbeitszeit angelegt und im Mitarbeiter mit Gültigkeitszeitraum zugeordnet. Tagesfenster, Pausenregeln und Rundung sind im Handbuch nicht so beschrieben, dass sie sich ohne PDS bestätigen ließen. Weiterhin offen.

### „An Arbeitszeit anpassen“

S. 3551–3552 definiert die beiden Varianten, die `calendar-feature-audit.md` als offen führt:

- **An Arbeitszeit anpassen und Dauer beibehalten:** Die ursprüngliche Dauer wird über die Arbeitszeiten verteilt.
- **An Arbeitszeit anpassen bis Terminende:** Das Terminende bleibt, die Dauer wird um die Zeiten außerhalb der Arbeitszeit gekürzt. Beispiel: 48 h von Montag 10 Uhr bis Mittwoch 10 Uhr bei Arbeitszeit 8–16 Uhr ergibt 6 h + 8 h + 2 h = 16 h.
- Beim Ziehen über mehrere Tage gibt es zusätzlich: **über die tägliche Arbeitszeit hinaus verplanen**.
- S. 3551: **Serviceaufträge werden bei Überschreitung der Arbeitszeit nicht automatisch aufgeteilt.**

**Auswirkung auf HeyElli:** „Auf Arbeitstage verteilen“ entspricht der ersten Variante, „Zusammenhängend speichern“ der dritten. Die zweite Variante (Dauer kürzen, Ende behalten) gibt es in HeyElli nicht. Die Fortsetzungen für Serviceeinsätze (`calendar-continuations.md`) sind eine HeyElli-Erweiterung ohne Gegenstück in PDS. Das stützt die offene Frage, welcher Endpunkt einen weiteren nativen Termin an derselben Serviceauftragsebene anlegt. „Dauer lt. Mitarbeiter“ kommt im Handbuch nicht vor und bleibt offen.

### Serientermine

S. 3549–3550 und S. 3565:

- Serien gibt es für freie Termine, Vorgänge, Projektakten und Tätigkeiten. **Serviceaufträge und Störungen können nicht Teil einer Serie sein.**
- Muster täglich, wöchentlich, monatlich, jährlich; Ende nach Datum oder Anzahl; höchstens **500 Termine** je Serie.
- Einzeln geänderte Termine werden zur **Ausnahme**. Wird danach die Serie bearbeitet, wird die Ausnahme gelöscht und der Termin wieder der Serie zugeordnet.
- Exchange erhält Serien als Einzeltermine; Serieninformationen werden nicht zurück synchronisiert. Die Ressourcenplanung ist führend.

Ein Serien-Endpunkt ist in der OpenAPI weiterhin nicht dokumentiert.

### PIM-Synchronisation und Microsoft Graph

- Anwenderdokumentation S. 1962–1966 und S. 2085 ff.: „PIM-Konfiguration“ ist die Exchange-Kalendersynchronisation von PDS. Das Flag `pimSynchronisation` an Terminen steuert also die Synchronisation **durch PDS**, nicht durch HeyElli.
- Releasedokumentation S. 61 ff. (Release 4.6.2): PDS synchronisiert Kalender, Aufgaben und Kontakte jetzt über **Microsoft Graph** mit einer **eigenen** App-Registrierung in Entra. Sie ist unabhängig von der Graph-Anbindung von HeyElli (Mailversand, SharePoint). Beide Registrierungen getrennt halten; HeyElli schreibt keine Kalendereinträge nach Exchange.
- S. 3563/3565: Manuell in Exchange angelegte Termine erscheinen in PDS als freie Termine; als privat markierte Termine zeigen in PDS nur die Zeit („Privat“) und sind dort **nicht veränderbar**.

### Projektleiter / Bauleiter

Anwenderdokumentation S. 216: Die Bezeichnung „Bauleiter“ ist ein PDS-Begriff, den Kunden umbenennen können (Beispiel im Handbuch: „Projektleiter“). Das bestätigt die Annahme in `integration-matrix.md`. Ein Schreibfeld in `/service/create` oder `/service/update` belegt das Handbuch nicht; die Frage an PDS bleibt offen. Seit Release 4.4 (Releasedokumentation S. 169): Dashboard-Filter „Bauleiter (eigener)“.

### Tätigkeiten (Release 4.5)

Releasedokumentation S. 139–140: Tätigkeiten lassen sich direkt aus dem Auftrag verplanen (Planzeitraum und Ressource erforderlich, Anzeige von Terminüberschneidungen). Beim Anlegen einer Tätigkeit kann automatisch ein Termin in Outlook, Exchange oder der Ressourcenplanung entstehen. Ein Detail- oder Schreibvertrag für Tätigkeiten ist in der OpenAPI weiterhin nicht dokumentiert.

## Weiterhin offen (nur durch PDS zu klären)

- Verhalten der Endpunkte: automatische Terminanlage durch `/service/createstoerung`, Sichtbarkeit von `/service/updatestoerung` am Termin, Idempotenz von `/termin/create`, zulässige Typen für `/termin/delete`, Bearbeitbarkeit von `bezeichnung`/`text` bei `SERVICEAUFTRAGEBENE`.
- Schreibfeld für Bauleiter/Projektleiter und Bearbeiter bestehender Belege.
- Ob `/service/updatestatus` „Manuell storniert“ bei „Mobil abgeholt“ annimmt (siehe Widerspruch oben) und welche Änderungen nach „Mobil abgeholt“ zulässig sind.
- Statuskatalog-API für die sieben oben genannten Vorgangsarten.
- Farbwerte per API oder freigegebene Datenansicht; Serien-Endpunkt; Arbeitszeit-Tagesfenster, Pausen, Rundung, historische Feiertage; „Dauer lt. Mitarbeiter“.
