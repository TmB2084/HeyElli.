# PDS: API-/View-Matrix

**Persönliche Auftragsmarkierungen (22.11.2026).** ServiceHub verwendet die Auftragskennung aus der bestehenden Serviceübersicht. `GET/POST /api/service/markierungen` liest und schreibt ausschließlich `platform.service_order_flags` für das geprüfte Konto und die aktive Quelle. Simulator und angeschlossenes PDS haben getrennte Markierungsbestände. PDS-API-Pfad, Schreibschema und Datenansicht sind für diese persönliche Auswahl nicht erforderlich.

Konten-Nachtrag 19.11.2026: PDS-Bearbeiter werden ausschließlich über die Zuordnung „PDS-Benutzer“ der heyelli-Konten bestimmt (`platform.pds_user_mappings` je Quelle, Migration 047, [heyelli-Konten](../auth/accounts.md)). Abgelöst sind Demo-Datei, Simulator-Konstante, Verwaltungsaktion `mapping` im PDS-Panel und `platform.duty_employee_links`; ältere Absätze unten beschreiben den damaligen Stand. Gespeichert wird die Mitarbeiter-UUID; ob `bearbeiterUUID` die Mitarbeiter- oder die `benutzerUUID` erwartet, ist mit PDS zu klären.

Quellen-Nachtrag 19.11.2026: Neue Anwenderdokumentation v9, Releasedokumentation v7 (Releases 4.0–4.6.2) und unveränderte OpenAPI (gleicher SHA-256) ausgewertet. Wichtig: Laut Anwenderdokumentation S. 1437 verhindert „Mobil abgeholt“ die Stornierung der mobilen Ausgabe; die Regel „Mobil abgeholt → Manuell storniert“ unten ist vor einer echten Anbindung mit PDS zu klären. Bei „Mobil abgeholt“ erlaubt PDS in der Oberfläche nur noch Änderungen an Datum und Uhrzeit. Abgleich mit den PDS-Handbüchern vom November 2026: [handbuch-abgleich-2026-11.md](handbuch-abgleich-2026-11.md).

Pfad-Nachtrag 08.11.2026: Zentrale Einstellungen jetzt `/einstellungen`, persönliches Benutzerkonto `/benutzerkonto`. `/verwaltung` leitet geschützt und unter Erhalt der Abfrageparameter weiter. Microsoft-Anmeldetests kehren nach `/einstellungen?microsoft_auth=test-ok` zurück. API-Pfade `/api/verwaltung/*`, PDS-Zuordnungen, Schemas und Schreibsperren unverändert.

UI-Nachtrag 08.11.2026: Der Bereich Verwaltung heißt jetzt „Einstellungen“, einschließlich der PDS-/Graph-/Microsoft-Anleitungen. Der neue Kontoeintrag verlinkt auf persönliche Einstellungen. Technische Routen `/verwaltung` und `/api/verwaltung/*`, serverseitige Administratorprüfungen und sämtliche PDS-Verträge bleiben unverändert.

UI-Nachtrag Verwaltung 08.11.2026: Neue Einstellungsarbeitsfläche mit seitlicher Navigation und mobiler Detailansicht gestaltet auch PDS-Verbindung, Prüfungen, Datenansichten, Bearbeiter, Freigabe und Anleitung. Die bestehenden Plattformpfade `/api/verwaltung/pds` und `/api/verwaltung/pds/anleitung` sowie sämtliche unten dokumentierten PDS-Pfade/Schemas bleiben unverändert. Kein neuer View, keine Änderung von Prüfungen, Geheimnisschutz oder Freigaben; Simulatorbetrieb bleibt erhalten.

UI-Nachtrag DutyBoard 08.11.2026: Die manuelle KW-Zuordnung zeigt ihre Vorschau in einem kompakten modalen Dialog mit Mitarbeiter, KW, Beginn und Ende statt unter der Jahresmatrix. Allgemeine Erklärungstexte entfallen, konkrete Ablehnungsgründe und ersetzte Zuordnungen bleiben sichtbar; Vorschau, Bestätigung und Planungsschritte nutzen unverändert denselben Vertrag. Arbeitsfläche, Jahres-/Ressourcenauswahl, Reiter, Feiertagsoptionen, Vorschauen, Fairnesskonten und Wünsche folgen dem CI-/UI-Leitfaden. Die bestehenden Plattformpfade `/api/bereitschaft`, `/api/bereitschaft/ressourcenauswahl`, `/api/bereitschaft/feiertage`, `/api/bereitschaft/fairness` und `/api/bereitschaft/wuensche` sowie die unten zugeordneten PDS-Terminschemas bleiben unverändert. Keine neue View, kein zusätzlicher PDS-Endpunkt; Verfügbarkeit, Feiertagsrotation, Freistatus, Wochenbegrenzung und Tauschfreigaben bleiben erhalten. Die Planung ist weiterhin Simulatorfunktion und im echten PDS-Lesebetrieb gesperrt. UI-Prüfbericht (Prüfnachweis in der Git-Historie).

UI-Nachtrag PlanBoard 08.11.2026: Die macOS-Gestaltung verändert ausschließlich Arbeitsfläche, Werkzeugleisten, Dialoge und Menüs. Datenfelder, Berechtigungen, Idempotenz, Fortsetzungen und Konfliktbehandlung bleiben unverändert. Weiterhin gelten die unten dokumentierten Pfade und Schemas für Terminlesen/-schreiben, Kategorien, Ressourcen und mobile Ausgabe; keine zusätzlichen Views oder PDS-Endpunkte. Simulator und echter PDS-Lesebetrieb bleiben getrennt. UI-Prüfbericht (Prüfnachweis in der Git-Historie).

UI-Nachtrag 08.11.2026: Die Gestaltung des CaseDesks wurde nach dem CI-/UI-Leitfaden überarbeitet. Datenfelder, Pflichtprüfungen, Idempotenzkennung und API-/View-Vorrang bleiben unverändert; keine neuen PDS-Endpunkte oder Views. Die bisherigen Zuordnungen zu dokumentierten API-Pfaden und Schemas gelten weiter. Die Oberfläche verwendet weiterhin die geschützten Plattformendpunkte `/api/pds-simulator`, `/api/pds-simulator/orders`, `/api/pds-simulator/persons` und `/api/pds-simulator/uploads` mit Simulatorbetrieb; die Neuanlage im echten PDS-Lesebetrieb bleibt gesperrt. UI-Prüfbericht (Prüfnachweis in der Git-Historie).

Stand: 02.11.2026. Verbindliche Quelle: freigegebene `Datenquellen/PDS/openapi.yaml`, Version 1.0. SHA-256 und daraus extrahierte 193 Operationen/Schemas stehen in `src/platform/pds/api/contract.json`; vollständige Pfadübersicht: [operations.md](operations.md).

## Ziel und verbindliche Vorrangregel

Die Serviceplattform verwendet später ausschließlich eine serverseitige API-Anbindung. Fachliche PDS-API vor Datenansicht. Benötigte Datenansichten werden ebenfalls über die dokumentierte API gelesen: `GET /datenansichten/list` zur Metadatenprüfung, `POST /datenansichten/listdaten` mit `{name,page,entriesPerPage}`. Kein direkter SQL-Zugriff auf PDS und niemals Schreibzugriffe über Views.

Nur ein nachgewiesen nicht verfügbares Feld darf eine freigegebene View benötigen. Vorhandene API-Werte – auch leere Texte, `false` und leere Listen – werden nicht überschrieben. HTTP-, Authentifizierungs-, Lizenz- und fachliche Fehler werden gemeldet, nicht durch Views kaschiert. Ein leerer Wert ist nicht automatisch eine API-Lücke.

Die API beschreibt Suchparameter im POST-Body (`suchwort`, `suchfelder`, `page`, `entriesPerPage`); Listenantworten verwenden `totalHitCount`/`resultList`. Die Empfehlung beträgt 500 Einträge je Seite, Maximum 1000. Die Seitenzählung ist im Simulator nullbasiert; vor Echtdatenbetrieb mit PDS bestätigen. Ein Bearer-Token gilt für einen Mandanten und dessen Benutzerrechte. Auch eine korrekte Anmeldung kann wegen fehlender API-Lizenz HTTP 403 erhalten.

## Lesefunktionen und Felder

| Plattformbedarf | API zuerst: Pfad / Feld | View erforderlich? | Stand und Grenzen |
| --- | --- | --- | --- |
| Objektsuche | POST `/objekt/listobjekte`, `/objekt/details`; `uuid`, `bezeichnung`, `typ` | Nein | Im Simulator implementiert; UI nutzt den API-DTO-Adapter. |
| Objektkunde | Objekt `personUUID`; POST `/person/details` und `/person/listkunden` | Nein | Objektkunde und abweichender Ansprechpartner bleiben getrennt. |
| Adresse | Objekt `standort.strasse`, `plz`, `ort` | Nein | Implementiert. |
| Technische Einheiten und Zuordnung | Objekt `typ=TECHNISCHE_EINHEIT`, `parentUUID`; Detail `childrenUUIDs` | Nein | Implementiert für eine Ebene; komplexe Struktur-/Bauteilhierarchien noch nicht vollständig simuliert. |
| Objektnummer / technische Nummer | `objektInfoFelder` plus GET `/objekt/listinfofelder` | Nur falls nicht als Infofeld verfügbar | Simulierte Feldbezeichnung „Nummer“ ist eine lokale Konfiguration, keine zugesicherte PDS-Standardbezeichnung. Tatsächliche Metadaten prüfen. |
| Hersteller, Typ, Standort, Gewerk | `objektInfoFelder`: `bezeichnung`, `typ`, `wert` | Nur wenn die konkreten Felder dort nicht geliefert werden | Simulator stellt fiktive Infofelder bereit. Feldbezeichnungen müssen gegen die Installation gemappt werden. Dann erst eine freigegebene Objekt-Ergänzungsview spezifizieren. Kein View-Schema erfunden. |
| Kundensuche und Kundennummer | POST `/person/listkunden`; `kundenRolle.kundennummer`, `name`, `uuid` | Nein | Implementiert. |
| Kundenspezifischer Ansprechpartner | POST `/person/details` des Kunden; `ansprechpartner[].person`, `funktionUUID`, `ekommunikationswege` | Nein | Implementiert für fiktive Kundenpersonen. |
| Globale Personensuche | POST `/person/listpersonen`, danach `/person/details` | Nein | Client vorhanden; aktuelle UI-Normalisierung ermittelt Ansprechpartner über Kundenrollen. Personen ohne Ansprechpartnerrolle noch nicht als Meldende auswählbar. |
| Personenfunktion | GET `/person/listfunktionen`, Rolle `funktionUUID` | Nein | Die Oberfläche wählt jetzt eine vorhandene API-Funktion im Kombi-Suchfeld. Fiktive Funktionsnamen dienen im Simulator zugleich als IDs; die reale Quelle liefert deren UUIDs. |
| Geschäftliches Festnetz/Mobil | `ekommunkationswege` am Personendetail (Schreibweise laut Quelle), Rolle `ekommunikationswege`; `typ=FESTNETZ/MOBIL`, `kategorie=GESCHAEFTLICH`, `value` | Nein | Implementiert; private Nummern werden nicht als Geschäftskontakt übernommen. |
| Mitarbeiter | POST `/mitarbeiter/listmitarbeiter`, `/mitarbeiter/details`; `personalNummer`, `vorname`, `nachname`, `berufsbezeichnung` | Nein | Implementiert. |
| Grundsätzliche Ressourcenplanzeit | Mitarbeiter `ressourcenplanzeit`, `/termin/listplanung`, `/termin/listterminebymitarbeiter` | Nein | Simulator verwendet vereinfacht das Vorhandensein einer Planzeit. Keine Zusage einer tatsächlichen Verfügbarkeit, keine vollständige Abwesenheits-/Konfliktprüfung. |
| Bauleiter-/Projektleitereignung | Mitarbeiter `funktionUUID`, betrieblich konfigurierte Liste zugelassener Funktionen | Nur wenn die betriebliche Eignung daraus nicht ableitbar ist | Simulator verwendet API-Funktionszuordnung. Ohne Konfiguration liest der Adapter die fiktive View `sim_site_managers` über `/datenansichten/listdaten`. Dieser Name ist nur ein Simulatorentwurf; reale View und Spalten müssen freigegeben werden. |
| Bestehende Störungen / Auftragsnummer | POST `/service/liststoerungen`, `/service/details`; `vorgangsNummer`, `rootEbene.ebenen` | Nein | Implementiert über den PDS-Service-Leseadapter: paginierte Störungssuche, Objekt-/TE-Filter, Gruppierung je Auftrags-UUID, anschließend Plattform-Paginierung. Feste Demoaufträge, Altdaten und neue API-Aufträge werden im Emulator in denselben Vertrag übersetzt. |
| Projektleiter eines bestehenden Auftrags | `/service/details`: `bauleiterUUIDs` | Nein | Service-Detailendpunkt implementiert. Das Bauleiter-Lesefeld ist dokumentiert; der Emulator erfindet keine API-seitige Zuweisung aus dem weiterhin ausschließlich lokalen Pflichtfeld. Fehlende Schreibfunktion bleibt offen. |
| Dokument-Metadaten und Download | GET `/service/listauftragsdokumente/{uuid}`, `/service/listdokumente/{uuid}`, `/dokument/downloaddokument/{uuid}` | Nein | Implementiert: Liste der Auftragsdokumente und binärer Download über PDS-Transport. Die Plattform prüft die Zugehörigkeit der Dokument-UUID zum Auftrag vor jedem Download. Mehrere Dateien je Auftrag werden als einzelne Links angeboten. |

**Derzeit muss keine reale Datenbankview angelegt werden.** Die API deckt die meisten benötigten Daten ab. Die einzige ausführbare View-Simulation betrifft die optionale betriebliche Projektleitereignung. Weitere Views dürfen erst nach Prüfung der installierten Infofelder begründet werden. Alle View-Namen und Spalten hier sind Entwürfe, keine aus PDS bestätigten Datenbankobjekte.

## Schreiben und Workflows

| Funktion | Dokumentierte API | Simulatorstatus / offene Voraussetzung | View? |
| --- | --- | --- | --- |
| Serviceauftrag mit externer Nummer | POST `/service/create`; `context.vorgangsVorlageName`, `vorgangsdaten.personUUID`, `externeNummer`, `belegDatum`, `texte` | Der ausführbare Workflow ruft `/service/create` auf, prüft Antwort-UUID und `vorgangsNummer` und verwendet sie in den Folgeschritten. `personUUID` ist der Objektkunde, nicht die meldende Person. Reale Vorlage muss konfiguriert werden. Der Simulator führt die API-Operationen einzeln aus und persistiert deren Antworten. | Nein |
| SA-Nummer | Antwort `PdsAPIServiceAuftragDetailsRESTModel.vorgangsNummer` | Neue Aufträge übernehmen die Nummer ausschließlich aus der API-Antwort. Der lokale API-Emulator vergibt `SIM-API-SA-*`. Historische `SIM-SA-*` bleiben lesbar. | Nein |
| Störung, Objekt/TE, Haupt- und Begleitmonteure | POST `/service/createstoerung`; `serviceauftragUUID`, `objektUUID`, `auszufuehrendeArbeiten`, `hauptmonteurUUID`, `weiteremonteureUUIDs`, `startZeitpunkt`, `endZeitpunkt` | `/service/createstoerung` wird nach der Auftragsanlage mit der zurückgegebenen UUID ausgeführt. Die gewählte TE ist `objektUUID`. Haupt-/Begleitmonteure sind getrennt. Übersprungene Planung sendet keine Monteur-/Terminfelder. Aktualisierung über `/service/updatestoerung` ist noch nicht implementiert und müsste immer beide Monteurfelder senden. | Nein |
| Vollständiger Kalendereintrag | POST `/termin/create` | Verlangt Start **und Ende**, Mitarbeiter, Typ und Status. Die aktuelle UI hat nur einen Beginn. Kein Endtermin erfunden; daher noch kein separater Termin-Create. Enum `vorgangtyp` enthält in dieser Datei kein SERVICEAUFTRAG: Verknüpfung mit PDS klären bzw. Störungsplanung verwenden. | Nein |
| Mobil-Ausgabe | POST `/service/mobilausgeben` mit `{uuid,auftragspool:false}` | Der Empfänger steht an der Störung als Hauptmonteur, nicht in der Mobil-Ausgabe-Anfrage. Der Workflow führt die Mobil-Ausgabe nach erfolgreicher Störungsanlage und gegebenenfalls Dokumentablage aus. Kein Versand an reale Endgeräte. | Nein |
| Neue meldende Person | POST `/person/create`, anschließend `/person/createEKommunikationsweg`, `/person/addansprechpartnerrolle` | Alle drei Operationen werden ausgeführt; die UUIDs aus Anlage und Kommunikationswegen werden weitergereicht. Rollenmodell bleibt widersprüchlich: Pflichtfeld `eKommunikationswege`, Property `ekommunikationswege`. Der explizite Simulator-Kompatibilitätsmodus sendet beide Schlüssel mit identischem Inhalt. Ohne diesen Modus blockiert der generische Workflow vor dem ersten Schreibaufruf. Für echtes PDS ist eine verbindliche Klärung erforderlich. | Nein |
| Abweichender Kunde | Rolle `ansprechpartnerBeiUUID`, `/person/updateansprechpartnerrolle` bzw. neue Rolle | Bei Neuanlage wird die Ansprechpartnerrolle per API dem ausgewählten Kunden zugeordnet. Der Objektkunde wird nicht geändert. Nachträgliches Umhängen bestehender Rollen bleibt eine alte lokale Simulatorfunktion und ist nicht Teil des umgestellten Neuanlagepfads. | Nein |
| Funktion einer neuen Person | Rolle `funktionUUID` | Die UI bietet jetzt die API-Funktionsauswahl. Der Workflow löst die Funktion vor dem ersten Schreibaufruf auf; unbekannte freie Funktionen werden abgewiesen. Keine View und kein erfundener Create-Endpunkt. | Nein |
| Meldende Person als Ansprechpartner am Auftrag | Detailmodell `ansprechpartnerUUID` lesbar | Feld fehlt im dokumentierten Create/Update-Modell. Name und Rückrufnummer sind im Meldetext enthalten. CaseDesk zeigt diesen Text in Schritt 4 vollständig mit derselben Formatierung wie beim Speichern im Simulator. Strukturierte Verknüpfung vor Echtbetrieb mit PDS klären. | Kein View-Schreiben |
| Optionale PDS-Bemerkung in Schritt 4 | POST `/service/createstoerung`, `PdsAPIServiceAuftragEbeneAnlegenRESTModel.bemerkung`; lesbar in `PdsAPIServiceAuftragEbeneDetailsRESTModel.bemerkung` | API-Feld der Auftragsstörung. Der Meldungstext bleibt in `auszufuehrendeArbeiten`. Simulator speichert und liefert beide Felder getrennt; bis 2.000 Zeichen für die Bemerkung. | Echt-PDS bleibt lesend. Ältere Entwürfe und leere Bemerkungen verwenden dieselbe Auftragsanfrage wie bisher. |
| CaseDesk-Auswahllisten | POST `/mitarbeiter/detailsbatch` und `/person/detailsbatch` über die dokumentierten UUID-Listen. Kundenspezifische Kontaktsuche liest den zugeordneten Kunden über `/person/details`. | API. Details in seriellen Gruppen zu höchstens 50 UUIDs, Prüfung auf vollständige Zuordnung. Treffer erscheinen seitenweise. Beide Detail-Batches im Simulator geprüft. | Das Suchverhalten gegen echtes PDS bleibt ungeprüft. Kein zusätzlicher View-Fallback. |
| Projektleiter zuweisen | `bauleiterUUIDs` nur in Auftragsdetails | Im dokumentierten `/service/create` und `/service/update` ist **kein** Bauleiter-Schreibfeld vorhanden. Aktuelle Pflichtzuweisung wird ausschließlich lokal simuliert. Nicht fälschlich auf `bearbeiterUUID` abbilden. Auch Vorgangs- und Projektakten-Schreibmodelle geprüft: kein belegter Ersatz. Konkrete Rückfrage und Prüfnachweise siehe Abschnitt „Gezielte Prüfung: Bauleiter-/Projektleiterzuweisung“. | Kein View-Schreiben |
| Dokument an Auftragsgrunddaten | POST `/dokument/uploaddokument` (multipart): `file`, `dokumententypUUID`, `referenzVorgangUUIDOpt`, `referenzVorgangtypOpt=SERVICEAUFTRAG`; optional `referenzFolderOpt` | Der Workflow überträgt die bereitgestellte Datei als Multipart mit echter Antwort-UUID des Auftrags und Typ SERVICEAUFTRAG. Der Simulator verwendet den über seine Metadaten verfügbaren Typ `sim-document-general`. Ein realer Typ muss konfiguriert werden. `referenzFolderOpt` wird bewusst nicht erfunden: „Grunddaten“ bleibt die lokale Kategorie, kein bestätigter PDS-Ordner. `/service/uploaddokument` wäre eine andere Referenzierung an die Störung. | Nein |
| 100-MB-Dateien / beliebige Typen | Kein verbindliches Größen-/Typenlimit im vorliegenden Vertrag | 100 MB ist ausschließlich ein Simulatorlimit. Reale Server-, Proxy- und Dokumentenlimits separat bestätigen. | Nein |

## Implementierungsstand und Betrieb

- `src/platform/pds/api/`: OpenAPI-Snapshot, strukturelle Requestvalidierung, HTTPS-/Bearer-Transport, Lookup-Adapter und Write-Mappings. Der Validator prüft Typen, Pflichtfelder, Enum und eindeutige Listen; keine vollständige OpenAPI-Validierung aller Formate/Patterns.
- `src/platform/pds/simulator/api.ts`: lokale Implementierung dokumentierter Leseoperationen mit PDS-Feldnamen und Ergebnisumschlägen. Nicht implementierte Rohoperationen liefern einen Fehler, niemals vorgetäuschten Erfolg.
- `/api/pds-simulator`: weiterhin Plattform-Backend; Objekt-, Einheiten-, Kunden-, Personen- und Mitarbeitersuche verwenden jetzt API-DTOs. Kein PDS-Bearer-Token im Browser.
- `/api/pds/rest/api/*`: optionaler Rohsimulator für implementierte GET/POST-Operationen. Benötigt `SIMULATOR_API_TOKEN` in der lokalen `.env`; ohne Konfiguration HTTP 503, falscher Token HTTP 401. Dieses Token gehört ausschließlich zur fiktiven lokalen Quelle.
- `PDS_API_BASE_URL` und `PDS_API_TOKEN` sind dokumentierte zukünftige Serverkonfiguration. Die Anwendung aktiviert damit **noch keine** echte PDS-Anbindung. Insbesondere keine URL aus `servers` der Kundendokumentation wird übernommen oder aufgerufen.
- Die neuen ausführbaren Workflows verwenden UUIDs aus tatsächlichen Antworten. Das ältere Feld `pdsApiCalls` bleibt ein diagnostischer Plan; `pdsReceipt` enthält die ausgeführten Antwort-Referenzen. Lokale Schritte sind persistent wiederaufnehmbar. Die PDS-Spezifikation dokumentiert keinen Idempotenzschlüssel: Ein verlorener HTTP-Erfolg nach einer echten Anlage muss vor Produktivbetrieb über Abgleich/Operationsjournal aufgelöst werden; lokale Schritt-Idempotenz darf nicht als PDS-Garantie ausgegeben werden.
- Neue Ansprechpartner, neue Serviceaufträge und deren Dokumentübertragung laufen jetzt durch die dokumentierten API-Workflows. Im lokalen Betrieb ist ein In-Process-PDS-Transport eingesetzt; die Serviceplattform erzeugt keine simulierte SA-Nummer selbst. Persistenz ist die Implementierung des Emulators, kein direkter SQL-Zugriff auf echtes PDS. Die Bestandsauftragsliste und Dokumentdownloads verwenden ebenfalls die simulierte API. Alte Zuordnungsänderung und fehlende Schreibfelder sind weiterhin explizit lokal bzw. offen. Es gibt keinen produktiven Schreibkontakt und keinen SQL-Fallback.

## Prüfung

`node --test src/platform/pds/api/tests/pds-api.test.mjs src/platform/pds/simulator/tests/pds-orders.test.mjs src/platform/pds/simulator/tests/pds-contacts-uploads.test.mjs src/platform/pds/simulator/tests/pds-simulator.test.mjs src/platform/pds/simulator/tests/pds-reporting.test.mjs`

Geprüft werden API-Vorrang ohne verdeckten Fehlerfallback, dokumentierte DTOs/Pflichtfelder, Bearer-Transport, Paging, Objekt-/Personenbezüge, lokale Persistenz und die ausgeführten Neuanlage-/Multipart-/Mobil-Workflows, Teilfehler-Wiederaufnahme und Persistenz nach Wiederöffnen. Tests verwenden temporäre Datenbanken und simulierte HTTP-Antworten. Kein Zugriff auf reale PDS-Systeme.

## Ausführbare Schreibabläufe und Fehlerzustände

`src/platform/pds/api/execute.ts` führt die fachlichen Aufrufe über `PdsTransport` aus; derselbe Executor kann nach Klärung der offenen Felder einen HTTPS-Transport verwenden. `write-gateway.ts` ist die lokale Konfiguration/Validierung, `write-api.ts` emuliert die dokumentierten Mutationen. Migration `006_api_write_workflows.sql` ergänzt API-Entitäten mit UUIDs und ein Schrittjournal. Angewendete Migrationen bleiben unverändert.

Jeder lokale API-Schritt speichert Änderung und Antwort in einer Transaktion. Wiederholung derselben Operation innerhalb desselben Workflows liefert die gespeicherte Antwort; abweichender Inhalt wird abgewiesen. Nach Fehlern wird keine vollständige Auftragsanlage gemeldet. Ein bereits angelegter Auftrag oder eine Person kann als unvollständiger API-Datensatz bestehen bleiben; Wiederholen setzt die Schritte fort. Keine automatische Löschung oder Rücknahme fremder Systeme. API-Fehler führen niemals zu Views oder zu einem alten lokalen Schreibfallback.

Bei Personen bildet der Simulator den Workflow-Schlüssel aus Benutzer und normalisierten Eingaben. Auftragserfassung verwendet den vorhandenen Anfrage-Schlüssel. Nach allen API-Erfolgen wird die lokale Plattformprojektion gespeichert; erst dann meldet die UI Erfolg. `pdsReceipt` enthält Service-UUID, SA-Nummer, Störungs-UUID und gegebenenfalls Dokument-UUID. Datei-Downloads neuer Aufträge lesen den binären API-Dokumentdatensatz; alte Dokumente bleiben kompatibel.

Der vorgezogene Dateiupload im Browser ist **Staging**, da eine PDS-Auftragsreferenz zu diesem Zeitpunkt noch nicht existiert. Erst beim Auftragsabschluss erfolgt der PDS-Multipart-Upload. Noch nicht verknüpfte Stagingdateien bleiben lokal erhalten. Der externe Rohsimulator unterstützt Mutationen mit Bearer-Token und zusätzlichem `X-Simulator-Workflow` (UUID) für die lokale Wiederholungserkennung; dies ist eine Simulator-Erweiterung, kein dokumentierter PDS-Header. Für echte PDS-Aufrufe wird dieser Header nicht verwendet.

Verbleibend und nicht durch Views lösbar: Bauleiter-Schreiben, strukturierter Ansprechpartner am Auftrag, garantierter Grunddatenordner, Rollenfeld-Schreibweise und ein vollständiger Kalendertermin mit Ende. Das vorhandene Startdatum wird an der Störung geführt; kein Enddatum erfunden. Für die drei umgestellten Schreibabläufe ist **keine View** erforderlich. Bestehende bedingte Leseviews bleiben API-nachrangig.

## Bestandsaufträge und Dokumentdownloads über API

`PdsServices` ist der öffentliche Service-Leseadapter. Er verwendet ausschließlich `PdsTransport` und kennt weder SQLite noch feste Demodatensätze. Die geschützten Plattformrouten für `resource=orders` und Dateiabruf verwenden diesen Adapter statt `store.list()`/`store.document()`. Es gibt keinen View- oder Speicherfallback in der Plattformroute. API-Fehler werden als Fehler gemeldet; ein nachweislich nicht vorhandener Auftrag oder nicht zugeordnetes Dokument führt zu 404.

Ablauf Auftragsliste: Objekt mit `/objekt/details` auflösen; `/service/liststoerungen` vollständig mit PDS-Paginierung lesen; auf Objekt und direkte untergeordnete technische Einheiten filtern; nach Auftrags-UUID gruppieren; Suchbegriffe und Plattform-Paginierung anwenden. Pro sichtbarem Auftrag `/service/listauftragsdokumente/{uuid}` abrufen. Alle dokumentierten Dateien werden als Links angeboten. Zwei Störungen desselben Auftrags erzeugen keinen doppelten Auftragslisteneintrag.

Ablauf Download: Auftragsnummer über die API-Störungsliste einer UUID zuordnen, `/service/details` gegenprüfen, `/service/listauftragsdokumente/{uuid}` lesen und nur eine darin enthaltene Dokument-UUID an `/dokument/downloaddokument/{uuid}` übergeben. Optionales Plattformargument `documentUUID` wählt eine Datei; ohne Argument wird zur Kompatibilität das erste Auftragsdokument verwendet. Eine fremde UUID wird nicht heruntergeladen. Die Plattform liefert ausschließlich einen Attachment-Download mit No-Sniff, Sandbox und No-Store aus. Der HTTPS-Transport liest diesen PDS-Endpunkt binär statt als JSON.

Der Emulator adaptiert feste Demoaufträge, historische Auftrags-JSONs sowie frühere Inline-/Stagingdateien intern. Neue API-Entitäten werden über ihre tatsächlichen UUIDs und unveränderten Binärinhalte ausgeliefert; die Plattform mischt keine Datenspeicher mehr. Historische Zuordnungen erhalten stabile synthetische UUIDs. Eine zusätzliche Datenbankmigration ist nicht erforderlich.

Grenzen: `/service/liststoerungen` liefert nur Aufträge mit Störungsebene. Eine reine Auftragsanlage, deren Störungsschritt noch fehlgeschlagen ist, wird dadurch nicht als fertiger Bestandsauftrag angezeigt. Für eine zukünftige vollständige Auftragsverwaltung ohne Störungsbezug wäre zunächst eine weitere dokumentierte Vorgangs-API zu prüfen, keine View automatisch vorzuziehen. Der aktuelle Objektfilter umfasst direkte technische Einheiten; komplexe mehrstufige Strukturen bleiben ein Ausbaupunkt. Der nach außen kompatible Downloadpfad akzeptiert derzeit Simulator-SA-Nummern; eine produktive Integration sollte stabile PDS-UUIDs verwenden. Beide umgestellten Lesefunktionen benötigen **keine View**.

Zusätzliche Tests (`src/platform/pds/simulator/tests/pds-service-reads.test.mjs`) prüfen historische und neue Dateien, wiedergeöffnete Testdatenbanken, API-Pfade, Gruppierung, Objektfilter, Paginierung, Suchbegriffe, unbekannte Nummern, fremde Dokument-UUIDs, binäre HTTP-Antworten und Fehlerweitergabe ohne Fallback. Alle Testdatenbanken sind temporär und getrennt von der Entwicklung.

## Gezielte Prüfung: Bauleiter-/Projektleiterzuweisung

Prüfstand: 02.11.2026, bereitgestellte `openapi.yaml`, Version 1.0. „Projektleiter“ ist die kundenspezifische Oberflächenbezeichnung; technisch wurde ausdrücklich auch nach dem PDS-Standardnamen „Bauleiter“ gesucht. Alle Vorkommen von `bauleiterUUIDs` stehen in Lesemodellen: Projektakte (Liste und Details), Serviceauftragsdetails, Rücklaufdetails und Vorgangsdetails. Ein `readOnly`-Attribut ist dabei nicht zwingend gesetzt; entscheidend ist, dass die konkreten Schreibendpunkte andere Requestmodelle ohne dieses Feld verwenden. Ein vorhandenes Responsefeld belegt keine Schreibmöglichkeit.

Geprüfte alternative Schreibwege einschließlich ihrer referenzierten Requestmodelle:

| API-Endpunkt | Geprüftes Modell / Befund |
| --- | --- |
| POST `/service/create` | `PdsAPIServiceAuftragAnlegenRESTModel` → `PdsAPIServiceVorgangAnlegenDatenRESTModel`: `bearbeiterUUID` und `projektakteUUID`, aber keine Bauleiterzuweisung. |
| POST `/service/update` | `PdsAPIServiceAuftragUpdateRESTModel`: UUID, externe Nummer, Selektionskriterien; kein Bauleiterfeld. |
| POST `/service/createstoerung`, `/service/updatestoerung` | Hauptmonteur und weitere Monteure betreffen die Einsatzplanung, nicht die Bauleiter-/Projektleiterverantwortung. Kein entsprechendes Requestfeld. |
| POST `/vorgang/create` | `PdsAPIVorgangAnlegenRESTModel` → `PdsAPIVorgangAnlegenDatenRESTModel`: Bearbeiter und Projektaktenbezug, keine Bauleiterzuweisung. Das zugehörige Context-Enum enthält außerdem kein `SERVICEAUFTRAG`; ein generischer Vorgang ist damit kein belegter Ersatz für die Serviceanlage. |
| POST `/vorgang/updatevorgang` | `PdsAPIVorgangUpdateRESTModel` mit Context und `PdsAPIVorgangUpdateVorgangsDatenRESTModel`: kein Bauleiterfeld. Context-Enum ebenfalls ohne `SERVICEAUFTRAG`. |
| POST `/projektakte/create` | `PdsAPIProjektakteAnlegenRESTModel` → `PdsAPIProjektakteAnlegenDatenRESTModel`: `bearbeiterUUID`, Ansprechpartner und Kunde, aber kein `bauleiterUUIDs`. |
| POST `/projektakte/updateprojektakte` | `PdsAPIProjektakteUpdateRESTModel`: Bezeichnung, externe Auftragsnummer, API-ID, Teams-Link, Status und Selektionskriterien; keine Bauleiterzuweisung. |
| `/service/updateinfofelder`, `/vorgang/updateinfofelder`, `/projektakte/updateinfofelder` | Generische Infofeldpflege ist dokumentiert. Eine Zuordnung eines Infofelds zur nativen Bauleiterliste oder eine entsprechende Nebenwirkung ist nicht dokumentiert; daher kein belegter Ersatz. |
| POST `/crm/createaufgabezuweisung` | Weist CRM-Aufgaben zu, nicht die Bauleitung eines Serviceauftrags oder einer Projektakte. |

**Ergebnis:** Im vorliegenden Vertrag ist auch über Vorgänge oder Projektakten keine dokumentierte Schreibmöglichkeit für die native Bauleiterzuweisung nachgewiesen. Ebenso ist keine dokumentierte Vererbungsregel ersichtlich, nach der die Verknüpfung einer Projektakte die Bauleiter eines Serviceauftrags setzt. Das bedeutet nicht, dass eine solche Funktion technisch unmöglich ist; sie ist mit dieser Spezifikation nicht belastbar implementierbar. Es wurde kein produktives PDS angesprochen und kein unbekanntes Zusatzfeld versuchsweise gesendet.

### Konkrete Rückfrage an PDS

> Wir möchten über die pds API die native Bauleiterzuweisung eines Serviceauftrags setzen bzw. ändern. In unserer Oberfläche heißt dieses variabel beschriftbare Standardfeld „Projektleiter“. In der bereitgestellten OpenAPI-Version 1.0 wird `bauleiterUUIDs` in `PdsAPIServiceAuftragDetailsRESTModel` sowie in Projektakten-/Vorgangs-Lesemodellen zurückgegeben. In den dokumentierten Create-/Update-Requestmodellen für Serviceaufträge, Vorgänge und Projektakten fehlt dieses Feld jedoch.
>
> Welcher unterstützte API-Endpunkt mit welchem Requestmodell setzt diese Zuordnung? Bitte nennen Sie den exakten JSON-Feldnamen, ein vollständiges Beispiel mit Serviceauftrags-UUID und Bauleiter-UUID sowie die benötigte API-/Softwareversion und Benutzerberechtigung. Referenzieren die Einträge Mitarbeiter-, Benutzer- oder Personen-UUIDs? Ersetzt die Übergabe die gesamte Bauleiterliste oder ergänzt sie Einträge, und wie werden einzelne bzw. alle Zuordnungen entfernt?
>
> Falls die Zuordnung ausschließlich über eine Projektakte erfolgt: Über welchen dokumentierten Schreibaufruf werden deren Bauleiter gesetzt, und wann bzw. wie wird die Zuordnung auf bereits bestehende und neue Serviceaufträge übernommen? Ist diese Vererbung ausdrücklich unterstützt? Falls stattdessen eine Infofeld-API vorgesehen ist, benötigen wir die genaue Feldkennung und die Bestätigung, dass sie die native Bauleiterliste pflegt. `bearbeiterUUID` möchten wir nicht ohne bestätigte fachliche Gleichsetzung als Ersatz verwenden.
>
> Falls der veröffentlichte Vertrag unvollständig ist, bitten wir um die ergänzte OpenAPI-Spezifikation bzw. die passende offizielle API-Erweiterung.

Bis zur Antwort bleibt die Projektleiterzuweisung ausdrücklich eine lokale Simulator-/Plattformfunktion. Der dokumentierte Lesepfad bleibt `/service/details` mit `bauleiterUUIDs`. **Keine View erforderlich für das Lesen dieses Felds; keine View als Schreibersatz.** Die Rückfrage wurde nur dokumentiert und nicht an PDS versendet.

## AD-Anmeldung, zentraler API-Zugang und Bearbeiter (02.11.2026)

Eine zentrale API-Verbindung mit `PDS_API_TOKEN` wird für alle Plattformbenutzer vorbereitet. Kein persönlicher API-Token ist erforderlich. Die Identität stammt aus der Sitzung (früher LDAPS mit Zuordnung AD-objectGUID → PDS-Bearbeiter; LDAPS entfernt am 19.11.2026). Für Microsoft-Konten ist die Bearbeiterzuordnung noch offen. Anmeldung und fachlicher Bearbeiter sind unabhängig vom technischen API-Konto.

| Bedarf | Dokumentierter Weg | Stand / verbleibende Grenze |
| --- | --- | --- |
| Anmeldung und Dispositionsberechtigung | Microsoft-Anmeldung (Entra ID), Rollen in HeyElli | LDAPS entfernt (19.11.2026). Bearbeiterzuordnung für Microsoft-Konten offen. Keine PDS-API oder View erforderlich. |
| AD-Benutzer dem PDS-Bearbeiter zuordnen | Freigegebene lokale Zuordnung auf feste Kennungen | Keine View nötig. Die erwartete Kennung von `bearbeiterUUID` und eine unterstützte Benutzerauflösung sind mit PDS zu bestätigen. |
| Serviceauftrag mit persönlichem Bearbeiter anlegen | `POST /service/create` → `vorgangsdaten.bearbeiterUUID`, Schema `PdsAPIServiceVorgangAnlegenDatenRESTModel` | Im Simulator-Workflow aus geprüfter Sitzung gesetzt, persistiert und über API-Details lesbar; bei fehlender Zuordnung Abbruch vor Schreibzugriff. Clientwerte werden ignoriert. |
| Allgemeine Aufträge und Angebote anlegen | `POST /vorgang/create`, `context.vorgangstyp=AUFTRAG` bzw. `ANGEBOT`, `vorgangsdaten.bearbeiterUUID` in `PdsAPIVorgangAnlegenDatenRESTModel` | API-Feld dokumentiert. Fachmodule noch nicht implementiert; gemeinsamer serverseitiger Zuweisungsbaustein `assignBearbeiter()` vorbereitet. |
| Projektakte anlegen | `POST /projektakte/create` → `projektdaten.bearbeiterUUID` in `PdsAPIProjektakteAnlegenDatenRESTModel` | API-Feld dokumentiert, Fachmodul noch nicht implementiert. |
| Bearbeiter bestehender Belege ändern | Feld fehlt in `PdsAPIServiceAuftragUpdateRESTModel` und `PdsAPIVorgangUpdateVorgangsDatenRESTModel` | Offene API-Schreiblücke; keine View-Schreibzugriffe. |
| API-Aufrufe authentifizieren | Zentraler technischer Bearer-Zugang | Vorbereiteter HTTPS-Transport verwendet ausschließlich `PDS_API_TOKEN`. Fachabläufe bleiben lokal simuliert. |
| Bauleiter-/Projektleiterzuweisung | Separates Feld, siehe gezielte Prüfung oben | `bearbeiterUUID` löst die weiterhin offene Bauleiter-Schreiblücke nicht. |

**Konkrete Fragen an PDS:** Auf welche Entität verweist `bearbeiterUUID` (PDS-Benutzer oder Mitarbeiter), wie wird deren Kennung unterstützt ermittelt, und darf ein zentraler technischer API-Benutzer andere Benutzer als Bearbeiter setzen? Welche Rechte sind dafür nötig? Wie kann der Bearbeiter eines bestehenden Serviceauftrags/Angebots/Auftrags geändert werden? Kann zusätzlich zum fachlichen Bearbeiter der tatsächlich angemeldete Plattformbenutzer in PDS-Revisionsdaten nachvollzogen werden, obwohl der API-Aufruf über den zentralen technischen Zugang läuft?

Für Anmeldung, Token und Bearbeiterzuweisung ist **keine View** vorgesehen. API-Lücken werden nicht durch View-Schreibzugriffe geschlossen. Einrichtung und Sitzungsgrenzen: [Microsoft-Anmeldung](../auth/microsoft-entra.md). Tests verwenden ausschließlich erfundene Kennungen, temporäre Datenbanken und simulierte HTTPS-Verbindungen.

### Zwei-Benutzer-Integrationstest

`src/platform/pds/simulator/tests/pds-two-users.test.mjs` prüft zwei getrennte simulierte Sitzungen mit unterschiedlichen AD-/PDS-Zuordnungen über **dieselbe Instanz des HTTPS-Transports und denselben zentralen Bearer-Zugang**. Die simulierte HTTP-Grenze leitet dokumentierte `/service/create`, `/service/createstoerung` und `/service/details` an den persistenten PDS-Emulator weiter; UUIDs und SA-Nummern werden tatsächlich dort erzeugt. Keine vorgegebenen Erfolgsantworten für die Auftragsanlage.

Geprüft: je Auftrag eigener `bearbeiterUUID` aus der Sitzungszuordnung, ignorierter abweichender Eingabewert, unterschiedliche Aufträge/SA-Nummern, gleiche API-Authentifizierung, getrennte Sitzungen mit Abmeldung, wiederholte Anlage ohne Duplikate und API-Rücklesen beider Bearbeiter nach Schließen/Wiederöffnen der Datenbank. Das Testgeheimnis wird nur zur Laufzeit zufällig erzeugt; Testdatenbank und Dateien liegen ausschließlich im temporären Testverzeichnis und werden entfernt. Keine Entwicklungsdatenbank und keine bestehenden lokalen Zugangsdaten werden verwendet. Kein View-Zugriff nötig. Dies ist ein automatisierter Integrationstest mit simulierten Sitzungen und HTTP-/PDS-Grenzen; Browseranmeldung, echtes LDAP und reales PDS werden damit nicht geprüft.

Browserprüfung mit zwei simulierten Benutzern am 02.11.2026 erfolgreich: zwei unterschiedliche Bearbeiter in zwei Serviceaufträgen, ein gemeinsamer zentraler HTTPS-API-Zugang, API-Rücklesen und persistierte Erstellerzuordnung geprüft. Testanpassungen ausschließlich in separater Kopie; echtes AD/PDS weiterhin ungeprüft. Ablauf und Grenzen: Browser-Testbericht (Prüfnachweis in der Git-Historie).

## Eingebauter lokaler AD-Demomodus

`AUTH_MODE=demo-directory` unterstützt jetzt die fiktiven Benutzer `demo.alex` und `demo.kim` direkt in der Anwendung. Die feste simulierte Verzeichniskennung wird derselben PDS-Zuordnungsvalidierung und Sitzungsprüfung zugeführt. Bei `/service/create` wird weiterhin `vorgangsdaten.bearbeiterUUID` serverseitig übernommen. Gemeinsame lokale Simulator-API, keine persönlichen API-Tokens und keine zusätzliche View. Produktionssperre; nach Aktivierung der Microsoft-Anmeldung ist die Demo-Anmeldung ersetzt. Der echte HTTPS-Transport mit zentralem Token und die offenen PDS-Kennungs-/Berechtigungsfragen bleiben unverändert. [heyelli-Konten](../auth/accounts.md).

Die Anmeldung wird jetzt plattformweit in der gemeinsamen oberen Menüleiste angeboten. `GET/POST/DELETE /api/simulator-session` und die serverseitige Bearbeiterzuordnung bleiben unverändert; Tokenwerte und PDS-Zugangsdaten gelangen weiterhin nicht zum Browser. Keine neuen PDS-Endpunkte oder Views erforderlich. Browserprüfung von Anmeldung, Abmeldung, Modulwechsel und fortbestehender Benutzeranzeige erfolgreich.

„Auftrag verwerfen“ setzt ausschließlich die laufende Browsererfassung zurück. Kein PDS-Lösch-/Stornoaufruf und kein View-Zugriff; angelegte Ansprechpartner, bereits übertragene Auftragsdaten sowie lokale Stagingdateien bleiben erhalten. Der Vorgang ist während Speichern/Upload gesperrt. Eine serverseitige Bereinigung unverknüpfter Dateien bleibt offen.

Der Navigationsschutz für ungespeicherte CaseDeskn arbeitet ausschließlich im Browser. Beim bestätigten Verlassen wird der Erfassungszustand verworfen und das gewählte Ziel geöffnet; keine neue PDS-API, kein Storno-/Löschaufruf und keine View erforderlich. Bestehende PDS-Daten und Stagingdateien bleiben erhalten. Native Warnungen beim Neuladen/Tabschließen unterliegen den Browsergrenzen; kein serverseitiger Entwurfsdienst ergänzt.

## Angebote mit Artikeln aus dem PDS-Katalog

Prüfung der bereitgestellten OpenAPI am 02.11.2026; Dokumentationsprüfung, keine echten API-Aufrufe und noch kein Angebotsmodul implementiert.

| Bedarf | Dokumentierte API / Schema | View / Stand und Grenzen |
| --- | --- | --- |
| Katalogartikel suchen | `POST /katalog/listartikel`, `PdsAPIKatalogSucheRESTModel`: `suchwort`, `suchfelder`, Paging und `katalogEintragsTypen`; Endpunkt beschreibt Artikel und Artikel inkl. Lohn | Keine View erforderlich. Im aktuellen Simulator noch nicht implementiert. |
| Artikeldetails und Preise lesen | `POST /katalog/details` mit `{uuid}`, `PdsAPIKatalogEintragDetailsRESTModel`: Texte, Typ, Einheit, `preisEinheit`, `preisStrategien`, `vkPreisFix`, Lieferanteneinträge | Keine View erforderlich. Welche Preisstrategie für Kunde/Vorgang greift, ist vor Umsetzung zu klären; gelesener Katalogpreis ist kein Nachweis des endgültigen Kundenpreises. |
| Neues Angebot mit Katalogartikeln anlegen | `POST /vorgang/create`, `context.vorgangstyp=ANGEBOT`, `vorgangsdaten.personUUID`, `bearbeiterUUID`, `rootEbene.positionen[]` (oder Unterebenen); Position: `PdsAPIPositionAnlegenRESTModel` mit `katalogUUID`, `positionsTyp`, `menge` und optional Texten, `ekPreis`, `vkPreis`, `preiseinheit`, `masseinheitUUID` | Dokumentierter API-Weg, keine View. Katalog-UUID aus der API verwenden. Noch kein ausführbarer Angebotsworkflow/Simulatorendpunkt. |
| Bestehende Angebotsposition bearbeiten | `POST /vorgang/updateposition`, Kontext `ANGEBOT`, `vorgangsDaten.uuid` und `positionsDaten[]` | Separater Update-Vertrag. Daraus keine Funktion zum Hinzufügen neuer regulärer Positionen ableiten. |
| Einem bestehenden Angebot neue reguläre Positionen hinzufügen | Kein eigenständiger allgemeiner `/vorgang/createposition`-Endpunkt dokumentiert; `/vorgang/updatevorgang` bietet keine Root-/Positionsstruktur | Offene Schreibfrage an PDS, niemals View-Schreiben. `/service/createposition` gilt für Serviceaufträge und ist kein Ersatz für Angebote. |
| Nachtragsangebot anlegen | `POST /vorgang/createnachtragsangebot` mit `uuid` und optional `rootEbene`, Schema `PdsAPINachtragAnlegenRESTModel` | Separater dokumentierter Nachtragsworkflow. Nicht als normales Anhängen an ein bestehendes Angebot behandeln; Bezug und fachliche Auswirkungen vor Umsetzung prüfen. |

**Konkrete Fragen an PDS:** Reicht bei einer Angebotsposition `katalogUUID` plus Menge zur vollständigen Übernahme von Texten, Einheiten und Kalkulation, oder welche Felder müssen explizit mitgesendet werden? Wie werden kundenspezifische Preise, Preisstrategien, Preiseinheiten und Rabatte bei der Angebotsanlage ermittelt? Welcher unterstützte API-Aufruf ergänzt neue reguläre Positionen in einem bestehenden Angebot, ohne daraus ein Nachtragsangebot zu machen?

### Angebotsvorlage auswählen

Vorhandene Angebotsvorlagen sind über `POST /vorgang/listvorlagen` mit `{vorgangstyp:"ANGEBOT"}` dokumentiert. `PdsAPIVorgangVorlageRESTModel` liefert `uuid`, `dbid`, `bezeichnung` und `standard`. Bei `POST /vorgang/create` kann der Kontext neben `vorgangstyp:"ANGEBOT"` das Feld `vorgangsVorlageName` enthalten (`PdsAPIVorgangAnlegenContextRESTModel`). Es wird ein Vorlagenname übergeben, keine Vorlagen-UUID. Keine View erforderlich; in HeyElli/Simulator noch kein Angebotsvorlagen-Workflow implementiert.

Eine eigene Standardauswahl je HeyElli-Modul wäre lokale Anwendungskonfiguration. Die bereitgestellte API dokumentiert keinen Endpunkt zum Anlegen/Bearbeiten von Angebotsvorlagen oder zum Ändern des PDS-Standardkennzeichens. Vorlagenpflege erfolgt daher vorerst in PDS. Offen mit PDS bestätigen: Entspricht `bezeichnung` aus der Vorlagenliste exakt dem von `vorgangsVorlageName` erwarteten Namen, welche Vorlageninhalte werden übernommen (z. B. Positionen, Texte, Kalkulation, Drucklayout), und welche Standardvorlage greift beim Weglassen des Felds? Die Vorlagenauswahl allein belegt keine frei steuerbare Drucklayoutauswahl.


## PlanBoard – erste Ausbaustufe (02.11.2026)

Die Kachel Raumservice wird durch den PlanBoard unter `/planboard` ersetzt. Die Plattform verwendet für Ressourcen, Termine und Änderungen ausschließlich den PDS-Transport. Im lokalen Betrieb beantwortet diesen der Simulator; eine Verbindung zum produktiven PDS wurde nicht getestet. Die Demotermine und Namen sind vollständig erfunden.

| Funktion / Daten | Vorrangiger dokumentierter API-Weg | View / verbleibende Grenze |
| --- | --- | --- |
| Planbare Mitarbeiter, Namen, Personalnummern und Gültigkeit | `POST /mitarbeiter/listmitarbeiter`, `POST /mitarbeiter/detailsbatch`; `ressourcenplanzeit.vonDatum/bisDatum`, `ressourcengruppenUUIDs` | Keine View. Derzeit Mitarbeiterressourcen; Geräte/Fahrzeuge sind nicht umgesetzt. |
| Ressourcengruppen | `GET /administration/listressourcengruppen` | Keine View. |
| Zeitraumbezogene Planung | `POST /termin/listplanung` mit Mitarbeiter-UUIDs und `zeitraum.vonDatum/bisDatum`; Paging, gemeinsame Termine anhand UUID dedupliziert | Keine View. Tages-, Wochen- und Monatsansicht verwenden denselben Ablauf. |
| Termindetails und Zustände | `POST /termin/detailsbatch`, vor Änderungen `POST /termin/details`; u. a. `bezeichnung`, `startZeitpunkt`, `endZeitpunkt`, `mitarbeiterUUIDs`, `status`, `typ`, `fix`, `ganzerTag`, `kategorien` | Keine View. Private Abwesenheiten erhalten einen neutralen Titel. Status wird angezeigt, nicht durch Ziehen geändert. |
| Verschieben, Zeitkanten und Ressourcenzuordnung | `POST /termin/update` mit `uuid`, `startZeitpunkt`, `endZeitpunkt`, `mitarbeiterUUIDs` | Ausschließlich API-Schreiben. Andere beteiligte Mitarbeiter bleiben erhalten; Doppelzuordnung und fixierte Termine werden abgewiesen. Das 15-Minuten-Raster ist eine HeyElli-Bedienentscheidung. Ganztagstermine werden tageweise verschoben. |
| Automatische Zustandsfarben | Status/Typ kommen aus der Termin-API; dort ist kein Farbwert bzw. keine PDS-Farbregel dokumentiert | **Offen:** unterstützten Endpunkt für PDS-Farbregeln erfragen. Nur wenn es keinen gibt, lesende freigegebene View verwenden. Der Simulator bietet ausdrücklich die erfundene View `sim_calendar_colors` über `GET /datenansichten/list` und `POST /datenansichten/listdaten` an, mit Spalten `status`, `typ`, `farbe` (Hex). Kein behaupteter PDS-Standardname. Die UI kennzeichnet diese Farben als Demo. Ohne freigegebene Zuordnung gibt es gekennzeichnete Ersatzfarben. API-Fehler führen nicht zu einem View-Fallback. |
| Arbeitszeitmodelle, Feiertage, Restkapazitäten, individuelle PDS-Sortierung | Noch kein vollständiger Ablauf implementiert | Kein View-Zugriff hierfür implementiert. Angezeigt werden verplante Personenstunden; keine behauptete verfügbare Kapazität. Schattierte Bereiche 07–17 Uhr dienen nur der Orientierung. API-Verträge vor einer View-Erweiterung gezielt prüfen. |
| Termine aus geplanten Serviceaufträgen | `/service/createstoerung` mit `hauptmonteurUUID`, `weiteremonteureUUIDs`, `startZeitpunkt`, `endZeitpunkt`; Anzeige über `/termin/listplanung` und `/termin/detailsbatch` | Simulator bildet dieselbe Störungsebene automatisch als gemeinsamen Termin ab, ohne separaten freien Termin anzulegen. Keine View. Reale automatische PDS-Verknüpfung/Mobilitätswirkung bleibt zu bestätigen; Details siehe Ergänzung unten. |

**Konkrete Fragen an PDS:** Welcher API-Endpunkt liefert die tatsächlich konfigurierte Farbpriorität und Farbwerte der Ressourcenplanung (Status, Termintyp, Kategorie oder weitere Kriterien)? Falls keiner: Welche freigegebene lesende View liefert diese Regeln einschließlich Priorität und Gültigkeit? Darf `/termin/update` bei allen in `/termin/listplanung` gelieferten Termintypen Beginn, Ende und Mitarbeiter ändern, insbesondere bei Serviceauftrags-/Tätigkeitsterminen, und welche Auswirkungen hat dies auf Serviceplanung und Mobilität? Wird beim Service-Planungsaufruf automatisch ein solcher Termin erzeugt, und wie werden dessen UUID und Dauer bestimmt? Unterstützt die Termin-API Versionsnummern, ETags oder eine atomare Bedingung gegen konkurrierende Änderungen?

Vor dem Schreiben wird der Termin erneut über die API gelesen und mit dem Ausgangsstand verglichen. Gleichzeitige Änderungen innerhalb eines Serverprozesses werden je Termin serialisiert, veraltete Stände mit Konflikt zurückgewiesen. Das ist ohne dokumentierte PDS-Versionsbedingung **kein atomarer Schutz gegen externe PDS-Schreiber oder mehrere Plattformprozesse**. Fehler rollen die lokale Vorschau zurück. Anmeldung und Disponentenrolle werden für Lesen/Schreiben serverseitig geprüft; Schreibzugriffe erfordern denselben Ursprung. Es werden keine neuen Zugangsdaten und keine Datenbankstruktur eingeführt. Änderungen liegen innerhalb des Simulators in der bestehenden generischen API-Entitätstabelle; die JSON-Seeddatei bleibt unverändert.

Noch nicht umgesetzt: Statuswechsel, Kapazitätsberechnung und vollständige Nachbildung aller PDS-Planungsfunktionen. Prüfungen: `src/apps/planboard/kalender/tests/resource-calendar.test.mjs` und Browserbericht (Prüfnachweis in der Git-Historie).


### Geplante Störungen automatisch im Kalender (02.11.2026)

Die bisherige Simulator-Lücke ist geschlossen: Geplante Serviceaufträge erscheinen automatisch als Termine vom Typ `SERVICEAUFTRAGEBENE`, bei Haupttechniker und sämtlichen Begleitern, mit derselben stabilen Termin-ID. Die Anzeige enthält die SA-Nummer und Objekt/TE; die Termindetails nennen Haupt- und Begleittechniker. Ungeplante bzw. übersprungene Planungen erzeugen keinen Termin. Vorhandene API-Störungsebenen, historische lokale Aufträge und die geplante fiktive Bestands-SA werden ebenfalls abgebildet. Keine produktiven Daten importiert.

| Ablauf | Dokumentierte API-Felder / lokale Umsetzung | View / offene Punkte |
| --- | --- | --- |
| Einsatzdauer erfassen und übertragen | CaseDesk: 15–1440 Minuten in 15-Minuten-Schritten, Vorgabe 60 Minuten. `/service/createstoerung`, Schema `PdsAPIServiceAuftragEbeneAnlegenRESTModel`, enthält bereits `startZeitpunkt` **und** `endZeitpunkt`, Haupt- und weitere Monteure. Ende wird aus Beginn plus tatsächlicher Dauer berechnet. | Keine View und kein erfundenes API-Feld `Dauer`. |
| Gemeinsamen Einsatz im Kalender lesen | Simulator projiziert die bestehende Störungsebene als Termin mit stabiler ID, `typ=SERVICEAUFTRAGEBENE`, `vorgangUUID`, `vorgangstyp=SERVICEAUFTRAG`, `objektUUID`, `mitarbeiterUUIDs` und `text`. Plattform liest ausschließlich `/termin/listplanung`, `/termin/detailsbatch` bzw. `/termin/details`. | Keine zusätzliche `/termin/create`-Anlage und keine View. Die Projektionslogik ist explizit Simulatorverhalten; die tatsächliche automatische Terminerzeugung im realen PDS ist noch zu bestätigen. |
| Bestehende Planungen ohne Endzeit | Im Emulator vorläufig 60 Minuten, in Titel/Details ausdrücklich markiert. Nach Ändern der Zeitkante wird die echte Endzeit gespeichert und die Markierung entfernt. | Keine behauptete PDS-Standarddauer; in Produktion Endzeit aus PDS verwenden bzw. fachlich klären. |
| Gemeinsamen Einsatz verschieben oder verlängern | Plattform weiterhin `/termin/update`; Emulator aktualisiert die zugehörige API-Störungsebene in einem einzelnen Datenbankschreibzugriff. `/service/details` und `/service/liststoerungen` liefern anschließend dieselben Zeiten und Monteure. | Keine View. Bei historischen Aufträgen ohne API-Störungsebene persistente Simulator-Überlagerung, die ebenfalls in Service-API-Leseantworten berücksichtigt wird. Alte Auftragssnapshots werden nicht umgeschrieben. |
| Haupt-/Begleitrolle beim Ressourcentausch | Beim Austausch des Haupttechnikers übernimmt die neue Ressource dessen Rolle. Beim Austausch eines Begleiters bleibt der Haupttechniker erhalten. Die Mobilitätsausgabe bleibt am Serviceauftrag und der Hauptmonteur bleibt maßgeblich. | Simulatorsemantik. Mobilitäts-Neuzustellung bzw. Rücknahme bei realem Technikerwechsel nicht implementiert oder belegt. |
| Automatische Aktualisierung der Kalenderanzeige | Beim Öffnen, bei Rückkehr zum Browserfenster und alle 30 Sekunden im sichtbaren Kalender; laufende Verschiebe-/Speichervorgänge sind davon ausgenommen. | Keine zusätzliche PDS-API, kein Pushdienst, keine View. |

Idempotente Wiederholung der Auftragsanlage erzeugt keinen zweiten Termin und setzt eine nachträglich bearbeitete Planung nicht zurück. Kalenderänderungen bleiben nach Wiederöffnen der Simulator-Datenbank bestehen. Keine neue Datenbankstruktur/Migration nötig; bestehende API-Entitäten werden genutzt. Die ursprüngliche Auftragsanlage bleibt mehrstufig; eine fehlgeschlagene Mobilitäts-/Dokumentphase kann bereits eine erfolgreich angelegte und geplante Störungsebene hinterlassen. Wiederholung verwendet weiterhin den vorhandenen API-Workflow.

**Fragen an PDS bleiben konkret offen:** Erzeugt `/service/createstoerung` mit Beginn, Ende, Hauptmonteur und weiteren Monteuren automatisch genau einen über `/termin/listplanung` sichtbaren Termin? Ist die Termin-ID über `/service/findstoerungtermin` ermittelbar, und wie werden mehrere Störungsebenen eines Auftrags zugeordnet? Aktualisiert `/termin/update` bei `SERVICEAUFTRAGEBENE` auch die Service-Ebene und bleibt die Unterscheidung Hauptmonteur/weitere Monteure erhalten? Welche zusätzlichen dokumentierten Aufrufe sind nach einem Hauptmonteurwechsel für Mobilität erforderlich? Diese Fragen nicht durch schreibende Views umgehen. Die Farb-, Kapazitäts- und Konkurrenzfragen aus der ersten Kalenderstufe bleiben unverändert.

Browserprüfung des vollständigen Ablaufs erfolgreich: Serviceaufträge im Kalender (Prüfnachweis in der Git-Historie).


### Rollenkennzeichnung am Terminbalken (03.11.2026)

| Bedarf | API-Weg | View / Grenze |
| --- | --- | --- |
| Haupt-/Begleitrolle einer Mitarbeiterzeile | Termin-DTO liefert Teilnehmer, aber keine zugesicherte Rollensortierung. Deshalb `POST /service/details` je verknüpftem Serviceauftrag (`vorgangUUID`), anschließend `POST /service/findstoerungtermin` mit UUID der geplanten Störungsebene. Die dort gelieferte Termin-UUID ordnet `hauptmonteurUUID` und `weiteremonteureUUIDs` eindeutig dem Balken zu. | Keine View. Simulator unterstützt den dokumentierten Lookup jetzt ebenfalls. Keine selbst erfundenen PDS-Terminfelder. Die normalisierte Plattformantwort erhält Rollen-IDs aus diesen API-Daten. |
| Anzeige nach Terminänderung | Nach `/termin/update` dieselbe API-Zuordnung erneut lesen. | Keine View und keine Rollen-Schreibfelder aus dem Browser. Allgemeine Termine ohne Servicebezug bleiben ohne Rollenmarkierung. |

UI: H = Haupttechniker, B = Begleitender Techniker, Legende ständig sichtbar. Auf breiten Balken ausgeschrieben, auf kurzen Balken als Kürzel oberhalb des Balkens. Rollenmarkierung unabhängig von Statusfarben. Die Endpunkte und Felder sind dokumentiert; Echttest der Service-/Terminkopplung und der Rolle nach Mobilitätswechsel bleibt offen wie oben beschrieben. Kein Schluss von der Reihenfolge in `mitarbeiterUUIDs` auf den Hauptmonteur.

Prüfbericht: Technikerrollen am Balken (Prüfnachweis in der Git-Historie).


### Begleiter im bestehenden Kalendereinsatz ändern (03.11.2026)

| Funktion | Dokumentierter API-Ablauf | View / Stand |
| --- | --- | --- |
| Vorhandenes Team lesen | `/service/details` plus `/service/findstoerungtermin`; Rollen und Störungsebenen-UUID werden serverseitig ermittelt. | Keine View, kein Rückschluss auf Rollen aus der Teilnehmerreihenfolge. |
| Begleiter neu festlegen / entfernen | `POST /service/updatestoerung`, `PdsAPIServiceAuftragEbeneUpdateRESTModel`. Die Endpunktbeschreibung verlangt bei Monteuränderungen **beide Felder**: `hauptmonteurUUID` aus dem aktuellen API-Stand und `weiteremonteureUUIDs` mit der neuen Auswahl, bei vollständigem Entfernen `[]`. Gemeinsamer Beginn und Ende werden mitgesendet. | Keine View und kein neues freies Kalenderereignis. Haupttechniker bleibt serverseitig erhalten. Ein neuer Haupttechniker muss explizit gewählt und serverseitig als planbare Ressource geprüft werden; Rollenüberschneidung wird abgewiesen. |
| Kalender nach dem Speichern lesen | `/service/findstoerungtermin` und Service-Rollenauflösung erneut lesen. | Simulator liefert denselben Termin mit aktualisierten Beteiligten und H/B-Markierungen. Echtes PDS weiterhin nicht angebunden. |

Die UI bietet Pillen mit × und Suche ab drei Zeichen. Kein Haupttechniker oder doppelt ausgewählter Begleiter in den Treffern. Fixierte Termine bleiben gesperrt. Server prüft Ressourcen, Dubletten, Rollenüberschneidung, Zeiten sowie Ausgangsstand einschließlich Haupttechniker vor dem Schreiben. Veraltete Stände werden abgewiesen. Leere Begleiterliste ist ausdrücklich zulässig; der Haupttechniker bleibt Teilnehmer. Allgemeine Termine ohne Servicezuordnung erhalten diesen Rolleneditor nicht.

Simulator: `/service/updatestoerung` unterstützt hier die Planungsfelder UUID, Beginn, Ende, Haupt- und weitere Monteure; andere Störungsfelder liefern „noch nicht simuliert“. Ein einzelner persistenter Schreibzugriff aktualisiert die Störungsebene, historische Aufträge ohne native API-Störung erhalten eine Simulatorüberlagerung. Keine neue Tabelle/Migration. Kein Workflow-Schrittcaching für fortlaufende Bearbeitungen, deshalb sind wiederholte unterschiedliche Änderungen möglich.

**Weiter offen für reales PDS:** Wird eine Änderung mit `/service/updatestoerung` unmittelbar am vorhandenen Termin sichtbar, einschließlich vollständigem Entfernen der Begleiter? Welche zusätzlichen Schritte gelten für bereits mobil ausgegebene Aufträge? Es wird kein neuer Mobilitätsversand behauptet. Atomarer Schutz gegen fremde externe Schreiber bleibt mangels dokumentierter Versionsbedingung offen. Lesefehler bzw. Schreibfehler lösen keinen View-Fallback aus.

Prüfung: Begleiter bearbeiten (Prüfnachweis in der Git-Historie).


### Haupttechnikerwechsel im Bearbeitungsdialog (03.11.2026)

| Funktion | API | View / Stand |
| --- | --- | --- |
| Haupttechniker explizit wechseln, Begleiter erhalten | `POST /service/updatestoerung`: `hauptmonteurUUID` = geprüfte neue Auswahl, `weiteremonteureUUIDs` = bestehende bzw. gleichzeitig bearbeitete Begleiter, mit Beginn/Ende. Die Endpunktbeschreibung verlangt beide Monteurfelder. | Keine View und kein neuer Termin. Vorherige Rollen werden aus `/service/details` und `/service/findstoerungtermin` gelesen. |
| H/B-Markierung aktualisieren | Nach Schreiben `/service/findstoerungtermin` und Service-Rollen erneut lesen. | Unveränderte Termin-ID. Neuer Hauptmonteur H, Begleiter B; bisheriger Hauptmonteur ist nicht mehr Teilnehmer, sofern er nicht ausdrücklich als Begleiter hinzugefügt wurde. |

Die Auswahl blockiert bereits ausgewählte Begleiter als Haupttechniker. Es werden keine Begleiter automatisch entfernt oder neue Begleiter aus dem bisherigen Haupttechniker erzeugt. Gleichzeitige ausdrückliche Rollenänderungen sind mit eindeutiger neuer Zuordnung möglich. Serverseitig werden neue Haupttechnikerkennung, Teilnehmermenge, Ressourcenverfügbarkeit, Dubletten und bestätigter Ausgangsstand einschließlich bisherigem Haupttechniker geprüft. Auch ein Rollentausch bei gleicher Teilnehmermenge gilt als Änderung. Fixierte Termine bleiben gesperrt.

Die frühere Beschränkung auf einen unveränderten Haupttechniker im Dialog ist damit aufgehoben. Die Mobilitäts-Neuzustellung nach einem Hauptmonteurwechsel bleibt wie bisher eine offene PDS-Frage; es erfolgt kein zusätzlicher `/service/mobilausgeben`-Aufruf auf Verdacht. Keine Änderung an Schema, Zugangsdaten oder Berechtigungen.

Prüfbericht: Haupttechnikerwechsel (Prüfnachweis in der Git-Historie).


### Haupttechniker als Kombi-Suchfeld (03.11.2026)

Reine Oberflächenänderung: Haupttechniker und Begleiter verwenden dieselbe lokale Auswahlkomponente, für den Haupttechniker im Einzelmodus mit Pille/× und Suche ab drei Zeichen. Die Kandidaten stammen weiterhin aus der vorhandenen Mitarbeiter-API; kein neuer Endpunkt und keine View. Die persistierte Auswahl wird erst beim Speichern über den oben dokumentierten `/service/updatestoerung`-Ablauf geändert. Während die Haupttechnikerpille entfernt ist, ist Speichern gesperrt; zusätzlich verhindert die Formularprüfung leere Zuordnungen. Serverseitige Validierung bleibt bestehen. Kein Schema- oder Konfigurationswechsel.

Browserprüfung: Haupttechniker-Kombisuche (Prüfnachweis in der Git-Historie).


### Ressourcen-Kombifeld und Beschreibung bereinigen (03.11.2026)

| Bedarf | API-Weg | View / Grenze |
| --- | --- | --- |
| Mehrere Teilnehmer eines allgemeinen Termins bearbeiten | Bestehende Termin-API, `POST /termin/update`, Feld `mitarbeiterUUIDs` mit der vollständigen eindeutigen Teilnehmerliste. Beginn und Ende bleiben gemeinsam. Rücklesen über Termin-API. | Keine neue View oder neuer Endpunkt. Aktuell Mitarbeiterressourcen, weiterhin keine Geräte/Fahrzeuge. Mindestens eine Ressource wird serverseitig verlangt; nicht planbare und doppelte Kennungen bleiben unzulässig. |
| Ressourcen-Kombisuche | Bereits geladene Mitarbeiter aus den bestehenden Mitarbeiter-APIs; lokale Suche ab drei Zeichen, Pillen und ×, vorausgewählte Teilnehmer. | Keine zusätzlichen API-Aufrufe für die Suche und keine View. Fixierte Termine bleiben gesperrt. |
| Doppelte Rollen im Beschreibungstext entfernen | Simulator hängt Haupt-/Begleitnamen nicht mehr an `Termin.text` an. Rollen werden weiterhin strukturiert per Service-API aufgelöst. | Fachlicher Freitext wird nicht anhand von Namen oder Stichwörtern gelöscht. Beschreibung und vorläufiger Dauerhinweis bleiben erhalten. Keine Datenmigration, keine Änderung an gespeicherten Auftragsbeschreibungen. |

Serviceeinsätze verwenden weiterhin die expliziten Haupt-/Begleiterfelder und `/service/updatestoerung` mit beiden Monteurfeldern; sie werden durch das allgemeine Ressourcen-Kombifeld nicht in freie Termine umgewandelt. Die bisherigen offenen Fragen zu realem PDS und Mobilität bleiben unverändert.

Prüfbericht: Ressourcen-Mehrfachauswahl (Prüfnachweis in der Git-Historie).


### Neue freie Termine (03.11.2026)

| Bedarf | Dokumentierter API-Weg | View / Grenze |
| --- | --- | --- |
| Neuen Termin anlegen | `POST /termin/create`, `PdsAPITerminAnlegenRESTModel`: `bezeichnung`, `typ=FREIER`, `status=GEPLANT`, `startZeitpunkt`, `endZeitpunkt`, `mitarbeiterUUIDs`, `text`, `ganzerTag=false`, `fix=false`. Termin-UUID kommt von der API. | Keine View. Simulator unterstützt zunächst ausschließlich freie, geplante, nicht ganztägige und nicht fixierte Neuanlagen. Keine automatische Serviceauftragsanlage. |
| Ressourcen und Zeiten vorauswählen | Vorhandene Kalenderzeitachse/Zeile; Tag/Woche 15-Minuten-Raster, Monat gewählter Tag 08:00; Vorgabedauer eine Stunde. | Reine UI-Vorbelegung. Kein PDS-Verfügbarkeitsmodell, keine Buchungssperre. Doppelklick auf einen bestehenden Balken erzeugt keinen neuen Termin; belegter Startzeitpunkt wird anhand bereits geladener Termine abgefangen. Spätere Überschneidungen oder externe Änderungen sind damit nicht ausgeschlossen. |
| Lesen nach Anlage | Bestehende `/termin/listplanung` und `/termin/detailsbatch`; UUID der Anlage wird sofort in die Anzeige aufgenommen. | Keine View. Gewähltes Datum wird angezeigt und Suchfilter zurückgesetzt, damit der neue Termin sichtbar wird. |

Der Plattform-Endpunkt `/api/ressourcenkalender/termine` prüft Sitzung/Disponentenrolle, gleichen Ursprung, begrenzten Request und Eingaben serverseitig. Titel erforderlich (max. 200 Zeichen), Beschreibung max. 4000 Zeichen, mindestens eine eindeutige planbare Ressource, Dauer mindestens 15 Minuten und maximal 62 Tage. Der Simulator speichert in der bestehenden API-Entitätstabelle; keine Migration. Ein eigener Workflow je Benutzer und Anlagekennung verhindert dort doppelte Anlage bei identischen Wiederholungen; geänderte Daten mit derselben Kennung liefern Konflikt. Die Kennung ist kein erfundenes PDS-DTO-Feld.

**Offene PDS-Frage:** Unterstützt das reale `/termin/create` eine idempotente Anlage bzw. einen eindeutig suchbaren externen Schlüssel, um eine nach Netzwerkabbruch unklare Anlage ohne Duplikate aufzulösen? Die Simulator-Garantie ist kein Nachweis einer entsprechenden realen PDS-Eigenschaft. Weitere Termintypen, Löschen und Statuswechsel sind nicht Teil dieser Erweiterung.

Prüfung auf Benutzerwunsch beendet: 52 automatisierte Tests waren erfolgreich; Lint, Typprüfung und Build waren vor der letzten kleinen Fokus-/Beschriftungsanpassung erfolgreich. Im Browser bestätigt: Doppelklick auf freie Stelle öffnet den Dialog mit 03.11.2026, 14:00–15:00 und Alex Beispiel vorausgewählt; Abbrechen erfolgt ohne Anlage. Der abschließende manuelle Speichervorgang wurde nach dem Abbruchwunsch nicht mehr geprüft. API-Anlage, persistentes Rücklesen, Validierung, Slotberechnung und Wiederholungsfälle sind automatisiert geprüft. Kein produktives PDS angebunden.


### Termin löschen mit Rückfrage (03.11.2026)

| Bedarf | Dokumentierter API-Weg | View / Grenze |
| --- | --- | --- |
| Termin löschen | `POST /termin/delete`, `PdsAPITerminDeleteRESTModel` mit `{uuid}`. Der dokumentierte Rückgabevertrag hat kein JSON-Schema; leere erfolgreiche Antworten (200/204) werden unterstützt, fachliche Fehler und HTTP-Fehler weiterhin abgewiesen. | Keine View. Die Plattform sendet nur die Termin-UUID an PDS. |
| Vorherigen Stand prüfen | `/termin/details` erneut lesen; UUID, Beginn, Ende und Mitarbeiterliste prüfen, fixierte Termine sperren. | Keine View. Wie bei Änderungen nur Serialisierung innerhalb eines Serverprozesses, kein atomarer Schutz vor externen PDS-Schreibern. |
| Gemeinsamen Termin entfernen | Dieselbe Termin-UUID einmal löschen; Anzeige anschließend aus allen Ressourcenzeilen entfernen. | Keine Einzeltermin-Duplikate je Mitarbeiter. Fehler erhalten die lokale Anzeige. |
| Servicebezug im Simulator | Persistente Löschmarkierung in vorhandenen API-Entitäten, auch für JSON-Demotermine und historische Service-Terminprojektionen. Gelöschte Termine fehlen in Planung/Details und kehren nach Neustart nicht zurück. Service-Leseprojektion entfernt zugehörigen Beginn/Ende. | Keine neue Tabelle oder Migration. Die Service-/Störungsdaten bleiben intern erhalten; keine Auftragslöschung und keine Mobilitätsstornierung. Die Entplanung in der Leseprojektion ist explizit Simulatorverhalten, kein Beleg für reales PDS. |

Plattform-Route `DELETE /api/ressourcenkalender` prüft serverseitig Sitzung, Disponentenrolle, gleichen Ursprung, begrenzten JSON-Body sowie den Ausgangsstand. UI-Rückfrage nennt Titel/Zeitraum und den Bezug auf alle Ressourcen. „Weiter bearbeiten“ und Escape lösen keinen Schreibaufruf aus. Während des Löschens sind Bestätigung, Abbrechen und Schließen gesperrt. Es gibt keine Wiederherstellungsfunktion in HeyElli. Die Bestätigung wirkt auf den gespeicherten Termin, nicht auf ungespeicherte Formularänderungen.

**Konkrete offene PDS-Fragen:** Darf `/termin/delete` für alle über `/termin/listplanung` gelieferten Typen verwendet werden, insbesondere `SERVICEAUFTRAGEBENE`, Tätigkeiten und Abwesenheiten? Welche Auswirkungen hat das Löschen auf Beginn/Ende, Haupt-/Begleitmonteure und bereits mobil ausgegebene Serviceaufträge? Wie wird eine gelöschte Serviceplanung unterstützt erneut geplant und welche Termin-UUID entsteht dabei? Im Simulator ist Wiederherstellung/erneute Planung einer gelöschten Störungsebene noch nicht implementiert. Keinen Storno-/Service-Löschaufruf und keine View-Schreibzugriffe aus dem Terminlöschen ableiten.

Prüfbericht: Terminlöschen (Prüfnachweis in der Git-Historie).


### Titel und Beschreibung bestehender Termine ändern (03.11.2026)

| Bedarf | Dokumentierter API-Weg | View / Grenze |
| --- | --- | --- |
| Titel/Beschreibung ändern oder Beschreibung leeren | `POST /termin/update`, `PdsAPITerminUpdateRESTModel`, mit `uuid`, optional `bezeichnung` und `text`. Leeren wird mit `text:""` übertragen. | Keine View. Nur tatsächlich bearbeitete Textfelder werden übergeben. Titel erforderlich, max. 200 Zeichen; Beschreibung max. 4000 Zeichen. |
| Vor dem Schreiben prüfen | `/termin/details`; für Rollen weiterhin Service-Zuordnung. Geänderte Textfelder werden gegen ihren bestätigten Ausgangstext geprüft, zusätzlich zu Zeiten/Teilnehmern. | Veraltete Texte liefern Konflikt. Fixierte Termine bleiben gesperrt. Keine Versions-/CAS-Garantie gegen externe PDS-Schreiber. |
| Serviceeinsätze | Terminfelder ebenfalls über `/termin/update`. Planung/Rollen bei Bedarf separat über `/service/updatestoerung` mit beiden Monteurfeldern. Reine Textänderung löst keinen Service-Planungsschreibzugriff aus. | Die Oberfläche ändert die **Terminbeschreibung**, nicht `auszufuehrendeArbeiten` oder die SA-Nummer. Keine automatische Mobilitäts-Neuausgabe. |
| Simulator-Persistenz | Freie Termine in bestehenden Kalender-API-Entitäten; Service-Termintexte als separate Überlagerung in derselben generischen API-Entitätstabelle. | Keine neue Struktur/Migration und keine View. Texte bleiben bei späteren Planungsänderungen und Neustart erhalten. Ursprüngliche Service-/Störungsbeschreibungen werden nicht überschrieben. |

Bei einer kombinierten Bearbeitung werden zunächst notwendige Service-Planungsänderungen gespeichert und danach Termintexte. Schlägt die zweite Phase fehl, ist dies ausdrücklich ein Teilfehler; die Oberfläche liest den aktuellen Kalenderstand neu und zeigt den Fehler. Kein vorgetäuschtes Zurückrollen der ersten API-Schreiboperation.

**Offene konkrete PDS-Fragen:** Sind `bezeichnung` und `text` für Termine vom Typ `SERVICEAUFTRAGEBENE` unabhängig editierbar oder werden sie aus der Service-Ebene abgeleitet/überschrieben? Welche Rückwirkung hat dies gegebenenfalls auf `auszufuehrendeArbeiten` oder `bemerkung`? Gibt es einen atomaren dokumentierten Ablauf für gleichzeitige Rollen-/Zeit- und Textänderungen? Die hier gewählte kalenderbezogene Trennung ist im Simulator geprüft, nicht gegen produktives PDS.

Prüfbericht: Termintitel und Beschreibung (Prüfnachweis in der Git-Historie).


### Funktionsabgleich der erweiterten PDS-Terminmaske (03.11.2026)

Der neue Screenshot wurde mit der bereitgestellten OpenAPI und dem aktuellen Modul verglichen. Zusätzliche API-Funktionen: Terminstatus, Ganztag, Fixierung, Kategorien, PIM-Flag, unterstützte weitere Neuanlagetypen, Anzeige verknüpfter Vorgangs-/Projekt-/Kundeninformationen und Termin-Dauerberechnung. Nicht ausreichend dokumentiert: originale Haupt-/Nebenfarben, Serien, vollständige Arbeitszeit-Anpassung und Tätigkeitsdetails. Für fehlende Lesedaten erst einen API-Weg erfragen, danach freigegebene Views prüfen; keine View-Schreibzugriffe.

Vollständige Zuordnung je Screenshotfunktion, API-Felder, vorhandener Stand, nötige Views/offene PDS-Fragen und empfohlene Reihenfolge: [PDS-Kalender-Funktionsabgleich](calendar-feature-audit.md). Reine Dokumentationsprüfung, keine neuen Funktionen implementiert und keine realen PDS-Aufrufe durchgeführt.

### Erweiterte Terminoptionen und verbindliche Farbpriorität (03.11.2026)

Dieser Abschnitt ersetzt die früheren Einschränkungen „nur freie geplante Termine“, „Kategorienliste leer“ und „Terminoptionen noch offen“. Die Umsetzung basiert auf der bereitgestellten OpenAPI; geprüft gegen den lokalen Simulator, nicht gegen produktives PDS.

| Funktion | API (hat Vorrang) | View / lokale Ergänzung / Grenze |
| --- | --- | --- |
| Terminstatus | `/termin/create`, `/termin/update`: `status=GEPLANT/FREI/VORGEMERKT`; Rücklesen über Details/Detailsbatch. | Keine View. Ändert ausschließlich den Terminstatus, keinen Auftragsstatus. |
| Ganztag und Dauer | Create/Update: `ganzerTag`, `startZeitpunkt`, `endZeitpunkt`. Datumsauswahl bei Ganztag, sonst Minuteneingabe mit h/min-Anzeige und mitgeführtem Ende. | Keine View. HeyElli verwendet Berlin-Ortszeit und ein ausschließliches Enddatum (00:00). Reale PDS-Ganztagssemantik/DST vor Echtnutzung bestätigen. |
| Fixierung | Create/Update: `fix`; eigener Button „Fixierung aufheben“ schreibt ausschließlich `{uuid,fix:false}`. | Keine View. Fixierte Termine sind bis zum bewussten Entsperren gegen Änderung, Ziehen und Löschen geschützt. Ausgangsstand wird serverseitig geprüft. |
| Kategorien | `GET /termin/listkategorien`; Mehrfachauswahl schreibt `kategorienUUIDs`; Details liefern `kategorien`. | Keine View. Drei fiktive Simulator-Kategorien. Kategorie-Ganztagsmerkmal wird angezeigt, nicht unbelegt automatisch angewandt. Keine Farben im Kategorie-API-Schema. |
| PIM | Create/Update: `pimSynchronisation`; Details lesen den Flagzustand. | Keine View. Simulator speichert nur den Schalter. Keine Outlook-/Exchange-Synchronisation durch HeyElli; PDS-Einrichtung, Zielkonto, Rechte und Wirkung offen. |
| Neue Terminarten | `/termin/create`: `FREIER`, `VORGANG`, `PROJEKT`, `ABWESENHEIT`, `PRIVATE_ABWESENHEIT`. Serviceeinsätze weiterhin über Service-API. | Keine View. Bestehender Typ bleibt lesend, da Termin-Update kein `typ` kennt. Urlaub/Tätigkeit sind keine gültigen Create-Typen. |
| Vorgangsbezug bei Anlage | `vorgangUUID` + `vorgangtyp`; Suche über dokumentierte Vorgangslisten für Auftrag, Angebot, Bedarfsmeldung, Rechnung, Lieferschein, Bestellung, Wareneingang, Rücknahme. Details zur Prüfung über `/vorgang/details`. | Für Abrufauftrag und Gutschrift keine eigene Liste dokumentiert: gezielte Suche mit bekannter UUID und passendem Typ über Details. Kein erfundener Listenendpunkt. Bestehende Verknüpfung nicht änderbar, weil Update keine Referenzfelder enthält. |
| Projektbezug bei Anlage | `/projektakte/listprojektakten`, `/projektakte/details`, anschließend `projektUUID` bei Termin-Create. | Keine View. Fachliche Gleichsetzung von Projektakte/`projektUUID` mit PDS vor Echtnutzung bestätigen. |
| Nummer, Titel, Kunde, **Auftrags-/Vorgangsstatus** | Service: `/service/details`; Vorgänge: `/vorgang/details`; Projektakte: `/projektakte/details`; Kunde ergänzend `/person/details`. | Keine View für diese vorhandenen Felder. Status ist lesend, unabhängig von Terminstatus und Tätigkeitsstatus. Für andere im Termin-Details-Enum vorkommende Vorgangsarten fehlen teilweise passende Detailsverträge; keine Ersatzstatus erfinden. |
| Einsatzort / Terminanschrift | Create/Update: `objektUUID`, `anschrift`; Objektsuche `/objekt/listobjekte` + Details. Bestehende Kundenanschriften aus `/person/listkunden` + `/person/details.postKommunikationswege`. Schreiben: `anschrift.urPostkommunikationswegUUID`; Lesen: `anschrift.urPostkommunikationsweg.uuid` (verschiedene DTOs). | Keine View. Nur vorhandene API-Anschriftenreferenzen, bearbeitbare Terminadressfelder; keine Stammdatenänderung. Leeren einer bestehenden Anschrift ist nicht dokumentiert, deshalb nur Ersetzen. Felder ohne Ursprungsreferenz sind nicht als frei schreibbare PDS-Anschrift behandelt. |
| Kalenderfarben | In Termin-, Kategorie- und Status-DTOs keine bestätigten Originalfarbwerte. Auftragsstatus selbst kommt über API. | Erst PDS nach Farb-API fragen; andernfalls freigegebene lesende Farb-View. Bis dahin **Kalenderfarben** in HeyElli: serverseitig für alle Disponenten gespeichert unter `.local/heyelli/calendar-colors.json` (Git-ausgeschlossen), Hexfarben je Status/Kategorie/Typ plus Auffangfarben. Kein PDS-Schreibzugriff. |

**Verbindliche Hierarchie:** Auftrags-/Vorgangsstatus → Kategorie → Termintyp → Terminstatus → Standardfarbe. Bei vorhandenem Auftragsstatus bleibt diese Ebene auch ohne konkrete Zuordnung maßgeblich: eigene Auffangfarbe, keine unbemerkte Übernahme der Kategorie-/Terminstatusfarbe. Status kann über PDS-UUID oder Namen zugeordnet werden. Innerhalb einer Ebene gilt die erste passende Regel; neu ergänzte HeyElli-Regeln werden vorn eingefügt. Echte konfigurierte PDS-Farbregeln stehen vor HeyElli-Ergänzungen derselben Ebene. Die fiktive `sim_calendar_colors`-Ansicht wird ausdrücklich nicht als Original-PDS-Konfiguration behandelt und überschreibt keine HeyElli-Einstellungen. Ein API-Fehler führt weiterhin nicht zu einem ungeprüften View-Fallback.

Farb-View-Vertrag bei späterer Freigabe: pro Zeile genau eines von `orderStatus` (UUID), `orderStatusName`, `category` (UUID), `typ` oder `status`, dazu `farbe` (`#RRGGBB`). `orderStatus="*"` bezeichnet die Auffangfarbe für unbekannte Auftragsstatus, `typ="*"` die allgemeine Standardfarbe. Dies ist ein HeyElli-Adaptervertrag, **kein bestätigter PDS-Viewname**. API-Daten haben vor einer solchen View Vorrang. Originale Haupt-/Nebenfarben und deren PDS-Priorität sind weiterhin nicht nachgewiesen.

**Weiterhin offen an PDS:** Farbregel-/Nebenfarben-Endpunkt oder freigebbare View; Serien mit Ausnahmen und atomaren Serienänderungen; API für Wochen-/Schicht-/Pausen-/Feiertagsregeln, Definition „Dauer lt. Mitarbeiter“ und die zwei Arbeitszeit-Anpassungen; Tätigkeitsdetails/-status; Auswirkungen der Terminoptionen auf servicegebundene/mobil ausgegebene Termine. Fehlende Leseinformationen nur nach API-Prüfung per freigegebener View ergänzen. Keine Schreibzugriffe über Views.

Technik: serverseitige Sitzungs-/Disponentenprüfung, Ursprungsprüfung für Änderungen, begrenzte Eingaben, Referenzvalidierung über API und Konfliktprüfung. Farbdatei atomar ersetzt, Schreibschutzmodus 0600, Versionsvergleich innerhalb eines Serverprozesses. Mehrere Serverinstanzen brauchen später einen gemeinsamen Konfigurationsspeicher mit atomarer Versionierung. Simulator-Terminoptionen liegen in vorhandenen API-Entitäten; keine Datenbankstrukturänderung/Migration. Ausschließlich erfundene Test-/Seed-Daten.

Prüfbericht: Terminoptionen und Farben (Prüfnachweis in der Git-Historie).

### Vollständige Statuskataloge statt nur verwendeter Status (03.11.2026)

Nachprüfung zur bereitgestellten PDS-Maske „Termin-Einstellungen / Statusfarbe“:

| Bedarf | Dokumentierter API-Weg | View / Umsetzung |
| --- | --- | --- |
| Statuskatalog Serviceauftrag/Störung | `GET /service/liststatus`, ohne Requestbody; Array `PdsAPIVorgangStatusRESTModel`. | Keine View nötig. Die Liste ist für die dynamische Übernahme der in PDS angebotenen Status vorgesehen; reale Rückgabe inklusive kundenspezifischer Status muss am Ziel-PDS geprüft werden. |
| Statuskatalog anderer Vorgangsarten | `POST /vorgang/liststatus` mit `{vorgangstyp}`. Zulässig: AUFTRAG, BEDARFSMELDUNG, RECHNUNG, ANGEBOT, LIEFERSCHEIN, BESTELLUNG, WARENEINGANG, ABRUFAUFTRAG, GUTSCHRIFT, RUECKNAHME. | Keine View nötig. Serviceauftrag ist kein Enumwert dieser Operation und verwendet seinen eigenen Endpunkt. |
| Statuskatalog Projektakten | `GET /projektakte/liststatus`. | Keine View nötig. |
| Statusidentität und Beschreibung | Gemeinsames DTO: `uuid` (Pflicht), `dbid`, `bezeichnung`, `kategorie`. | Für HeyElli-Zuordnungen stabile UUID plus Vorgangsart verwenden; Namen nur anzeigen. Umbenennung darf keine Farbzuordnung verlieren; Status gleichnamiger Vorgangsarten nicht ungeprüft zusammenfassen. |
| Originale Statusfarben aus der gezeigten PDS-Konfiguration | Kein Farbfeld im Status-DTO und kein bestätigter Endpunkt für diese Farbregeln. | Offene PDS-Frage bleibt bestehen; ggf. freigegebene lesende View für Vorgangsart, Statusidentität und Farbe. Screenshotfarben sind kein API-Vertrag. |

**Aktueller Implementierungsstand:** Die Kalenderansicht liest den tatsächlich zugeordneten Status aus Service-/Vorgangs-/Projektaktendetails. Die HeyElli-Farbauswahl enthält bislang dort vorkommende Status und lokale Vorgaben; die oben nachgewiesenen vollständigen Liststatus-Endpunkte sind noch nicht an diese Oberfläche bzw. den Simulator angebunden. Diese Dokumentationsprüfung ergänzt keine neue Funktion.

**Konkrete Frage an PDS:** Entsprechen sämtliche Einträge unter „Termin-Einstellungen / Statusfarbe / Serviceauftrag/Störung“ (insbesondere Geplant, Auftragspool, Ausgegeben Mobil, Mobil abgeholt, Material ausstehend) jeweils einem über `/service/liststatus` gelieferten Vorgangsstatus? Falls teilweise abgeleitete Planungs-/Mobilzustände: welche API-Felder und Auswertungsregeln ergeben den wirksamen Farbschlüssel? Welcher unterstützte API-Endpunkt liefert die konfigurierten Farben einschließlich kundenspezifischer Zuordnungen? Falls nicht verfügbar, welche freigegebene lesende View stellt diese Informationen bereit? Kein automatisches Gleichsetzen mit dem Terminstatus GEPLANT/FREI/VORGEMERKT.

### Implementierte vollständige Statuslisten je API-Familie (03.11.2026)

Dieser Abschnitt ersetzt den früheren Stand „Statuslisten noch nicht angebunden“.

| Feld / Funktion | API und Schema | View / Grenze |
| --- | --- | --- |
| Alle Status unabhängig von verwendeten Terminen | GET `/service/liststatus`, `/projektakte/liststatus`, `/ruecklauf/liststatus`, `/lager/listzaehllistenstatus`; POST `/vorgang/liststatus` für alle zehn zulässigen `vorgangstyp`-Werte. Jeweils Array `PdsAPIVorgangStatusRESTModel`. | 14 API-Familien im Simulator implementiert. Keine View, kein Fallback bei Fehler/Berechtigungsproblemen. |
| Farbzuordnung | HeyElli speichert `orderType` (Vorgangsart) + `orderStatus` (API-UUID) + `farbe`. Aktueller Name/Kategorie nur aus Statuskatalog. | Keine Farbwerte in Status-API. Weiterhin HeyElli-Konfiguration bzw. später bestätigte Originalfarben-API/lesende Farb-View. |
| Umbenennung / alte Regeln | UUID bleibt unverändert; neue Liste aktualisiert den angezeigten Namen. Bestehende Namens-/globale UUID-Regeln werden anhand API-Katalog einmalig auf Familien-/UUID-Regeln migriert und persistiert. Nicht auflösbare/verwaiste Regeln bleiben erhalten. | Keine neue Datenbankstruktur. Details der Migration, einschließlich alter Demo-Offen-ID, in der Statusdokumentation. Neue namensgebundene Regeln werden serverseitig abgewiesen. |
| Fehlende Familien | Preisanfrage, Rücklieferung, Aufmaß, Eingangsrechnung, Auftragsbestätigung, Wartungsauftrag, Wartungsangebot haben keinen nachgewiesenen Liststatus-Vertrag in dieser OpenAPI. | In der Auswahl als nicht API-abgedeckt markiert. Keine erfundenen Enumwerte/Endpunkte. Haupthandbuch nennt `pds_vorgang_status` und `pds_vorgang_status_kategorie`; Einsatz für Lücken erst nach Klärung der Spalten/Typzuordnung und API-Prüfung. |
| PDS-Standardstatus | Handbücher und Screenshot geprüft. Alle 13 Screenshot-Servicezustände enthalten; acht zusätzlich in Service-/Störungskapiteln belegt. Angebot „Beauftragt“ als Standard-Wandlungsbeispiel berücksichtigt. | Keine vollständige versionsbezogene Auslieferungstabelle aller Vorgangsarten nachgewiesen. Weitere Demo-/Screenshot-Einträge sind nicht ungeprüft als PDS-Standard ausgewiesen. 100-Prozent-Garantie für vollständigen PDS-Auslieferungszustand bleibt mangels Quelle offen. |

Vollständige Quellenstellen, Status-/Kategorie-/Ebenenabgrenzung, Seed-Herkunft, Implementierung und konkrete PDS-Fragen: [Statuskataloge und Standardnachweis](status-catalogs.md). Ausschließlich fiktive UUIDs und Beispieldaten. Keine produktiven PDS-Aufrufe. Die Simulation des Umbenennens verwendet vorhandene generische Testentitäten und erfindet keinen PDS-Schreibendpunkt.

Prüfung dieses Stands: Statuskataloge und UUID-Persistenz (Prüfnachweis in der Git-Historie). 70 automatisierte Tests und manueller Browserablauf in isolierter Testumgebung; kein echtes PDS.

### Screenshot-Kategorien und dauerhafte Kategoriefarben (03.11.2026)

| Feld / Funktion | API / Implementierung | View / Grenze |
| --- | --- | --- |
| Screenshot-Kategorien vollständig lesen | `GET /termin/listkategorien`, `PdsAPITerminKategorieRESTModel`: `uuid`, `bezeichnung`, `ganzerTag`. Simulator enthält Urlaub, Krank, Projekt, fortführung Wartung, fortführung Serviceauftrag, Bereitschaft, Elternzeit, FZA, Zusatzinfo, Termin Angefragt, ÜBL, Schule. | Keine View. Zwölf Einträge mit stabilen fiktiven UUIDs; im Screenshot sind alle Ganztagshaken leer, daher `ganzerTag=false`. Individuelle Konfiguration der gezeigten Installation, kein allgemeiner PDS-Standardnachweis. |
| Bestehende Demo-Kategorien erhalten | Service, Besprechung, Ganztagsplanung mit unveränderten bisherigen IDs bleiben zusätzlich verfügbar, damit gespeicherte Termine/Zuordnungen weiter gültig sind. Insgesamt 15 Kategorien. | Keine Datenbankmigration. Wiederholbares statisches Seed in `database/seeds/pds-simulator/calendar-references.json`, kein Überschreiben bestehender Termine. |
| Terminzuordnung | `/termin/create`, `/termin/update` mit `kategorienUUIDs`; Details/Detailsbatch liefern `kategorien` mit denselben UUIDs. | Keine View. Bestehende Mehrfachauswahl verwendet die API-Liste. |
| Farben je Kategorie | Eigener Bereich „Kategoriefarben“ in HeyElli. Zentrale Regeln `{category:<UUID>,farbe:<Hex>}` in bestehender lokaler Farbkonfiguration. Kategorie-Katalog wird beim Öffnen frisch über API gelesen. | **Kein Farbfeld in PDS-Kategorie-API.** Screenshotfarben werden nicht als API-Rückgabe vorgetäuscht oder ungefragt in vorhandene Farbregeln übernommen. Bei Bedarf später bestätigte Farb-API, sonst freigegebene lesende View. |
| Umbenennung | Nur der API-Anzeigename ändert sich; Terminzuordnung und Farbregel bleiben über UUID erhalten. Verwaiste Farbregeln bleiben mit UUID sichtbar, bis sie bewusst entfernt werden. | Kein namensbasierter Ersatzschlüssel. Neue Farbregeln werden serverseitig gegen die API-Kategorie-UUIDs geprüft; vorhandene verwaiste Regeln bleiben bearbeitbar. |
| Fehler / Priorität | Doppelte/ungültige Kategorien-UUIDs und ungültige optionale Daten werden abgewiesen. Fehlende optionale Bezeichnung wird als UUID angezeigt. | Kein stiller View-Fallback. Farbpriorität weiterhin Auftragsstatus → Kategorie → Termintyp → Terminstatus → Standard. |

Simulator-Test einer Umbenennung nutzt eine vorhandene generische Testentität `category-label:<UUID>`; kein erfundener PDS-Schreibendpunkt, keine neue Datenbankstruktur. Die Plattform ändert Kategorie-Stammdaten nicht selbst. API-/Disponentenprüfung und Ursprungsprüfung der Farbänderungen bleiben erhalten. Prüfung mit eigenen temporären Datenbanken; kein produktives PDS angesprochen.

Prüfbericht: Kategorien und UUID-Farben (Prüfnachweis in der Git-Historie).

### Termintypfarben und Vertragsleistungsvarianten geprüft (03.11.2026)

Zur gezeigten Termin-Konfiguration: `PdsAPITerminDetailsRESTModel.typ` liefert die acht Grundtypen VORGANG, PROJEKT, TAETIGKEIT, SERVICEAUFTRAGEBENE (Störung), FREIER, URLAUB, ABWESENHEIT und PRIVATE_ABWESENHEIT. HeyElli kann bereits für alle acht Typen Regeln `{typ:<API-Typ>,farbe:<Hex>}` unter „Kalenderfarben → Weitere Farben und bisherige Zuordnungen → Weitere Farbregel“ speichern. Farben sind lokale Einstellungen, keine behaupteten PDS-Farbwerte. Farbpriorität bleibt Auftragsstatus → Kategorie → Termintyp → Terminstatus → Standard. Keine View für die Typidentität erforderlich.

Die zusätzlichen Screenshot-Zweige „Störung mit Vertragsleistung“ und „Störung ohne Vertragsleistung“ sind keine eigenen `typ`-Enumwerte. Die API enthält jedoch in `POST /service/liststoerungen`, Suchschema `PdsAPIStoerungSucheRESTModel`, den Filter `vertragsleistung` mit KEIN, INTERVALL, WARTUNGSVORGANG. Ergebnisse enthalten Störungs-/Ebenen-UUIDs; die Vertragsleistungszuordnung kann damit grundsätzlich API-basiert über entsprechende gefilterte Listen und die bestehende Service-/Terminverknüpfung untersucht werden. Ergänzend stehen `intervallUUID` und `wartungsvertragUUID` an Service-Ebenen. Ein einzelnes Vertragsleistungs-/Farbfeld fehlt im Termin-DTO. Wartungsvertragsbezug allein nicht ungeprüft mit dem wirksamen Screenshot-Farbzweig gleichsetzen.

**Aktueller Stand:** Grundtypfarben sind implementiert; getrennte Farbregeln mit/ohne Vertragsleistung und Auswertung dieses Suchfilters für den Kalender sind noch nicht implementiert. Simulatorfilter müsste dabei tatsächlich die entsprechenden Störungen unterscheiden, statt den Filter nur anzunehmen. Vor Umsetzung genaue Zuordnung KEIN/INTERVALL/WARTUNGSVORGANG zu den zwei PDS-Farbzweigen bestätigen; fehlende/unklare Zuordnung muss als unbekannt gelten. Keine zusätzlichen PDS-Typen oder direkten Datenbankzugriffe erfinden. Originale konfigurierte Typfarben werden von den geprüften DTOs nicht geliefert; Farb-API bei PDS erfragen, andernfalls freigegebene lesende Farb-View. Diese Prüfung ist eine Dokumentationsergänzung, keine neue Kalenderfunktion.

### Vertragsleistungsfarben implementiert (03.11.2026)

Ersetzt den vorherigen Stand „Varianten noch nicht implementiert“.

| Funktion | API / Umsetzung | View / Grenze |
| --- | --- | --- |
| Vertragsleistungsvariante ermitteln | POST `/service/liststoerungen`, Suchschema `vertragsleistung=KEIN/INTERVALL/WARTUNGSVORGANG`, alle Seiten. Abgleich mit Service-/Störungsebene über `/service/details` und `/service/findstoerungtermin`. | Keine View. KEIN allein → OHNE; INTERVALL/WARTUNGSVORGANG ohne KEIN → MIT; widersprüchlich/fehlend → UNBEKANNT. Reale Filtersemantik bleibt vor Echtnutzung zu bestätigen. |
| Pro Störung statt pro Auftrag | Schlüssel Serviceauftrags-UUID + `serviceAuftragEbene.uuid`; keine Annahme, dass Wrapper-UUID und Ebene identisch sind. | Gemischte Störungen desselben Auftrags werden getrennt klassifiziert. Kein bloßes Ableiten aus aktueller Wartungsvertragsreferenz; historische Vertragsleistung bleibt möglich. |
| Simulatorfilter | Filter tatsächlich vor Paginierung, ungefilterte Liste unverändert. Bestehende Seed-Störungen mit/ohne Vertragsleistung; weitere native Testfälle über vorhandene generische Entitäten. | Keine neue Migration, keine Produktivdaten. Interner Modus kein zusätzliches API-Feld und kein erfundener Schreibendpunkt. |
| Zwei Störungsfarben | HeyElli-Regeln `contractService=MIT/OHNE`, initial Hellblau/Hellgrün; zentral speicherbar unter Termintypfarben. | Lokale Vorgaben, keine API-Originalfarben. Unknown nutzt allgemeine Störungs-/Auffangfarbe. |
| Priorität | Konkreter Auftragsstatus → Kategorie → bekannte Vertragsleistungsvariante → allgemeiner Termintyp; nachgeordnet bisherige Fallbackfarben. | Status-**Auffangfarbe** greift erst ohne passende Kategorie/Typfarbe. Präzisiert und ersetzt frühere Aussage „unbekannter Auftragsstatus immer zuerst neutral“. Konkrete Statusregeln behalten Vorrang. |

Quellenstellen, Zuordnungsregeln, Performancegrenze und konkrete PDS-Fragen: [Vertragsleistung und Farben](contract-service-colors.md). Keine echten PDS-Aufrufe. API-Fehler bleiben Fehler, kein View-Fallback. Die Handbuchprüfung belegt die Abgrenzung Vertragsleistung/Vertragsreferenz, aber nicht den realen Filterbetrieb dieser Installation.

Prüfung: 79 Tests und Browsernachweis (Prüfnachweis in der Git-Historie), ausschließlich isolierte Simulatorumgebung. Die Legende zeigt konkrete Statusfarben nur bei tatsächlich passender Statusregel und beide Vertragsleistungsvarianten separat.

### Farbregeln ausschließlich in drei PDS-Bereichen (03.11.2026)

Dieser Abschnitt ersetzt frühere Konfigurationen mit Terminstatus-, globalen Standard-/Auffangfarben und „Weitere Farben und bisherige Zuordnungen“.

| Bereich / Funktion | Zulässige Regeln / API-Bezug | View / Grenze |
| --- | --- | --- |
| **Termin-Konfiguration** | Konkrete `typ`-Werte der acht dokumentierten Termintypen; MIT/OHNE-Vertragsleistungsvarianten für Störungen aus dem dokumentierten API-Filterabgleich. | Farben zentral in HeyElli. Keine globale `typ="*"`-Farbregel. |
| **Termin-Kategorien** | `category=<API-Kategorie-UUID>` aus GET `/termin/listkategorien`. | Keine namensgebundene Zuordnung; Farbe bleibt bei Umbenennung erhalten. |
| **Statusfarbe** | `orderType=<Vorgangsart>` + `orderStatus=<API-Status-UUID>` aus dokumentierten Statuskatalogen. | Keine globale `orderStatus="*"`-Regel und keine neue Namensregel. Verwaiste, aber eindeutig per Art/UUID gebundene Zuordnungen bleiben im passenden Bereich erhalten. |
| Entfernte Regelarten | `status=GEPLANT/FREI/VORGEMERKT`, globale Typ-/Status-Auffangregeln, unbekannte Typen, nicht auflösbare Namens-/ungebundene Statusregeln. | Entfallen in Oberfläche, Speichervalidierung und Farbauswertung. Terminstatus bleibt als fachliches API-Feld, Eingabe und Filter erhalten; nur dessen gesonderte Farbregeln entfallen. |
| Migration bestehender Dateien | Zuerst bisherige Namen/ungebundene UUIDs anhand der API-Kataloge in gültige Statusregeln umwandeln, dann alle übrigen unzulässigen Regeln entfernen und atomar persistieren. | Bestehende gültige Farben erhalten, keine zusätzlichen PDS-Schreibzugriffe. Gleiche Normalisierung für alte Regeln einer später freigegebenen Farb-View. Malformed Farben/Antworten bleiben Fehler; kein stiller View-Fallback. |

Farbpriorität jetzt ausschließlich **Statusfarbe → Termin-Kategorien → Termin-Konfiguration**. Ist keine Regel anwendbar, verwendet die Darstellung eine feste neutrale Farbe (verknüpfter Vorgang `#cad0db`, sonst `#b9c2d1`); dies ist keine einstellbare vierte Regelart. Die beiden Störungsvarianten behalten ihre festen Typ-Vorgaben und bleiben innerhalb der Termin-Konfiguration anpassbar. Entfernte Regeln können auch über alte Formulare oder direkte Schreibanfragen nicht erneut gespeichert werden.

Die lokale Entwicklungs-Farbdatei wurde zusätzlich zum isolierten Test geprüft/normalisiert. Alle 47 vorhandenen Regeln waren bereits gültigen Bereichen zugeordnet und blieben erhalten. API-/Disponentenprüfung, Ursprungsprüfung, UUID-Referenzvalidierung und Versionsschutz bleiben erhalten. Keine Datenbankstrukturänderung.

Prüfung: Drei Farbbereiche (Prüfnachweis in der Git-Historie). Die früheren Aussagen zur Aufbewahrung nicht auflösbarer Namensregeln und zu konfigurierbaren allgemeinen Auffangfarben sind damit überholt.

### Drei Farbbereiche als Reiter (03.11.2026)

Reine Oberflächenänderung: Termin-Konfiguration, Termin-Kategorien und Statusfarbe werden im Farbendialog als Reiter in dieser Reihenfolge dargestellt. Ein Bereich ist jeweils sichtbar; Eingaben und gemeinsame Speicherung bleiben beim Wechsel erhalten. Tastaturbedienung über Links/Rechts und Pos1/Ende, verknüpfte Tab-/Panel-Beschriftungen. Die Farbpriorität bleibt **Statusfarbe → Termin-Kategorien → Termin-Konfiguration**. Keine Änderung an Farbregeln, Speicherung, API-Abfragen, View-Grenzen, Referenzen oder Simulator-Datenmodell.

Prüfung der Reiter: Browserablauf und bestehende 82 Tests (Prüfnachweis in der Git-Historie). Keine Änderung der API-/View-Abgrenzung oder Farbpriorität.

### Termin-Konfiguration nach Termintyp auswählen (03.11.2026)

Der erste Reiter zeigt jetzt wie im PDS-Beispiel links dauerhaft acht Termintypen in dieser Reihenfolge: Vorgang, Projekt, Tätigkeit, Störung, Freier Termin, Urlaub, Abwesenheit, Private Abwesenheit. Rechts erscheinen die Farben des ausgewählten Typs. Die technischen API-Typwerte bleiben unverändert (`VORGANG`, `PROJEKT`, `TAETIGKEIT`, `SERVICEAUFTRAGEBENE`, `FREIER`, `URLAUB`, `ABWESENHEIT`, `PRIVATE_ABWESENHEIT`).

Für die sieben Typen außer Störung wird die vorhandene bzw. neu einstellbare Typfarbe direkt als **Default** angeboten. „Default“ ist nur eine Feldbeschriftung innerhalb des konkreten Typs, keine globale Standardregel und kein neuer API-Schlüssel. Änderungen erzeugen weiterhin `{typ:<konkreter Typ>,farbe}`. Noch nicht gespeicherte Typfarben werden als solche gekennzeichnet; Auswahl startet mit bestehender Typvorgabe oder neutraler Vorschaufarbe. Die Darstellung bleibt bis zur bewussten Änderung unverändert.

Bei Störung erscheinen stattdessen die vorhandenen Varianten mit/ohne Vertragsleistung. Eine bereits vorhandene allgemeine Störungsfarbe bleibt gegebenenfalls als Farbe für unbekannte Vertragsleistung sichtbar. Es werden keine vorhandenen Farben überschrieben oder automatisch Screenshot-Grünwerte übernommen. Keine zusätzliche „Typfarbe hinzufügen“-Auswahl nötig; alle Typen sind direkt erreichbar. Vertikale Tastaturbedienung und Erhalt von Eingaben beim Typ-/Reiterwechsel.

Reine Oberflächenkorrektur, keine Änderung der Farbpriorität **Statusfarbe → Termin-Kategorien → Termin-Konfiguration**, Datenquelle, API-/View-Grenze oder Speicherung. PDS-Originalfarben bleiben mangels bestätigtem API-Farbfeld eine offene Integration.

Prüfung: Termintyp-Auswahl, Speicherung und bestehende 82 Tests (Prüfnachweis in der Git-Historie).

### Hauptfarbe und erste Nebenfarbe je Termintyp (03.11.2026)

Diese Änderung ersetzt die bisher feste Hierarchie **Statusfarbe → Termin-Kategorien → Termin-Konfiguration** vollständig. Im ersten Reiter werden für jeden der sieben Termintypen außer Urlaub eine Hauptfarbquelle und optional eine erste Nebenfarbquelle ausgewählt. Beide können auf Termin-Konfiguration, Termin-Kategorien oder Statusfarbe verweisen; derselbe Bereich kann nicht beide Plätze belegen. „Leer“ deaktiviert die Nebenfarbe. Urlaub verwendet ausschließlich seine Termintypfarbe.

Es gibt keinen automatischen Wechsel zwischen den drei Bereichen: fehlt für die Hauptfarbquelle eine passende Regel, erscheint die feste neutrale Darstellung; fehlt die Nebenfarbregel, wird kein Streifen gezeichnet. Die Nebenfarbe erscheint rechts im Balken; Verschieben, Größenänderung und H/B-Kennzeichnung bleiben erhalten. Innerhalb der Termin-Konfiguration gelten weiterhin die bekannten Störungsvarianten mit/ohne Vertragsleistung. UUID-Zuordnungen von Status und Kategorien bleiben unverändert. Mehrere passende Kategorien werden weiterhin nach der gespeicherten Regelreihenfolge aufgelöst. Innerhalb derselben Quelle haben bestätigte PDS-Farben aus einer konfigurierten View weiterhin Vorrang vor lokalen Ergänzungen.

**HeyElli-Konfiguration:** Die gemeinsame Farbdatei speichert nun `{rules,colorLayouts}` atomar mit gemeinsamer Versionsprüfung. Alte Regelarrays bleiben lesbar; ihre Farben bleiben erhalten. Für Altdateien und neue Konfigurationen ist der Ausgangswert explizit Termintyp als Hauptfarbe, Nebenfarbe leer. Die alte feste Bereichshierarchie wird nicht übernommen. „HeyElli-Standardfarben laden“ setzt auch diese Ausgangszuordnungen zurück. Schreibzugriff bleibt serverseitig auf angemeldete Disponenten und gleichen Ursprung beschränkt. Ungültige/fehlende Typen, Urlaub-Zuordnungen und doppelte/unbekannte Quellen werden abgewiesen. Keine Datenbankmigration.

**PDS-API / View:** Termine, Typen, Kategorien, Status und Vertragsleistungszuordnung kommen weiterhin aus den dokumentierten API-Abläufen. Die Auswahl von Haupt-/Nebenfarbquellen ist eine lokale HeyElli-Einstellung; es wird kein PDS-API-Endpunkt dafür vorgetäuscht und nichts in PDS zurückgeschrieben. Originale Farbreihenfolgen bzw. Haupt-/Nebenfarbkonfigurationen sind über die vorhandene Dokumentation weiterhin nicht als abrufbar bestätigt. Eine zusätzliche View für diese HeyElli-Einstellungen ist nicht erforderlich; die bestehende optionale Farb-View bleibt unverändert. Offene Frage an PDS: Gibt es dokumentierte Lese-/Schreibendpunkte für Termintyp-Farbreihenfolge und Haupt-/Nebenfarben?

Prüfung: Haupt-/Nebenfarben und Speicherung (Prüfnachweis in der Git-Historie).

### Urlaub: Beantragt und Genehmigt (03.11.2026)

Die Termin-Konfiguration für Urlaub enthält zwei unabhängig speicherbare Farben **Beantragt** und **Genehmigt**, angelehnt an den Screenshot zunächst beide türkis (`#00c5c8`, angenäherte lokale Vorgabe, kein aus PDS gelesener Standardfarbwert). Dies sind Varianten innerhalb der Termin-Konfiguration, kein vierter Farbbereich und keine Nebenfarb-Reihenfolge für Urlaub. Lokale Schlüssel: `{vacationApproval:"BEANTRAGT"|"GENEHMIGT",farbe}`. Eine vorhandene allgemeine Urlaub-Typfarbe bleibt für unbekannten Genehmigungsstatus erhalten und sichtbar.

**API-Prüfung:** `PdsAPITerminDetailsRESTModel` in der bereitgestellten OpenAPI-Datei (`src/platform/pds/api/contract.json`) kennt `typ=URLAUB`, aber keinen Genehmigungsstatus. Die einzigen Terminstatuswerte sind `VORGEMERKT`, `FREI`, `GEPLANT`. In der gesamten bereitgestellten Spezifikation ist kein Urlaubsgenehmigungs-Endpunkt bzw. Feld für beantragt/genehmigt dokumentiert. Aus „Geplant“ wird ausdrücklich keine Genehmigung abgeleitet. Die API-Terminverträge und Simulator-Antworten werden nicht um ein erfundenes PDS-Feld erweitert.

**Verbleibende Lücke / View:** Die Anzeige ist für eine ausdrücklich gelieferte fachliche Zuordnung vorbereitet; die aktuelle API-Anbindung liefert sie noch nicht. Ohne bestätigten Genehmigungsstatus greift weiterhin die allgemeine Urlaubfarbe oder die neutrale Darstellung. Für die automatische Auswahl muss PDS einen dokumentierten API-Endpunkt nennen (hat Vorrang), andernfalls wird eine lesende View benötigt: Termin-UUID → Genehmigungsstatus Beantragt/Genehmigt. Eine solche View ist noch nicht eingerichtet. Konkrete Frage an PDS: Welcher dokumentierte API-Endpunkt liefert den Urlaubsgenehmigungsstatus eines `URLAUB`-Termins; falls keiner existiert, über welche Tabelle/View und UUID-Beziehung kann dieser sicher gelesen werden? Farben und Varianten werden ausschließlich lokal in HeyElli gespeichert, keine Urlaubsanlage/Genehmigung über die API implementiert.

Prüfung: 88 automatisierte Tests erfolgreich, einschließlich Varianten, unbekanntem Status, Validierung und Speicherung. Im isolierten Browser beide Farbfelder angezeigt und mit unterschiedlichen Werten gespeichert. Entwicklungsdaten unverändert.

### Urlaub: unbekannten Genehmigungsstatus aus Farbauswahl entfernt (03.11.2026)

Das zusätzliche Farbfeld „Genehmigungsstatus unbekannt“ wird in der Urlaub-Konfiguration nicht mehr angeboten. Sichtbar bleiben die beiden Varianten Beantragt und Genehmigt. Bestehende allgemeine Urlaubfarbregeln bleiben zur Abwärtskompatibilität gespeichert; diese reine Oberflächenänderung verändert weder API-/View-Zuordnung noch die offene Beschaffung des Genehmigungsstatus.

### Urlaubsgenehmigung über simulierte Datenansicht (04.11.2026)

| Feld/Funktion | Dokumentierter API-Weg / Schema | Ergänzung und Implementierungsstand |
| --- | --- | --- |
| Urlaubstermin, Zeit, Ressourcen und `typ=URLAUB` | `/termin/listplanung`, `/termin/detailsbatch`, `PdsAPITerminDetailsRESTModel` | Weiterhin API. Die DTOs erhalten kein erfundenes Genehmigungsfeld. |
| Urlaubsgenehmigungsstatus | Feldlücke im Termin-DTO. `GET /datenansichten/list` (`PdsAPICustomViewRESTModel` inkl. `columns`), `POST /datenansichten/listdaten` (`PdsAPICustomViewDataRESTModel`: `name`, `page`, `entriesPerPage`) | Simulator liefert die individuell benannte, ausschließlich lesende Ansicht `sim_calendar_vacation_approvals`. Genau zwei Spalten: `terminUUID`, `genehmigungsstatus` (`BEANTRAGT` oder `GENEHMIGT`). Keine Behauptung eines PDS-Standardnamens oder echter DB-Spalten. |
| Verknüpfung und Farben | API-Termin-UUID → View-Spalte `terminUUID` | Adapteroption `vacationApprovalView` aktiviert die explizite Ergänzung. Simulator-Einstieg konfiguriert sie; Kalender und Terminbearbeitung erhalten `vacationApproval`. Die vorhandenen lokalen Farben Beantragt/Genehmigt werden als Urlaub-Hauptfarbe verwendet. Keine Nebenfarbe für Urlaub. |
| Beispieldaten | `database/seeds/pds-simulator/calendar.json` und `vacation-approvals.json` | Am 06.11.2026, jeweils 08:00–16:00: Alex Beispiel „Urlaub · Beantragt“, Kim Muster „Urlaub · Genehmigt“. Der vorhandene Urlaubstermin wurde als genehmigt zugeordnet, ein beantragter ergänzt. Stabile fiktive UUIDs; keine DB-Strukturänderung und keine Übernahme produktiver Daten. |

**Vorrang und Fehlerverhalten:** Die View ergänzt ausschließlich die nachgewiesene API-Feldlücke. Ein API-Fehler führt zu keinem View-Fallback. Ohne konfigurierte View bleibt die Genehmigung unbekannt. Eine konfigurierte, aber nicht verfügbare Ansicht sowie API-Fehler, ungültige Werte und doppelte UUID-Zuordnungen brechen die Kalenderanfrage ab. Fehlende Zeilen gelten als unbekannt, niemals automatisch als beantragt/genehmigt. Datenansichten werden in Seiten zu 500 Zeilen gelesen; Join nur auf `URLAUB`-Termine. Titel, Terminstatus Geplant/Frei/Vorgemerkt und Kategorien werden nicht als Genehmigung interpretiert. Änderungen/Löschen von Terminen erfolgen weiterhin über die dokumentierte Termin-API; keine View-Schreibzugriffe oder Urlaubsfreigaben eingebaut.

**Prüfung der echten PDS-Möglichkeit:** Das bereitgestellte Administrationshandbuch (Version 375, November 2026), Kapitel 1.28, Seiten 68–72, dokumentiert individuelle Datenansichten, deren SQL-Quelle und Abruf per PDS-API nach Einrichtung/Aktivierung. Damit ist der generische Transport bestätigt. Ein fertiger View-Name für Urlaub, die konkrete SQL-Tabelle, der Genehmigungswert und die UUID-Verknüpfung zum Kalendertermin sind aus den geprüften Unterlagen nicht bestätigt. Die OpenAPI enthält weiterhin keinen speziellen Urlaubsgenehmigungs-Endpunkt. Die Simulation ist vollständig nutzbar, ein echtes PDS ist nicht angeschlossen.

**Vor echter Nutzung mit PDS klären:** konkrete Quelltabelle und Beziehung Urlaub → Termin-UUID, Bedeutung aller Genehmigungszustände (insbesondere zurückgezogene/abgelehnte Anträge), JSON-Zeilenformat und API-Zugriff für den zentralen Zugang. Eine echte lesende Ansicht muss mandantenbezogen auf die erlaubten Kalenderdaten begrenzt sein; allgemeine PDS-Inhaltsrechte greifen bei individuell definiertem SQL laut Handbuch nicht automatisch. Live-View statt nächtlich aktualisierter Materialized View wählen, wenn Statusänderungen unmittelbar sichtbar sein sollen. Ein zukünftig dokumentierter fachlicher API-Endpunkt hat Vorrang vor dieser Ergänzung. Kein ausführbares SQL mit geratenen PDS-Tabellennamen angelegt.

Die frühere Aussage „Zuordnung in der aktuellen Simulation noch offen“ ist damit überholt. Offen bleibt die konkrete echte PDS-View, nicht die lokale Demonstration. Prüfbericht (Prüfnachweis in der Git-Historie).

### Alle Termin-Kategorien direkt sichtbar (04.11.2026)

Der Reiter Termin-Kategorien zeigt jetzt jeden Eintrag aus `GET /termin/listkategorien` (`PdsAPITerminKategorieRESTModel`: UUID, Bezeichnung, Ganzer Tag) direkt mit Farbauswahl. Die bisherige Auswahl zum einzelnen Hinzufügen von Farbfeldern entfällt. Kategorien ohne lokale Farbregel werden ebenfalls angezeigt und als solche gekennzeichnet; erst eine Farbänderung legt eine Regel an. Ganzer Tag wird nur lesend angezeigt. Vorhandene UUID-Zuordnungen und die Farbquellen je Termintyp bleiben erhalten. Verwaiste gespeicherte Kategoriezuordnungen bleiben separat einsehbar und entfernbar. Keine neue API-/View-Anbindung und keine Änderung an Simulator oder Schreibrechten.

### Statusfarbe: Vorgangsarten links, vollständige Statusliste rechts (04.11.2026)

Der Reiter Statusfarbe verwendet dieselbe zweispaltige Auswahl wie die Termin-Konfiguration. Links stehen alle verfügbaren Vorgangsarten mit Statusanzahl; rechts erscheinen sämtliche Status der ausgewählten Art unmittelbar mit Farbauswahl. Der zusätzliche Status-Auswahlschritt und „Statusfarbe hinzufügen“ entfallen. Nicht zugeordnete Status werden als solche gekennzeichnet; erst eine Farbänderung erzeugt eine lokale Regel. Vorhandene Zuordnungen bleiben über Vorgangsart/UUID erhalten; verwaiste Statusregeln sind gesondert sichtbar und entfernbar. Tastaturauswahl der Vorgangsarten über Auf/Ab/Pos1/Ende. Vorgangsarten ohne dokumentierten Statuslisten-Endpunkt bleiben unter „Weitere Vorgangsarten“ als Hinweis sichtbar.

Reine Oberflächenänderung: Die bisherigen dokumentierten Statuslisten-Endpunkte und API-/View-Grenzen bleiben unverändert. Die expliziten Haupt-/Nebenfarbquellen je Termintyp werden nicht verändert. Keine Simulator-, Datenbank- oder Berechtigungsänderung.

04.11.2026: Die zusätzliche Anzahlzeile im Reiter Termin-Kategorien wurde entfernt. Kategorienliste, Farben und API-/View-Zuordnung bleiben unverändert.

### Aktueller Tag und laufende Viertelstunde (04.11.2026)

Reine HeyElli-Zeitorientierung: heutiger Tag dezent markiert, aktuelle 15-Minuten-Spalte mit kontrastierendem Streifen über Kopfzeile/Ressourcenzeilen. Berechnung nach Europe/Berlin, laufende Aktualisierung zu Minutenbeginn und bei Fensterfokus/Sichtbarkeit. Keine zusätzliche PDS-API-/View-Abfrage; Terminfarben und explizite Haupt-/Nebenfarbzuordnungen bleiben unverändert. Der Streifen liegt hinter den Balken und fängt keine Zeigeraktionen ab.

Prüfung: Lint, Typprüfung und Build erfolgreich. Im Browser am 04.11.2026 um 19:37 Uhr deutscher Zeit die dezente Tagesmarkierung und den Streifen für 19:30–19:45 sichtbar geprüft. Nur die Kalenderansicht gescrollt, keine Termine oder Farbeinstellungen gespeichert.

### Automatisch zum aktuellen Zeitpunkt scrollen (04.11.2026)

Beim erstmaligen Anzeigen des Kalendergitters und auf ausdrücklichen Klick auf „Heute“ wird der aktuelle Zeitpunkt nach Europe/Berlin in der sichtbaren Zeitachse zentriert, soweit die Scrollgrenzen es zulassen. „Heute“ wechselt zuvor zum aktuellen Datum und funktioniert auch bei bereits aktuellem Datum. Der automatische Erstlauf wartet auf das vorhandene Gitter nach dem Laden bzw. Anmelden. Folgende Daten-/Uhrzeitaktualisierungen führen nicht erneut zum Zentrieren. Keine neue PDS-API-/View-Abfrage und keine Änderung an Termindaten oder Farbregeln.

Prüfung: Browser beim Öffnen, nach manuellem horizontalem Scrollen mit erneutem „Heute“ und nach Rückkehr aus der Vorwoche geprüft. Lint, Typprüfung und Build erfolgreich. Ausschließlich Ansichtsnavigation, keine Termin-/Farbeinstellungen gespeichert.

04.11.2026: Auch bei Auswahl von Tag/Woche/Monat wird explizit zum heutigen Datum und zur aktuellen Uhrzeit gescrollt. Der Ansichtswechsel verwendet denselben Scrollauftrag wie „Heute“ und berücksichtigt die neue Spaltenbreite. Reine Oberflächenänderung, keine zusätzliche API-/View-Anbindung oder Datenspeicherung. Lint, Typprüfung und Build geprüft.

### Arbeitszeitmodelle, Feiertage und Restkapazitäten (04.11.2026)

| Feld/Funktion | API-Pfad und Schema | View / Umsetzung / Vorrang |
| --- | --- | --- |
| Mitarbeiter und grundsätzliche Planungszeit | `/mitarbeiter/listmitarbeiter`, `/mitarbeiter/detailsbatch`, `PdsAPIMitarbeiterDetailsRESTModel.ressourcenplanzeit` | API bleibt führend. Von-/Bis-Datum begrenzt die planbaren Tage. |
| Wochenmodell, Gültigkeit, tägliche Sollzeit, Tagesfenster/Pausen, Mitarbeiter-Feiertagsgruppen-Zuordnung | Im bereitgestellten Mitarbeiter-DTO und in der OpenAPI kein entsprechender Leseendpunkt nachgewiesen | Lesende individuelle View `sim_calendar_working_times` im Simulator, Option `workingTimeView`. Abruf `/datenansichten/list`, `/datenansichten/listdaten`, `PdsAPICustomViewRESTModel`, `PdsAPICustomViewDataRESTModel`. Vertrag/Spalten in [Arbeitszeitdokumentation](working-time.md). Kein erfundener fachlicher API-Endpunkt und kein direkter DB-Zugriff. |
| Feiertage inkl. Halbtag und Datum | `GET /administration/listfeiertage`, `PdsAPIFeiertagRESTModel` | Direkt API; keine redundante View. Genaues geliefertes Datum, keine erfundene Wiederholung. |
| Feiertagsgruppen und aktive Feiertags-UUIDs | `GET /administration/listfeiertagsgruppen`, `PdsAPIFeiertagsGruppeRESTModel` | Direkt API. Die Mitarbeiter-Gruppenreferenz fehlt im Mitarbeiter-DTO und wird gezielt durch die Modell-View ergänzt. |
| Arbeitszeitdarstellung | API-Ressourcenplanzeit + View-Fenster + API-Feiertage | Feste 07–17-Schattierung entfernt; individuelle Fenster pro Ressourcenzeile, Pausen und Feiertage ausgespart. |
| Restkapazität | Lokale Berechnung aus täglicher Sollzeit, bestätigten Abwesenheiten und geplanten API-Terminen | Pro Mitarbeiter und gesamt, Überplanung negativ/rot. Sollzeit ist unabhängig von der Fensterlänge. Keine View-Schreibzugriffe. Keine automatische Terminverteilung. |

Die bisherige Aussage „Arbeitszeitmodelle/Restkapazitäten nicht implementiert“ ist für den Simulator überholt. Implementiert sind die explizite View-Ergänzung, native Feiertags-APIs und die lokale Bilanz. Ein echtes PDS ist weiterhin nicht angeschlossen. Fehlende Modelle bleiben unvollständig; API-/View-Fehler lösen keinen stillen Ersatz durch Standardzeiten aus. Fachregeln zu Vormerkungen, Abwesenheiten, Pausen und Sollzeitkürzung sowie Grenzen der Feiertagsdaten sind ausdrücklich in der [Arbeitszeitdokumentation](working-time.md) beschrieben.

**Quellenprüfung:** Ressourcenplanungshandbuch v69, Seiten 8–9 und 23–24: Lohndaten, tägliche Stunden versus Darstellungsfenster, Restzeiten/Minus-Planzeiten. Administrationshandbuch v375, Kapitel 1.28, Seiten 68–72: individuelle Datenansichten und API-Abruf. Keine konkrete SQL-Tabelle bzw. fertige PDS-Arbeitszeit-View bestätigt. Offen an PDS: tatsächliche UUID-Verknüpfung zu Lohndaten/Modell und Feiertagsgruppe, Ausnahmetage/Schichtzyklen, vollständige historische/jährliche Feiertagsdaten statt allein `naechstesDatum`, Halbtag-/Pausen-/Rundungslogik. Die View braucht mandantenbezogene Begrenzung und echte Rechteprüfung. Keine Schemaänderung, keine produktiven Daten importiert.

Prüfung: Arbeitszeit- und Kapazitätsprüfungen (Prüfnachweis in der Git-Historie).

### Planungswarnungen vor Kalender-Schreibzugriffen (04.11.2026)

| Feld/Funktion | API-/View-Zuordnung | Implementierung |
| --- | --- | --- |
| Arbeitszeitprüfung beim Anlegen/Ändern von Kalenderterminen | Vorhandene Termin-/Mitarbeiter-APIs, `workingTimeView` und native Feiertags-APIs; Urlaubsgenehmigungs-View für bestätigte Abwesenheiten | Serverseitige Leseprüfung über denselben PDS-Kalenderadapter für den vollständigen vorgeschlagenen Datumsbereich. Keine Prüfung nur anhand des gerade sichtbaren Browserausschnitts. |
| Warnung außerhalb der Arbeitszeit | Netto-Arbeitsfenster inkl. Pausen, Feiertagskürzung und Ressourcenplanzeit | Pro zugeordneter Ressource; normale Termine werden gegen jedes betroffene Tagesfenster geprüft. Abwesenheits-/Urlaubstermine werden nicht wegen ganztägiger Dauer als außerhalb liegende Arbeit bewertet. |
| Warnung bei Überschneidung / Überbuchung | API-Termine und lokale dokumentierte Kapazitätsrechnung | Zeitliche Überschneidungen mit reservierenden Terminen und neue/verschärfte negative Tageskapazität. Der bearbeitete Termin wird ersetzt, nicht doppelt gezählt. Alle neuen Ressourcen einschließlich Haupt-/Begleittechnikern werden geprüft. |
| Bestätigung und tatsächliches Speichern | HeyElli-Route `POST /api/ressourcenkalender/termine` → PDS `/termin/create`; `POST /api/ressourcenkalender` → dokumentierter Termin-/Serviceplanungs-Updateablauf | Ohne Bestätigung antwortet die HeyElli-Route bei Hinweisen mit HTTP 409 und `planningWarnings`, ohne Schreibzugriff. „Trotzdem speichern“ wiederholt denselben Vorschlag mit dem internen HeyElli-Flag `acceptPlanningWarnings=true`; dieses Flag wird nicht als erfundenes PDS-Feld weitergeleitet. Die Hinweise blockieren den bestätigten Schreibvorgang nicht. |

Der Warnungsdialog zeigt Titel und vorgeschlagenen Zeitraum sowie die betroffenen Ressourcen. „Weiter bearbeiten“ oder Escape speichert nichts; Formulareingaben bleiben erhalten. Bei Ziehen/Verlängern wird vor Bestätigung noch keine Änderung in PDS gespeichert; beim Abbruch bleibt der ursprüngliche Termin bestehen. Tastaturverschiebungen/-verlängerungen und die Terminbearbeitung verwenden denselben Ablauf. Reine Titel-/Beschreibungsänderungen und das Aufheben einer Fixierung erzeugen keine erneute Zeitwarnung bei unveränderter Planung.

Fehlende Modell-/Genehmigungsdaten erscheinen als Hinweis auf eine unvollständige Prüfung und können ausdrücklich übergangen werden. Fehler beim eigentlichen API-/View-Abruf sowie Authentifizierungs-, Validierungs-, Fixierungs- und Versionskonflikte bleiben Fehler; die Bestätigung umgeht keine Rechte- oder Datenprüfung. Planungshinweise sind eine aktuelle Momentaufnahme, keine atomare Ressourcenreservierung; parallele neue Termine können nach der Leseprüfung weitere Konflikte erzeugen. Es werden keine nicht dokumentierten PDS-Sperr-/Reservierungsendpunkte erfunden. Die Warnlogik gilt für die Kalender-Neuanlage/-Bearbeitung, nicht zusätzlich für den separaten Ablauf des CaseDesks.

Keine neue Datenansicht und keine DB-Strukturänderung. Prüfbericht (Prüfnachweis in der Git-Historie).

### Bestätigte Kalender-Fortsetzungen auf nächsten Arbeitszeiten (04.11.2026)

| Feld/Funktion | Dokumentierter API-Weg / Schema | Umsetzung / Grenze |
| --- | --- | --- |
| Verteilung der Restdauer | Bestehende Modell-View, Feiertags-APIs, Termin-/Abwesenheitsdaten | Server berechnet gemeinsame Netto-Arbeitsfenster; Vorschau vor Schreiben. Gewählte Dauer bleibt erhalten, Pausen/Feiertage/bestätigte Abwesenheiten werden übersprungen. Maximal 62 Tage / 120 Teile. |
| Zusätzliche Termine für Auftrag/Angebot etc. | `/termin/create`, `PdsAPITerminAnlegenRESTModel`: VORGANG + vorhandene `vorgangUUID` / erlaubter `vorgangtyp` | Native Referenz auf bestehenden Vorgang. Keine zusätzliche Vorgangs-, Auftrags- oder Ebenenanlage. |
| Projekt-Fortsetzung | `/termin/create`, Typ PROJEKT + bestehende `projektUUID` | Native Projektaktenreferenz bleibt erhalten, keine Projektanlage. |
| Service-Fortsetzung | Create-DTO schließt SERVICEAUFTRAGEBENE und SERVICEAUFTRAG aus; `/service/updatestoerung` aktualisiert eine vorhandene Ebene, `/service/findstoerungtermin` liefert einen Termin | Native zusätzliche Störungstermine an derselben Ebene sind eine API-Schreiblücke. Simulator erstellt ausdrücklich freie PDS-Kalendertermine mit einer HeyElli-Textreferenz auf dieselbe bestehende Service-/Ebenen-UUID. Keine weitere Serviceebene. Vor Bestätigung wird die Grenze angezeigt. In der generischen Implementierung standardmäßig gesperrt, im Simulator ausdrücklich aktiviert. |
| Service-Rollen bei Kopien | `/termin/details(batch)` + bestehendes `/service/details`; Änderung `/termin/update` | H/B-Zuordnung in HeyElli aus verifiziertem Textverweis. Keine Behauptung nativer zusätzlicher PDS-Mobilitätsausgabe. Kopie kann unabhängig geändert werden, ohne ursprünglichen Einsatz mitzuverschieben. |
| Bestätigung, Warnungen und Wiederholung | HeyElli-Routen ergänzen `continuationChoice`, `operationId`, `continuationHash`; keine neuen PDS-Felder | Vorschau mit Weiter bearbeiten / Zusammenhängend speichern / Auf Arbeitstage verteilen. Nach Bedarf bisherige Planungswarnungen. Teilweise erfolgreiche Speicherung wird gemeldet; Wiederholung verwendet vorhandene Teile. Kein stilles Löschen/Rollback. |

Kein neuer View, keine DB-Strukturänderung. Fortsetzungsreferenzen werden ausschließlich über das dokumentierte Termin-Textfeld geschrieben und in HeyElli aus der Beschreibung ausgeblendet; das ist ein HeyElli-Protokoll, keine dokumentierte native Servicezuordnung. Eine echte PDS-Installation ist nicht angeschlossen. Details einschließlich Wiederholungsgrenzen, eigenständiger Folgetermine und konkreter Fragen an PDS: [Kalender-Fortsetzungen](calendar-continuations.md). Eine View darf die offene Service-Schreibfunktion nicht ersetzen.

Prüfung: 110 Tests und Browserablauf (Prüfnachweis in der Git-Historie).

04.11.2026: In der Ressourcenbeschriftung stehen belegte Stunden und Reststunden jetzt in einer gemeinsamen Zeile. Die Modellzeile entfällt; Soll-/Abwesenheitsangabe und farbige Überlastungskennzeichnung bleiben erhalten. Reine Oberflächenänderung, keine Änderung der Arbeitszeit-/Kapazitätsberechnung oder API-/View-Zuordnung.

04.11.2026: Mindesthöhe der Ressourcenzeilen auf 112 px passend zur kompakten Beschriftung reduziert. Bei überlappenden Terminen wächst die Zeile weiterhin mit den benötigten Balkenspuren. Keine Änderung an API-/View-Zuordnung oder Fachlogik.

### Ressourcenauswahl und Gruppen (04.11.2026)

| Feld/Funktion | Konkreter API-Pfad / Schema | Umsetzung / View |
| --- | --- | --- |
| Verfügbare Ressourcengruppen | `GET /administration/listressourcengruppen`, `PdsAPIRessourcenGruppeRESTModel` mit `uuid`, optional `dbid`, `bezeichnung` | Direkt API; keine View. HeyElli liefert Katalog als `resourceGroups` mit stabilen UUIDs und lesbaren Namen. |
| Mitarbeiter und Mehrfachzuordnung zu Gruppen | `POST /mitarbeiter/listmitarbeiter`, `POST /mitarbeiter/detailsbatch`, `PdsAPIMitarbeiterDetailsRESTModel.ressourcengruppenUUIDs` | Direkt API; jede Ressource behält ihre `groupIds`. Namen werden über die UUIDs aufgelöst. Mehrfachmitgliedschaften bleiben erhalten. |
| Planbare Ressourcen im Zeitraum | `ressourcenplanzeit` im Mitarbeiter-DTO | Bestehende API-Prüfung bleibt maßgeblich. Nicht planbare Mitarbeiter erscheinen nicht als Kalenderressource. Gruppen können deshalb im gewählten Zeitraum ohne auswählbare Mitglieder sein. |
| Gruppen-/Einzelauswahl im Kalender | Lokale HeyElli-Ansichtseinstellung auf den API-IDs | Dialog „Ressourcen auswählen“: ganze Gruppe gemeinsam markieren/entmarkieren, einzelne Mitarbeiter, Alle/Keine, Suche ab drei Zeichen, explizit übernehmen oder abbrechen. Keine PDS-Schreibfunktion und kein zusätzlicher View. |
| Hauptressourcengruppe, Gruppenfarbe, Hierarchie oder individuelle PDS-Gruppensortierung | In den bereitgestellten Gruppen-/Mitarbeiter-DTOs nicht dokumentiert | Nicht aus Arrayposition oder Bezeichnung geraten. Falls diese Felder benötigt werden, zunächst PDS-Endpunkt klären, sonst gezielte lesende View. Bisher nicht implementiert. |

Der Simulator enthält drei fiktive Gruppen (Kundendienst/Service, Heizung/Lüftung, Elektrotechnik) sowie überlappende Mitgliedschaften. Separate wiederholbar gelesene Beispieldaten: `database/seeds/pds-simulator/resource-groups.json`. Kein produktiver Import und keine DB-Strukturänderung.

Die bestätigte Auswahl bleibt während der Nutzung des Kalender-Moduls bei Tag-/Woche-/Monats- und Zeitraumwechseln erhalten. Nicht mehr planbare ausgewählte UUIDs bleiben für einen späteren Zeitraumwechsel vorgemerkt. „Alle Ressourcen“ umfasst auch später neu geladene planbare Ressourcen. Eine explizite Gruppenauswahl markiert die aktuell verfügbaren Mitglieder, keine dauerhaft gespeicherte dynamische Gruppenregel. Gruppenkontrollen zeigen vollständige bzw. teilweise Auswahl, auch bei Mehrfachmitgliedschaften. Die Gesamtkapazität wird für die sichtbaren Ressourcen gebildet; Belegung/Warnungen einzelner Termine rechnen weiterhin mit vollständigen API-Termindaten. Der vorhandene Ressourcen-Textfilter bleibt eine zusätzliche Einschränkung. Keine Speicherung der Auswahl in PDS. Die spätere benutzerbezogene HeyElli-Persistenz ist unten im Abschnitt „Benutzerbezogene Ressourcenauswahl“ beschrieben.

Die Auswahl ist ein Anzeigefilter und kein Zugriffsschutz. Bestehende serverseitige Sitzungs-/Disponentenprüfungen bleiben erhalten; es werden keine weiteren Benutzer- oder Mandantenrechte abgeleitet. Fehlerhafte Gruppenlisten, doppelte UUIDs oder ungültige Mitgliedschaften werden gemeldet, nicht durch Views kaschiert.

**Weitere Ressourcenarten:** Aktuell Mitarbeiterressourcen. Geräte/Fahrzeuge und eine Organisationshierarchie werden mit dieser Änderung nicht behauptet. Der Personen-Endpunkt `/person/listabteilungen` betrifft Personen-/Kontaktabteilungen und wird nicht ohne Nachweis als Mitarbeiter-Ressourcengruppe verwendet. Offene Frage an PDS: Welche dokumentierten Endpunkte liefern Hauptgruppe, Farben/Sortierung sowie planbare Geräte-/Fahrzeugressourcen mit Zuordnung zur Terminplanung? Eine eventuelle View ist erst nach nachgewiesener Feldlücke zu ergänzen.

Prüfung: Gruppen und Einzelauswahl (Prüfnachweis in der Git-Historie).

Oberfläche (05.11.2026): „Ressourcenauswahl“ steht ohne Auswahlzähler neben „Kalenderfarben“ und verwendet dieselbe Schaltflächengestaltung. API-Zuordnung und Filterverhalten bleiben unverändert.

### Benutzerbezogene Ressourcenauswahl (05.11.2026)

HeyElli-Einstellung, keine PDS-Stammdatenänderung: `GET/POST /api/ressourcenkalender/ressourcenauswahl` liest/schreibt die Ressourcen-UUID-Auswahl ausschließlich für die serverseitig geprüfte Disponentensitzung. Kein PDS-Schreibpfad und keine View erforderlich. Ressourcen/Gruppen kommen unverändert aus den oben dokumentierten PDS-APIs. Speicherung lokal in `.local/heyelli/resource-selections/`, getrennt nach stabiler Benutzerkennung (AD-Objektkennung bei AD/Demo-AD), nicht nach Anzeigename oder gemeinsamem API-Token. Benutzerwechsel werden beim Speichern geprüft; keine übergebene Benutzerkennung bestimmt das Speicherziel. Ungültige/zu große Eingaben werden abgewiesen, Schreibzugriffe prüfen den Ursprung.

`null` bedeutet alle einschließlich neuer Ressourcen, `[]` keine, UUID-Listen eine feste Auswahl. Vorübergehend nicht verfügbare UUIDs bleiben erhalten. Persistenz über Modulwechsel, Neuladen, Abmeldung und Serverneustart; bei Speicherfehlern keine Erfolgsmeldung. Noch offen für Produktivbetrieb mit mehreren Instanzen: gemeinsamer persistenter HeyElli-Einstellungsspeicher. Keine Behauptung einer Speicherung in einem tatsächlich angeschlossenen PDS.

Oberfläche (05.11.2026): Farblegende und Farbhinweise unter dem Kalenderplan entfernt. Farbkonfiguration, Auflösung der Haupt-/Nebenfarben und PDS-Datenzuordnung bleiben unverändert.

Oberfläche (05.11.2026): Checkbox „Haupttechniker-/Begleiter-Badges“ neben „Vorgemerkte Termine“ blendet ausschließlich die H/B-Kennzeichnung auf Terminbalken ein oder aus (standardmäßig sichtbar). Zuordnungen, Termindaten, Kapazitäten und API-Abläufe bleiben unverändert; Rollen bleiben in Termindetails und zugänglichen Beschriftungen verfügbar.

Benutzereinstellungen (05.11.2026): `GET/POST /api/ressourcenkalender/ressourcenauswahl` liefert/speichert zusätzlich `showTechnicianBadges` (Boolean). Beide Einstellungen werden unabhängig aktualisiert, ohne die jeweils andere zu überschreiben. Bestehende Dateien ohne Badge-Wert verwenden `true`. Gleiche serverseitige Benutzerbindung und Ursprungsprüfung wie für die Ressourcenauswahl; persistiert ausschließlich in HeyElli, kein PDS-Endpunkt oder View erforderlich. Bei Benutzerwechsel neu geladen, bei Speicherfehlern bleibt der bisherige Wert bestehen.

### Kalender auf Arbeitszeiten begrenzen (05.11.2026)

Reine HeyElli-Anzeigeoption: nutzt die bereits dokumentierte simulierte PDS-Datenansicht `sim_calendar_working_times` über `/datenansichten/list` und `/datenansichten/listdaten` für Arbeitsintervalle. Keine weitere API-/View-Feldlücke, keine Schreibzugriffe auf PDS. Frühester Beginn und spätestes Ende werden über die sichtbaren Ressourcen und den gewählten Zeitraum gebildet, Pausen nicht herausgerechnet. Ohne Intervalle/bei fehlendem Modell volle Tagesachse. Alle Tage verwenden dasselbe Zeitfenster. Termine außerhalb werden optisch ausgeblendet, Kapazitäts- und Warnungsberechnung behalten vollständige Daten. Anlegen per Doppelklick, Drag/Resize und Viertelstundenmarkierung auf diese Achse umgerechnet; bestehende Datumswerte werden nicht durch bloßes Umschalten geändert. Option inzwischen benutzerbezogen in HeyElli gespeichert (siehe Ergänzung unten). Simulator und HeyElli umgesetzt, kein tatsächlich angeschlossenes PDS geprüft.

Benutzerpersistenz (05.11.2026): `GET/POST /api/ressourcenkalender/ressourcenauswahl` liefert/speichert zusätzlich `limitWorkingHours` als Boolean. Standard für neue Benutzer und bestehende Dateien ohne dieses Feld: `false`. Speicherung unter derselben serverseitig geprüften Benutzerkennung wie Ressourcenauswahl und Badge-Sichtbarkeit; unabhängige Teilaktualisierungen erhalten die anderen Einstellungen. Benutzerwechselprüfung, Ursprungsschutz und Eingabevalidierung bleiben aktiv. Beim Öffnen und Benutzerwechsel geladen, erst nach erfolgreichem Speichern übernommen; Scrollposition anschließend auf die aktuelle Uhrzeit in der neuen Achse angepasst. Reine HeyElli-Präferenz, kein zusätzlicher PDS-API-Endpunkt oder View und kein PDS-Schreibzugriff. Lokale Einzelinstanz-Persistenz unverändert.

Benutzerpersistenz und Filterzeile (05.11.2026): `GET/POST /api/ressourcenkalender/ressourcenauswahl` liefert/speichert zusätzlich `showTentative` als Boolean (Standard `true`). Gleiche geprüfte Benutzerbindung, Ursprungsschutz und unabhängige Teilaktualisierung wie für die übrigen HeyElli-Kalenderpräferenzen. Bestehende Dateien bleiben kompatibel; bei Fehlern bleibt der bisherige Wert bestehen. Keine Änderung an PDS-API-/View-Zuordnung oder Terminen. Ressourcen-/Terminsuche jetzt als eigene Zeile direkt über dem Plan. Reiner Anzeigefilter, kein Zugriffsschutz; vollständige Termindaten bleiben Grundlage der Einzelkapazitäten.

Oberfläche (05.11.2026): Statische Bedienhinweiszeile unter dem Zeitraum entfernt; dynamische Status-/Fehlerrückmeldungen bleiben erhalten. Datumsauswahl zeigt die ISO-Kalenderwoche des gewählten Datums, Zeitraum-Anzeige die enthaltene KW bzw. KW-Spanne mit Wochenjahr bei Jahreswechsel. Lokale Datumsberechnung, keine zusätzliche PDS-API/View erforderlich.

Oberfläche (05.11.2026): Erfolgsbestätigungen nach dem Speichern von Kalenderpräferenzen, Farben und Terminen sowie nach Anlegen/Löschen werden unter dem Zeitraum nicht mehr angezeigt. Fehler, laufende Speicherung und Drag-Vorschau bleiben sichtbar. API-/View-Zuordnung und Speicherung unverändert.

Oberfläche (05.11.2026): „Neu laden“ steht rechts in der Suchfilterzeile direkt über dem Plan; Verhalten und bestehende PDS-API-/View-Aufrufe bleiben unverändert.

### Zentrales Plattformbackend und eigene Rollen (05.11.2026)

| Feld/Funktion | API-Pfad und Schema | View / Vorrang | Implementierungsstand / offene Fragen |
| --- | --- | --- | --- |
| HeyElli-Benutzer, Rollen, Freigabe und Sitzungen | Eigene Plattformverwaltung unter `/api/verwaltung`, `/benutzer` und `/sitzungen`; keine entsprechenden dokumentierten PDS-Rollen-/Rechteendpunkte | Keine View. Plattformberechtigungen werden serverseitig geprüft; keine Ableitung von Rechten aus Ressourcengruppen/Funktionen | PostgreSQL, Rollen Administrator/Disposition/Lesezugriff und geschützte Verwaltung lokal implementiert. Keine Änderung an PDS-Benutzern oder PDS-Rechten. |
| Fachlicher Bearbeiter | Weiterhin `POST /service/create`, `PdsAPIServiceAuftragAnlegenRESTModel`, `vorgangsdaten.bearbeiterUUID` | Bestehende geprüfte AD-/Demo-Zuordnung bleibt maßgeblich; keine View und keine Browserzuweisung | Dauerhafte Sitzung bindet die geprüfte PDS-Kennung; ein Zuordnungswechsel entwertet den Zugriff. Fachabläufe bleiben Simulator. Die Identität hinter der Kennung und Fremdzuweisungsrechte bleiben für echtes PDS zu bestätigen. |
| Rechte des zentralen API-Zugangs | OpenAPI-Einleitung: Bearer-Token, Mandantenbindung und Rechte seines zugeordneten PDS-Benutzers | Plattformrolle kann PDS-Rechte nicht erweitern; API-Fehler führen nie zum View-Fallback | Zentrale API-Authentifizierung unverändert. Keine echte PDS-Verbindung aktiviert oder geprüft. |

Tests laufen in einer ausdrücklich getrennten PostgreSQL-Datenbank und verändern keine Entwicklungs-/PDS-Fachdaten. Produktivbetrieb bleibt gesperrt. Betriebsanleitung und Grenzen: [Plattformbackend](../auth/platform-backend.md).

### PostgreSQL für Kalenderfarben und persönliche Anzeigeeinstellungen (05.11.2026)

| Feld/Funktion | Konkreter API-Pfad / Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Globale HeyElli-Farbregeln und Haupt-/Nebenfarben | Plattform `GET/POST /api/ressourcenkalender/farben`; bestehende `CalendarColor`-/`ColorLayouts`-Modelle | Keine neue PDS-API oder View. Vorhandene PDS-Farbdaten und fachliche Normalisierung unverändert | PostgreSQL statt lokaler Farbdatei; Altwerte transaktional und wiederholbar übernommen. Administrator für Änderungen erforderlich. |
| Eigene Ressourcenauswahl, Badges, Arbeitszeitbegrenzung, vorgemerkte Termine | Plattform `GET/POST /api/ressourcenkalender/ressourcenauswahl`; `selection`, `showTechnicianBadges`, `limitWorkingHours`, `showTentative`, `version` / `expectedVersion` | Reine HeyElli-Präferenzen, kein zusätzlicher PDS-Pfad, kein View und keine PDS-Schreiboperation | Benutzerbezogen in PostgreSQL. Bestehende Hash-Zuordnung bleibt erhalten, auch vor Benutzerprovisionierung. Nur eigenes Sitzungsprofil zugänglich. |
| Hell/Dunkel/Wie Gerät | Plattform `GET/POST /api/einstellungen`; `appearance`, `owner`, `version` / `expectedVersion`, optionale Übernahme `importIfUnset` | Kein PDS-Feld / View. Gespeicherte Profilwahl hat Vorrang vor einmaliger Browserübernahme | Implementiert, eigene Präferenz für alle aktiven Rollen. Ohne Anmeldung bleibt die Browserwahl lokal. |

Migration 003 und `settings:import` ändern keine PDS-Verträge. Originaldateien bleiben erhalten, existierende PostgreSQL-Werte werden nicht überschrieben. Kein Dateispeicher-Fallback bei Datenbankfehlern. Die echten PDS-Verbindungen bleiben ungetestet und nicht aktiviert. [Übernahme und Betriebsgrenzen](../auth/settings-storage.md).

### Kalenderfarben und Systemvorgaben in der Verwaltung (06.11.2026)

| Feld/Funktion | API / Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Kalenderfarben in `/verwaltung` | Bestehendes `GET/POST /api/ressourcenkalender/farben`, `CalendarColor` und `ColorLayouts` | Kein neuer PDS-Endpunkt/View; identische zentrale Regeln und Haupt-/Nebenfarben wie im PlanBoard | Wiederverwendeter Editor, PostgreSQL-Daten unverändert. Administrator für Änderungen. |
| Standarddarstellung und Kalender-Anzeigevorgaben | Plattform `GET/POST /api/verwaltung/einstellungen`: `defaultAppearance`, `showTechnicianBadges`, `limitWorkingHours`, `showTentative`, `version` | Reine HeyElli-Konfiguration, kein PDS-Schema/View und keine PDS-Schreiboperation. Bestehende Benutzer-/Browser-/Altdateiwerte haben Vorrang | Migration 004; Administrator, Ursprungsschutz, Versionsvergleich und Verwaltungsprotokoll. Vorgaben nur für noch nicht konfigurierte Präferenzen. |

Keine Änderung an echter PDS-Authentifizierung, Rollen oder Terminen. Fachabläufe verwenden weiterhin den Simulator. PostgreSQL-Einstellungen wurden in getrennter Testumgebung einschließlich Neustart geprüft; echte PDS-Anbindung bleibt nicht aktiviert.

### Lesende Kalenderlegende statt Farbeditor (06.11.2026)

| Feld/Funktion | API / Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Verwendete Haupt-/Nebenfarben | Bereits geladene Plattformmodelle `CalendarData.colors`, `colorLayouts`, `CalendarEvent`; gemeinsame `eventColorDetails`-/`eventColors`-Auflösung | Keine neue API/View und keine Schreibzugriffe. Bisherige Farbquellen und Zuordnung unverändert | Dialog „Legende“ berücksichtigt Zeitraum, Ressourcen-/Terminfilter, Vormerkungsfilter und verkürzte Zeitachse. Gleiche Farbe kann mehrere Bedeutungen mit getrennten Beschriftungen haben. Neutrale Hauptflächen werden erklärt. |
| H/B-Rollenlegende | Vorhandene `mainTechnicianId`/`companionTechnicianIds`, bereits über Service-API aufgelöst | Keine neue PDS-Quelle und keine Ableitung aus Teilnehmerreihenfolge | H = Haupttechniker, B = Begleiter ausschließlich im Dialog „Legende“ erklärt. Badge-Ausblenden bleibt eine persönliche Präferenz. |
| Zentrale Farben bearbeiten | Bestehendes geschütztes `POST /api/ressourcenkalender/farben`; Oberfläche ausschließlich `/verwaltung` | Administratorberechtigung und Versionsschutz unverändert | Editor aus dem PlanBoard entfernt. Keine Datenmigration und keine Änderung gespeicherter Farben. |


Kompakte Kalenderlegende (06.11.2026): Lesende Einträge sind nach tatsächlich verwendeter Farbquelle Termintyp/Kategorie/Status gruppiert. Haupt-/Nebenfarbe bleiben je Eintrag gekennzeichnet; neutrale Darstellungen bleiben ihrer angefragten Quelle zugeordnet. Keine Änderung der API-/View-Vorrangregeln, keine neuen Endpunkte oder Schreibzugriffe. Gruppierung, Mehrfachverwendung derselben Kategorie und Filterung sind isoliert geprüft.

### Hintergrundaktualisierung und lokale Sperre je Termin (06.11.2026)

| Funktion | API / Schema | Vorrang / View | Implementierung / Grenzen |
| --- | --- | --- | --- |
| Automatisches Lesen ohne Bedienungssperre | Bestehendes Plattform-GET `/api/ressourcenkalender`, unveränderte normalisierte `CalendarData`/`CalendarEvent`; PDS weiterhin `/termin/listplanung`, `/termin/detailsbatch` und bestehende Fachauflösungen | Keine neue API/View, kein Fallback bei API-Fehlern. Bei vorübergehenden Lesefehlern bleiben zuletzt geladene Daten mit Fehlermeldung sichtbar | Hintergrundlesen, neueste Anfrage gewinnt, Abbruch/15-Sekunden-Timeout gibt Ladeanzeige frei. Initiales Laden und Zeitraumwechsel bleiben getrennt. 401/403 entfernt Daten und entwertet ausstehende Antworten. |
| Einzeltermin während Bearbeitung/Speicherung schützen | Bestehende Termin-UUID aus `CalendarEvent.id`; unverändertes POST/DELETE `/api/ressourcenkalender`, erwarteter Ausgangsstand bleibt Bestandteil der Anfrage | Rein lokale UI-Koordination, keine PDS-Reservierung. Alle Ressourcenkopien desselben Termins teilen die Sperre | Andere Termine werden weiter aktualisiert und können parallel gespeichert werden. Verspätete Leseantworten überschreiben keine neueren Änderungen/Löschungen. Rücknahme betrifft nur den fehlgeschlagenen Termin. |
| Fehler, Planungsdialoge und Benutzerwechsel | Bestehende Planungs-/Fortsetzungsantworten und serverseitig geprüfte Sitzung | Keine zusätzliche API und kein direkter Datenbankzugriff | Entwürfe bleiben nach Schreibfehlern weiter bearbeitbar; Bestätigungen werden nacheinander gezeigt, Fortsetzungswiederholungen terminbezogen gehalten. Antworten vor einem Benutzerwechsel werden verworfen. |

Die echte PDS-Anbindung bleibt nicht aktiviert. Eine atomare Sperre gegenüber externen PDS-Schreibern oder mehreren Plattformprozessen wird nicht behauptet; die zuvor dokumentierten Grenzen der erwarteten Ausgangsstände bleiben bestehen.


Lesezugriff auf lokal speichernde Termine (06.11.2026): Gespeicherte Balken zeigen während einer laufenden Anfrage einen Ladekringel und bleiben zum Öffnen der Details bedienbar. Felder, Speichern/Löschen und Drag-/Resize-Aktionen sind für diesen Termin deaktiviert; Schließen bleibt erlaubt. Nach Abschluss wird ein erneut geöffneter Dialog mit dem API-Ergebnis aktualisiert. Keine neuen PDS-Endpunkte, Views oder Sperren; unveränderte serverseitige Konflikt-/Berechtigungsprüfung.

Prüfung erneuter Terminänderung nach Antwortverlust (06.11.2026): Bestehendes POST `/api/ressourcenkalender` / `PdsCalendar.update`, dokumentiertes `/termin/update` und Rücklesen `/termin/details`; keine neuen Endpunkte/Views. Tests mit echtem Simulatoradapter bestätigen erfolgreiche Wiederholung vor Speicherung, Konflikt 409 bei veraltetem Ausgangsstand nach bereits erfolgter Speicherung, keine neuen UUIDs und keinen Verlust zwischenzeitlicher Änderungen. Der Browser benötigt im zweiten Fall Neuladen/Abgleich; keine allgemeine transparente Idempotenz des echten PDS-Update-Endpunkts behauptet. Prüfbericht (Prüfnachweis in der Git-Historie).

Automatischer Abgleich beim erneuten Speichern (06.11.2026): `PdsCalendar.update` liest innerhalb der bestehenden lokalen UUID-Sperre über dokumentiertes `POST /termin/details` (`Termin`-Antwort) den aktuellen Stand. Stimmt das vollständige angefragte Ziel einschließlich Texte, Optionen und gegebenenfalls Haupt-/Begleittechniker bereits überein, wird dieses Ergebnis ohne `POST /termin/update` bzw. `/service/updatestoerung` bestätigt. Ansonsten bleiben die erwarteten Ausgangswerte und Konfliktantworten unverändert verbindlich. Keine neue API, kein View/Fallback, keine Datenbankänderung. Acht isolierte Adaptertests prüfen Antwortverlust, unveränderte UUID-Menge, parallele Wiederholungen, Optionen, Rollen und Schutz neuerer Änderungen. Implementiert im Plattformadapter und mit Simulator geprüft; kein atomarer Compare-and-Swap gegenüber externen PDS-Schreibern/mehreren Plattformprozessen und keine allgemeine Idempotenz von PDS behauptet. Mehrteilige Teilfehler und Neuanlagen bleiben eigene Abläufe.

Browserverifikation des automatischen Wiederholungsabgleichs (06.11.2026): Zwei Browserfenster mit echten Kalenderkomponenten und `PdsCalendar`/`SimulatedPdsApi` auf temporärer SQLite-Datei. Antwortverlust nach tatsächlichem `/termin/update`, erfolgreiche Wiederholung ohne Neuladen und ohne weiteren Schreibzugriff sowie Konflikt 409 nach neuerer Änderung im zweiten Fenster bestätigt. Kringel und Feldsperren nach Erfolg/Abbruch/Konflikt aufgehoben, eigener Entwurf und neuerer gespeicherter Stand erhalten. Fünf HTTP-Speicherversuche, drei PDS-Schreibaufrufe, unveränderte Testtermin-UUIDs. Keine neue API/View; echte PDS-Anbindung weiterhin nicht geprüft. Details im Prüfbericht (Prüfnachweis in der Git-Historie).

### Automatischer Feldabgleich und Offline-Wiederholung (06.11.2026)

| Funktion | API / Schema | Vorrang / View | Stand und offene Punkte |
| --- | --- | --- | --- |
| Unabhängige Änderungen zusammenführen | Plattform `POST /api/ressourcenkalender`, `CalendarChange.expected` und aktuelles `CalendarEvent`; Rücklesen über `POST /termin/details`, Schreiben über `/termin/update` bzw. `/service/updatestoerung` | Ausschließlich bestehende API, keine Views oder direkten PDS-Datenbankzugriffe | Feldvergleich im Adapter implementiert, echte widersprüchliche Felder liefern 409 mit aktuellem Stand/Feldnamen. Identität/Schreibrecht weiterhin auf Server geprüft. Keine externe atomare Versionssperre nachgewiesen. |
| Entwurf und Wiederholung | Lokaler Browserspeicher je serverseitig ermitteltem Einstellungs-Owner; unveränderte Schreib-API und Wiederholungskennung | Keine neue PDS-Funktion, kein View-Fallback | Bereits gesendete Änderungen bei Online-Signal/alle 15 Sekunden wiederholen; ungesendete Eingaben wiederherstellbar. Lokale Gerätesicherung, kein geräteübergreifender Entwurfsdienst. Getrennte lokale Entwurfsstände desselben Benutzers/Termins einschließlich mehrerer Tabs sind implementiert; siehe Mehr-Tab-Ergänzung unten. |

Mit Simulator und Browser geprüft; echte PDS-Verbindung weiterhin nicht angeschlossen. Prüfbericht und Grenzen (Prüfnachweis in der Git-Historie).

### Benutzer-/Zeitnachweis bei Feldkonflikten (06.11.2026)

| Funktion | API / Schema | Vorrang / View | Stand und offene Punkte |
| --- | --- | --- | --- |
| Gespeicherte Feldänderung zuordnen | Aktuelle normalisierte Werte aus `POST /termin/details`, bestätigte Antworten von `/termin/update` bzw. `/service/updatestoerung`; lokales `platform.audit_events` mit Sitzungs-Actor, Feldfingerabdruck und PostgreSQL-Zeit | Bestehende API, kein View und kein direkter PDS-Datenbankzugriff | Implementiert für Plattformänderungen: Nachweis-Callback innerhalb lokaler UUID-Sperre. Identische Wiederholungen ändern ursprünglichen Nachweis nicht. Keine verteilte Transaktion zwischen PDS und PostgreSQL; fehlende/abweichende Nachweise bleiben unbekannt. |
| Beide Konfliktseiten anzeigen | Geschütztes Plattform-POST `/api/ressourcenkalender`: 409 enthält `current`, `conflicts`, `provenance.current` und `provenance.mine`; lokale optionale `editedAt`-Zeit je Feld | Actor der Anfrage ausschließlich aus serverseitiger Sitzung; Client-Zeit ausdrücklich Gerätezeit, ersatzweise Server-Eingangszeit | Benutzer und Zeitpunkt je konfliktbehaftetem Feld angezeigt. Keine PDS-Autor-/Zeitfelder erfunden. Historische/externe Herkunft ohne nachgewiesene API-Felder bleibt offen. |

59 Kalender-/Nachweistests, 23 isolierte PostgreSQL-Tests und Browserregression für automatische Zusammenführung/Offline-Wiederholung erfolgreich. Keine echte PDS-Verbindung geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).


### Getrennte lokale Entwurfsstände je Tab (06.11.2026)

Unveränderte API-Verträge `POST /api/ressourcenkalender`, `CalendarChange.expected`, `/termin/details`, `/termin/update` und `/service/updatestoerung`; keine neue PDS-Funktion, kein View oder PDS-Datenbankzugriff. Eigene unveränderliche lokale Speichereinträge je Stand verhindern Überschreiben und Löschen fremder/späterer Eingaben. Alte Entwürfe werden übernommen, Originalstände beim Wiederherstellen erhalten. Storage-Ereignisse aktualisieren nur die Wiederherstellungsliste; tabübergreifende automatische Wiederholungen werden über Web Locks nach Wiederholungskennung koordiniert und erneut auf vorhandene, sendebereite Stände geprüft. Ohne Web Locks bleiben fremde Dokumentstände manuell wiederherstellbar. Serverseitige Feldkonflikt-/Berechtigungsprüfungen bleiben bestehen. 64 gezielte Tests und Zwei-Tab-Browserprüfung erfolgreich; keine echte PDS-Verbindung geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).

Bereinigung bestätigter Kalenderentwürfe (06.11.2026): Unveränderte Plattform-/PDS-APIs. Bestätigte Ergebnisse von Kalender-POST und angenommene, nicht lokal geschützte Kalender-GET-Ergebnisse dienen zum Entfernen nachgewiesen erledigter lokaler Stände. Arbeitskopien und ihre explizit referenzierten unveränderlichen Ursprünge werden nach erfolgreichem Abschluss entfernt; abweichende Entwürfe und während einer Anfrage neu erzeugte Revisionen bleiben bestehen. Keine zusätzlichen PDS-Schreibvorgänge oder Views. 68 gezielte Tests und Browserprüfung erfolgreich; echte PDS-Anbindung weiterhin nicht geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).

### Hintergrundsicherung ohne Entwurfsverwaltung (06.11.2026)

Unveränderte Kalender-/PDS-Schreibverträge (`POST /api/ressourcenkalender`, `/termin/details`, `/termin/update`, `/service/updatestoerung`) und serverseitige Zugriffs-/Feldkonfliktprüfungen. Kein neuer View oder PDS-Datenbankzugriff. Lokale Sicherungsstände werden beim normalen Terminöffnen aufgenommen und je Feld zusammengeführt; nur echte lokale Widersprüche verlangen eine Auswahl. Die geschützte Plattform-Einstellungsantwort ergänzt den Anzeigenamen der geprüften Sitzung für lokale Konflikthinweise. Vorübergehende Schreibfehler bleiben bis drei Fehlversuche bzw. 90 Sekunden still; terminale 4xx-Antworten und echte API-Feldkonflikte werden gezielt behandelt. 74 Kalender-/Hintergrundtests, 23 isolierte PostgreSQL-/HTTP-Tests und Browserprüfung erfolgreich. Keine echte PDS-Verbindung geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).

Browserprüfung nach vollständigem Schließen aller Kalender-Tabs (06.11.2026): Bestehende Plattform-/PDS-APIs unverändert. Wiedereröffnung derselben Test-Origin im selben Browserprofil nimmt gesendete lokale Änderungen automatisch auf; Antwortverlust vor und nach `/termin/update` geprüft. Beta wurde nach bereits erfolgter Speicherung nicht erneut geschrieben, Alpha nach Wiederöffnung gespeichert, ein unabhängiges PIM-Feld erhalten. 18 IDs vorher/nachher identisch, keine Gamma-Schreibanfrage für ungesendete Eingaben. Keine neue API, View oder Änderung am Produktcode; tatsächlicher Adapter/Simulator geprüft, echte PDS-Verbindung nicht. Prüfbericht (Prüfnachweis in der Git-Historie).

### Samstag/Sonntag gemeinsam ein- und ausblenden (06.11.2026)

| Funktion | API / Schema | Vorrang / View | Stand und Grenzen |
| --- | --- | --- | --- |
| Persönliche Wochenendanzeige | Plattform GET/POST `/api/ressourcenkalender/ressourcenauswahl`, optionales boolesches `showWeekends` im bestehenden Kalender-JSON von `platform.user_preferences` | Rein lokale Anzeigepräferenz, kein PDS-Schreibfeld, keine neue View | Implementiert mit geprüfter Sitzung/Owner und bestehender Versionsprüfung. Alte Profile bleiben standardmäßig bei sichtbaren Wochenenden. |
| Verdichtete Zeitachse und tatsächliche Termindaten | Unveränderte PDS-Planungslesepfade `/termin/listplanung`, `/termin/detailsbatch`; vorhandene Schreibpfade für explizite Terminänderungen unverändert | UI filtert Wochenendspalten; keine Terminlöschung, kein Datenfallback | Kopf/Termine/Arbeitszeiten/Legende/Kapazitäten auf sichtbare Tage projiziert. Slot-Anlage und Drag/Resize verwenden tatsächliche Tagesoffsets; Tagesnavigation überspringt ausgeblendete Wochenenden. |

93 Kalender-/Darstellungstests, 24 isolierte PostgreSQL-/HTTP-Tests und Browserprüfung mit Samstag-/Sonntagsterminen erfolgreich. Keine echte PDS-Verbindung geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).

Freitag–Montag-Verschieben/Verlängern bei ausgeblendetem Wochenende (06.11.2026): Unveränderte Kalender-POST-/PDS-Verträge (`/termin/details`, `/termin/update`); nur Tests/Fixture/Dokumentation ergänzt. Echte Kalenderkomponenten per Maus mit tatsächlichem Simulatoradapter geprüft: zwei Verschiebungen jeweils sechs Stunden erhalten, zwei Verlängerungen korrekt Freitag 14:00 bis Montag 10:00 = 68 Kalenderstunden, Ganztag Montag 00:00 bis Dienstag 00:00. Wochenend-Kompression und Arbeitszeitfenster verändern keine gespeicherten Grenzen. Fünf Schreibaufrufe, UUIDs/Ressourcen unverändert, Persistenz nach Neuladen bestätigt. Keine neue API/View und keine echte PDS-Verbindung. Fachliche Planungs-/Fortsetzungsdialoge in diesem Geometrietest nicht neu geprüft. Prüfbericht (Prüfnachweis in der Git-Historie).

Fixierung und Bearbeitung: Die Oberfläche erlaubt Eingaben vor dem Speichern. Beim Bestätigen wird über `/termin/update` zunächst `fix:false` und danach die fachliche Änderung geschrieben (bestehender Adapter/Simulator, kein Nachweis eines angeschlossenen PDS). Zwischenstände bleiben durch Vergleichswerte und Hintergrundsicherung geschützt; beide API-Schritte sind keine gemeinsame Transaktion.

HeyElli-Terminhistorie: Bestätigte Änderungen im bestehenden `onSaved`-Callback werden zusätzlich mit alten/neuen Feldwerten, Sitzungsbenutzer und PostgreSQL-Zeit gespeichert. Lesender Terminzugriff über `POST /termin/details` (`PdsAPITerminDetailsRESTModel`) vor Historienausgabe. Keine PDS-Historien-API, kein View, keine rückwirkende Erfassung direkter PDS-Änderungen. Fehler beim Protokollieren nach erfolgreichem PDS-Schreiben sind mangels verteilter Transaktion weiterhin eine mögliche Protokolllücke.

Mobile Ausgabe im Terminfenster: `POST /service/mobilausgeben`, `PdsAPIServiceAuftragMobilAusgebenRESTModel` mit serverseitig aus `/termin/details` abgeleiteter Serviceauftrag-UUID und `auftragspool:false`. Haupttechniker wird vor Bestätigung angezeigt und serverseitig erneut verglichen. Erfolgreiche Ausgabe mit Benutzer/Zeit und Haupttechniker in HeyElli-Historie. Keine View und kein automatischer Neuversuch. Implementiert gegen Simulator; reales PDS, Zustellung und Auswirkungen mehrerer Serviceebenen weiterhin unbestätigt.

Service-Stornostatus: `POST /service/updatestatus`, `PdsAPIServiceAuftragUpdateStatusRESTModel` mit `uuid` und `statusBezeichnung`; Katalog `GET /service/liststatus`, aktueller Bezug `/termin/details` + `/service/details`. Auswahlregel: „Mobil abgeholt“ → „Manuell storniert“, andere nicht stornierte Zustände → „Storniert“. Kein View, keine Terminlöschung und kein impliziter `/service/mobileausgabestornieren`-Aufruf. Implementiert im Simulator und in HeyElli mit Schreibrecht, erwarteter Status-ID, Bestätigung und Historie. Reales PDS nicht verbunden; erlaubte Übergänge und mobile Auswirkungen sind zu bestätigen. Der API-Vertrag bietet keinen atomaren Vergleich des Vorstatus.

Sammelausgabe aus der Kalenderanzeige: bestehendes `POST /service/mobilausgeben` / `PdsAPIServiceAuftragMobilAusgebenRESTModel` mit `auftragspool:false`, je eindeutiger Serviceauftrag-UUID genau ein Aufruf pro bestätigtem Durchlauf. Terminbezug und Haupttechniker werden vorher über `/termin/details` geprüft. Keine neue PDS-API oder View. Heute-Auswahl nach Europe/Berlin; sichtbare Auswahl wird clientseitig ermittelt, Server prüft Zugriff und Eignung jedes ausgewählten Termins. Teilfehler stoppen weitere Ausgaben, bestätigte Ausgaben sind in HeyElli-Historien protokolliert; keine transaktionsübergreifende Atomarität und keine automatischen Wiederholungen. Simulator implementiert; reales PDS/Mobilzustellung weiterhin offen.

Team-Wochenplan: unveränderte bestehende Kalender-Leseanbindung (`/termin/listplanung`, `/termin/detailsbatch`, `/service/details`, `/service/findstoerungtermin`, `/objekt/details`, `/person/details`). Oberfläche verwendet vorhandene `resourceIds`, `mainTechnicianId`, `companionTechnicianIds`, `customer.name`, `location` (Objekt einschließlich Standortadresse) und gegebenenfalls `addressText` (Terminanschrift). Keine neue API/Views, keine erfundenen Adressen. Fehlende Objekt-/Adressangaben werden als nicht verfügbar angezeigt; abweichende Terminanschrift bleibt in Einsatzdetails sichtbar. Simulatoranzeige, reale Datenqualität unbestätigt.

DutyBoard und Wochenplanung: vorhandene Termin-Leseanbindung `/termin/listplanung` und `/termin/detailsbatch` (u.a. `PdsAPITerminDetailsRESTModel`) wird jahresweise in Teilzeiträumen bis 60 Tage genutzt; Kategorie stammt aus `/termin/listkategorien`. Anlage über `/termin/create` (`PdsAPITerminAnlegenRESTModel`: Bezeichnung, Beginn/Ende, Mitarbeiter, `kategorienUUIDs`), Ersatz ausschließlich über `/termin/delete` (`PdsAPITerminDeleteRESTModel`) nach erneutem Vergleich des Bestands. Kein View, keine direkten PDS-Datenbankschreibzugriffe. Neue Bereitschaften sind freie Termine mit Kategorie Bereitschaft, Mo. 07:00–Mo. 07:00; keine Mobilitätsausgabe. PostgreSQL speichert Planungsschritte und Historie. Reihenfolge: neue Bereitschaft anlegen, bestätigten Bestand entfernen, Fortschritt speichern. Simulatorworkflow und Planungsmarker unterstützen Wiederaufnahme; echte PDS-Idempotenz, Atomarität konkurrierender Terminschreibzugriffe und langfristige Vollständigkeit der Verfügbarkeitsdaten bleiben offen. Keine Gleichsetzung vergangener geplanter Bereitschaft mit tatsächlich geleisteter Arbeitszeit.

Manuelle KW-Zuordnung: Zwei angrenzende Wochen sind als ausdrückliche Ausnahme erlaubt. HeyElli-Vorschau `POST /api/bereitschaft` liefert `slots[].consecutiveWarning` und `consecutiveNeighbors` (Bestandsfingerabdrücke); `start` verlangt das boolesche `confirmConsecutive: true` und persistiert `consecutiveConfirmed` im vorhandenen JSON-Planungsjournal. Hash und erneuter Bestandsvergleich binden die Bestätigung an diese Nachbartermine. `step` prüft Verfügbarkeit, maximal zwei Wochen und unveränderte Nachbarn erneut; Historie protokolliert die Ausnahme mit Benutzer/Zeitpunkt. Keine Migration, keine neuen PDS-Felder oder Views; die folgenden PDS-Pfade/Schemas bleiben unverändert. Automatische Verteilung und Tausch behalten die Ein-Wochen-Regel. Die Bereitschaftsmatrix nutzt denselben geprüften Wochenplanungsweg: `/termin/create` (`PdsAPITerminAnlegenRESTModel`) und anschließend `/termin/delete` (`PdsAPITerminDeleteRESTModel`) für ersetzbare Altbesetzungen, genau eine Woche mit Kategorie Bereitschaft. Vorschauhash, erneuter Bestandsvergleich und PostgreSQL-Fortschritt bleiben aktiv. Keine neuen PDS-Pfade oder Views.

Bereitschaft: Kategorieauflösung über `/termin/listkategorien`; Anlage `/termin/create` und Änderung `/termin/update` erzwingen `status:FREI`, wenn Kategorie Bereitschaft gewählt ist. Keine Statusänderung des zugehörigen Serviceauftrags. Fixierte Alttermine werden nicht automatisch umgeschrieben.

### Feiertagsgewichtete Bereitschaftsverteilung (07.11.2026)

| Feld/Funktion | API-Pfad / Schema | View | Vorrang / Stand / offen |
|---|---|---|---|
| Bundesland, örtliche Ausnahmen, Gewichtungen | HeyElli `POST /api/bereitschaft` preview/start: `holidays` mit enabled, state, localAssumption/localCorpus/localPeace, historyYears (1–10, Standard 5), weights (newYear/christmas/easter/pentecost/other jeweils 1–10); keine PDS-Felder | Keiner | Serverseitig validierte lokale Planungslogik; berücksichtigt bestehende Bereitschaften im ISO-Jahr. Vorschauhash bindet Optionen; Journal speichert resultierende Slots/Punkte. Mehrjährige Feiertagsrotation aus gespeicherten Bereitschaften, Rückblick 1–10 Jahre; Historie ist an den Vorschauhash gebunden. Benutzeroptionen werden separat in HeyElli/PostgreSQL gespeichert. |
| Bereitschaftstermine lesen/schreiben | Unverändert dokumentierte `/termin/listplanung`, `/termin/listkategorien`, `/termin/create`, `/termin/delete`; Terminschema mit Kategorien, Mitarbeiter und Zeitpunkten, Status FREI | Keiner | API hat Vorrang; implementiert und geprüft gegen lokalen Simulator mit erfundenen Daten. Keine tatsächliche PDS-Anbindung. Feiertage lokal aus Bundeslandregeln und Osterberechnung, nicht aus erfundenen PDS-Endpunkten. |

Die mehrjährige Rotation liest die benötigten Jahre ausschließlich über die bestehende Kalender-API (`/termin/listplanung` in begrenzten Zeitfenstern und `/termin/listkategorien`); keine Views oder direkten PDS-Datenbankzugriffe. Neujahr ist eine eigene Bewertungsgruppe mit Standardgewicht 3. Bundesland und Gewichte der aktuellen Planung werden für den gesamten gewählten Rückblick einheitlich angewendet. Historische Stammdatenwechsel des Einsatzortes werden nicht rekonstruiert; nicht mehr vorhandene Bereitschaften können nicht berücksichtigt werden. Implementiert und mit fiktiven Daten gegen den Simulator geprüft, nicht gegen echtes PDS.

### Gemeinsame Ressourcenauswahl für Bereitschaften

Der DutyBoard verwendet den vorhandenen Ressourcenauswahldialog des PlanBoards. `GET /api/bereitschaft` liefert zusätzlich `resourceGroups` aus dem bestehenden Adapter: `GET /administration/listressourcengruppen` (uuid/bezeichnung), `POST /mitarbeiter/listmitarbeiter` und `POST /mitarbeiter/detailsbatch` (ressourcengruppenUUIDs, ressourcenplanzeit). Keine Views oder neuen PDS-Endpunkte. API-Vorrang unverändert; gegen Simulator implementiert, nicht gegen echtes PDS geprüft. Die Auswahl steuert sichtbare Zeilen und die automatische Verteilung, wird separat pro Benutzer in PostgreSQL gespeichert und ändert keine gespeicherten PlanBoardpräferenzen. Server prüft Teilnehmer und Planbarkeit weiterhin beim Vorschlag und vor jedem Planungsschritt.

Persistente Bereitschaftsauswahl: HeyElli `GET/POST /api/bereitschaft/ressourcenauswahl`, serverseitig geprüfter Sitzungsbenutzer und optimistische Versionierung; PostgreSQL `platform.duty_resource_preferences` über Migration 007. Dies ist eine lokale HeyElli-Benutzereinstellung, keine PDS-Schreibfunktion; keine zusätzlichen API-Pfade oder Views auf PDS-Seite.

Die Aktion „Aus Ressourcenplan übernehmen“ verwendet HeyElli `POST /api/bereitschaft/ressourcenauswahl` mit `source: resource-plan`, eigener Zielversion und geprüftem Sitzungsbenutzer. Die Quellauswahl wird serverseitig aus dessen bestehendem PostgreSQL-Kalenderprofil gelesen und einmalig in die separate Bereitschaftsauswahl kopiert. Keine zusätzliche PDS-Schnittstelle und kein View; bestehende API-Vorrangregeln unverändert. Lokal gegen den Simulator/isolierte PostgreSQL-Testumgebung geprüft.

Persönliche Feiertagseinstellungen: HeyElli `GET/POST /api/bereitschaft/feiertage`, Schema `holidays` (enabled/state/historyYears/localAssumption/localCorpus/localPeace/weights), owner und expectedVersion. PostgreSQL-Migration 008 ergänzt separate Feiertagswerte und Version im persönlichen Bereitschaftsprofil. Keine PDS-Felder, Schreibendpunkte oder Views; serverseitige Identität und Validierung, gegenüber Ressourcenauswahl unabhängige Versionierung. Implementiert und gegen isolierte lokale Testumgebung geprüft; keine echte PDS-Anbindung.

### Bereitschafts-Fairnesskonto und Auswahlbegründungen

| Funktion | API / Schema | View | Stand / Vorrang / offene Grenzen |
|---|---|---|---|
| Fairnesskonto je Mitarbeiter | HeyElli `GET /api/bereitschaft/fairness?year=...`: from/to/asOf/weighted/settingsVersion/accounts; je Account id/days/plannedDays/holidayPoints/plannedHolidayPoints/last (christmas/easter/pentecost/newYear/other) | Keiner | Geschützter Lesezugriff; serverseitig geprüftes eigenes Feiertagsprofil. Daten über bestehende `/termin/listplanung`, `/termin/listkategorien` und Mitarbeiter-/Ressourcen-API, keine PDS-Datenbankzugriffe. Berechnung aus vorhandenen Terminen, kein Arbeitszeitnachweis und keine Wiederherstellung gelöschter Termine. |
| Grund einer automatischen Zuordnung | HeyElli Vorschau `POST /api/bereitschaft` liefert `slots[].selectionReason`; resultierender Slot inklusive Begründung wird im bestehenden Planungsjournal gespeichert | Keiner | Aus tatsächlichem Rangvergleich abgeleitet; geschützt wie die bestehende Planung. Keine neue PDS-Schreibfunktion, keine neue Datenbankstruktur. Konten berücksichtigen nur gespeicherten Bestand, Gründe auch vorausgehende Vorschlagswochen. Implementiert gegen Simulator und isolierte Tests, nicht gegen echtes PDS. |

### Persönliche Sperrwochen und Bereitschaftstausch (07.11.2026)

| Funktion / Feld | API-Pfad und Schema | View | Vorrang, Stand, offene Punkte |
|---|---|---|---|
| Benutzer–Ressource-Zuordnung | HeyElli-Verwaltung `GET/POST /api/verwaltung/mitarbeiterzuordnung`; lokale `platform.duty_employee_links` | Keiner | Ausdrückliche, eindeutige Administratorzuordnung, keine Namensheuristik und kein PDS-Schreiben. Die Spezifikation enthält `PdsAPIMitarbeiterDetailsRESTModel.benutzerUUID` über `/mitarbeiter/detailsbatch`; eine automatische Übernahme dieser Zuordnung ist derzeit nicht implementiert. Lokale HeyElli-Zuordnung ist eigenständige Konfiguration. |
| Sperrwochen | HeyElli `GET/POST /api/bereitschaft/wuensche`, actions exclude/unexclude; Ressource aus geprüfter Zuordnung, week_day ISO-Montag; PostgreSQL Migration 009 | Keiner | Lokale Planungsregel, kein erfundener PDS-Abwesenheitsendpunkt. Keine allgemeinen PlanBoardtermine angelegt. Gilt für Bereitschaftsverteilung, manuelle KW-Zuordnung und Tausch; Schreibprüfung außerdem vor Fortsetzungs-/Kalenderschreibvorgängen. |
| Urlaub als Sperre | Bestehende `/termin/listplanung`, Termin-typ URLAUB/ABWESENHEIT/PRIVATE_ABWESENHEIT, status ungleich FREI; Zeitüberschneidung | Keiner | Dokumentierte Kalender-API hat Vorrang. Bestehende Verteilungsregel bleibt erhalten; als FREI gekennzeichnete Abwesenheiten sperren nicht. Nur eine Kategorie „Urlaub“ an einem anders typisierten Termin ist nicht automatisch gleichbedeutend mit diesen Abwesenheitstypen. |
| Tauschwunsch und Zustimmung/Freigabe | HeyElli `/api/bereitschaft/wuensche`, propose/agree/reject/cancel/approve/resume; originale Terminsnapshots, status/version/progress; `duty_wish_history` mit actor/time | Keiner | Eigene Sperren/Wünsche auch für Leser; Partnerzustimmung und Planerfreigabe getrennt, Identität serverseitig. Dauerhaftes Journal in PostgreSQL, keine PDS-Schreibfunktion erfunden. Keine Benachrichtigungen, kein Tausch über zwei ISO-Jahre. |
| Tausch ausführen | Bestehende `POST /termin/details`, `/termin/listplanung`, `POST /termin/update` mit uuid/startZeitpunkt/endZeitpunkt/mitarbeiterUUIDs, Status FREI | Keiner | API-Schreiben, keine direkte PDS-Datenbankänderung. Termin-IDs und unabhängige Textänderungen bleiben erhalten. Keine systemübergreifende Atomizität: zwei Schritte, bei Teilstand fortsetzbar; bekannte Zuordnung wird bei Wiederholung erkannt. Vor jedem Schritt aktuelle Verfügbarkeit und planungsrelevanter Terminstand geprüft. Gegen Simulator getestet, nicht gegen echtes PDS. |

Die Mitarbeiterzuordnung wurde in den Verwaltungs-Unterreiter „Mitarbeiterzuordnung“ verschoben. Die Verwaltungs-API prüft Administratorrechte für Lesen und Schreiben und verwendet unverändert die bestehende serverseitige Link-Validierung. Jahr 2000–2100 steuert nur die Ressourcenabfrage, die Zuordnung gilt global. Die Wünsche-Ansicht liefert keine administrativen Benutzer-/Zuordnungslisten mehr. Keine neuen PDS-Endpunkte oder Views, keine Datenmigration.

Die Zuordnungsoberfläche ist nun direkt in „Benutzer & Rollen“ als Mitarbeiter-Spalte eingebunden, mit automatischer Speicherung bei Auswahl. Separate Verwaltungs-API, Administratorprüfung, Eindeutigkeit und Schutz offener Tauschwünsche bleiben unverändert. Keine PDS- oder Datenbankschemaänderung.

Mitarbeiterverzeichnis zur Benutzerzuordnung: `/mitarbeiter/listmitarbeiter` und `/mitarbeiter/detailsbatch`, Schema `PdsAPIMitarbeiterDetailsRESTModel.ressourcenplanzeit` (vonDatum/bisDatum). Keine Jahresauswahl mehr; HeyElli berechnet `planningAvailable` aus dem heutigen deutschen Datum und vorhandener Ressourcenplanzeit. Das Verwaltungsverzeichnis enthält auch nicht planbare Personen, die per Checkbox eingeblendet werden; gespeicherte Zuordnungen bleiben sichtbar. Der Kalenderadapter behält ohne expliziten Verzeichnismodus seine bisherige Ressourcenfilterung. Kein View und keine Schemaänderung.

Verwaltungsprotokoll: Neue lokale Kalender-Feldstempel enthalten zusätzlich die bereits ermittelten alten und neuen Werte. Unverändert lokale HeyElli-Protokollierung, keine neue PDS-Abfrage und kein PDS-Schreibpfad. Historische Feldstempel bleiben ohne nachträglich erfundene Werte.

Lokale Verwaltung: Änderungen an Benutzer-Mitarbeiter-Zuordnungen und Kalenderfarben/Farbquellen werden atomar in PostgreSQL audit_events mit alten/neuen Werten, serverseitigem Benutzer und Datenbankzeitpunkt protokolliert. Mitarbeiterbezeichnungen stammen aus dem bereits geladenen Mitarbeiterverzeichnis; keine zusätzlichen PDS-Endpunkte oder Schreibfelder. API-Vorrang und Simulatorstatus unverändert.

## Verwaltungsbereich PDS-Anbindung (07.11.2026)

Die Verwaltung enthält geschützte Einrichtung, lesende API-Prüfungen und eine Freigabeübersicht. **Keine Umschaltung der Fachmodule**: Kalender, Serviceaufnahme und Bereitschaft verwenden weiterhin den Simulator. Eine geprüfte Verbindung ist kein freigegebener Echtbetrieb.

| Funktion | Konkreter Vertrag | View/Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Mandanten-Anmeldung | securitySchemes.bearerAuth, HTTP Bearer/JWT | Kein erfundener Login-Endpunkt | Vom PDS-Admin ausgestellter Token; HTTPS-Transport prüft TLS und lehnt Weiterleitungen ab. |
| Kategorienprüfung | GET `/termin/listkategorien`, Liste `PdsAPITerminKategorieRESTModel` | API zuerst | Echte lesende Anfrage, oberste Antwortstruktur geprüft; keine Schema-Vollprüfung. |
| Mitarbeitersuche | POST `/mitarbeiter/listmitarbeiter`, `PdsAPIMitarbeiterSucheRESTModel` / `PdsAPIMitarbeiterSucheResultRESTModel`, page=0, entriesPerPage=1 | API zuerst | Minimaler Test, keine personenbezogenen Ergebniszeilen gespeichert oder an den Browser gegeben. Seitenzählung im Zielsystem weiterhin bestätigen. |
| Funktionen | GET `/person/listfunktionen` | API zuerst | Separat sichtbarer Berechtigungstest. Fehler bleiben sichtbar. |
| Ansichtenverzeichnis | GET `/datenansichten/list`, `PdsAPICustomViewRESTModel[]` | Nur ausdrücklicher Metadatentest, kein Fehlerfallback | Keine Viewdaten abgefragt und keine Simulator-Viewnamen als echte Konfiguration übernommen. Konkrete Feldlücken, Namen und Spalten müssen freigegeben werden. |
| Geschützte Einrichtung / Prüfprotokoll | HeyElli `/api/verwaltung/pds`; Migration 016, lokale verschlüsselte Umgebungsdatei | Kein PDS-Datenbankzugriff | Admin-/Same-Origin-Schutz; neue Zugangsdaten erst nach Kategorien- und Mitarbeitersuche übernehmen. Fehler erhalten bestehende Datei. Audit speichert Benutzer, Aktion, Zeitpunkt ohne Token. |

Noch vor einer Fachmodul-Umschaltung zu lösen: reale Bearbeiter-UUIDs und deren Zuordnung zu Microsoft-Konten, Trennung gespeicherter Simulator-Entwürfe/Ressourcen/Zuordnungen/Pläne von echten IDs, fehlendes Bauleiter-Schreibfeld, Ansprechpartner-Vertragswiderspruch, sicherer Abgleich nach verlorenen Create-Antworten, installationsbezogene Arbeitszeit-/Farb-/Urlaubsviews und fachliche Abnahme im getrennten PDS-Testmandanten. Die Verwaltungsoberfläche nennt diese Sperrpunkte ausdrücklich; sie bietet keinen irreführenden Live-Schalter.

## Quellenumschaltung und abgesicherter Lesezugriff (08.11.2026)

Migrationen 017/018 ergänzen die aktive Quelle, getrennte Arbeitsbereiche, Bearbeiterzuordnungen und die Kalender-Vorprüfung. **Simulator bleibt standardmäßig aktiv; Echtbetrieb bedeutet derzeit ausdrücklich nur Lesezugriff.** Die vorherige Aussage „keine Umschaltung der Fachmodule“ ist für diesen vorbereiteten Lesezugriff abgelöst, nicht für Schreibabläufe.

| Funktion | Vertrag / API-Pfad und Schema | Vorrang / Ansicht | Implementierung und Grenzen |
| --- | --- | --- | --- |
| Quellenfreigabe | HeyElli `/api/verwaltung/pds`, Aktionen `source`, `calendar-test` | Keine Datenansicht als Ersatzquelle | Explizite Bestätigung, passende verschlüsselte Konfiguration, aktive Microsoft-Anmeldung (Entra ID), erfolgreiche aktuelle API-/Kalenderprüfungen derselben Version (24 Stunden). Kein echter Schreibmodus. Isolierte Testumgebungen dürfen simulierte Anmeldung verwenden. |
| Kalender-Leseadapter | `/administration/listressourcengruppen`, `/mitarbeiter/listmitarbeiter` → `PdsAPIMitarbeiterSucheRESTModel`, `/mitarbeiter/detailsbatch`; `/termin/listplanung` → `PdsAPISuchePlanungByMitarbeiterRESTModel`, `/termin/detailsbatch`, `/termin/details`; Kategorien und dokumentierte Statuskataloge | API zuerst | Zentrale Quelle wird vor jedem Adapteraufbau ermittelt. Rückgabe kennzeichnet echte Quelle und deaktiviert Schreiben. Kalendertest liest sieben Tage und speichert nur Status/Anzahlen, keine Termine oder Personen. Reales PDS weiterhin nicht angeschlossen oder abgenommen. |
| Objekte, Kunden, Referenzen und Bestandsaufträge | Vorhandene `PdsLookups`-/`PdsServices`-Lesepfade, insbesondere `/objekt/listobjekte`, `/person/listkunden`, `/service/liststoerungen` und dokumentierte Details | API zuerst | Tatsächlicher HTTPS-Transport im freigegebenen Lesebetrieb, keine lokalen Ersatzzeilen. Auch bisher öffentliche Beispielsuchen verlangen bei echter Quelle eine serverseitig geprüfte Sitzung. |
| Schreibsperre | Alle Create/Update/Delete/Mobilausgabe-Pfade | Views ausschließlich lesend | Zentrale Readonly-Transportgrenze plus API-Sperren vor Workflowjournalen. Serviceanlage, Personenänderungen, Uploads und Bereitschaftsschreibabläufe werden nicht lokal ersatzweise ausgeführt. Der rohe Simulator unter `/api/pds/rest/api/*` bleibt ausschließlich der separate lokale Simulator. |
| Optionaler Farb-/Arbeitszeit-/Urlaubsbezug | `GET /datenansichten/list`, `POST /datenansichten/listdaten`, `PdsAPICustomViewDataRESTModel` mit `name,page,entriesPerPage`; bestehende Adapterverträge siehe working-time.md | Nur konfigurierte nachgewiesene Feldlücken | Verwaltungsfelder colorView/workingTimeView/vacationApprovalView. Fehlende konfigurierte Farbansicht liefert jetzt ausdrücklich einen Fehler; kein stiller Fallback. Namen abweichend von Simulatoransichten; Spalten/Semantik installationbezogen bestätigen. |
| Quellengebundene Einstellungen | Lokales PostgreSQL: pro Konfiguration eigenes Schema `pds_<UUID>` mit Kopien der Struktur von `calendar_colors` und `user_preferences` | Kein Zugriff auf PDS-Datenbank | Kalenderfarben und Ressourcenauswahl isoliert; persönliche Darstellung bleibt zentral. Entwurfseigentümer enthält Quellenkennung. Bei Quellenwechsel werden offene Kalenderzustände zurückgesetzt; gesicherte Entwürfe verbleiben in ihrer ursprünglichen Quelle. Simulator-Auswahl wird beim Zurückschalten wiederhergestellt. |
| Bearbeiterzuordnung | Lokales `pds_user_mappings`, Verwaltungsaktion `mapping`; `assignBearbeiter` benötigt `pdsUserUUID` | Kein belegter PDS-Benutzerkatalog vorhanden | Manuelle echte UUID pro HeyElli-Benutzer und Arbeitsbereich, eindeutig und versions-/vorwertgeschützt, auditiert. Nicht mit Mitarbeiter-UUID gleichsetzen. `pdsActorForSession` stellt serverseitig abgeleitete Identität für spätere freigegebene Workflows bereit; erweitert aktuell keine Schreibrechte. |

Bei neuen Zugangsdaten entsteht bewusst ein neuer isolierter Arbeitsbereich; alte Arbeitsbereiche bleiben lokal erhalten und werden nicht automatisch als anderer Mandant interpretiert. Tokenrotation kann deshalb derzeit einen neuen leeren Kalender-Einstellungsbereich erzeugen. Eine automatische Wiederverwendung anhand derselben URL wäre unsicher, weil der Token den Mandanten bestimmen kann. Bei Ansichtenänderungen und neuen Zugangsdaten wird die aktive Quelle auf Simulator zurückgesetzt und eine erneute Prüfung verlangt. Auf Quellenfehler gibt es keinen automatischen Rückfall.

Vor echtem Schreiben bleiben externe Vertrags-/Abnahmepunkte: Bauleiterfeld, Ansprechpartner-Pflichtfeldwiderspruch, Zuordnung und Rechte tatsächlicher Bearbeiter, sichere Behandlung verlorener Create-Antworten ohne dokumentierten Idempotenzschlüssel und Abnahme von Kalenderänderungen/Folgeschritten im getrennten PDS-Testmandanten. Keine unbekannten Endpunkte oder View-Schreibzugriffe wurden ergänzt.

Prüfstand 08.11.2026: Lint, Typecheck und Produktionsbuild erfolgreich; neun API-/Konfigurations-/Transporttests und 30 Plattformtests erfolgreich. Die isolierte PostgreSQL-/HTTP-Prüfung deckt getrennte Quellenprofile, gesperrte Schreibpfade, Verbindungsfehler ohne Fallback, Bearbeiter-Vorwertschutz und Rückkehr zum Simulator ab. Im Browser mit ausschließlich erfundenem Provider geprüft: Zugang speichern, Kalender-Vorprüfung, ausdrückliche Lesefreigabe, echter Adapterpfad ohne Simulatorzeilen und Rückwechsel. Kein reales PDS kontaktiert oder freigegeben; die Entwicklungsquelle bleibt Simulator.

## Kompakte Fragenliste zur Schreibfreigabe (08.11.2026)

Unter Verwaltung → PDS-Anbindung → Anleitung ist eine kompakte Tabelle der offenen Rückfragen verfügbar. Die Antworten müssen die installierte API-Version, dokumentierte Requestmodelle/-felder, Rechte und fiktive Beispiele benennen; sie sind keine automatische Freigabe. PDS-Admin kann Vertragslücken an den PDS-Support weitergeben.

| Frage / Funktion | Konkreter Vertrag | View / Vorrang | Stand und Freigabevoraussetzung |
| --- | --- | --- | --- |
| Bearbeiter, Vorlage, Dokumentenablage | `/service/create`, `PdsAPIServiceAuftragAnlegenRESTModel`; `/dokument/uploaddokument`, Multipart | API zuerst, keine View | Installationsbezogene Kennungen, Rechte für Fremdzuweisung, Dokumententyp, Ordner und Limits bestätigen. Kein neuer Benutzerkatalog behauptet. |
| Bauleiter setzen/entfernen | `/service/details`: `PdsAPIServiceAuftragDetailsRESTModel.bauleiterUUIDs`; Create/Update ohne entsprechendes Schreibfeld | Kein View-Schreiben | Unterstützten Endpunkt, UUID-Typ, Listen-/Vererbungssemantik bei PDS erfragen. |
| Ansprechpartnerrolle und Auftragsbezug | `/person/addansprechpartnerrolle`, Pflichtschlüssel eKommunikationswege vs. Property ekommunikationswege; `/service/details`: ansprechpartnerUUID nur lesbar | Kein View-Schreiben | Verbindlichen Request und strukturierten Auftragsschreibweg bestätigen. |
| Antwortverlust / Paralleländerungen | Bestehende Create-/Update-/Delete-, Upload- und Mobilitätsverträge; kein belegter Idempotenz- oder atomarer Versionsvertrag | Kein Fallback | Eindeutiges Wiederfinden, Sichtbarkeitszeit, Wiederholungsfolgen sowie ETag/Compare-and-Swap klären; keine Zusage verlustfreier konkurrierender Schreibzugriffe ohne Nachweis. |
| Serviceplanung / Löschen | `/service/createstoerung`, `/service/findstoerungtermin`, `/service/updatestoerung`, `/termin/update`, `/termin/delete`; jeweilige bestehende Requestmodelle | API zuerst | Terminzuordnung, Feldabgleich, unterstützte Typen, mobile Folgen und Neuplanung bestätigen. |
| Ausgabe / Storno | `/service/mobilausgeben`, `PdsAPIServiceAuftragMobilAusgebenRESTModel`; `/service/updatestatus`, `PdsAPIServiceAuftragUpdateStatusRESTModel` | Keine View | Mehrere Ebenen, Technikerwechsel, erneute Ausgabe, erlaubte Statusübergänge und tatsächliche mobile Rücknahme prüfen. |
| Mehrteilige Serviceeinsätze | `/termin/create`, `PdsAPITerminAnlegenRESTModel`; keine dokumentierte passende native Service-Referenz | Keine schreibende Ergänzungsview | Unterstützten Mehrfachtermin-/Fortsetzungsweg und Transaktionsgarantien erfragen; Simulatorergänzung nicht als reale Fähigkeit darstellen. |
| Abnahme / ergänzende Verfügbarkeit | Getrennter Testmandant; bestehende Arbeitszeit-/Urlaubs-Leseadapter, gegebenenfalls `/datenansichten/listdaten` | API vor belegter Feldlücke | Fiktive Testfälle und Verantwortliche bestätigen. Optionale Ansichten separat von fehlenden Schreibverträgen behandeln. |

Diese Änderung ergänzt ausschließlich die Anleitung. Keine neuen PDS-Aufrufe oder Schreibfreigaben; Simulator bleibt aktiv. Bestätigte Antworten erfordern anschließend Implementierung und Prüfung je freizugebendem Ablauf.

### Markdown-Download der PDS-Anleitung (08.11.2026)

Verwaltung → PDS-Anbindung → Anleitung bietet „Als Markdown herunterladen“. Geschütztes HeyElli `GET /api/verwaltung/pds/anleitung` liefert `heyelli-pds-anleitung.md` als UTF-8-Anhang mit `no-store`; serverseitig nur für Administratoren. Oberfläche und Download verwenden gemeinsame statische Inhalte für Fragen, Einrichtung, Stand und Freigabegrenzen. Keine gespeicherten Zugänge, Tokens, Benutzerzuordnungen oder Prüfresultate im Export. Kein zusätzlicher PDS-API-Pfad, kein View, keine Schreib- oder Quellenfreigabe; Simulatorbetrieb unverändert.

### Anbindungsanleitung nach Zuständigkeit (08.11.2026)

Oberfläche und Markdown enthalten nun getrennte Schritte für PDS-Admin und HeyElli-Admin: Testmandant, API-Lizenz, zentraler mandantenbezogener Bearer-Zugang, HTTPS/TLS und Netzwerk, sichere Übergabe, Microsoft-Anmeldung/Rollen als Voraussetzungen, UI-Einrichtung ohne Konsoleneingabe der PDS-Zugänge, lesende Prüfungen, ausdrückliche Lesefreigabe und Rückwechsel. Konkrete PDS-Menüwege zur Token-Ausstellung sind versionsabhängig und ausdrücklich mit PDS zu bestätigen, nicht erfunden. Die bestehenden vier Probeverträge und der Kalender-Leseadapter bleiben unverändert; Datenansichten nur für belegte Feldlücken. Fehlerhilfe für 401/403/404, TLS/Netzwerk und Prüfversionen ergänzt. Keine neuen API-Aufrufe, Views oder Schreibfreigaben; weiterhin nur mit fiktiven Daten geprüft.

### Einheitliche Integrationsanleitungen (08.11.2026)

PDS und Microsoft Graph verwenden dieselbe Anleitungskomponente: Download im Kopf, neutraler Status, zwei responsive Zuständigkeitskarten, aktueller Stand, Prüfung/Freigabe, Fehlerbehebung und Zugangsschutz. PDS-Vertragsfragen bleiben zusätzlich sichtbar. Beide Markdown-Exporte werden aus denselben strukturierten Inhalten wie die Oberfläche erzeugt. Keine Änderung an PDS-Pfaden/-Schemas, Datenansichten, Vorrangregeln oder Freigaben; Simulator unverändert aktiv.

Kompakte Anleitungsdarstellung: Der zusätzliche allgemeine Statuskasten innerhalb beider Anleitungen entfällt; der aktuelle Modulstatus bleibt oberhalb der Reiter sichtbar. Admin-Karten überschreiben den globalen Abschnittsabstand von 48 px mit 0; Kopf, Karten und Listen haben kompaktere Abstände. Die eigenständigen Markdown-Dateien behalten ihren einleitenden Kontext, sämtliche offenen Fragen und Freigabegrenzen. Keine Änderung an API, Datenansichten, Quellen- oder Schreibfreigabe.

### Zusätzliches Microsoft-Anmeldemodul (08.11.2026)

Microsoft Entra OIDC wird unabhängig von PDS vorbereitet. Keine neuen PDS-API-Pfade, Schemas, Views oder Schreibfunktionen. PDS-Freigabevoraussetzung ist seit 19.11.2026 die aktive Microsoft-Anmeldung (LDAPS entfernt); kein automatischer Bearbeiterbezug oder E-Mail-Abgleich. Microsoft-Konten sind eigene HeyElli-Identitäten mit ausdrücklicher Rollen-/Benutzerfreischaltung. Der PDS-Simulator bleibt aktiv. Details: [Microsoft-Anmeldung](../auth/microsoft-entra.md).

### Anwendung vollständig hinter Anmeldung (08.11.2026)

Die zentrale HeyElli-Zugriffssperre schützt nun auch synthetische Suchdaten und die rohe Simulator-API `/api/pds/rest/api/*` durch eine gültige Plattform-Sitzung; vorhandene zusätzliche Bearer-Prüfungen bleiben bestehen. Dokumentierte PDS-API-Pfade/-Schemas, Readonly-Grenze und API-Vorrang unverändert. Kein View-Fallback und keine neue Verbindung/Freigabe. Simulator bleibt aktiv.

UI-Nachtrag KW-Navigation: KW-Überschriften öffnen den PlanBoard ausschließlich mit `datum`, ohne Mitarbeiterfilter. Persönliche Ressourcenpräferenzen, PDS-Pfade und Schemas bleiben unverändert. Aktuell-Badge entfernt, farbliche Markierung bleibt erhalten. Keine neue API oder View.

### Bereitschaftskontextmenü und Teilung (08.11.2026)

| Funktion | Plattform / dokumentierte PDS-API | View | Umsetzung / offene Punkte |
| --- | --- | --- | --- |
| Kontextmenü / PlanBoard | Anzeige vorhandener Termine; Link mit `datum` und `mitarbeiter`, bestehende `/termin/listplanung` und Details | Keine | Temporäre Zielansicht, keine Änderung persönlicher Auswahl |
| Splitten | HeyElli `POST /api/bereitschaft/termine`, action `split`, id, expected-Fingerprint, operationId, splitAt (deutsche Ortszeit), resourceId. PDS `/termin/details`, `/termin/listplanung`, `/termin/create` (`PdsAPITerminAnlegenRESTModel`) und `/termin/update` (bestehendes Änderungs-DTO) | Keine | Server prüft Sitzung/Schreibrecht, Quelle, Fixierung, Bestand, Planbarkeit, Abwesenheit und Sperrwochen. Zweiten freien Termin mit Status FREI erzeugen, dann Original verkürzen. PostgreSQL-Journal Migration 020, Marker und Wiederaufnahme; ursprüngliche Notizen bleiben am Original und werden in den zweiten Teil übernommen. Keine gemeinsame PDS-Transaktion; echte Schreibfreigabe und atomare/idempotente Garantien weiterhin offen |
| Löschen | Gleicher HeyElli-Pfad, action `delete`; `/termin/details`, `/termin/delete` (`PdsAPITerminDeleteRESTModel`) | Keine | Sicherheitsdialog, serverseitiger Bestandsvergleich, wiederholbare Operation, Historie mit Benutzer/Zeitpunkt und alten/neuen Werten |

API-Vorrang unverändert; kein direkter PDS-Datenbankzugriff. Planungs- und Tauschprozesse werden über dieselben Jahreslocks koordiniert. Implementiert und geprüft im Simulator / isolierter PostgreSQL-Testumgebung; echter PDS-Schreibbetrieb bleibt gesperrt.

### Benutzerkonto: eigener Mitarbeiter (08.11.2026)

| Feld/Funktion | Quelle / API / Schema | View | Vorrang und Stand |
| --- | --- | --- | --- |
| Eigener Name / HeyElli-Rolle | HeyElli `GET /api/benutzerkonto`: displayName, role; serverseitige Sitzung | Keine | Nur geprüfter Sitzungsbenutzer; keine Rollen-/Benutzerwahl durch Client |
| Zugeordneter Mitarbeitername | PostgreSQL `platform.duty_employee_links` ausschließlich mit Sitzungs-ID filtern; bestehender Kalender-Ressourcenadapter über `/mitarbeiter/listmitarbeiter`, `/mitarbeiter/detailsbatch` (uuid, vorname, nachname, ressourcenplanzeit), `/administration/listressourcengruppen`. API liefert nur employee.name und employeeState, keine Verzeichnisliste | Keine | API-Vorrang. Auch aktuell nicht verfügbare Mitarbeiter aus gespeichertem Link auflösen. Simulator implementiert und isoliert geprüft. Keine Gleichsetzung mit `pdsUserUUID` oder PDS-Bearbeiterzuordnung |

Im echten PDS-Lesebetrieb sind die bisherigen simulatorbezogenen Mitarbeiterlinks nicht freigegeben: employeeState `unsupported`, keine stille Übernahme aus Simulator und kein View-Fallback. Fehlende Zuordnung (`none`), nicht mehr vorhandener Mitarbeiter (`missing`) und nicht erreichbares Verzeichnis (`unavailable`) bleiben unterscheidbar. Neue Felder des eigenen HeyElli-DTO, keine neue PDS-Schreibfunktion, keine Migration.

UI-Nachtrag Logo-Navigation 09.11.2026: Die App-Suche öffnet den bestehenden PDS-Einstellungsbereich über `/einstellungen?bereich=pds`. Kein neuer PDS-Endpunkt, kein neues Schema oder View; API-Vorrang, Simulatorbetrieb und ausdrückliche Freigaben bleiben unverändert.

UI-Nachtrag App-Namen 09.11.2026: Die drei Service-Apps heißen CaseDesk, PlanBoard und DutyBoard. Technische URLs, API-Pfade, Schemas und Speicherschlüssel bleiben unverändert; keine neue PDS-Funktion oder View.

UI-Nachtrag Meister-Pfade 09.11.2026: Kanonische Seitenpfade sind `/casedesk`, `/planboard` und `/dutyboard`; bisherige Seitenpfade leiten per HTTP 308 mit Suchparametern weiter. PDS-Verträge und bestehende Plattform-API-Pfade (insbesondere `/api/ressourcenkalender` und `/api/bereitschaft`) bleiben unverändert. Keine neue API, kein Schema oder View.

UI-Nachtrag verschachtelte Einstellungen 09.11.2026: PDS-Verbindung, API-Prüfung, Datenansichten, Bearbeiter, Quelle/Freigabe und Anleitung öffnen als Unterseiten mit URL-Verlauf statt segmentierter Reiter. `/api/verwaltung/pds`, `/api/verwaltung/pds/anleitung`, PDS-Pfade/Schemas, Geheimnisschutz und Freigaben unverändert; kein neuer View.

UI-Nachtrag lokaler Einstellungsverlauf 09.11.2026: Die Hauptbereichspfeile bleiben innerhalb der Einstellungsapp, auch auf PDS-Unterseiten. Navigationsschutz für offene PDS-Eingaben geprüft; keine Änderung an PDS-Pfaden, Schemas, Views oder Freigaben.

UI-Nachtrag kompakte Kopfzeile 09.11.2026: PDS-Unterseitentitel stehen rechts neben dem app-lokalen Pfeilpaar. Zusätzliche Eltern-/Zurück-Buttons entfernt; mobil bleibt die Bereichsauswahl per Seitenleisten-Symbol erreichbar. PDS-Verträge, APIs und Freigaben unverändert.

UI-Nachtrag Schalter 09.11.2026: Checkboxen für PDS-Freigabe und Kalenderoptionen erhalten die gemeinsame macOS-/iOS-Schalterdarstellung; Formularwerte, bestehende Freigabeschritte und Berechtigungen bleiben unverändert. Keine Änderung an PDS-Pfaden, Schemas oder Views.

UI-Nachtrag Einstellungssektionen 09.11.2026: Gemeinsame Einstellungsgruppen und ausgerichtete Integrationsformulare; Unterseitenmodell validiert PDS-Bereichszugehörigkeit. Bestehender PDS-Eingabenschutz im Browser geprüft. Keine Änderung an `/api/verwaltung/pds`, PDS-Verträgen, Schemas, Views, Geheimnisspeicherung oder Freigaben.

### Service-Cockpit und Kunden-/Objektakte · 09.11.2026

#### BMACloud-Anlagenzuordnung an technischen Einheiten · 12.11.2026

| Feld/Funktion | Konkrete API / Schema | View / Vorrang | Implementierung / offene Fragen |
| --- | --- | --- | --- |
| Vertragsbezug einer technischen Einheit | POST `/wartungsvertrag/listvertraegebyobjekt`, `PdsAPIWartungVertragDetailsRESTModel.wartung.kstKtr.nummer` | PDS-API, keine View | Pro bestehender Vertragskarte die Wartungskostenträgernummer verwenden, niemals Rechnungs- oder Objektkostenträger als Ersatz. |
| BMACloud-Anlage finden | BMACloud GET `/anlagen?nr=…` unter `/api/v2`, Schema `Anlagen` / `Anlage`, Felder `aid`, `nr`, `anlagenort` | BMACloud-API, keine View | Exakter zusätzlicher Nummernvergleich, führende Nullen erhalten, AIDs validieren und deduplizieren. Mehrere Anlagen mit identischer Nummer werden zur Auswahl angezeigt. |
| Portal-Link | Vom Betreiber ausdrücklich vorgegeben: `<Installation>/portal.php?action=anlagen_add&aid=<AID>` | Kein PDS-`webLink`; Portalroute nicht in der BMACloud-OpenAPI dokumentiert | HTTPS-Link ohne API-Token; neuer Tab mit eigenständiger BMACloud-Anmeldung. Portalroute muss später gegen die tatsächliche Installation geprüft werden. |

Integration standardmäßig deaktiviert; Einrichtung, Verbindungstest und ausdrückliche lesende Freigabe nur durch Administratoren. Serverabfragen ausschließlich bei echtem PDS-Lesebetrieb, keine Übertragung fiktiver Simulatorreferenzen. Quellen-, Berechtigungs- und Abfragefehler führen nicht zu einer erfundenen Anlagenzuordnung. Keine BMACloud- oder PDS-Schreibfreigabe. BMACloud liefert laut OpenAPI keine Browser-Links; das URL-Schema stammt aus der Betreiberangabe. Live-Verbindung und Portalziel bisher nicht abgenommen.

#### Kostenträger in Objekt-, Einheiten- und Vertragsakten · 12.11.2026

| Feld/Funktion | API-Pfad und Schema | View / Vorrang | Implementierung und offene Punkte |
| --- | --- | --- | --- |
| Objekt / technische Einheit: Zuordnung | POST `/objekt/details`, `PdsAPIObjektDetailsRESTModel.kstKtrUUID` | API, keine View | Eigene Referenz des Datensatzes lesen; keine stillschweigende Vererbung vom übergeordneten Objekt. |
| Referenz zu Nummer und Bezeichnung auflösen | POST `/administration/listkostentraeger` und `/administration/listkostenstelle`, `PdsAPIKstKtrSucheRESTModel` → `PdsAPIKstKtrSucheResultRESTModel.resultList[]` / `PdsAPIKstKtrRESTModel` (`uuid`, `nummer`, `bezeichnung`) | API, keine View | Vollständige paginierte Listen; exakter UUID-Abgleich. Gemeinsames Kostenstellen-/Kostenträgerfeld; widersprüchliche oder nicht auflösbare Referenzen als Fehler anzeigen. Keine Roh-UUID als fachliche Nummer ausgeben. |
| Vertrag: Wartung | POST `/wartungsvertrag/listvertraegebyobjekt`, `PdsAPIWartungVertragDetailsRESTModel.wartung.kstKtr` / `PdsAPIKstKtrRESTModel` | Direkter API-Wert, keine View | Nummer und Bezeichnung separat als Kostenträger Wartung in der bestehenden Vertragskarte anzeigen. |
| Vertrag: Rechnung | Derselbe Pfad, `PdsAPIWartungVertragDetailsRESTModel.rechnung.kstKtr` / `PdsAPIKstKtrRESTModel` | Direkter API-Wert, keine View | Nummer und Bezeichnung separat als Kostenträger Rechnung; keine Ableitung aus Wartung oder Objekt. |

Simulator: neue wiederholbar gelesene fiktive Referenzdatei `cost-carriers.json`, API-Listen sowie Zuordnungen an Objekten, technischen Einheiten und vorhandenen Vertragskarten. Keine Datenmigration und kein Überschreiben gespeicherter Aufträge. Bestehender Service-Lesezugriffsschutz und Quellenwahl gelten weiter. Abfragefehler führen weder zu Simulator- noch View-Fallbacks und werden nicht als fehlende Zuordnung dargestellt. Echte PDS-Antworten und Rechte auf beide Referenzlisten sind bei der späteren Anbindung zu prüfen; bislang keine Live-PDS-Abnahme. Ein eigener Vertragseditor ist nicht Bestandteil dieser Änderung.

#### PDS-Links in Akten · 12.11.2026

| Feld/Funktion | Konkrete API / Antwortschema | View / Vorrang | Stand und offene Fragen |
| --- | --- | --- | --- |
| Kundenakte: `webLink` | POST `/person/details` → `PdsAPIPersonDetailsRESTModel.webLink` | Keine View; ausschließlich gelieferter API-Wert | Öffnen im neuen Tab und Kopieren implementiert. |
| Objekt und technische Einheit: `webLink` | POST `/objekt/details` → `PdsAPIObjektDetailsRESTModel.webLink` | Keine View; ausschließlich gelieferter API-Wert | Dieselben Aktionen einschließlich untergeordneter technischer Einheiten implementiert. |
| Auftragsakte: `webLink` | POST `/service/details` → `PdsAPIServiceAuftragDetailsRESTModel.webLink` | Keine View; ausschließlich gelieferter API-Wert | Aktionen im gemeinsamen Aktenkopf implementiert. |

Alle drei Felder sind in der bereitgestellten OpenAPI als String dokumentiert. Es gibt keinen zusätzlichen API-Aufruf, keinen aus UUIDs konstruierten Link und keinen Fallback. Nur absolute HTTP-/HTTPS-Werte ohne Zugangsdaten, Leer-/Steuerzeichen oder Backslashes passieren die Prüfung; akzeptierte Werte bleiben unverändert. Fehlende/ungültige Werte blenden beide Aktionen aus. Links werden nicht serverseitig abgerufen. Bestehender Sitzungs- und Service-Lesezugriffsschutz gilt weiter. Der unveränderte Simulator liefert keine `webLink`-Werte; der Browsernachweis nutzt ausschließlich fiktive Antworten in einem separaten Checkout. Echte PDS-Antworten, Zielerreichbarkeit und eine gegebenenfalls zusätzliche PDS-Anmeldung müssen bei der späteren Abnahme geprüft werden. Prüfbericht (Prüfnachweis in der Git-Historie).

Neues Modul `src/apps/servicehub/akten/`: fachliches Anzeigemodell, reiner API-Leser, serverseitig geschützter Zugang und Oberfläche getrennt. `GET /api/service` sowie `?kind=order|customer|object&id=…` prüfen vor jedem Zugriff die serverseitige Sitzung mit mindestens Leserecht, liefern nur reduzierte Anzeigedaten und verwenden `Cache-Control: no-store`. Quellenwahl über den bestehenden `pdsApi`-Einstieg; kein direkter PDS-Datenbankzugriff, keine neue Schreibfreigabe und keine Datenansicht.

| Feld/Funktion | Dokumentierte API / Schema | View / Vorrang | Implementierung / offene Punkte |
| --- | --- | --- | --- |
| Zentrale Auftragsübersicht | POST `/service/liststoerungen`, `PdsAPIStoerungSucheRESTModel` → `PdsAPIStoerungSucheResultRESTModel` mit `PdsAPIStoerungRESTModel`, `serviceAuftrag` und `serviceAuftragEbene` | Keine View; ausschließlich API | Vollständige Seiten mit 500 Einträgen, max. 40 Seiten pro Liste; bei unvollständiger Paginierung/zu großer Datenmenge Fehler statt irreführender Teilkennzahlen. Eindeutige Auftrags-UUID gruppiert mehrere Störungen, ohne deren Planung zu verlieren. Aufträge ohne Störungen sind durch diesen Endpunkt nicht nachgewiesen und nicht enthalten. |
| Auftragstitel, Nummer, Kunde, Status | `PdsAPIServiceAuftragRESTModel`: `uuid`, `vorgangsNummer`, `bezeichnung`, `personUUID`, `vorgangStatus` | API | Simulator liefert den zuvor ausgelassenen dokumentierten Kundenbezug `personUUID` jetzt mit. Keine Ableitung des Auftraggebers aus dem Objekt, da dieser abweichen darf. Statusbezeichnungen unverändert anzeigen; keine erfundene Zuordnung „offen/abgeschlossen“. |
| Cockpit: heute, ohne Termin, ohne Haupttechniker | `PdsAPIServiceAuftragEbeneRESTModel`: `startZeitpunkt`, `endZeitpunkt`, `hauptmonteurUUID` | API | Pro Auftrag zählen, wenn mindestens eine Störung die Bedingung erfüllt. Heute = Überschneidung in Europe/Berlin; exklusives Ende berücksichtigt. Kennzahlen gelten unabhängig vom Status. Prioritätszuordnung an einzelnen Störungen ist im verwendeten Listenmodell nicht dokumentiert und wird nicht erfunden. |
| Kunden-/Objekt-/Technikernamen in der Übersicht | POST `/person/listkunden` (`PdsAPIPersonSucheRESTModel`), `/objekt/listobjekte` (`PdsAPIObjektSucheRESTModel`), `/mitarbeiter/listmitarbeiter`; jeweilige `resultList` mit UUID-Bezügen | API | Fehlende Bezüge ausdrücklich als nicht verfügbar anzeigen. Keine automatischen View-Fallbacks bei Fehlern/Berechtigungslücken. |
| Auftragsakte | POST `/service/details`, `PdsAPIServiceAuftragSucheDetailsRESTModel` → `PdsAPIServiceAuftragDetailsRESTModel`, `rootEbene.ebenen` | API | Beschreibung, Status, Beginn/Ende, Haupttechniker, Begleiter und Objektbezug. Keine Bearbeitung über die neue Oberfläche; bestehende Meister-Apps bleiben direkt erreichbar. |
| Kundenakte | POST `/person/details`, `PdsAPIPersonSucheDetailsRESTModel` → `PdsAPIPersonDetailsRESTModel` | API | Name, Kundennummer, Adresse und Ansprechpartner mit geschäftlichen Telefonen. Steuer-/Bankdaten und übrige interne Felder werden nicht an die Oberfläche weitergereicht. Zugehörige Objekte und Aufträge stammen aus der Übersicht. |
| Objektakte / technische Einheit | POST `/objekt/details`, `PdsAPIObjektSucheDetailsRESTModel` → `PdsAPIObjektDetailsRESTModel` | API | Standort, benannte Infofelder, Kunde, Untereinheiten, übergeordnetes Objekt und zugehörige Aufträge. Adresse des übergeordneten Objekts bei einer Einheit ausdrücklich als solche beschriften. |
| Aktennavigation Kunde, Objekt, Einheit, Auftrag | `personUUID` des Auftrags, `objektUUID` der Auftragsstörung sowie `uuid`, `personUUID`, `parentUUID` und `typ` aus der vorhandenen Objektliste (`/objekt/listobjekte`) | API, vorhandene reduzierte Serviceübersicht | Kundenzuordnung der Objekte kann entlang der Objekthierarchie vererbt werden. Der Kunde des Auftrags bleibt maßgeblich. Menüs zeigen sichtbare Kundenziele sowie direkt verknüpfte Ziele und deren Vorfahren, auch bei abweichendem Auftragskunden. Direkt zugeordnete Einheiten und die jeweils nächstgelegenen zugeordneten Objekte führen im Menü den Hinweis „Passend zum Auftrag“. Gleiche Logik für Simulator und PDS-Leseadapter. |
| Vorschläge in Kunden & Objekte | Vorhandene Serviceübersicht aus `/person/listkunden` und `/objekt/listobjekte` sowie bestehende Kostenträgersuche | API, bestehende Auswahl der sichtbaren Daten | Vorschläge werden aus den Suchtreffern der Kundenübersicht gebildet und öffnen die vorhandenen Akten. Kundenkategorie und persönliche Ausblendungen schränken die Treffer ein. |
| Bereichsübergreifende Suche im ServiceHub-Cockpit | Bestehende Serviceübersicht aus `/service/liststoerungen`, `/person/listkunden` und `/objekt/listobjekte`, dokumentierte Wartungsintervalle und bestehende Kostenträgersuche | API, keine neue Abfrage oder View. Die Objektliste liefert optional `PdsAPIObjektRESTModel.objektInfoFelder`. Die Übersicht projiziert den Wert eines als „Nummer“ bezeichneten Feldes als durchsuchbare Objektnummer. | Feldbezeichnung „Nummer“ ist im Simulator verfügbar und installationsabhängig. Persönliche Ausblendungen gelten für Kunden- und Objekttreffer. Unvollständige Wartungs- oder Kostenträgerdaten werden angezeigt. Details und Dokumentinhalte werden nicht separat indexiert. |
| Wartungsverträge am Objekt | POST `/wartungsvertrag/listvertraegebyobjekt`, `PdsAPIUUIDRESTModel` → Array `PdsAPIWartungVertragDetailsRESTModel`, `wartung.bezeichnung/beschreibung/leistungsumfang` | API | Exakt dieser dokumentierte Leseaufruf zusätzlich im Readonly-Transport erlaubt; Vertrags-Schreibaufrufe bleiben gesperrt. Simulator liefert aus seinen vorhandenen fiktiven Vertragsreferenzen eine klar fiktiv bezeichnete Vertragsdarstellung. Vertragsfehler separat anzeigen, nicht als leere Vertragsliste ausgeben. |

**Stand und Grenzen:** Simulator lesend im Browser geprüft; kein echtes PDS angeschlossen oder live verifiziert. Echte Endpunkte und Schemas sind dokumentiert, Berechtigungen und tatsächliche Antwortdaten müssen bei der späteren PDS-Abnahme geprüft werden. Vertragsabfragen sind kein Zugriff auf Rechnungs-/Preisdetails. Keine neuen Prioritäts-, SLA- oder Abschlussannahmen. Neue Oberfläche aktualisiert die Übersicht im Hintergrund; API-Fehler wechseln niemals still zum Simulator oder zu Views.

#### Kompakte Service-Auftragsvorschau · 09.11.2026

Reine Anzeigeänderung auf Grundlage der oben dokumentierten API-DTOs, keine neuen API-Pfade oder Views: Kunde aus `serviceAuftrag.personUUID`, Objektadresse aus `/objekt/listobjekte` einschließlich `parentUUID`-Verknüpfung bei technischen Einheiten, Termin und Haupttechniker aus derselben `serviceAuftragEbene`. Bei mehreren Störungen wird die zum Planungsfilter passende Störung angezeigt; Anzahl der Störungen sichtbar. Vorschau kürzt den Meldetext, Originaltext und alle Störungen bleiben in der Akte verfügbar. Keine Änderungen an PDS- oder Simulatorbeständen, Schreibfreigaben oder Quellenwahl.

### Nachträgliche Terminvergabe bestehender Einsätze · 10.11.2026

| Funktion | API / Schema | Vorrang / View | Stand |
| --- | --- | --- | --- |
| Vorhandenen Einsatz planen | POST `/service/updatestoerung`, `PdsAPIServiceAuftragEbeneUpdateRESTModel`: `uuid`, `startZeitpunkt`, `endZeitpunkt`, `hauptmonteurUUID`, `weiteremonteureUUIDs` | Dokumentierte API-Operation; keine View, kein Create-Aufruf | Simulator-Implementierung unterstützt jetzt auch bisher ungeplante Störungen. Gemeinsame Planungsfelder mit Schritt 3 des CaseDesks. Echte PDS-Schreibfreigabe bleibt gesperrt. |
| Vergleich und Wiederholung | Plattform-POST `/api/service/planung`, erwarteter Stand ausschließlich für die Plattform; keine erfundenen PDS-Schreibfelder | Aktuelle Planung unter SQLite BEGIN IMMEDIATE lesen und vergleichen, danach Simulator-Implementierung der dokumentierten Update-Operation ausführen | Gleicher Zielstand wird ohne erneutes Schreiben bestätigt. Anderer zwischenzeitlicher Planungsstand liefert 409; keine Überschreibung. Identität und Schreibrecht ausschließlich aus geprüfter Sitzung. Auftrag-/Störungszugehörigkeit geprüft. |

Kein neuer Auftrag, keine neue Störung und keine neue Termin-UUID: die bestehende Störung wird aktualisiert und erscheint unter ihrer stabilen Kalenderkennung. Kunde, Beschreibung und weitere fachfremde Angaben bleiben erhalten. Änderungsprotokoll mit Benutzer und Zeitpunkt wird anschließend ergänzt; ein Protokollfehler wird ausdrücklich als bereits gespeicherte Planung mit Warnung gemeldet. Keine atomare Transaktion über Simulator-SQLite und PostgreSQL behauptet. Reale PDS-Parallelitäts-/Idempotenzgarantien sind weiterhin offen, deshalb keine Freigabe echten Schreibbetriebs. Verfügbarkeit wird wie in Schritt 3 bislang nicht geprüft.

### Ellis Funktionswissen · 11.11.2026

Nur Dokumentations-/Bedienwissen ergänzt: Der Funktionskatalog beschreibt API-Vorrang, lesende Datenansichten, getrennte Quellen und weiterhin gesperrte echte Schreiboperationen. Keine neuen PDS-API-Pfade, Schemas oder Views; Vorrangregeln und offene Freigabefragen bleiben unverändert. Elli erhält weder Transport noch Konfiguration oder Auftragsdaten und bestätigt keine tatsächlichen Integrationszustände. Simulator-Schreibfunktionen werden ausdrücklich vom echten PDS-Lesebetrieb unterschieden. Quellenreferenz: `src/apps/askelli/elli/feature-catalog.ts` und dessen Verweise auf die bestehenden Planungs- und Integrationsmodule.

Korrektur der Bedienhinweise (11.11.2026): Keine zusätzliche „Freigabe des Simulator-Schreibbetriebs“ als Benutzervoraussetzung behaupten. Rollenrecht (Disposition/Administrator) und aktueller Implementierungsstand getrennt beschreiben. Die Simulator-Implementierung vorhandener Schreibabläufe ist kein echter PDS-Schreibbetrieb; die bestehenden API-Pfade, Schemas, View-Regeln und offenen Fragen ändern sich durch diese Textkorrektur nicht.

Vollständiger Wissensabgleich (11.11.2026): Ellis Benutzerwissen enthält keine Entwicklungs-/Testebenen mehr. Fachliche Schreibvoraussetzungen werden als Rollenrecht plus Unterstützung durch die Datenanbindung beschrieben. PDS-Anbindung bleibt in der Anleitung korrekt als ausschließlich lesend beschrieben. Keine Änderung an API-Pfaden, Schemas, Views, Prioritäten, echter Schreibsperre oder offenen Integrationsfragen. Die technischen Nachweise bleiben hier erhalten; sie werden nicht als Laufzeitwissen an Elli übergeben. Siehe den Prüfnachweis in der Git-Historie.

### CaseDesk: mobile Ausgabe wählbar, Aufträge nach TE · 11.11.2026

| Feld / Funktion | API-Pfad und Schema | Vorrang / View | Implementierungsstand und offene Fragen |
| --- | --- | --- | --- |
| Auftrag und Störung anlegen | POST `/service/create`, `PdsAPIServiceAuftragAnlegenRESTModel`; POST `/service/createstoerung`, `PdsAPIServiceAuftragEbeneAnlegenRESTModel` | Dokumentierte API; keine View | Bestehender Simulatorablauf beibehalten. `mobileIssue` ist ausschließlich eine Plattformoption, kein erfundenes PDS-Feld. Der Neuanlage-Endpunkt übergibt diese Option immer ausdrücklich. Standard ist aus. |
| Nach Anlage mobil ausgeben | POST `/service/mobilausgeben`, `PdsAPIServiceAuftragMobilAusgebenRESTModel`: `uuid` des angelegten Auftrags und `auftragspool:false` | API-Schreibaufruf erst nach angelegtem Auftrag und Störung; keine View | Nur nach aktivem Schalter und gültiger Planung mit Haupttechniker. Für Begleiter wird keine gesonderte Ausgabe ausgelöst. Ohne Haupttechniker wird der Wunsch serverseitig vor jeder Anlage abgewiesen. Niedrige Workflow-Helfer behalten für bestehende Aufrufer ohne übergebene Option ihr bisheriges Verhalten; die Auftragserfassung verwendet explizites Opt-in/Opt-out. Echte PDS-Schreibfreigaben unverändert gesperrt. |
| Vorhandene SA zur ausgewählten TE | POST `/objekt/details`, `PdsAPIObjektSucheDetailsRESTModel` → `PdsAPIObjektDetailsRESTModel.childrenUUIDs`; POST `/service/liststoerungen`, `PdsAPIStoerungSucheRESTModel` → `PdsAPIStoerungSucheResultRESTModel.resultList[].serviceAuftragEbene.objektUUID` | Dokumentierte API, Ergebnis vor Gruppierung nach exakter TE filtern; kein View-Fallback | Plattformparameter `unitId` wird nicht als undokumentierter PDS-Suchparameter gesendet. Zugehörigkeit TE zum Objekt geprüft. Fremde TE wird abgewiesen. Ohne ausgewählte TE zeigt Schritt 1 keine objektweiten SA. Andere Aufrufer ohne `unitId` behalten ihre bisherige objektweite Liste. |
| Sichere Wiederholung | Plattform-Anfragekennung und Simulator-Schrittspeicher | Keine zusätzliche PDS-Operation oder View | Ein Entwurf behält seine Anfragekennung. Kanonischer Auftrag inklusive Ausgabewunsch wird vor API-Schritten gebunden. Gleiche Wiederholung setzt bestätigte Schritte fort, andere Daten unter derselben Kennung werden abgewiesen. Keine Behauptung realer PDS-Idempotenz-/Transaktionsgarantien. |
| Ausgabehistorie | Plattform-PostgreSQL `calendar_history`, stabile Kalenderkennung der angelegten Störung | Eigene Historie, kein PDS-Historienimport | Benutzer aus geprüfter Sitzung, Zeitpunkt aus DB, Haupttechniker und Operation protokolliert. Transaktionssperre verhindert doppelte Einträge bei parallelen Wiederholungen derselben Ausgabe. Historienfehler wird nach erfolgreicher Anlage/Ausgabe ausdrücklich als Warnung gemeldet, nicht als fehlgeschlagene Anlage. Keine atomare Transaktion über SQLite/PostgreSQL behauptet. |

OpenAPI wurde lokal als maßgeblicher Vertrag gelesen. Browser-/HTTP-Prüfung ausschließlich mit erfundenen Daten und isolierter Infrastruktur; kein echtes PDS angeschlossen. Vor Echtnutzung bleiben die bestehenden Fragen zu Schreibpflichtfeldern, Rollen, mobilen Berechtigungen und Wiederholungs-/Statusgarantien offen. Prüfbericht (Prüfnachweis in der Git-Historie).


### Elli / Copilot: bestätigte Fachaktionen (11.11.2026)

Copilot Studio ist ein neuer, standardmäßig deaktivierter KI-Anbieter. Kein PDS-Zugriff aus dem Modell, keine beliebigen Werkzeuge und keine Views. HeyElli liefert begrenzte passende DTO-Projektionen und führt ausschließlich serverseitig erzeugte, unveränderliche Vorschläge nach separater Benutzerbestätigung aus. Die verschobenen HTTP-Handler unter `resource-calendar/*-http.ts` verwenden unverändert die bisherigen Authentifizierungs-, Rollen-, Herkunfts-, Warnungs- und Datenquellenprüfungen. Die lokalen Plattformrouten bleiben unverändert.

| Feld / Funktion | Dokumentierte API / Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Passende Mitarbeiter und Kalendertermine lesen | Bestehende `/mitarbeiter/listmitarbeiter`, `/termin/listplanung`, `/termin/detailsbatch`, `/termin/details`; Kalender-DTOs wie oben | Keine neue View; vorhandene Kalenderadapter und dokumentierte API haben Vorrang | Kontext auf maximal 20 passende Mitarbeiter und 20 freie Termine/Serviceeinsätze im begrenzten Suchzeitraum reduziert. Nur bei einem Änderungsanliegen von Disposition/Administrator. Keine Kontakte, vollständigen Akten, Tokens oder Konfigurationen im Modellkontext. |
| Freien Termin anlegen | POST `/termin/create`, `PdsAPITerminAnlegenRESTModel`: `bezeichnung`, `typ=FREIER`, `startZeitpunkt`, `endZeitpunkt`, `mitarbeiterUUIDs`, `status=GEPLANT` | Keine View; kein neuer Serviceauftrag | Bestätigungskarte nennt Titel, Mitarbeiter, Beginn/Ende. Stabile Vorschlags-ID dient als vorhandene Anlagekennung. Simulator unterstützt dies; echtes PDS-Schreiben bleibt gesperrt. Reale idempotente PDS-Anlage weiterhin offen. |
| Freien Termin / Serviceeinsatz verschieben | Bestehender Adapter: POST `/termin/update`, `PdsAPITerminUpdateRESTModel`; bei Serviceeinsätzen vorhandener `/service/updatestoerung`-Ablauf, `PdsAPIServiceAuftragEbeneUpdateRESTModel` | Keine View und keine neue Termin-Anlage | Dauer/Besetzung bleiben erhalten. Vor Ausführung erneutes Detailslesen und Snapshotvergleich; bei Zwischenänderung neuer Vorschlag erforderlich. Fixierte, ganztägige und Fortsetzungstermine ausgeschlossen. Bestehende Planungswarnungen werden nicht automatisch akzeptiert. |
| Einen Serviceauftrag mobil ausgeben | POST `/service/mobilausgeben`, `PdsAPIServiceAuftragMobilAusgebenRESTModel`: `uuid`, `auftragspool=false`; Haupttechniker stammt aus dem gelesenen Termin | Keine View; vorhandene Einzel-Ausgabe mit Historie | Vorschau zeigt Auftrag und Haupttechniker. Einmalige Ausführungsmarkierung verhindert Wiederholung desselben Vorschlags auch bei parallelen Bestätigungen. Unklare Ergebnisse bleiben gesperrt und werden nicht automatisch wiederholt. Reale Gerätewirkung und PDS-Berechtigungen weiterhin nicht geprüft/freigegeben. |

Plattform-PostgreSQL speichert Konfigurationsstatus und Bestätigungsvorschläge (Migration 025), keine PDS-Datenbankzugriffe. Vorschläge gehören zu Benutzer, Chat und Konfigurationsversion, verfallen nach 15 Minuten und protokollieren bestätigte Ausgänge mit Benutzer/Zeitpunkt. Copilot-Freigabe schaltet weder die echte PDS-Schreibanbindung noch Microsoft-Anmeldung oder Graph-Echtversand frei.


Anbieter-Nachtrag 11.11.2026: Bei inaktivem Copilot verwendet Elli wieder Ollama als lokale Bedienungshilfe. Dieser Zweig ruft weder die Fachkontextsuche noch Vorschlagserzeugung oder PDS-Schreibhandler auf. Nur aktiver Copilot erhält für konkrete Änderungsanliegen den oben beschriebenen begrenzten Kalenderkontext und kann bestätigungspflichtige Vorschläge vorbereiten. Dokumentierte PDS-Pfade, Rollen, Views und reale Schreibsperren unverändert. Prüfung (Prüfnachweis in der Git-Historie).


### App-Rollen und gemeinsame Datenquellen (11.11.2026)

| Feld / Funktion | API-Pfad und Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| App-Zugriff vor PDS-Lese-/Schreibwegen | Plattform-Zugangsprüfung vor `/api/pds/rest/api/[...segments]` und den bestehenden Service-/Kalender-Adaptern; unveränderte oben dokumentierte PDS-RESTModelle | Kein neuer View, API-Vorrang unverändert | Migration 027 verwaltet eigene App-Rollen ausschließlich in Plattform-PostgreSQL. Allgemeine PDS-Quellen sind für freigegebene Service-/Planungs-Apps gemeinsam nutzbar; App-Zugriff ist keine Datensatztrennung. Fachrechte und reale Schreibsperren gelten zusätzlich. |
| Elli: begrenzter Kalenderkontext und bestätigte Fachaktionen | Bestehende `/termin/*`, `/mitarbeiter/listmitarbeiter`, `/service/updatestoerung`, `/service/mobilausgeben` mit oben genannten Schemata | Keine zusätzliche View, kein Fallback | Zusätzlich PlanBoard-Freigabe erforderlich. Keine Kontextprojektion und kein Vorbereiten/Bestätigen ohne diese Freigabe. Copilot weiterhin deaktiviert; keine neue Echt-PDS-Freigabe. |


### App-Schreibrechte (12.11.2026)

| Funktion | API / Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Serviceplanung, Störungsanlage, Kalender und Bereitschaft bearbeiten | Bestehende `/termin/create`, `/termin/update`, `/service/updatestoerung`, `/service/mobilausgeben` und zugehörige oben dokumentierte RESTModelle | Keine neue View, API-Vorrang unverändert | Plattformmigration 028 trennt Lesen und Schreiben pro App. Serviceplanung prüft Service; Erfassung und Kontakt-/Uploadwege CaseDesk; Terminschreiben PlanBoard; Bereitschaftsplanung und Tauschfreigabe DutyBoard. Gemeinsame Quell-Lesewege bleiben geteilt, rohe Termin-Schreibwege brauchen PlanBoard-Schreibrecht. Kein allgemeiner Dispositionsstatus genügt als Fachschreibfreigabe. Reale PDS-Schreibsperre bleibt bestehen. |
| Bestätigte Elli-Fachaktionen | Bestehende oben dokumentierte Termin- und mobile Ausgabewege | Keine neue View | Zusätzlich Schreibrecht für AskElli und PlanBoard beim Vorbereiten und Ausführen, keine Freigabe durch Chattext. Copilot weiterhin deaktiviert. |

Browsernachweis vom 12.11.2026: Service-Terminvergabe über den vorhandenen Service-Planungsadapter funktioniert mit Service-Schreibrecht; Kalenderanlage/-änderung/-löschung und mobile Ausgabe bleiben ohne PlanBoard-Schreibrecht gesperrt, einschließlich des rohen `/termin/update`-Wegs. Nur isolierter Simulator, keine neue API/View und keine reale Schreibfreigabe. Prüfbericht (Prüfnachweis in der Git-Historie).

### Kundenhierarchie in Service (12.11.2026)

| Feld / Funktion | API-Pfad und Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Kunde → Objekt → technische Einheit | Vorhandene POST `/person/listkunden` (`PdsAPIPersonSucheRESTModel`) und `/objekt/listobjekte` (`PdsAPIObjektSucheRESTModel`); gelieferte Objektfelder `uuid`, `personUUID`, `parentUUID`, `typ` | Ausschließlich bestehende API-Daten; keine zusätzliche View | Oberfläche gruppiert über `personUUID`; bei fehlendem Kundenbezug einer Einheit wird der vorhandene `parentUUID`-Pfad verfolgt. Suche erhält Vorfahren. Unklare Zuordnungen bleiben sichtbar, zyklische Referenzen werden begrenzt. Keine Datenänderung. Simulator im Browser geprüft, echtes PDS weiterhin nicht live verifiziert. |
| Kunden- und Einheitenakte öffnen | Unverändert `/person/details` und `/objekt/details` mit oben genannten Details-Schemas | API-Vorrang unverändert | Bestehende Aktenaufrufe und Zugriffsschutz bleiben erhalten; keine neuen Schreibfelder oder künstlichen Kundenzuordnungen. |

### Serviceakten: getrennte Lesephasen (12.11.2026)

| Funktion | API-Pfad und Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Kerndaten einer Akte | Unveränderte oben dokumentierte Detailpfade für Kunde, Auftrag und technische Einheit mit ihren REST-Modellen; HeyElli `/api/service?kind=…&id=…&part=base` | API zuerst, keine neue View | Liefert Kerndaten und undurchsichtige Revision ohne Mitarbeiter-, Kostenträger-, Vertrags- oder BMACloud-Abfragen. Service-Leserecht zusätzlich serverseitig geprüft. |
| Zusatzdaten | Bestehende oben dokumentierte Mitarbeiter-, Kostenstellen-/Kostenträger- und Vertragslisten; HeyElli `part=extras&revision=…` | Kein stiller View-Fallback bei Fehlern | Parallel zur benutzbaren Akte. Revision vor und nach dem Laden geprüft; veralteter Stand ergibt 409. Einzelne Quellenfehler bleiben sichtbar. BMACloud ist eine getrennte externe Quelle. |
| Hintergrundaktualisierung und Abbruch | Unveränderte PDS-Anfrageschemata; internes optionales Transportsignal ist kein PDS-Feld | Keine Datenbankschreibzugriffe | Kerndaten alle 15 Sekunden, erfolgreiche Zusatzdaten frühestens nach 60 Sekunden. Abbruch und Gesamtbudget erreichen PDS und BMACloud. Simulatorprüfung durchgeführt; keine Freigabe oder Prüfung einer echten PDS-Verbindung. |

### Zugriff und Mengenbegrenzung (12.11.2026, F07/F10)

| Funktion | API-Pfad und Schema | View / Vorrang | Stand / offene Fragen |
| --- | --- | --- | --- |
| Geschützte API-Exporte / gemeinsame Quellen | Bestehende `/api/service`, `/api/pds/rest/api/[...segments]`, Such-, Kalender- und Bereitschaftswege; unveränderte oben dokumentierte PDS-RESTModelle | API-Vorrang unverändert; keine neue View | Jeder geschützte Route-Export prüft Sitzung und App-Leserecht unabhängig vom Proxy; Schreibzugriffe zusätzlich nach `writeAppsForRequest`. Quellen dürfen von den in `model.ts` ausdrücklich genannten Apps gelesen werden; das überträgt keine Schreibrechte. Service-Fachleser besitzt zusätzlich `requireAppRead`. |
| PDS-JSON und Dokumentantworten | Alle dokumentierten Operationen des `PdsHttpTransport`, insbesondere `/dokument/downloaddokument/{uuid}` | Übergröße ist ein Fehler, kein View-Fallback | Streaming-Limit 8 MiB JSON / 100 MiB Dokumente, unabhängig von `Content-Length`. Keine Änderung an PDS-Feldern oder Zieladressen. |
| Raw-Anfragen und Dokumente | `/api/pds/rest/api/[...segments]` vor Weitergabe an die dokumentierten Simulatoroperationen | Unbekannte Operationen bleiben gesperrt | JSON 16.000 Byte, Multipart 100 MiB plus 64 KiB Metadaten, einzelne Datei höchstens 100 MiB. Besitzer-/Ursprungsprüfung und zusätzliches Simulator-Token bleiben erforderlich. Keine Freigabe echter PDS-Schreibfunktionen. |

### Audit F11/F12/F13 – Begriffe und private Kalenderentwürfe (12.11.2026)

| Feld / Funktion | Dokumentierter PDS-Pfad / Schema | Vorrang / View | Stand und Grenzen |
| --- | --- | --- | --- |
| Aktenkopf technische Einheit / Objekt | Bestehende oben dokumentierte Objekt-/TE-Lesewege und deren Typzuordnung | Unverändert API-Vorrang; keine neue View | UI verwendet die vorhandene Datensatzart für „Technische Einheit“ beziehungsweise „Objektakte“. Keine neue PDS-Feldannahme. |
| Ellis BMACloud-Bedienwissen | Bestehende oben dokumentierte Vertrags-/Kostenträger-Lesewege; BMACloud-Zuordnung separat | Wartungskostenträgernummer exakt, nicht Rechnungskostenträger; keine View-Umgehung | Katalog und Hilfe erläutern vorhandenen Bedienweg einschließlich führender Nullen, AID-Mehrdeutigkeit und expliziter Integrationsfreigabe. Kein Zugriff auf aktuelle Zugangsdaten durch Elli. |
| Private verschlüsselte Entwurfszweige und Gerätefreigabe | Kein PDS-Endpunkt; ausschließlich Plattformtabellen aus Migration 032 | Keine View; vorhandene API-Schreibadapter und Versionsprüfungen unverändert | Getrennte Benutzer-/Tabzweige, verschlüsselte PostgreSQL-Zusatzsicherung, bestätigte lokale Bereinigung. Wiederaufnahme verwendet bestehende Vorgangskennungen. Weder neue echte PDS-Schreibfunktion noch Quellenfreigabe. |
| Lebenszyklus BMACloud-/Copilot-Zugangsdaten | Kein PDS-Endpunkt; ausschließlich Plattformreferenzen aus Migration 031 | Keine Änderung an PDS-Konfigurationen | Referenzgestützte Bereinigung greift nicht auf PDS-Geheimnisdateien zu. Simulator und reale Schreibsperre bleiben unverändert. |

## Konfigurationsveröffentlichung · Audit A01/A04, 13.11.2026

| Funktion/Feld | Vertrag / Pfad | View | Vorrang und Stand | Offene Fragen |
| --- | --- | --- | --- | --- |
| PDS-Zugangsdaten, aktive Konfigurationsreferenz | Plattform `/api/verwaltung/pds`; Kernprüfung weiterhin `GET /termin/listkategorien` und `POST /mitarbeiter/listmitarbeiter` mit dokumentierten Antworten. Migration 033: `platform.pds_connection.config_id`. | Keine | Unveränderliche verschlüsselte Dateien; Referenz und Quellenbereich gemeinsam in PostgreSQL veröffentlichen. SQL-Rollbacks erhalten den alten Stand. Legacy-Dateien bleiben nur lesend erhalten. Fehlender Master-Schlüssel verhindert Neuerzeugung bei bestehendem Bestand. | Echte Zielsystemabnahme weiterhin offen. |
| Vorherige PDS-Konfiguration | Plattform `/api/verwaltung/geheimnisablage`, keine zusätzliche PDS-Operation | Keine | Administratorbestätigung; Referenz samt vorhandenem Quellenbereich wiederherstellen, Simulator aktivieren, Datenansichten und Prüfungen entwerten. Gemeinsame Anbieter-Sperre für Veröffentlichung/Bereinigung. Keine geheimen Werte im Export/Protokoll. | Keine neue fachliche API-Lücke; reale Schreibfreigabe unverändert offen. |

Keine Erweiterung des PDS-Schreibbetriebs, kein View-Fallback bei Fehlern, keine realen Daten importiert. Tests verwenden ausschließlich isolierte PostgreSQL-Instanzen und fiktive Anbieterantworten.


### Ressourcen- und Abfragebudgets (A06, 13.11.2026)

| Funktion | API / Schema | Vorrang / View | Implementierung und Grenze | Offen |
| --- | --- | --- | --- | --- |
| Service-Listen | dokumentierte `/service/liststoerungen`, `/person/listkunden`, `/objekt/listobjekte`, `/mitarbeiter/listmitarbeiter`; bestehende Listen-/Seitenschemata | API zuerst, kein zusätzlicher View-Fallback | Bisherige Paginggrenze 20.000 Datensätze, zusätzlich 16 MiB je Liste; Quellenaufrufe unter Vorgangs-/Einzelzeitbudget | Last realer PDS-Anbieter weiterhin ungeprüft |
| Dokumente | dokumentierter Multipart-Aufruf `/dokument/uploaddokument`, `FormDataBodyPart`; unveränderte Vertragsfelder | Kein View / keine neuen PDS-Endpunkte | Lokale Uploads stückweise in SQLite, Benutzer-/Gesamtquote und kleine Parallelität; alte BLOBs unverändert. API-Dokumentkopien zählen zur gemeinsamen Quote. Echte PDS-Fachschreibfreigabe unverändert aus | Viren-/Makroprüfung und echter Schreibbetrieb bleiben gesondert freizugeben |
| Abfragebudget | bestehende dokumentierte PDS-Requests, unveränderte Schemas | Kein stiller Fallback bei Budget-/Transportfehler | Maximal 80 externe PDS-Aufrufe pro HTTP-Vorgang, Zeitbudget 30/60 s, zusätzlich 15 s je Aufruf; vorhandene Antwortgrenzen bleiben | Kein Durchsatzversprechen für reales PDS; isolierte Lastprüfung nutzt ausschließlich lokale Fiktion |


## Betriebsüberwachung A07 · 14.11.2026

| Funktion | API-Pfad / Schema | View | Vorrang und Stand | Offene Abnahme |
| --- | --- | --- | --- | --- |
| Lesbarkeit der lokal gespeicherten PDS-Anbindung überwachen | Kein PDS-Fachaufruf; lokale Konfigurationsreferenz über `readPdsConfiguration`, Anzeige geschützt über `/api/verwaltung/betriebsstatus` | keiner | Implementiert: geschützte Ablage nur lesen, bei Schlüsselverlust alarmieren; keine neue Konfiguration, Quelle oder Schreibfreigabe. Dokumentierte Fach-API und vorhandener Simulator bleiben unverändert. | Reale Anbietererreichbarkeit, Schreibfreigabe und verbindlicher Abgleich unklarer Ergebnisse nicht durch den lokalen Monitor nachgewiesen. |

API-Fehler/-Zeiten werden ausschließlich in festen Bereichen ohne Fachtexte oder Tokens zusammengefasst. Kein stiller View-Fallback und keine zusätzlichen PDS-Pings. [Überwachung und Grenzen](../operations/monitoring.md).


Navigationsnachtrag 14.11.2026: Geschützte Zugangsdaten, Browser-Schutz, Sitzungsdauer, Daten & Aufbewahrung und Betriebsstatus stehen jetzt unter Einstellungen → System → Sicherheit, getrennt von Allgemein. Bestehende Allgemein-Direktlinks werden innerhalb der Einstellungen umgestellt. PDS-Wiederherstellung unter Sicherheit → Geschützte Zugangsdaten; PDS-Anbindung bleibt unter Integrationen. API-Pfade, Schemas, Quellen-/Schreibfreigaben und View-Vorrang unverändert.

## SharePoint-Aktenablage · 14.11.2026

| Funktion / Feld | Dokumentierte PDS-API / Schema | View | Vorrang / Implementierung | Offene Abnahme |
| --- | --- | --- | --- | --- |
| Aktenexistenz und stabile Zuordnung | `POST /person/details`, `POST /objekt/details`, `POST /service/details`, jeweilige `uuid`-Kennung und vorhandene Aktenmodelle | keiner | Bestehende API hat Vorrang; Quelle plus Aktenart/UUID wird serverseitig zu einem nichtsprechenden Ordnerschlüssel gehasht. Keine Ableitung anhand von Namen. | Reale PDS-Leseverbindung weiterhin separat freizugeben. |
| Vertragsdokumente | `POST /wartungsvertrag/listvertraegebyobjekt`, Vertrags-`uuid` aus bestehender Liste | keiner | Vertrag muss am angefragten Objekt nachgewiesen sein; eigene Vertragskennung für den Dokumentordner. | Keine zusätzliche PDS-Schreibfunktion. |
| Dateiliste / manueller Upload | Kein PDS-Schreibpfad; ausschließlich Microsoft Graph Dokumentbibliothek über separates SharePoint-Modul | keiner | Service-Lese-/Schreibrechte getrennt; SharePoint initial deaktiviert, eigener Test und ausdrückliche Freigabe. Simulator und echte PDS-Quellen getrennt zugeordnet. | Microsoft-Berechtigungen, tatsächliche Bibliothek und SharePoint-Aufbewahrung mit Administration prüfen. |

Es werden keine neuen PDS-Endpunkte oder Views erfunden und keine SharePoint-Dateien in PDS geschrieben. [Betrieb und Schutz](../operations/sharepoint.md).

### Service-Suche nach Kostenträgern (14. November 2026)

| Suchfeld/Funktion | Dokumentierter API-Vertrag | Vorrang und Implementierung | Grenzen/offene Fragen |
| --- | --- | --- | --- |
| Objekt/TE-Kostenreferenz für die Suche | POST `/objekt/detailsbatch`, `PdsAPIObjektSucheDetailsBatchRESTModel.uuids` → Array `PdsAPIObjektDetailsRESTModel.kstKtrUUID` | API; keine View. Simulator bildet denselben Lesevertrag ab. Je Hintergrundanfrage höchstens 12 Objektkennungen, Antwortzuordnung wird vollständig geprüft. | `/objekt/listobjekte` liefert die Kostenreferenz laut Schema nicht. Keine Übernahme einer Elternreferenz als eigene Zuordnung. |
| Nummer/Bezeichnung auflösen | POST `/administration/listkostentraeger` und `/administration/listkostenstelle`, `uuid`, `nummer`, `bezeichnung` | API-Listen seitenweise lesen; im Browser ausschließlich die projizierten Referenzen für die aktive Suche halten. Mehrdeutige identische UUIDs mit widersprüchlichen Werten werden abgewiesen. | 16 MiB pro Quellliste, 8 MiB projizierter Katalog. Berechtigungs-/Verbindungsfehler bleiben explizit, kein View-Fallback. |
| Vertragskostenträger Wartung/Rechnung | POST `/wartungsvertrag/listvertraegebyobjekt` → `PdsAPIWartungVertragDetailsRESTModel.wartung.kstKtr` / `.rechnung.kstKtr`, jeweils `nummer`, `bezeichnung` | Beide nachgewiesenen API-Werte fließen in den Suchtext der zugehörigen Objekt-/TE-Akte ein. Maximal drei gleichzeitige Vertragsabrufe, nur lesend. | Pro Objekt maximal 1.000 Verträge/1 MiB Antwort und 8 KiB Suchtext, sonst ausdrücklicher Budgetfehler statt abgeschnittener Suchdaten. |
| Hintergrundsuche und Zuordnung | HeyElli `GET /api/service?part=cost-catalog` bzw. `cost-objects`; geprüfte Sitzung, Service-Leserecht und gebundener Quellenstand | Nur aktive Suchanfragen laden die Zusatzdaten in kleinen Batches. Normale Listen bleiben bedienbar; Fortschritt/Fehler sichtbar. Hierarchietreffer behalten Kunde und Elternobjekt. Zugehörige Aufträge werden ebenfalls über Kostenträger gefunden. | Maximal vier Millionen Suchtextzeichen im Browser; abgeschlossenes Suchwissen nach fünf Minuten erneuern, nach Suchneustart erneut lesen. Quellenwechsel entwertet alte Ergebnisse. Keine Indexdateien oder fachlichen Schreibzugriffe. Echte PDS-Verbindung weiterhin nicht freigegeben. |

Die Suchtrefferanzeige projiziert Wartungs-/Rechnungskostenträger zusätzlich als getrennte Einträge mit Rolle, Nummer und Bezeichnung. Eigene Referenzen werden aus dem bereits gelesenen Katalog ergänzt. Gleiche Rolle/Nummer/Bezeichnung wird dedupliziert, gleiche Werte mit verschiedenen Rollen bleiben erhalten. Nur passende eigene Einträge werden an Objekt/TE angezeigt; ein als Hierarchiekontext erhaltener Elternknoten übernimmt keine fremde Zuordnung. Die Obergrenze von 8 KiB pro Objekt gilt für die strukturierte Vertragsprojektion, das Browserbudget zählt Suchtext und Anzeigedaten gemeinsam. Keine zusätzlichen PDS-Endpunkte, Views oder Schreibfunktionen.

### Wartungsübersicht und gesperrte Auftragsvorschau (14. November 2026)

| Funktion/Feld | API-Vertrag | Vorrang/Implementierung | Offene Punkte und Grenzen |
| --- | --- | --- | --- |
| Wartungsverträge zum Objekt/TE | POST `/wartungsvertrag/listvertraegebyobjekt`, `PdsAPIUUIDRESTModel` → Array `PdsAPIWartungVertragDetailsRESTModel` | API. Nur bestätigte `objektUUID`-Zuordnung verwenden; auf einer Elternabfrage gelieferte Kindverträge werden beim tatsächlichen Objekt gelesen, nicht doppelt übernommen. Rechnungsintervalle bleiben ausgeschlossen. | Fehlende/mehrdeutige Zuordnung ist Fehler, keine Schätzung. Maximal 1.000 Verträge/1 MiB je Objekt und 5.000 Intervallreferenzen. |
| Wartungsintervalle | `.wartung.intervalle[].uuid`, anschließend GET `/wartungsvertrag/wartungsintervalldetails/{wartungsintervallUUID}` → `PdsAPIWartungIntervallDetailsRESTModel` | Genau der dokumentierte GET im Readonly-Adapter freigegeben; kein Schreibaufruf. Höchstens acht Details pro Seite, drei parallel, überprüfte Antwort-UUID. | Seitencursor an Hash der Vertrags-/Intervallzuordnungen gebunden; Änderungen führen zu 409 und ausdrücklich unvollständigem Stand. |
| Fälligkeit | `.intervallSerie.naechstesDatum` (Datum) | Ausschließlich geliefertem Datum folgen. Keine eigene Serienberechnung, kein Ersatz durch Start-/Berechnungszeitraum. Heute und überfällig getrennt; unbekannte/ungültige Daten unter „Ohne gültige Fälligkeit“. | Vertragsabschluss/Laufzeit aus `.wartung.abschlussDatum` / `.laufzeit.vonDatum,bisDatum` kennzeichnen außerhalb des aktiven Bereichs liegende Verträge; im Filter „Alle“ weiterhin sichtbar. Widersprüchliche Datumsangaben bleiben prüfbedürftig. |
| Kunde/Objekt/TE | Objektzuordnung des Vertrags; vorhandene Objekt-/Personenlisten | Kunde und tatsächliches Objekt über die bekannte Hierarchie zuordnen. Bei Vertrag direkt am Objekt keine TE erfinden. Die Wartungsakte zeigt Vertrag und Fälligkeit aus denselben Leseantworten. Für zugeordnete TE übernimmt sie Anlageninformationen aus der bestehenden Objektakte. | Fehlende Zuordnung sichtbar; Auftragsvorschau dann gesperrt. Persönliche Ausblendungen der Kundenliste unterdrücken keine Wartung. |
| Kundenmarkierungen für offene Aufträge und fällige Wartungen | `vorgangStatus.bezeichnung` und `objektUUID` der Serviceeinsätze sowie vorhandene Wartungs- und Objektdaten | Dieselbe Statusauswertung wie in Kunde 360. Aufträge einmal je Kunde oder betroffenem Objekt und dessen Vorfahren zählen. Fällige Wartungen zählen ab dem Berliner Fälligkeitsdatum, einschließlich heute. | Direkte Objektzuordnungen werden bei der Verteilung ausschließlich nach oben zusammengefasst. Aufträge ohne passenden Objektbezug bleiben beim Auftragskunden. Unvollständige Wartungsdaten werden kenntlich gemacht. |
| „Auftrag erzeugen“ | Nur clientseitige, native Vorschau mit geprüften Lesedaten; kein neuer Schreibendpunkt | Vorschau benötigt Service-Schreibrecht. Die ausführende Aktion ist fest gesperrt, auch im Simulator und für Administratoren. Keine Auftragsanlage oder Fälligkeitsänderung. | Vor Implementierung/Freigabe klären: native Übernahme mit `/service/createstoerung.intervallUUID`, Positions-/Pflichtfeldübernahme, Fortschreibung und atomarer Wiederholungsschutz je Intervall/Fälligkeit. Bestehende PDS-Freigabe aktiviert dies nicht. Fragen auch in administrativer PDS-Anleitung. |

Der Simulator ergänzt ausschließlich fiktive Verträge/Intervalle aus `database/seeds/pds-simulator/maintenance.json`; Tagesabstände werden bei der Leseantwort relativ zum aktuellen Berliner Datum dargestellt. Bestehende SQLite-Daten und echte Integrationskonfigurationen werden nicht verändert. Die Wartungsübersicht, das Cockpit und die Kundenmarkierungen verwenden denselben objekt- und seitenweisen Leseablauf mit Fortschrittsanzeige; Fehler/Überlast bleiben ausdrücklich unvollständig, kein View-Fallback. Maximal 20.000 Wartungen bzw. vier Millionen projizierte Zeichen je Browseransicht und 16 KiB pro Wartung; vollständige Aktualisierung frühestens 60 Sekunden nach Abschluss. Keine tatsächliche PDS-Verbindung abgenommen oder freigegeben.

#### Anschluss Terminvergabe nach bestätigter Wartungsanlage

Die kompakte Wartungsübersicht bereitet den Folgeablauf über einen nicht angeschlossenen Erzeugungsadapter vor. Keine native Wartungs-Schreibfunktion oder Freigabe wurde hinzugefügt. Ein zukünftiger, serverseitig abgesicherter Adapter muss bestätigte Auftrags-/Einsatzkennungen zurückgeben und Wiederholungsschutz/Fälligkeitsfortschreibung garantieren.

Der vorbereitete Anschluss liest anschließend `POST /service/details` über den geschützten Service-Leseweg erneut: `PdsAPIServiceAuftragEbeneDetailsRESTModel.uuid`, `.intervallUUID` und `.objektUUID` müssen zur bestätigten Anlage und ausgewählten Wartung passen. Die Quelle wird über `sourceRevision` an den geöffneten Wartungsstand gebunden. Grund-/Zusatzdaten müssen denselben revisionsgeprüften Stand besitzen. Der Planungsdialog erhält einen einmaligen, überprüften Ausgangsstand; Hintergrundaktualisierungen übernehmen keinen neueren Versionsstand in bereits bearbeitete Eingaben. Bei Fehlern ausschließlich erneutes Lesen desselben Auftrags, keine erneute Erzeugung.

Danach wird der vorhandene Service-Dialog „Termin vergeben“ mit den Planungsfeldern des CaseDesks verwendet. Speichern bleibt an den vorhandenen, versionierten und serverseitig geschützten Weg `/api/service/planung` gebunden. Dessen echte PDS-Schreibfreigabe bleibt unverändert gesperrt; keine Aussage über noch ungeklärte native Nebenwirkungen. Zu klären ist auch, ob zuerst ohne Techniker/Termin angelegt und danach geplant werden darf, ohne doppelte Planungstermine zu erzeugen. Die Frage steht zusätzlich in der administrativen Anleitung.

## Dynamische Einsatzmappe · 14. November 2026

| Feld/Funktion | API-Pfad und Schema | View / Vorrang | Stand und offene Punkte |
| --- | --- | --- | --- |
| Aktuelle Einsatzdaten | POST `/service/details` (Serviceauftrag), `/service/liststoerungen`, Termin-/Mitarbeiterauflösung des bestehenden Service-Readers | Keine View, dokumentierte API hat Vorrang | Bestehender Akten-Refresh bleibt aktiv; keine statische Dateikopie. |
| PDS-Dokumentauswahl | GET `/service/listdokumente/{uuid}`, `/service/listauftragsdokumente/{uuid}`; Dokumentmetadaten `uuid`, `fileName`, `datum` | Keine View / kein stiller Fallback | Beide Listen getrennt auswerten, gleiche Dokument-UUID zusammenfassen; Auswahl speichert nur Referenzen. Je Liste höchstens 500 Datensätze/1 MiB. |
| Download | GET `/dokument/downloaddokument/{uuid}` (binär) | Dokument muss aktuell in einer der Auftragslisten enthalten sein | Geschützter Service-Leseweg, aktuelle Auftragszugehörigkeit vor jedem Download; keine persistente Kopie. Maximal 100 MiB. |
| Zugeordnete Akten / Ansprechpartner | POST `/objekt/detailsbatch`, `/person/details`, `/wartungsvertrag/listvertraegebyobjekt` und bestehender Reader | Keine View | Ausschließlich tatsächlich zugeordnete Kunden, Objekte/Eltern und Verträge; begrenzte Hierarchie. |
| BMACloud-Verweis | `/wartungsvertrag/listvertraegebyobjekt` → Wartung `kstKtr.nummer` | Bestehende BMACloud-Zuordnung, kein Rechnungskostenträger | Nur bei freigegebener Integration und echter Quelle; keine ausgedachten AIDs. |

**Offen vor echter PDS-Abnahme:** Die Spezifikation bezeichnet beide Dokumentlisten als Serviceauftragslisten, verwendet bei `listauftragsdokumente` aber auch den Begriff „Ebene“. Die Einsatzmappe verwendet wie der vorhandene Downloadweg die bestätigte Auftrags-UUID. Ob einzelne PDS-Installationen zusätzlich Ebenen-/Störungs-UUIDs benötigen, muss der PDS-Admin bestätigen. Keine zusätzlichen UUID-Aufrufe oder Schreibendpunkte werden geraten. Der Simulator liefert klar fiktive Metadaten und Textdokumente für zwei Beispielaufträge; dies ist kein Nachweis einer realen Verbindung.

## Terminbestätigung an Kunden · 14. November 2026

| Feld/Funktion | Konkreter API-Pfad / Schema | Vorrang / View | Stand und offene Grenzen |
| --- | --- | --- | --- |
| Auftrag und Einsatz | POST `/service/details`, `PdsAPIServiceAuftragDetailsRESTModel`, `rootEbene.ebenen[]` (UUID, `objektUUID`, `startZeitpunkt`, `endZeitpunkt`, `hauptmonteurUUID`) | Ausschließlich API, keine View | Zugehörigkeit zum Auftrag prüfen. Fehlende/ungültige Planung verhindert Bestätigung; keine angenommene Dauer. Auftrag nach Auflösung erneut lesen, vor neuer Übergabe Vorschau-Fingerabdruck prüfen. |
| Haupttechniker | POST `/mitarbeiter/listmitarbeiter`, paginierte Mitarbeiterliste; `uuid`, `vorname`, `nachname` | Bestehender begrenzter Listenreader | Nur tatsächlich aufgelöste Namen, keine Platzhalter in der Kundenmail. |
| Objektadresse | POST `/objekt/details`, `PdsAPIObjektDetailsRESTModel`, `standort`, `parentUUID`, `bezeichnung` | API, keine View | Eigene Adresse oder bestätigter Elternstandort, maximal acht Ebenen. Ohne Adresse keine Bestätigung. |
| Kundendaten / E-Mail | POST `/person/details`, `PdsAPIPersonDetailsRESTModel`: `ekommunkationswege[]` (Schreibweise der Spezifikation), `ansprechpartner[].ekommunikationswege[]` / `PdsAPIEKommunikationsweg[Details]RESTModel` | API hat Vorrang; keine Adressen erfinden | Nur `typ=EMAIL`, `kategorie=GESCHAEFTLICH` und gültige `gueltigkeit.vonDatum/bisDatum`; doppelte Adressen zusammenfassen. Maximal 100 Kontakte je Liste/100 Vorschläge und 1 MiB Kundendetail. Fehlende Adresse manuell eingeben und ausdrücklich bestätigen; nicht nach PDS zurückschreiben. |
| Kundenbestätigung | Kein PDS-Schreibendpunkt | Bestehende Outlook-/Graph-Integration | Nur explizite Vorbereitung/Einreihung. Keine PDS-Änderung oder automatische Statusänderung. Versand-/Zustellnachweis bleibt im Mailweg. |

Leser, Quellengrenzen und Vorschau sind implementiert und werden mit fiktiven Datensätzen geprüft. Native PDS-Antworten müssen vor realer Inbetriebnahme insbesondere bei der Schreibweise `ekommunkationswege` und Kontaktgültigkeit abgenommen werden. API-Fehler werden nicht durch Views oder geschätzte Adressen ersetzt. Zeitpunkte im Kundenbrief werden in Europe/Berlin formatiert; Nachrichten enthalten keine internen Arbeitsbeschreibungen, Dokumentinhalte oder Zugangsdaten.

## Anlagenchronik · 14. November 2026

| Funktion/Feld | Dokumentierter API-Pfad / Schema | API-/View-Vorrang | Implementierung und Grenzen |
| --- | --- | --- | --- |
| Technische Einheitenakte | POST `/objekt/details`, `PdsAPIObjektDetailsRESTModel.typ` | API; keine View | Nur `TECHNISCHE_EINHEIT`; Antwort-UUID und Quellenstand prüfen. Eltern-/Geschwistereinsätze nicht ungeprüft übernehmen. |
| Serviceeinsätze | POST `/service/liststoerungen`, vorhandene paginierte Liste, `serviceAuftrag` und `serviceAuftragEbene` / `PdsAPIServiceAuftragEbeneDetailsRESTModel` | API | Exakter `objektUUID`-Bezug. UUIDs dedupliziert; widersprüchliche Dubletten abweisen. `startZeitpunkt` als Termin, Auftragsnummer/Status, gekürzte Arbeitsbeschreibung und Name aus `/mitarbeiter/listmitarbeiter`. Keine Ausführung behaupten. Maximal 500 zugeordnete Einsätze. |
| Wartungsintervalle | POST `/wartungsvertrag/listvertraegebyobjekt`, GET `/wartungsvertrag/wartungsintervalldetails/{wartungsintervallUUID}` | Bestehender Wartungsreader; keine View | Geprüfte Vertrags-/Objektzuordnung und gebundene Indexseiten, acht Details pro Seite. `intervallSerie.naechstesDatum` als Fälligkeit. Maximal 256 Intervalle in der Chronik; bei Überschreitung sichtbare Unvollständigkeit. Keine historischen Durchführungen berechnen. |
| Auftragsunterlagen/Berichte | GET `/service/listdokumente/{uuid}`, `/service/listauftragsdokumente/{uuid}` → `PdsAPIDokumentMetadatenRESTModel` (`uuid`, `fileName`, `datum`, `dokumententyp.bezeichnung`) | API; kein Objekt-Dokumentlistenweg erfunden | Je Anfrage höchstens vier serverseitig zugehörigkeitsgeprüfte Aufträge. Auftragsunterlagen können mehrere Einheiten betreffen; dies ausdrücklich kennzeichnen. Dokument-UUID deduplizieren, zugehörige Aufträge erreichbar lassen. Datum ausschließlich aus Metadaten, sonst Ohne Datum. Geschützter bestehender Download prüft aktuelle Dokument-/Auftragszugehörigkeit. |
| SharePoint-Unterlagen | Bestehende freigegebene Graph-Dokumentliste des Einheitenordners | Ergänzende Integration | Änderungsdatum als solches darstellen; keine Ausführungszeit ableiten. Höchstens 100 Dateien, Original-Links, keine Kopien. |
| Rückläufe / vergangene Ausführungen | Details über bekannte Rücklaufkennungen grundsätzlich dokumentiert; kein allgemeiner Rücklauf-Listenabruf nachgewiesen | Kein stiller View-Fallback | Ohne belastbaren Kennungsweg nicht Teil der Chronik. Keine lückenlose Wartungs-/Ausführungshistorie behaupten. Die offene Bedeutung von Ebene bei Auftragsdokumenten gilt weiterhin. |

Umgesetzt als geschützter, rein lesender Service-Weg `/api/service/chronik`, Quellenstand gebunden. Kategorien laden unabhängig, Intervalle seitenweise, Dokumentlisten in Vierergruppen; erneute Aktualisierung alle 60 Sekunden/Fokus/Online. Bis 100 zugeordnete Aufträge/1.000 PDS-Unterlagen in dieser Ansicht, Mehrmengen und Ausfälle sichtbar gekennzeichnet. Bestehende PDS-Lesebudgets und Lesefreigaben gelten weiter. Fiktiver Wartungsbericht aus dem wiederholbaren Beispieldatenkatalog dient ausschließlich der isolierten Darstellung; kein Import echter Berichte und kein Nachweis realer Ausführung.

CaseDesk verwendet dieselbe Anlagenchronik mit Service-Leserecht und der UUID der ausgewählten technischen Einheit. Die Ansicht beginnt mit fünf Einträgen und lädt beim Verlassen von Schritt 1 keine Chronikdaten weiter. API-Pfade und Freigaben gelten unverändert.

Offene Datumsfrage für die native Abnahme: `PdsAPIDokumentMetadatenRESTModel.datum` ist als freier String ohne Format dokumentiert. Die Chronik ordnet gültige ISO-Daten/-Zeitpunkte ein; andere oder widersprüchliche Formate bleiben ausdrücklich Ohne Datum und werden nicht geraten. Mit dem PDS-Admin das tatsächliche Format klären.

## Material- und Leistungsliste · 15. November 2026

| Funktion/Feld | Konkreter API-Pfad / Schema | Vorrang / View | Implementierung und Grenzen |
| --- | --- | --- | --- |
| Positionszuordnung | POST `/service/details`, `PdsAPIServiceAuftragDetailsRESTModel.rootEbene.ebenen[]` → `PdsAPIServiceAuftragEbeneDetailsRESTModel.positionen[]` | Dokumentierte API, keine View | Auftrag und Antwort-UUID sowie gebundene Quelle prüfen; je Einsatz gruppieren. Keine erfundenen Positionen auf der Root-Ebene: diese enthält laut Schema nur `ebenen`. Fehlende Liste ist nicht dasselbe wie leere Liste. |
| Position / Artikel / Leistung | `PdsAPIVorgangPositionDetailsRESTModel.uuid,nummer,name,kurztext,langtext,zusatztext,positionsTyp,positionsArt` | Auftragsposition hat Vorrang vor aktuellem Katalog | Positionsnummer nicht als Artikelnummer ausgeben. Name/Bezeichnungen und tatsächlich gelieferte Bestell-/Hersteller-/EAN-Nummern (`bestellnummer,herstellernummer,eannummer`) darstellen. Lange Texte aufklappbar und ausschließlich als Klartext, kein HTML aus PDS ausführen. |
| Mengen und Einheit | `.menge`, `.gesamtMenge`, `.masseinheit` → `PdsAPIMasseinheitRESTModel.bezeichnung` | API; keine Umrechnung oder Ersatzfelder | 0, negative und dezimale Mengen erhalten. Abweichende Gesamtmenge separat, keine eigene Multiplikation/Summenbildung. Preiseinheit ist keine Mengeneinheit. Fehlende Werte nicht mit 0 füllen, ungültige Mengen ausdrücklich kennzeichnen. |
| Unterpositionen / Sonderarten | `.teilleistungen[]` rekursiv, `.teilleistungIgnorieren`, `.positionsArt` | Originalstruktur lesen | Parent-Zuordnung und Tiefe erhalten. Alternative, Bedarf, Schatten und Differenz erkennbar. Innerhalb eines Einsatzes doppelte Positions-UUIDs nicht still zusammenführen; betroffene Liste als unvollständig kennzeichnen. Kein Verbrauchs-/Bestandsnachweis. |
| Schutz und Budget | Geschützter GET `/api/service/einsatzmappe?section=positions`, vorhandene Service-Leseprüfung | Keine neuen PDS-Endpunkte oder Views | Whitelist-Projektion ohne `ekPreis`, `vkPreis`, Lieferantendaten oder interne Kalkulationsfelder. Maximal 100 Einsatzgruppen, 1.000 Positionen, 1 MiB projizierte Daten, acht Unterebenen und begrenzte Feldlängen. Kein PDS-Schreibaufruf oder Katalog-Fallback bei Fehlern. |

Status: Reader, Simulator-Beispiele, Oberfläche, Hilfe und Elli umgesetzt; native PDS-Anbindung weiterhin getrennt freizugeben und abzunehmen. Offen bleibt die fachliche Auslegung von `menge` gegenüber `gesamtMenge` bei jeder nativen Sonder-/Sortimentsstruktur; HeyElli zeigt beide Werte ohne eigene Berechnung. Die Dokumentation schreibt kein Richtextformat für `langtext` vor, deshalb sichere Klartextdarstellung. Keine automatische Übernahme aus Wartungsintervallen oder Auftragserzeugung: Angezeigt werden ausschließlich bereits im Serviceauftrag vorhandene Positionen.

## Rücklauf- und Abschlusskontrolle · 15.11.2026

| Feld / Funktion | API und Schema | Vorrang / Ansicht | Stand und offene Fragen |
| --- | --- | --- | --- |
| Bekannten Rücklauf lesen | GET `/ruecklauf/details/{uuid}` → `PdsAPIRuecklaufDetailsRESTModel` | Dokumentierte API; kein View-Fallback | Implementiert, nur lesend in der Auftragsakte/Einsatzmappe. UUID muss bekannt sein; vor der Ausgabe Abgleich mit POST `/service/details`, `rootEbene.ebenen[].uuid`. |
| Auftragszuordnung, Arbeiten, Datum | `PdsAPIRuecklaufEbeneDetailsRESTModel`: `serviceauftragebeneUUID`, `ausgefuehrtenArbeiten`, `ausfuehrDatum`, `status` | Ausschließlich exakt zugeordnete Ebenen; Ausführungsdatum niemals aus Planung ableiten | Implementiert. Fehlendes Datum/Arbeitsbeschreibung ausdrücklich anzeigen. Rücklaufstatus und Auftragsstatus nicht gleichsetzen; keine automatische Abschlussbuchung. |
| Rücklaufpositionen | `rootEbene.ebenen[].positionen` → `PdsAPIVorgangPositionDetailsRESTModel` | Rücklaufpositionen separat von Auftragspositionen; gemeinsame geprüfte Projektion | Mengen, Einheiten, Beschreibungen, Unterpositionen. Keine Preise, Kalkulation oder Lager-/Verbrauchsbehauptung. Maximal 100 Ebenen/1.000 Positionen/Tiefe 8; projizierter Rücklauf maximal 2 MiB. |
| Rücklaufdokumente | GET `/ruecklauf/listdokumente/{uuid}` und `/ruecklauf/listauftragsdokumente/{uuid}` → `PdsAPIDokumentMetadatenRESTModel[]`; GET `/dokument/downloaddokument/{uuid}` | Grunddaten mit Rücklauf-UUID nur bei ausschließlich diesem Auftrag zugeordneten Ebenen; Auftragsdokumente gemäß Beschreibung mit Rücklaufebenen-UUID | Implementiert, bis zwölf Einsatzordner plus Grunddaten; Budgetgrenze/Teilfehler sichtbar. Download prüft Quelle, aktuellen Auftrag und aktuelle Dokumentmitgliedschaft erneut. Der PDS-Admin muss Ebene/UUID-Semantik der Auftragsdokumente beim Anschluss bestätigen. Dateien bleiben in PDS. |
| Rückläufe automatisch finden | Kein Rücklauf-Listenendpunkt nachgewiesen. POST `/vorgang/listvorgaengebyperson` und `/vorgang/listvorgaengebyprojektakte` verlangen `vorgangstyp`; deren Enum enthält **kein RUECKLAUF**. `RUECKNAHME` ist kein Rücklauf. | Keine erfundene Abfrage; kein stiller Fallback | Offen für echte automatische Entdeckung: dokumentierter Kennungsweg oder ausdrücklich vereinbarte lesende Datenansicht benötigt. Bis dahin Eingabe einer bekannten UUID; keine vollständige Abschlusskontrolle behaupten. |
| Fiktiver Prüfnachweis | Simulator GET derselben dokumentierten Rücklaufpfade | Rein virtuelle Seed-Datei `returns.json`, kein Import/Überschreiben bestehender Bestände | `sim-return-2` zu `sim-order-2`, ausgeführte Arbeiten/Datum/Position und vorhandener fiktiver Bericht. Kein tatsächlich angeschlossenes PDS und keine externe Freigabe. |

## Automatische Rücklaufzuordnung über Datenansichten · 15.11.2026

Diese Ergänzung ersetzt den manuellen UUID-Bedienweg aus dem vorherigen Abschnitt. Der fehlende native Rücklauf-Listenabruf bleibt eine belegte API-Lücke; die UUID-Eingabe in der Auftragsakte entfällt.

| Feld / Funktion | API / Schema | Vorrang und Vertrag | Implementierungsstand / offene Fragen |
| --- | --- | --- | --- |
| Rücklaufkennungen entdecken | GET `/datenansichten/list` → `PdsAPICustomViewRESTModel` mit `columns`; POST `/datenansichten/listdaten` → `PdsAPICustomViewDataRESTModel` (`name,page,entriesPerPage`) | Ausschließlich ausdrücklich konfigurierte Ansicht `returnLinkView`. Genau zwei Textspalten `ruecklaufUUID`, `serviceauftragebeneUUID`; vereinbarte Aliasnamen, keine behaupteten PDS-Standardspalten. Nur Kennungen, keine Fachtexte oder Preise. | Implementiert. PDS-Admin muss reale Ansicht und Herkunft der UUID-Spalten bereitstellen/freigeben. Keine tatsächliche Ansicht bestätigt: lokale Quelle ist Simulator, echte Konfiguration nicht hinterlegt. |
| Zuordnung zum Auftrag | POST `/service/details`, Ebenen-UUIDs; GET `/ruecklauf/details/{uuid}`, `PdsAPIRuecklaufEbeneDetailsRESTModel.serviceauftragebeneUUID` | Die Ansicht entdeckt nur Kandidaten. Jeder Treffer muss in den nativen Rücklaufdetails genau den behaupteten Originaleinsatz enthalten. Auftrag wird aus dessen tatsächlichen Ebenen abgeleitet, nicht aus Kundennamen, Nummern oder Objektähnlichkeit. | Implementiert, Dubletten zusammengeführt, mehrere Rückläufe je Einsatz möglich. Veraltete/fremde Beziehungen erscheinen als unvollständige Prüfung ohne fremde Inhalte. |
| Inhalte / Dokumente | Bestehende Rücklaufdetails und Dokumentpfade aus vorheriger Matrix | Fachliche API hat Vorrang. Ansicht ersetzt ausschließlich die fehlende Kennungsliste. Dokumente erst für geöffneten Rücklauf; Auftragsbindung vor Download erneut prüfen. | Automatische Liste mit Nummer, Ausführungsdatum und Status; erster Rücklauf öffnet automatisch. Hintergrundaktualisierung erhält Auswahl und aufgeklappte Bereiche. Keine Dateikopie/Abschlussbuchung. |
| Grenzen und Fehler | Maximal 2.000 Ansichtsmetadaten/1 MiB, 500 Zeilen pro Seite, 20.000 Zuordnungszeilen/8 MiB, bis 41 Seiten inklusive leerer Abschlussseite; maximal 20 Rücklaufkandidaten/8 MiB nativer Details je Auftrag | Keine unvollständige Seitenliste als verbindlich leer ausgeben. Native Teilfehler ausdrücklich melden. Kein stiller View-Wechsel und kein Rückfall auf Simulator. | Serverseitig umgesetzt, bestehendes 25-Sekunden-Gesamtbudget der Einsatzmappe. Stabile Seitensortierung, Mandantenbegrenzung und Aktualität der Ansicht mit PDS bestätigen; kein dokumentierter Snapshot-/Filterparameter. Nicht für beliebige Großbestände unbeschränkt scannen. |
| Einrichtung / Freigabe | Einstellungen → PDS-Anbindung → Datenansichten → Rücklaufzuordnung; API-Prüfung | Geänderter Ansichtsvertrag deaktiviert echten Zugriff wie bisher. Metadaten und Kennungsdaten der konfigurierten Ansicht müssen erfolgreich geprüft werden; danach API-/Kalenderprüfung gleicher Konfiguration und ausdrückliche Freigabe. | Implementiert in bestehenden JSON-Konfigurationen, keine Datenbankmigration. Neue Ansicht nicht automatisch aktiviert. Anleitung und Markdown-Download aktualisiert. |
| Fiktiver Prüfstand | `sim_service_return_links` über dieselben dokumentierten Ansichts-API-Pfade | Ausdrücklich erfundener Vertragsentwurf, kein PDS-Standardname. Nicht als reale Konfiguration speichern. | Automatische Zuordnung von `sim-return-2` zu `sim-order-2-incident`; reale PDS-Anlage/Ansicht weiterhin offen. |

### Browsernachprüfung der Rücklaufansichten · 15.11.2026

E24/E25 in Chromium und WebKit erfolgreich: automatische Zuordnung ohne UUID-Eingabe, Ausschluss falscher Aufträge, Dubletten, veraltete Ansichtsbezüge, fehlende Ansicht, falsche Spalten, ungültige Datenseiten und Abbruch des Ansichtsabrufs. Fehlerfälle entstehen am PDS-Transport einer isolierten Quellkopie und durchlaufen die unveränderten Leser sowie die geschützte Route bis zur Browsermeldung. Kein UI-Erfolg mit leerer Liste bei Fehlern; Hintergrundfehler erhalten unbestätigten letzten Stand, Wiederholung ohne Neuladen erfolgreich. Fiktive Prüfansicht, keine tatsächlich angeschlossene PDS-Ansicht. Prüfbericht und Grenzen (Prüfnachweis in der Git-Historie).

### Übersicht der Ansichtsverträge in der PDS-Anleitung · 15.11.2026

Unter Einstellungen → PDS-Anbindung → Anleitung steht unter der kompakten Anleitung eine Übersicht der vier administrativ konfigurierbaren Ansichten. Bildschirm und Markdown-Download verwenden dieselben statischen Vertragsdaten (`pds-view-guide-data.ts`): Anlass, Einstellungsfeld, Spalten/Formate, Verknüpfungen, Regeln und fiktive JSON-Beispiele. Keine echte Datenansicht oder API-Freigabe geändert.

| Ansicht | Belegter Leseadapter / API-Vorrang | In der Anleitung hervorgehobene Grenzen |
| --- | --- | --- |
| Rücklaufzuordnung (`returnLinkView`) | `/datenansichten/list`, `/datenansichten/listdaten`; native `/ruecklauf/details/{uuid}` prüft Originaleinsatz aus `/service/details` | Genau zwei Spalten `ruecklaufUUID`, `serviceauftragebeneUUID`; keine Auftragsnummer oder Rücklaufebenen-UUID. Bestehende Abfragebudgets gelten. |
| Arbeitszeiten (`workingTimeView`) | Ansichts-API; `readWorkingTime`; Feiertage/Gruppen weiterhin `/administration/listfeiertage`, `/administration/listfeiertagsgruppen` | Mitarbeiter-/Modell-/Gruppen-UUID, Bezeichnung, Gültigkeit, ISO-Wochentag, tägliche Sollminuten und getrennte Nettofenster. Arbeitsfreie Tage ausdrücklich, fehlende Tage unbekannt. |
| Urlaubsgenehmigung (`vacationApprovalView`) | Ansichts-API; `enrichVacationApprovals`; Urlaubstermine aus Termin-API | Eindeutige `terminUUID`, Status exakt `BEANTRAGT` oder `GENEHMIGT`. Keine Genehmigung durch die Ansicht. |
| Kalenderfarben (`colorView`) | Ansichts-API; `PdsCalendar.list` / `readLegacyColorRules` | Farbe `#RRGGBB` und genau ein Kriterium je JSON-Zeile. Empfohlenes flaches Schema `typ` + `farbe`; keine zusätzlichen null-Kriterien. Bei Status-UUID zusätzlich Vorgangsart. Erste Seite mit 500 Regeln; keine Vollständigkeit für größere Bestände zugesichert. |

Alle Ansichts-/Spaltennamen sind individuelle Aliasverträge. Der Bauleiter-Simulatorhilfsvertrag ist ausdrücklich keine zusätzliche freigegebene Echt-PDS-Konfiguration. Rohdaten-/Snapshotformat der realen Installation und stabile Paginierung bleiben mit PDS abzustimmen; keine neuen SQL-Tabellen oder Endpunkte behauptet. Die vier fiktiven Beispiele wurden gegen die tatsächlich verwendeten Leser geprüft.

### Serviceauftragsakte · Darstellungsvereinheitlichung · 15.11.2026

Reine macOS-Darstellung derselben Service-/Termin-/Rücklaufdaten: Auftragsnummer und Status gemeinsam, Fokusfelder Kunde, Objektadresse, Termin und Haupttechniker. Vollständiger Meldetext bleibt bei langen Beschreibungen aufklappbar; eine gekürzte Vorschau ersetzt keine gespeicherten Inhalte. Einsatzstatus nur zusätzlich anzeigen, wenn er vom Auftragsstatus abweicht. Dokumente, Kontakte, Rückläufe, Material und BMACloud-Verweise mit einheitlichen Gruppen. Keine neuen API-/View-Felder, Endpunkte, Schreibfreigaben oder fachlichen Abschlussregeln. Vorhandene serverseitige Berechtigungs- und Zuordnungsprüfungen unverändert.

### Kunden-, Objekt- und Einheitenakten · Fokusdarstellung · 15.11.2026

Reine Darstellung vorhandener `/person/details`- und `/objekt/details`-Daten sowie bisheriger Zusatzabfragen: Kundenname/-nummer, Anschrift und Ansprechpartner; Objekt-/TE-Nummer aus dem Infofeld `Nummer`, Gerätemetadaten aus `Hersteller`, `Typ`, `Standort`; Kunde und geerbte Adresse aus der tatsächlichen Objekthierarchie. Eigene Kostenreferenzen weiterhin über `/administration/listkostentraeger` beziehungsweise `/administration/listkostenstelle`, Vertragskosten über `/wartungsvertrag/listvertraegebyobjekt` getrennt nach Wartung/Rechnung. Keine TE-Nummer als BMACloud-Anlagennummer umgedeutet; BMACloud bleibt an der bisherigen Wartungskostenträger-Zuordnung. Keine neue Ansicht, API-Schreibfunktion oder Integrationsfreigabe. Chronik, Dateiablage, Verknüpfungen und serverseitige Rechte unverändert.

## Navigation vom Kalender zum Servicevorgang

„Im Service öffnen“ im Termin-Kontextmenü verwendet die bereits ermittelte Service-UUID (`vorgangUUID` → `CalendarEvent.link.id`, Typ `SERVICEAUFTRAG`). Der Adapter löst sie über POST `/service/details` mit `{uuid}` auf; bei Fortsetzungen wird die vorhandene validierte Service-Referenz verwendet. Die interne Navigation führt nach `/servicehub?ansicht=orders&akte=order&id=<Service-UUID>`. Keine zusätzliche PDS-Abfrage, kein neuer Schreibzugriff und keine Datenansicht für den Link. Die kalenderseitige API liefert die Service-Lesefreigabe aus der geprüften Sitzung; die Serviceakte und ihre API prüfen den Zugriff zusätzlich selbst. Freie Termine, andere Vorgangsarten und fehlende Service-Freigabe erhalten keinen solchen Link. Simulator und bestehender PDS-Leseadapter nutzen denselben Verweis; eine tatsächliche PDS-Verbindung wurde hierfür nicht freigegeben oder geprüft.

### CaseDesk-Werkzeug: dauerhafte Erfassung und Wiederholung

| Feld/Funktion | API-Pfad und Schema | View | Vorrang / Stand / offene Punkte |
| --- | --- | --- | --- |
| Wiederherstellbarer angefangener Werkzeug-Auftrag | HeyElli-eigener persönlicher Weg `/api/benutzerkonto/auftragsentwuerfe`, verschlüsselte unveränderliche Formularstände; keine PDS-Schreibdatenquelle | Keine | Benutzer und PDS-Arbeitsbereich serverseitig gebunden; bestehende Kalenderablage getrennt. |
| Wiederholung nach verlorener Anlageantwort | Bestehender HeyElli-Weg `POST /api/pds-simulator/orders`, unveränderter `Idempotency-Key` und validierter Auftragsinhalt; bestehender dokumentierter Service-Workflow in `write-gateway.ts` / `createService` | Keine | Im Simulator umgesetzt und isoliert zu prüfen. Kein neuer PDS-Endpunkt, keine echte Schreibfreigabe. Die tatsächliche PDS-Anlage bleibt im echten Lesebetrieb gesperrt; echte Wiederholungsgarantien sind weiterhin vor Schreibfreigabe mit PDS nachzuweisen. |

### Serviceakte → zugehöriger Kalendertermin

| Feld/Funktion | Konkrete API / Schema | View | Vorrang / Stand |
| --- | --- | --- | --- |
| Sprung je geplantem Einsatz | `/service/details`: Ebene `uuid`, `startZeitpunkt`, `hauptmonteurUUID`; vorhandene Kalenderzuordnung über `/service/findstoerungtermin` → `uuid`, ergänzt als `serviceIncidentId` im Kalenderadapter | Keine | Vorhandene API-IDs haben Vorrang. Kein Erraten einer Kalender-UUID. Der Verweis übergibt Datum in deutscher Ortszeit, Serviceauftrag und Einsatz-ID. Tagesansicht, Techniker und Fokus werden nur lokal für den Aufruf gesetzt. Ohne Termin kein Link; zusätzliches PlanBoard-Leserecht serverseitig ermittelt. Keine neuen PDS-Abfragen oder Schreiboperationen. |

Der durch den Service-Kalenderlink gesetzte Mitarbeiterfilter wird im Ressourcen-Suchfeld mit dem Namen aus dem vorhandenen Mitarbeiterkatalog angezeigt. Entfernen oder Bearbeiten löst die URL-Bindung (`mitarbeiter`, `einsatz`, `auftrag`); es erfolgt keine PDS-Schreiboperation und keine Änderung der gespeicherten Ressourcenauswahl. Gilt ebenso für bestehende Bereitschaftslinks mit `mitarbeiter`.

## Auftragsaktionen im Service-Aktenkopf · 15. November 2026

| Funktion | API und Schema | Vorrang / View | Stand und offene Punkte |
| --- | --- | --- | --- |
| Statusauswahl und aktueller Auftrag | GET `/service/liststatus` → `PdsAPIVorgangStatusRESTModel[]`; POST `/service/details` → `PdsAPIServiceAuftragDetailsRESTModel` | Ausschließlich API, kein View-Fallback | Status-Schaltfläche im Aktenkopf. Mobile Systemstatus werden nicht als beliebige Statuswahl angeboten. |
| Haupttechniker vor Ausgabe | POST `/mitarbeiter/details` → `PdsAPIMitarbeiterDetailsRESTModel`, Zuordnung aus `rootEbene.ebenen[].hauptmonteurUUID` | API | Vor Bestätigung alle Haupttechniker anzeigen; bei fehlender Zuordnung keine mobile Ausgabe. |
| Statuswechsel / Stornierung | POST `/service/updatestatus`, `PdsAPIServiceAuftragUpdateStatusRESTModel` mit `uuid`, `statusBezeichnung` | Dokumentierter Schreibvertrag; keine Views | Nur im freigegebenen lokalen Simulatorbetrieb umgesetzt. Bei „Mobil abgeholt“ ausschließlich „Manuell storniert“ als Stornierung; sonst „Storniert“. Bereits stornierte Aufträge erhalten keine weiteren Aktionen. |
| Mobile Ausgabe | POST `/service/mobilausgeben`, `PdsAPIServiceAuftragMobilAusgebenRESTModel` mit `uuid`, `auftragspool:false` | Dokumentierter API-Vertrag | Lokales Simulatormodell stellt Ausgabe und Status „Ausgegeben Mobil“ gemeinsam dar. Keine neue Aussage über native PDS-Statusfolgen. |
| Parallelität und Wiederholung | HeyElli `/api/service/status` | Keine erfundene PDS-Sperr-/Idempotenzfunktion | Eigene Vorschauversion des vollständigen Auftrags, Quellbindung, synchrone Simulatortransaktion und kontogebundene Vorgangskennung. Veraltete Vorschau wird abgewiesen; wiederholte Bestätigung derselben ausgeführten Aktion überschreibt keine spätere Änderung. Historie mit Benutzer/Zeitpunkt, alten/neuen Werten. Echte PDS-Schreibfreigabe bleibt gesperrt; native Übergänge, CAS-/Sperrmöglichkeit, Wiederholungsschutz und Nebenwirkungen vor Freigabe klären. |

Kalender-, Terminvergabe- und Terminbestätigungsaktionen stehen als beschriftete Symbole im Aktenkopf links vom Status. Es werden keine neuen Aufträge oder Termine durch einen Statuswechsel angelegt. Leserecht und Service-Schreibrecht werden serverseitig getrennt geprüft; PlanBoard-Schreibrecht ist dafür nicht erforderlich.

## Persönlich ausgeblendete Einträge im CaseDesk · 15. November 2026

| Feld / Funktion | API-Pfad und Schema | Vorrang / View | Stand |
| --- | --- | --- | --- |
| Objekt-/Einheitenhierarchie und Kunde | POST `/objekt/listobjekte` → `PdsAPIObjektSucheResultRESTModel.resultList[]` / `PdsAPIObjektRESTModel`: `uuid`, `typ`, `personUUID`, `parentUUID`; POST `/objekt/details` → `PdsAPIObjektDetailsRESTModel.childrenUUIDs` für die vorhandene Einheitenzuordnung | API, keine Datenansicht | Die Katalogsuche berücksichtigt persönliche Ausblendungen aus PostgreSQL, gebunden an Sitzung und tatsächlichen PDS-Arbeitsbereich. Kunden und ausgeblendete Vorfahren verbergen untergeordnete Einträge. Filterung vor Suchsortierung, Trefferzahl und Seitenschnitt. |
| Kundenauswahl | POST `/person/listkunden` → `PdsAPIPersonSucheResultRESTModel.resultList[].uuid` | API, keine Datenansicht | Persönlich ausgeblendete Kunden werden aus der Katalogauswahl entfernt. |

Gilt im Simulator und im lesenden PDS-Adapter mit demselben persönlichen Ausblendebestand wie Service. Keine Änderung oder Löschung in PDS. Ausblendungen sind Ansichtspräferenzen, keine Datensatzberechtigungen; direkte Akten und bestehende Aufträge werden dadurch nicht gesperrt. Bereits eingegebene Entwurfszuordnungen werden nicht automatisch gelöscht. Wieder einblenden erfolgt weiterhin im Service unter „Ausgeblendete Einträge“.

## CaseDesk · Standardpositionen · 16. November 2026

| Feld / Funktion | Dokumentierter API-Vertrag | Vorrang / View | Implementierung / Grenzen |
| --- | --- | --- | --- |
| Artikelname und Auswahl | POST `/katalog/listartikel`, `PdsAPIKatalogSucheRESTModel` (`suchwort`, `page`, `entriesPerPage:30`) → `PdsAPIKatalogSucheResultRESTModel.resultList[]` / `PdsAPIKatalogEintragRESTModel` (`uuid`, `name`, `kurztext`) | API, kein View-Fallback | Suchbare, paginierte Auswahl unter Einstellungen → Apps → CaseDesk → Standardpositionen. Eindeutig fiktive Artikel im Simulator unter `database/seeds/pds-simulator/catalog-articles.json`. |
| Artikelprüfung | POST `/katalog/details`, `PdsAPIKatalogSuchDetailsRESTModel.uuid` → `PdsAPIKatalogEintragDetailsRESTModel` (`uuid`, `name`, `typ`, `loeschKennzeichen`) | API; Client-Bezeichnung/-Typ nicht vertrauen | Serverseitige Auflösung beim Speichern. Nur verfügbare `ARTIKEL` und `ARTIKEL_INKL_LOHN`; andere Typen oder fehlende Artikel verweigern die Änderung. |
| Zentrale Vorgaben | HeyElli `/api/verwaltung/stoerungsmeister`; PostgreSQL `platform.incident_defaults` | Eigene Konfiguration, kein PDS-Schreibzugriff | Administrator, Ursprung, Datenquelle und Version prüfen. Maximal 20 Positionen, eindeutige Positionsnummern, endliche positive Mengen bis 1.000.000. Name und Typ stammen aus der Detailantwort. Historie alter/neuer Vorgaben, Benutzer und Zeitpunkt. Keine automatische Löschung. |
| Position an neuer Störung | POST `/service/createposition`, `PdsAPIServiceAuftragEbenePositionAnlegenRESTModel` (`uuid`: Störung, `position`: `PdsAPIPositionAnlegenRESTModel`) → `PdsAPIVorgangPositionDetailsRESTModel` | Dokumentierte API, keine View-Schreibzugriffe | Felder: `katalogUUID` ← Katalogkennung, `name` ← geprüfter Katalogname, `positionsTyp` ← Artikeltyp, `positionsArt:NORMAL`, `nummer` ← Positionsnummer, `menge` ← Menge, `apiID` ← stabile Standardpositionskennung. Ausführung im lokalen Simulator zwischen Störungsanlage und mobiler Ausgabe. |
| Wiederholung und Konfigurationswechsel | Bestehender geschützter Anlagevorgang und Simulator-Schrittnachweise | Eigener Wiederholungsschutz, kein erfundener PDS-Idempotenz-Endpunkt | Vorgaben vor erster Fachanlage pro Vorgang einfrieren. Einzelne Positionen mit eigener Schrittnummer atomar anlegen; Wiederholung erzeugt weder Auftrag noch Position doppelt. Bereits abgeschlossene ältere Vorgänge werden nicht nachträglich ergänzt. |

**Echter PDS-Betrieb:** Katalogsuche und geschützte Konfiguration können den dokumentierten Leseadapter verwenden. Die Auftrags-/Positionsanlage bleibt bis zur separaten Freigabe des echten Schreibbetriebs gesperrt. Vor Freigabe müssen native Pflichtfelder, Preis-/Steuer-/Einheitenübernahme aus `katalogUUID`, Status-/Mobilfolgen und die Eindeutigkeit von `apiID` sowie Wiederholungsschutz bei unklarer Antwort mit PDS geprüft werden. Es werden keine Preise erfunden, keine Preiszusagen gemacht und keine vorhandenen Auftragspositionen verändert.

## Abschlusslinks nach Störungsanlage · 16. November 2026

| Funktion | API / Schema / Herkunft | Vorrang / View | Umsetzung |
| --- | --- | --- | --- |
| Bestätigte Auftragsakte | POST `/service/create` → `PdsAPIServiceAuftragDetailsRESTModel.uuid`, gespeicherter `pdsReceipt.uuid` | Tatsächliche gespeicherte Kennung, keine Suche über Nummer/Name | Eigene POST-Antwort `/api/pds-simulator/orders` ergänzt `links.service` zur Service-Auftragsakte. Nur bei aktuellem serverseitigem Service-Leserecht. |
| Geplanter Termin | POST `/service/createstoerung` → `PdsAPIServiceAuftragEbeneDetailsRESTModel.uuid`, gespeicherter `pdsReceipt.stoerungUUID`; bestätigter Planungsbeginn und `technicianId` | Kein View, keine neu erfundene Terminkennung | `links.calendar` führt mit Berliner Datum, Auftrag, Einsatz und Haupttechniker direkt zum Termin im PlanBoard. Ohne geplanten Beginn/Haupttechniker oder Ziel-App-Leserecht kein Kalenderlink. |

Die Kennungen stammen auch bei wiederholter Anlage aus demselben gespeicherten Ergebnis; editierbare Formulardaten erzeugen keine Abschlusslinks. Im Menüleisten-Werkzeug öffnen die Links die Haupt-App über eine auf gleichen Ursprung, tatsächliches Werkzeugfenster und zwei erlaubte App-Pfade begrenzte Nachricht. Der bestehende Navigationsschutz bleibt aktiv; das Werkzeug lädt keine vollständige Fach-App in seinem schmalen Rahmen. Diese Navigation gibt keine neuen PDS-Schreibfunktionen frei.

### Verfügbarkeit bei Terminvergabe (2026-11-16)

| Feld/Funktion | API / Schema | Ergänzende Datenansicht | Vorrang und Stand | Offene Grenzen |
| --- | --- | --- | --- | --- |
| Planbare Techniker | `/mitarbeiter/listmitarbeiter`, `/mitarbeiter/detailsbatch`, `/administration/listressourcengruppen`; Mitarbeiter mit Ressourcenplanzeit | keine | API; gemeinsame lesende Quelle für CaseDesk und Service, serverseitig mindestens Leserecht in einer der beiden Apps | Keine Fachgruppenqualifikation oder Fahrzeitprüfung |
| Belegung / freie Alternativen | `/termin/listplanung` (`PdsAPISuchePlanungByMitarbeiterRESTModel`), `/termin/detailsbatch`; Zeitraum, Mitarbeiter, Status und Typ | konfigurierte Urlaubsgenehmigungsansicht nur für fehlenden Genehmigungsstatus | API hat Vorrang; GEPLANT belegt, FREI/VORGEMERKT nicht; Urlaub nur genehmigt, unbekannter Genehmigungsstatus bleibt unklar | Momentaufnahme ohne Reservierung. Keine Auftrags-, Kunden-, Termintexte oder privaten Abwesenheitstexte in der Antwort |
| Zusammenhängende freie Zeit | bestehender Arbeitszeitvertrag: `/datenansichten/list`, `/datenansichten/listdaten`, native Pausen-/Feiertagsquellen der Arbeitszeitintegration | konfigurierte Arbeitszeitmodelle, Genehmigungen wie im PlanBoard | Maximal 14 Kalendertage, 300 Mitarbeiter, 10.000 Termine; Dauer 15–1440 Minuten; Begleiter müssen ebenfalls frei sein. Keine stillen Ersatzarbeitszeiten | Ohne Modell keine Frei-Zusage; real angebundenes PDS noch nicht nachgewiesen. Implementierter Simulator und isolierte Prüfungen sind getrennte Nachweise |

Keine neue PDS-Schreibfunktion und keine Freigabeänderung. Vorschläge ändern erst nach Auswahl die Eingabefelder. Bestehende Speicher- und Konfliktprüfungen bleiben maßgeblich.

Bei der lokalen Terminvergabe eines bestehenden Einsatzes wird dessen eigene Kalenderzuordnung anhand der bestehenden Simulatorreferenz ausgenommen; andere Termine bleiben belegend. Die Freigabe realer Planung setzt zusätzlich eine belegte Zuordnung zur PDS-Terminreferenz voraus.

Verfügbarkeitsvorschläge werden auch beim Ende der Sommerzeit gegen die vorhandene Berlin-Eingabeprüfung rückgeprüft. Mehrdeutige Startminuten werden nur innerhalb desselben belegungsfreien Intervalls übersprungen; reicht dessen verbleibende Dauer nicht aus, folgt erst ein späteres vollständig passendes Intervall. API-Pfade, Freigaben und Zeitstempelverträge bleiben unverändert; kein Nachweis für reales PDS.

### Nachlieferung der lokalen Servicehistorie (16.11.2026)

Statuswechsel und mobile Ausgabe verwenden unverändert `/service/updatestatus` beziehungsweise `/service/mobilausgeben`; die Terminvergabe bestehender Einsätze bleibt bei `/service/updatestoerung`. Keine neue PDS-Funktion oder Freigabe. Im implementierten Simulator werden Historienaufträge mit Benutzer, ursprünglichem Zeitpunkt und Werten atomar mit der Fachänderung gesichert und nach PostgreSQL idempotent übertragen. Wiederholungen und der lokale Überwachungsdienst übertragen ausschließlich diese Nachweise, niemals erneut die Fachaktion. Für reales PDS ist damit weder eine verteilte Transaktion noch eine Schreibfreigabe nachgewiesen. Vor Einführung dieser Sicherung bereits verlorene Historien werden nicht erfunden.


### MailDesk – Zuordnung des geteilten Postfachs (20.11.2026)

MailDesk liest ausschließlich über bestehende, dokumentierte Lesewege (`/service/liststoerungen`, `/person/listkunden`, `/objekt/listobjekte`, `/mitarbeiter/listmitarbeiter`, `/administration/listkostentraeger`, `/administration/listkostenstelle`, `/objekt/detailsbatch`, `/wartungsvertrag/listvertraegebyobjekt`) und ordnet Mails über Kostenträger-, Auftrags- und Kundennummern sowie Objektadressen zu. Keine Views, keine Schreibzugriffe. Serviceaufträge aus Mails entstehen ausschließlich über den bestehenden CaseDesk-Weg (`/service/createstoerung` im Simulator; im echten PDS weiterhin nicht freigegeben). Offen: Ob Kostenträgernummern im Echtbestand je Kunde eindeutig sind; gemeinsame Kostenträger werden nur mit zweitem Hinweis automatisch zugeordnet. Details: `docs/maildesk.md`.


### SharePoint-Ablagestruktur: Quellen der Ordnernamen (21.11.2026)

| Ordnerteil | API-Pfad und Schema | Vorrang | Stand |
| --- | --- | --- | --- |
| Stadt, Straße mit Hausnummer | POST `/objekt/details` → `standort.ort`, `standort.strasse` (`PdsAPIPostKommunikationswegDetailsRESTModel`) | API | implementiert; Einheiten über `parentUUID` |
| Gewerk | `fachbereichUUID` (`PdsAPIObjektDetailsRESTModel`) + GET `/mitarbeiter/listfachbereiche` (`PdsAPIFachbereichRESTModel`) | API | implementiert; in PDS ist der Fachbereich das Gewerk der Anlage (Anwenderdokumentation „Anlagen und Bauteile erstellen“). Das simulierte Infofeld „Gewerk“ wird dafür **nicht** verwendet. |
| Einheit | `bezeichnung` + `dbid` | API | implementiert; „Kürzel“ ist nicht im API-Vertrag, eine Objektnummer nur als installationsspezifisches Infofeld |
| Kunde | POST `/person/details` → `name`, `kundenRolle.kundennummer` | API | implementiert |

Simulator liefert `dbid`, `fachbereichUUID` und `/mitarbeiter/listfachbereiche` entsprechend dem Vertrag (Test `src/platform/pds/simulator/tests/pds-simulator-objects.test.mjs`). Offen: ob reale Installationen den Fachbereich an jeder technischen Einheit pflegen; ohne Fachbereich entsteht `ohne_gewerk`.


### CRM-Aufgaben und Termine vor Ort (21.11.2026)

Grundlage für „Meine Aufgaben“, „Kunde 360“ und „Aufgabe anlegen“ aus MailDesk. Quelle: OpenAPI `/crm/*`, `/termin/*`; Anwenderdokumentation Kap. 11 (Aktivitäten, Aufgaben).

| Funktion | API-Pfad und Schema | View | Vorrang | Stand |
| --- | --- | --- | --- | --- |
| Aufgabentypen | GET `/crm/listaufgabentypen` → `PdsAPIAufgabeTypRESTModel[]` (`uuid`, `bezeichnung`, `standard`) | keiner | API | implementiert (`src/platform/pds/api/crm.ts`), Simulator |
| Aufgaben suchen | POST `/crm/listaufgaben` (`PdsAPIAufgabeSucheRESTModel`: `suchwort`, `status[]`, `projektakteUUIDs[]`, `faelligkeitNach/Vor`) → `PdsAPIAufgabeRESTModel` | keiner | API | implementiert; die Liste enthält **keine** Zuweisungen und keine Beschreibung, und PDS filtert **nicht** nach Benutzer, Kunde oder Objekt. heyelli lädt Details einzeln nach und filtert selbst. |
| Aufgabe lesen | POST `/crm/aufgabedetails` → `PdsAPIAufgabeDetailsRESTModel` inkl. `zuweisungen[].benutzerUUID` | keiner | API | implementiert |
| Aufgabe anlegen | POST `/crm/createaufgabe` (`PdsAPIAufgabeAnlegenRESTModel`, Pflicht `betreff`; nur **entweder** `objektUUID` **oder** `projektakteUUID`) | – | API | implementiert, **nur Simulator**; echtes PDS ist weiterhin nur lesend freigegeben (`ReadonlyPdsTransport`) |
| Aufgabe ändern (Status, Fälligkeit, Text) | POST `/crm/updateaufgabe` (`PdsAPIAufgabeUpdateRESTModel`, Status `OFFEN`, `IN_BEARBEITUNG`, `WARTEN`, `ERLEDIGT`, `ABGELEHNT`) | – | API | implementiert, nur Simulator |
| Zuweisen / Zuweisung lösen | POST `/crm/createaufgabezuweisung` (`uuid`, `benutzerUUID`), POST `/crm/removeaufgabezuweisung` (Zuweisungs-`uuid`) | – | API | implementiert, nur Simulator |
| Benutzer zu Mitarbeiter | POST `/mitarbeiter/details` → `benutzerUUID` (`PdsAPIMitarbeiterDetailsRESTModel`) | keiner | API | implementiert; heyelli-Konten sind Mitarbeitern zugeordnet, Zuweisungen erwarten die `benutzerUUID` |
| Termine vor Ort je Objekt | POST `/termin/listplanung` (alle planbaren Mitarbeiter, Zeitraum ≤ 56 Tage) + POST `/termin/detailsbatch` → `objektUUID`, `typ`, `status`, `startZeitpunkt`, `mitarbeiterUUIDs` | keiner | API | implementiert (`src/platform/pds/api/visits.ts`); PDS bietet Termine nur je Mitarbeiter, nicht je Objekt oder Kunde. „Vor Ort“ = Typ `SERVICEAUFTRAGEBENE`, `TAETIGKEIT`, `VORGANG` oder `PROJEKT`, Status `GEPLANT` oder `VORGEMERKT`, Objekt gesetzt. |
| Aktivitäten (Gesprächsnotiz, Telefonat, E-Mail) | **nicht im API-Vertrag** | – | – | nicht anbindbar; Notizen und Mails bleiben in heyelli |
| Dokumente an Aufgaben | **nicht im API-Vertrag** (`/dokument/uploaddokument` nur Projektakte, Vorgang, Person) | – | – | nicht anbindbar |

Simulator: fiktive Aufgaben und Typen in `database/seeds/pds-simulator/crm-tasks.json`, Schreiben idempotent je Workflow-Schritt; Mitarbeiter liefern `benutzerUUID` (`sim-user-N`); fünf kommende Termine vor Ort (24.11.–14.12.2026) im Kalender-Seed. Test: `src/platform/pds/simulator/tests/pds-crm.test.mjs`.

Offen (mit PDS zu klären, nicht angenommen): ob jede Installation `benutzerUUID` an den Mitarbeitern pflegt; welche Aufgabentypen eingerichtet sind; ob PDS zugewiesene Benutzer bei API-Anlage selbst benachrichtigt (Handbuch 11.2 beschreibt die Benachrichtigung für die PDS-Oberfläche); ob eine Aktivitäten-API geplant ist; Freigabe von `/crm/*`-Schreibzugriffen für das echte PDS.


### MissionControl: Kennzahlen für Ziele (21.11.2026)

| Kennzahl | API-Pfad und Schema | View | Vorrang | Stand |
| --- | --- | --- | --- | --- |
| Offene Angebote | POST `/vorgang/listangebote` (`PdsAPIVorgangSucheRESTModel.statusUUIDs`) → `PdsAPIVorgangRESTModel` (ohne Datum); Alter über POST `/vorgang/details` → `PdsAPIVorgangDetailsRESTModel.belegDatum` | keiner | API | implementiert (`src/apps/missioncontrol/goals.ts`), Details höchstens 300 Angebote; Status über `/vorgang/liststatus` `ANGEBOT` |
| Überfällige Aufgaben | POST `/crm/listaufgaben` (`status`, `faelligkeitVor`) | keiner | API | implementiert |
| Aufträge ohne Termin | `/service/liststoerungen` (Service-Kontext) | keiner | API | implementiert |
| Wartungsquote | keine übergreifende Liste fälliger/erledigter Wartungsintervalle im API-Vertrag | – | – | nicht automatisch; manuelles Ziel |
| Fokuszeiten nach PDS | POST `/stundenerfassung/stundenverbuchen` übernimmt nur gesammelt je Mitarbeiter und Zeitraum | – | – | nicht angebunden; Fokuszeiten bleiben in heyelli |

Simulator: fiktive Angebote mit `belegDatum` in `database/seeds/pds-simulator/offers.json`; `/vorgang/listangebote` berücksichtigt `statusUUIDs`.
