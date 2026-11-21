# Lokaler PDS-Simulator

## Quellen und Abgrenzung

Ausgewertet am 01.11.2026: die lokal freigegebenen PDS-Handbücher und CSV-Exporte unter `Developer/Datenquellen/PDS`. Die Originale werden nicht ins Repository kopiert. CSV-Dateien sind Windows-1252-kodiert und semikolongetrennt; für eine spätere Auswertung ist ein CSV-Parser mit Unterstützung für zitierte, mehrzeilige Felder erforderlich.

Herangezogene Handbuchstellen:

- Haupthandbuch v126, S. 1365–1369: Objekt-/Anlagenstruktur, untergeordnete Anlagen und Bauteile, Fachbereich und Typ.
- Haupthandbuch v126, S. 1421–1424: Serviceauftrag, Ansprechpartner, Empfängerbezug, fortlaufende Nummer und Hinweise auf bereits vorhandene Aufträge.
- Ressourcenplanung v69, S. 5–10: Mitarbeiter als Ressourcen, Gruppen, Planungszeiträume und Arbeitszeiten.

Die ursprünglichen Handbücher beschreiben Fachlichkeit und Bedienung. Seit 02.11.2026 liegt zusätzlich `openapi.yaml` vor. Der daraus abgeleitete technische Vertrag und der aktuelle API-/View-Stand stehen verbindlich in [pds/integration-matrix.md](pds/integration-matrix.md). `/api/pds-simulator` bleibt das Plattform-Backend; seine Stammdatensuchen verwenden nun dokumentierte PDS-DTOs. Die Schreibwege sind noch nicht vollständig als PDS-HTTP-Workflow ausgeführt.

## Feldzuordnung

| Export | Quellfelder | Simulationsmodell |
| --- | --- | --- |
| Objekte | Objekt, Kundennummer, Straße, Postleitzahl, Ort | Objekt mit eigenständiger synthetischer ID, Nummer und Adresse |
| Objekte | Techn. Einheit, Gewerk, Hersteller, Typ, Standort Zentrale | Technische Einheit mit explizitem Objektbezug |
| HR | Personalnummer, Vorname, Nachname, Abteilung, Fachbereich | Mitarbeiter und Suchbezeichnung |
| Serviceaufträge | Belegnummer, Status, Bezeichnung, Objekt/Technische Einheit | Bestehender Serviceauftrag mit Objekt-/Einheitenbezug |
| Serviceaufträge | Monteur, Plandatum von, Uhrzeit von, Externe Nummer | Modellfelder für Techniker, Planbeginn und externe Referenz |

Alle Inhalte sind neu erfunden, einschließlich IDs, Namen, Adressen, Nummern und Auftragsbeschreibungen. Die Daten wurden nicht durch Umbenennen einzelner Produktionspersonen erzeugt. Originalzeilen, Bemerkungen und Kontaktdaten sind weder enthalten noch zur Laufzeit erforderlich. Die künstliche Planbarkeit ist explizit gesetzt: Aus einem HR-Eintrag oder einer Lizenzierung darf keine tatsächliche Ressourcenverfügbarkeit abgeleitet werden. Arbeitszeiten, Abwesenheiten, Gruppen und Hierarchien über die erste Anlagenebene hinaus sind noch nicht simuliert.

## Betrieb und Schnittstelle

Der Simulator läuft als eigenes Fachmodul im Next.js-Server mit `npm run dev`. Er benötigt keine weitere Datenbank, keine zusätzlichen Pakete und keine Zugangsdaten. Stammdaten liegen als schreibgeschützte synthetische Fixtures vor. Neue Aufträge liegen getrennt in der lokalen SQLite-Datei, siehe README.

`GET /api/pds-simulator?resource=objects&q=Nord&offset=0&limit=20`

- `resource`: `objects`, `units`, `employees`, `siteManagers`, `persons` oder `orders`.
- Für `units`, `persons` und `orders` ist eine bekannte `objectId` erforderlich.
- `q`: höchstens 100 Zeichen; mehrere Wörter werden gemeinsam gesucht, ohne Beachtung von Großschreibung, Umlauten und ß.
- `offset`: 0 bis 10000; `limit`: 1 bis 50, Standard 20.
- Antwort: `{ source: "pds-simulator", synthetic: true, items: [{ id, label, address? }], total }`.
- Ungültige Eingaben: HTTP 400. Andere Methoden außer GET/HEAD/OPTIONS werden nicht unterstützt.

Die öffentlichen Stammdatensuchen liefern nur fiktive Suchansichten. Für die Auftragsliste einschließlich gespeicherter Aufträge ist eine geprüfte lokale Sitzung erforderlich. Das serverseitige Modul exportiert keine Rohdaten an Client-Komponenten. Suchabfragen werden validiert, Treffer begrenzt und technische Einheiten auf das gewählte Objekt eingeschränkt. Der Browser zeigt Lade-, Fehler- und Leerzustände sowie eine Wiederholung an; veraltete Suchanfragen werden abgebrochen. Beim Objektwechsel wird die Anlagenzuordnung zurückgesetzt. Bestehende simulierte Aufträge werden als Hinweis angezeigt.

## Prüfung und nächste Ausbaustufe

`node --test src/platform/pds/simulator/tests/pds-simulator.test.mjs` prüft Suche, Objektfilter, Planbarkeit, Eingabegrenzen, Seitenauswahl und Referenzkonsistenz. Tests sind rein im Speicher und greifen auf keine Datenbank zu.

Auftragsanlage, automatische SIM-SA-Vergabe und Technikerplanung sind lokal implementiert. `POST /api/pds-simulator/orders` benötigt eine gültige serverseitig geprüfte Sitzung (Rolle Disposition), denselben Origin und eine UUID im Header `Idempotency-Key`. Identität und Rolle stammen ausschließlich aus der serverseitigen Sitzung. Sämtliche Felder und Fremdbezüge werden serverseitig validiert. Auftrag und Termin werden gemeinsam transaktional gespeichert; SQL verwendet gebundene Parameter. Derselbe Schlüssel mit verändertem Inhalt oder anderer Identität wird abgelehnt.

Die Anmeldung unter `/api/simulator-session` verwendet ein HttpOnly-/SameSite-Strict-Cookie mit einer Stunde Laufzeit, in Produktion mit Secure-Flag. Die zufällige Kennung verweist auf eine serverseitige Sitzung. Der lokale Anmeldeendpunkt begrenzt alle Versuche pro Serverprozess. Geheimnisse kommen ausschließlich aus lokaler, ausgeschlossener Konfiguration; fehlende Konfiguration verweigert den Zugang. Die Unternehmensanmeldung erfolgt über die Microsoft-Anmeldung (Entra ID); die tatsächliche Fachanbindung bleibt lokal. Produktive Mandantentrennung und Kapazitätsprüfung sind nicht implementiert. Siehe [aktuelle Anmeldebeschreibung](auth/active-directory.md).

Die getrennte Datenbank, Migration, Zeitbehandlung und isolierten Speicherungstests sind im README beschrieben. Keine PostgreSQL-Migrationen oder produktiven Daten wurden verändert.

## Bauleitung und gemeinsame Such-/Auswahlfelder

`siteManagers` liefert ausschließlich explizit als Bauleiter markierte fiktive Mitarbeiter. Dies ist eine Simulationszuordnung und keine aus dem HR-Export bestätigte PDS-Berechtigung. Das Formular übernimmt die Auswahl als `bauleiterId` in Vorschau und Auftragsinhalt; der Server weist unbekannte oder nicht geeignete Mitarbeiter zurück. Die verpflichtende Projektleiterzuweisung wird im Abschlussbereich als „Auftrag Projektleiter zuweisen“ bezeichnet. Das bisherige Ortsfeld entfällt; der Auftrag leitet seine Ortsinformation aus dem Objekt ab. Die vorhandene JSON-Speicherung benötigt dafür keine Tabellenänderung.

## Begleitende Techniker und Mobilität

Auftragsanlage akzeptiert optional `companionTechnicianIds` (Liste eindeutiger planbarer Mitarbeiter, maximal 20). `technicianId` bleibt der Haupttechniker. Der Server setzt `mobilityTechnicianId` ausschließlich aus dieser Haupttechniker-ID; ein vom Client abweichend behaupteter Mobilitätsempfänger wird nicht übernommen. Begleiter dürfen nicht zugleich Haupttechniker sein und benötigen dessen Einsatztermin. Die gesamte Zuordnung wird in derselben Auftragstransaktion gespeichert. Ein realer PDS-Mobilitätsversand ist weiterhin nicht angebunden.

## Kundenpersonen und Grunddaten-Dokumente

Die synthetische Personenquelle enthält Kundenbezug und geschäftliche Telefonnummern. `persons` wird serverseitig auf den Kunden des gewählten Objekts eingeschränkt. Neue Aufträge benötigen im Standardsuchbereich eine ursprünglich oder zusätzlich zum Objektkunden zugeordnete `personId`. Im ausdrücklich gewählten globalen Suchbereich sind auch Personen anderer Kunden zulässig. Der Name wird serverseitig daraus abgeleitet. Telefon und „an Techniker vor Ort“ erfordern eine Rückrufnummer; E-Mail erfordert ein geprüftes Dokument. Andere Meldewege sind für neue Aufträge nicht zulässig. Ältere Aufträge bleiben lesbar.

`document` enthält für neue Aufträge `uploadId` und vom Server übernommene Dateimetadaten mit Kategorie `Grunddaten`. Die Datei selbst wird vorab binär übertragen (beliebige Dateitypen, 100 MB = 104.857.600 Bytes). Die Auftrags-API erlaubt maximal 16.000 Zeichen JSON. Früher gespeicherte Base64-Dokumente bleiben lesbar. Downloads sind ausschließlich nach Sitzungs-/Rollenprüfung und mit Attachment-, No-Sniff-, Sandbox- und No-Store-Headern über `GET /api/pds-simulator/orders/[number]/document` möglich. Dateien werden als `application/octet-stream` ausgeliefert.

## Personenanlage und Binär-Uploads

Neue Migration: `002_contacts_uploads.sql`. Angewendete Migrationen bleiben unverändert und werden über gespeicherte SHA-256-Prüfsummen kontrolliert. Die Migration ergänzt `customer_persons` und `uploads`; feste Beispieldaten bleiben unveränderliche Fixtures ohne importierte Produktionsdaten.

`POST /api/pds-simulator/persons`: `{objectId,name,function,landline,mobile}`; serverseitig geprüfte Dispositionssitzung und gleicher Origin erforderlich. Die Kundenzuordnung kommt aus dem Objekt, nie aus einer behaupteten Kundennummer. Eine passende bestehende Kombination wird wiederverwendet. Antwort ist direkt als Personenauswahl verwendbar. Personensuche berücksichtigt gespeicherte Personen und benötigt ebenfalls Anmeldung.

`POST /api/pds-simulator/uploads`: roher Dateikörper, `X-File-Name` URI-kodiert und `X-Upload-Id` als UUID. Sitzung und Origin werden vor dem Lesen geprüft. Die tatsächlich gelesene Größe wird unabhängig von Content-Length kontrolliert und oberhalb 100 MB abgebrochen. Es gibt keine Dateityp-/Endungsfilter. Leere Dateien und Dateinamen mit Pfad-/Steuerzeichen werden abgelehnt. Wiederholungen mit gleicher Kennung sind nur für identischen Inhalt, Namen und Benutzer möglich. Die Auftrags-API akzeptiert ausschließlich existierende Uploads des angemeldeten Benutzers; Client-Metadaten werden dabei ersetzt. Nicht zugeordnete Uploads bleiben bis zu einer späteren Bereinigungsfunktion lokal gespeichert.

## Personenfunktion und Telefonnummern

Migration `003_person_functions.sql` ergänzt die Funktion (Bestandswert: „Ansprechpartner“) und eine eigene geschäftliche Mobilnummer. Das bestehende `phone`-Feld dient weiter dem geschäftlichen Festnetz. Neue Personen benötigen Name, explizite Funktion und mindestens eine gültige der beiden Nummern. Die API liefert typisierte Beschriftungen der vorhandenen Nummern, die Funktion sowie den vom Objekt abgeleiteten Kunden. Gleich benannte Datensätze mit derselben Festnetznummer und abweichenden weiteren Angaben werden nicht still überschrieben.

Die Neuanlage ist erst nach einer abgeschlossenen, fehlerfreien Personensuche ohne Treffer sichtbar; der Suchname wird in einen modalen Dialog übernommen. Abbrechen und Escape schließen ihn. Andere Sucharten, leere Suche und Netzwerkfehler bieten keine Personenanlage an.

## Kompakte Oberfläche

Drei aufeinander aufbauende Karten öffnen persistente Dialoge für Objekt, Meldung und Planung. Erst abgeschlossene Schritte werden grün; Änderungen setzen betroffene und nachfolgende Schritte zurück. Die Zusammenfassungen stehen kompakt in den Karten statt in einer Gesamtvorschau. Auswahlwerte und Begleiter sind als entfernbare Pillen im gemeinsamen Such-/Auswahlfeld dargestellt. Die serverseitigen Zugriffs- und Validierungsregeln bleiben auch bei veränderter Oberfläche maßgeblich.

Neue Aufträge benötigen einen gültigen Bauleiter/Projektleiter, unabhängig vom Client. Die Zuweisung steht links vom Speichern; fehlende Pflichtangaben werden benannt und der Speicherbutton bleibt bis zur Vollständigkeit deaktiviert. Bestehende gespeicherte Aufträge werden nicht verändert.

## Geschäftspartnerübergreifende Meldung und Kundenzuordnungen

Der Personensuchendpunkt akzeptiert `personScope=customer|all` (Standard: `customer`). Globale Suche liefert alle bekannten fiktiven Kundenpersonen, einschließlich Funktion, Telefonnummern, ursprünglicher Kundennummer und `customerNumbers`. Rolle und Identität stammen weiterhin aus der serverseitigen Sitzung. Der lokale Dispositionsbenutzer ist für beide Suchbereiche berechtigt. Der Suchbereich ist eine fachliche Auswahl, keine vom Client gesetzte Berechtigung.

Neue Aufträge speichern `personScope`. Im globalen Modus wird die bekannte Person als Meldender akzeptiert, ohne den Objektkunden zu ändern oder sie automatisch dauerhaft zu verknüpfen. Im Standardmodus akzeptiert der Server nur Personen mit tatsächlichem Kundenbezug. Andere Suchbereichswerte sowie unbekannte Personen werden abgewiesen.

`resource=customers` liefert die aus fiktiven Objekten bekannten Kunden und unterstützt die Drei-Zeichen-Suche der gemeinsamen Auswahlkomponente. Ein ausgewählter Kunde erscheint als Pille mit X. Es gibt keine Checkbox-Mehrfachauswahl mehr.

`POST /api/pds-simulator/persons` akzeptiert optional `customerNumber` für einen abweichenden Kunden. Ohne diesen Wert wird der Objektkunde verwendet. Alle Kundenreferenzen werden serverseitig geprüft; die neue Person gehört ausschließlich zum gewählten Kunden. Bei einem Auftrag für einen anderen Objektkunden ist ausdrücklich `personScope=all` erforderlich; die Oberfläche setzt diesen Bereich bei der abweichenden Auswahl automatisch.

`POST /api/pds-simulator/person-links` verwendet nun `{personId,customerNumber}` und ersetzt die Kundenzuordnung einer bestehenden Person. Sitzung, Rolle und Origin werden geprüft. Der neue Kunde wird als einzige Zuordnung in `person_customer_assignment` gespeichert; bisherige zusätzliche Verknüpfungen der Person werden in derselben Transaktion entfernt. `005_person_customer_assignment.sql` ergänzt diese Tabelle, ohne die festen Fixtures oder alte Migrationen zu ändern. Ältere Mehrfachzuordnungen bleiben bis zum ausdrücklichen Wechsel bestehen. Neue Schreibwege fügen keine weiteren Kundenzuordnungen hinzu.

Die Bearbeitung der Kundenzuordnung bestehender Personen wird in der Meldungsaufnahme nicht angeboten. Der abweichende Kunde kann ausschließlich im Popup für einen neuen Ansprechpartner ausgewählt werden. Die serverseitige Zuordnungsfunktion ist weiterhin zugriffsgeschützt; die globale Auswahl bestehender Ansprechpartner bleibt möglich.

Im Popup für neue Ansprechpartner steht die Kundenwahl direkt sichtbar und verpflichtend als Kombi-Suchfeld. `resource=customers&objectId=…` liefert den einen Objektkunden zur Vorbelegung (nicht mehr die anderen Kunden). Die Suche nach Ersatzkunden verwendet `resource=customers&q=…` ohne Objektfilter. Nach Entfernen der vorausgewählten Pille ist eine neue Auswahl erforderlich, bevor die Oberfläche die Personenanlage freigibt.


Die Anmeldung wurde um den getrennten Modus `AUTH_MODE=ldaps` ergänzt (am 19.11.2026 wieder entfernt; Unternehmensanmeldung ist die Microsoft-Anmeldung). Die aktuellen Regeln zu Sitzungen, Gruppenprüfung und PDS-Bearbeiterzuordnung und zentralem API-Zugang stehen in [AD-/LDAPS-Anmeldung](auth/active-directory.md). Diese Beschreibung ersetzt ältere Angaben zur Passwortsignatur und Sitzungsdauer. Bestehende Fachabläufe bleiben am Simulator.
