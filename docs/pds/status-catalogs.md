# Statuskataloge: API-Anbindung und belegter PDS-Standard

Stand: 03.11.2026. Grundlage: bereitgestellte OpenAPI, Haupthandbuch v126 (2072 Seiten), Administration v375 (800 Seiten), Ressourcenplanung v69 (46 Seiten), Screenshot der Service-Statusfarben vom 03.11.2026. Keine echten PDS-Aufrufe und keine Produktivdatenimporte.

## Ergebnis der Dokumentationsprüfung

Eine **vollständige, versionsübergreifend verbindliche Liste aller ausgelieferten Vorgangsstatus je Vorgangsart ist in diesen Quellen nicht nachgewiesen**. Die OpenAPI definiert beim Status kein festes Enum, sondern UUID, optionale Bezeichnung und Kategorie. Deshalb kann keine seriöse 100-Prozent-Garantie für sämtliche PDS-Auslieferungsstatus gegeben werden. Die API-Kataloge der konkret angebundenen PDS-Installation bleiben maßgeblich.

Belegt ist:

- Haupthandbuch S. 327–328, Kapitel 5.5.36 „Vorgangsstatus“: eigene Status sind zusätzlich zu vorhandenen Status möglich und werden Vorgangsarten zugeordnet. Die bisherigen Status bleiben bestehen und können nicht geändert oder gelöscht werden; automatische Änderungen verwenden laut Beschreibung weiterhin Standardstatus.
- Haupthandbuch S. 281: Im Auslieferungszustand erhält ein Angebot beim Wandeln in einen Auftrag den Status **Beauftragt**. Das Beispiel betrifft das Angebot, nicht ungeprüft den entstandenen Auftrag. Statusregeln können dieses Verhalten übersteuern. Die verkürzte Formulierung auf S. 328 ist daher nicht als vollständige Status-/Vorgangsartentabelle ausgelegt.
- Haupthandbuch S. 881–883: individuelle Status, Mandantenzuordnung und Statuskategorie. Das Bildschirmbeispiel zeigt Abgerechnet, Auftragspool, Ausgegeben, Ausgegeben Mobil, Bearbeitet und Beauftragt, aber keine vollständige Liste und keine vollständige Typzuordnung.
- Haupthandbuch S. 1424: für bestehende Serviceaufträge werden Offen, Ausgegeben, Mobil abgeholt, Ausgegeben Mobil, Auftragspool und Teilerledigt genannt. Keine Behauptung, dass diese Teilmenge bereits der komplette Katalog sei.
- Haupthandbuch S. 1443: bei Störungen sind zusätzlich Mobil storniert und Manuell storniert sowie die Prioritätsbildung des Serviceauftrags aus Störungszuständen beschrieben. Dies belegt keine frei editierbare Statusmaschine über die Kalender-API.
- Haupthandbuch S. 1536: Rücklauf-Ebenen verwenden Teilerledigt, Offen, Freigegeben und Abgerechnet. Ebenenstatus und vollständiger Rücklauf-Vorgangsstatuskatalog sind nicht gleichzusetzen.
- Administration S. 149–151: Farben werden je Vorgangsart und Status in der Terminverwaltung gepflegt. Keine festen UUIDs oder vollständige Standardkataloge.
- Administration S. 154: Eingangsrechnung nennt ausdrücklich Erledigt und Storno als Standardwerte dieser Workflow-Einstellungen. Für diese Vorgangsart existiert in der bereitgestellten OpenAPI jedoch kein passender Liststatus-Aufruf. Nicht über den eingeschränkten `/vorgang/liststatus`-Enum vortäuschen.
- Administration S. 199–201 und Haupthandbuch S. 1933–1934: Status für DATEV/Peppol sind konfigurationsabhängig und werden bei Aktivierung ggf. angelegt. Nicht als überall vorhandene Grundauslieferung einbauen.
- Ressourcenplanung S. 21: mobile Status Ausgegeben Mobil/Mobil abgeholt/Auftragspool und besondere Kennzeichnung. Keine Farbwerte im API-Vertrag.

## Simulatorabdeckung

Seed: `database/seeds/pds-simulator/status-catalogs.json`. Stabile fiktive UUIDs; keine UUIDs aus Produktivdaten. Die Herkunft steht je Eintrag unter `evidence`; dieses interne Belegfeld wird nicht als erfundenes API-Feld ausgegeben.

**Alle 13 Service-Einträge des bereitgestellten Screenshots sind vollständig enthalten:** Auftragspool, Ausgegeben, Ausgegeben Mobil, Erledigt, Geplant, Manuell storniert, Material ausstehend, Mobil abgeholt, Mobil storniert, Offen, Storniert, Teilerledigt, zur Löschung vorgesehen. Davon sind acht zusätzlich durch die oben genannten Handbuchstellen für Service/Störung belegt. Bei den übrigen fünf bestätigt der Screenshot die Existenz in der gezeigten Installation, aber nicht zweifelsfrei ihren Status als unveränderte PDS-Grundauslieferung.

Hinzu kommt ein ausdrücklich fiktiver individueller Service-Status „Demo: Rücksprache erforderlich“, der in keinem Kalendertermin verwendet wird. So ist überprüfbar, dass die Oberfläche den vollständigen Katalog abfragt und nicht vorhandene Termine als Statusquelle benutzt.

Die anderen API-Familien erhalten vollständige **simulierte** Listen, inklusive bisheriger Demo-UUIDs. Ergänzungen ohne eindeutigen Auslieferungsnachweis tragen `synthetic-demo-not-certified-standard`. Die Rücklauf-Einträge aus dem Ebenenbeispiel sind als solche gekennzeichnet. Diese Datensätze sind keine Behauptung einer vollständigen PDS-Standardinstallation. Beauftragt beim Angebot ist als dokumentiertes Standardbeispiel gesondert belegt. Für Aufmaß und Eingangsrechnung belegte Namen werden nicht einfach anderen API-Vorgangsarten zugeordnet.

Die Simulation bildet damit die belegten Service-Einträge und die dokumentierten Leseabläufe ab. Sie bildet keine vollständige PDS-Statusmaschine oder alle automatischen Folgezustände nach. Insbesondere leitet sie „Geplant“ nicht allein aus einem Kalendertermin als Auftragsstatus ab.

## API-Kataloge und Grenzen

| Familie | API |
| --- | --- |
| Serviceauftrag / Störung | GET `/service/liststatus` |
| Auftrag, Angebot, Bedarfsmeldung, Rechnung, Lieferschein, Bestellung, Wareneingang, Abrufauftrag, Gutschrift, Rücknahme | POST `/vorgang/liststatus`, jeweils `{vorgangstyp}` |
| Projektakte | GET `/projektakte/liststatus` |
| Rücklauf | GET `/ruecklauf/liststatus` |
| Zählliste | GET `/lager/listzaehllistenstatus` |

14 Familien, ohne Abhängigkeit von Zeitbereich, Terminen oder verwendeten Status. Rückgabe: `PdsAPIVorgangStatusRESTModel` (`uuid`, `dbid`, `bezeichnung`, `kategorie`; nur UUID ist Pflicht). Namen fehlen ggf. → UUID anzeigen. Leere Listen bleiben leer. Fehler oder doppelte/ungültige UUIDs führen zu einer sichtbaren Fehlermeldung, nie zu einem stillen View-Fallback.

Nicht von diesen Liststatus-Verträgen abgedeckt: **Preisanfrage, Rücklieferung, Aufmaß, Eingangsrechnung, Auftragsbestätigung, Wartungsauftrag, Wartungsangebot**. In der Vorgangsartauswahl sichtbar, aber als nicht API-abgedeckt deaktiviert. Für diese Familien einen unterstützten API-Weg bei PDS erfragen. Das Haupthandbuch S. 2022 nennt `pds_vorgang_status` und `pds_vorgang_status_kategorie` als Datenansichten; Spalten und Zuordnung zu Vorgangsarten sind hier nicht bestätigt. Erst nach API-Prüfung und Freigabe für diese Lücken verwenden. Keine Status-View für die bereits API-abgedeckten Familien nötig.

## Farbidentität und Bestandsübernahme

Neue Zuordnung: **Vorgangsart + Status-UUID → Farbe**. Name/Kategorie sind nur Anzeigeinformationen. UUIDs dürfen in verschiedenen Familien vorkommen und dort andere Farben erhalten. Der Katalog wird beim Öffnen der Farbeinstellungen frisch über API geladen. Umbenennen ändert die Anzeige, nicht die gespeicherte Zuordnung. Ein nicht mehr gelisteter Status bleibt mit UUID als verwaiste Zuordnung erhalten und wird nicht auf einen gleichnamigen neuen Status umgebogen.

Bisherige Namens- und ungebundene UUID-Regeln werden beim ersten Lesen mit aktuellem Katalog einmalig in passende Familien-/UUID-Zuordnungen überführt und in der bestehenden lokalen Farbdatei atomar gespeichert. Für bisherige globale Regeln bleibt ihre damalige Geltung erhalten: trifft ein Name mehrere Familien, erhalten diese jeweils eine UUID-Regel. Bereits explizite Familienregeln haben Vorrang. Nicht auflösbare Namens-/ungebundene Altregeln werden bei der Beschränkung auf die drei PDS-Bereiche entfernt. Gültige Vorgangsart-/UUID-Regeln bleiben erhalten. Die frühere fiktive Service-Offen-ID `sim-status-offen` wird auf die bereits für native Demoaufträge verwendete UUID `sim-open` vereinheitlicht.

Die automatische Bestandsübernahme aktualisiert die Farbdatei auch beim ersten Kalenderabruf. Der Versionsvergleich verhindert, dass ein parallel geöffnetes altes Formular den migrierten Stand überschreibt. Neue Statusregeln über die Oberfläche bzw. den Server benötigen Vorgangsart und UUID. Namen werden nicht mehr als neue Identität gespeichert. Bis zu 1000 eindeutige Farbregeln, maximal 512 KB Anfragegröße.

Farbpriorität ist ausschließlich Statusfarbe → Termin-Kategorien → Termin-Konfiguration. Ohne passende Regel gilt eine feste neutrale Darstellungsfarbe, keine zusätzliche konfigurierbare Farbregel. Originale PDS-Farbregeln würden innerhalb der jeweiligen Ebene vor HeyElli-Ergänzungen stehen; ungebundene alte Farb-View-Regeln werden dazu ebenfalls auf aktuelle Katalog-UUIDs aufgelöst. Farbwerte selbst sind **nicht** Teil der Statuslisten-API. Die lokalen HeyElli-Standardfarben sind keine zugesicherten PDS-Auslieferungsfarben.

## Nachtrag 19.11.2026 (Anwenderdokumentation v9)

S. 1431: Der Status eines Serviceauftrags ergibt sich aus der Störung mit dem niedrigsten Status (teilerledigt → Mobil storniert → Manuell storniert → offen → Ausgegeben Mobil → Mobil abgeholt → Ausgegeben → Erledigt). S. 2188: Statusfarben gibt es für 19 Vorgangsarten; die sieben ohne Liststatus-API sind Preisanfrage, Rücklieferung, Aufmaß, Eingangsrechnung, Auftragsbestätigung, Wartungsauftrag und Wartungsangebot. „Material ausstehend“ kommt im Handbuch nicht vor (kundenspezifisch). Abgleich mit den PDS-Handbüchern vom November 2026: [handbuch-abgleich-2026-11.md](handbuch-abgleich-2026-11.md).

## Noch erforderlich für eine garantierte 100-Prozent-Auslieferungsabbildung

Eine von PDS bestätigte versionsbezogene Liste aller ausgelieferten Status einschließlich Kategorie und Zuordnung zu sämtlichen Vorgangsarten; Abgrenzung konfigurierbarer/optionaler Mobil- und DATEV-Zustände; Bestätigung, welche gezeigten Servicefarben-Zustände durch `/service/liststatus` geliefert werden; unterstützte Statuskatalog-API für die sieben fehlenden Vorgangsarten oder freigegebene View-Spalten. Fiktive UUIDs müssen beim späteren Anschluss durch echte API-UUIDs ersetzt bzw. die Farbzuordnungen bewusst übernommen werden.
