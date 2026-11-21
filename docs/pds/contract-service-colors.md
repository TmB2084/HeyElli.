# Vertragsleistungsfilter und Störungsfarben

Stand: 03.11.2026. Maßgeblich ist die bereitgestellte OpenAPI. Umsetzung und Tests erfolgen ausschließlich mit dem lokalen PDS-Simulator und erfundenen Datensätzen, nicht mit produktivem PDS.

## Quellenprüfung und Zuordnung

- `/service/liststoerungen` akzeptiert im Suchschema `PdsAPIStoerungSucheRESTModel` den Filter `vertragsleistung` mit `KEIN`, `INTERVALL`, `WARTUNGSVORGANG`.
- Das Termindetails-Modell enthält kein Vertragsleistungsfeld. Die gefilterte Störungsliste enthält dagegen `serviceAuftrag.uuid` und `serviceAuftragEbene.uuid`; über `/service/details` und `/service/findstoerungtermin` ist die Verbindung zur Termin-UUID möglich.
- Haupthandbuch v126, S. 1439: Vertragsleistung wird an der Störung für Arbeiten beispielsweise im Wartungsrahmen gesetzt. S. 1458: Nach Entfernen eines Vertrags bleibt die Information zur früheren Vertragsleistung im Serviceauftrag/Rücklauf erhalten. Deshalb nicht allein aus einer aktuell vorhandenen `wartungsvertragUUID` oder dem technischen Objekt ableiten. Relevante Handbuchseiten vollständig gelesen, S. 1458 zusätzlich visuell gerendert geprüft.
- **Implementierte Zuordnung:** Treffer ausschließlich in KEIN → OHNE; Treffer in INTERVALL und/oder WARTUNGSVORGANG ohne gleichzeitigen KEIN-Treffer → MIT. Treffer sowohl in KEIN als auch einem positiven Filter oder überhaupt kein Treffer → UNBEKANNT. Überlappen die beiden positiven Filter, ist die Zweiteilung weiterhin eindeutig MIT.

Die Enumbezeichnungen und die Handbuchbeschreibung stützen diese Abbildung; eine ausdrückliche normative Erklärung aller drei Suchfilter und ihrer gegenseitigen Ausschließlichkeit fehlt in der OpenAPI. Die Umsetzung ist im Simulator vollständig geprüft. **Vor Echtnutzung an PDS bestätigen:** Entsprechen KEIN tatsächlich „ohne Vertragsleistung“ und INTERVALL/WARTUNGSVORGANG dem Farbzweig „mit Vertragsleistung“, einschließlich historischer/entfernter Verträge und manuell gesetztem Leistungsmerkmal? Sind die Filter erschöpfend und welche Rechte beschränken Ergebnisse? Ohne reale Prüfung keine Behauptung, dass diese Semantik gegen eine produktive PDS-Installation verifiziert wurde. Ein ignorierter Filter, der dieselben Störungen in allen drei Gruppen liefert, wird als widersprüchlich erkannt, nicht stillschweigend als OHNE behandelt.

## API-Ablauf

Nach dem vorhandenen Service-/Termin-/Rollenabgleich werden pro Kalenderlesen alle Seiten der drei gefilterten `/service/liststoerungen`-Abfragen gelesen. Kein unbestätigtes Suchfeld oder zusätzlicher Endpunkt. Zuordnungsschlüssel: **Serviceauftrags-UUID + Störungsebenen-UUID**, nicht Auftrag allein, Beschreibung, Teilnehmerreihenfolge oder Wrapper-UUID. So können Störungen desselben Serviceauftrags verschieden klassifiziert sein.

Es werden ausschließlich bereits aufgelöste Termine vom Typ `SERVICEAUFTRAGEBENE` angereichert. Nicht zuordenbare Störungstermine bleiben UNBEKANNT. Die Klassifikation ist ein HeyElli-Lesemodell, kein zusätzliches erfundenes PDS-Terminfeld. Fehler/fehlende Berechtigungen der API liefern einen sichtbaren Fehler; kein stiller View-Fallback und keine Umdeutung in OHNE. Paginierung prüft vollständige Seiten und plausible Gesamtanzahl. Alle Seiten werden berücksichtigt, auch wenn die relevante Störung erst nach Treffer 500 kommt.

Im aktuellen Adapter erfolgt diese zusätzliche Abfrage auch nach Terminänderungen, damit die zurückgegebenen Kalenderdaten konsistent sind. Drei globale, ggf. mehrseitige Listen können bei großen Installationen teuer sein. Eine spätere Optimierung braucht von PDS bestätigte Such-/Delta-Möglichkeiten oder einen mandanten-/berechtigungsbezogenen Cache. Keine ungeprüfte Einschränkung anhand des sichtbaren Termindatums, da der Suchvertrag keinen passenden Zeitraumfilter enthält.

## Simulator

`database/seeds/pds-simulator/service-contracts.json` ordnet die bestehenden fiktiven Störungen eindeutig zu: SIM-SA-10001 ohne, SIM-SA-10002 mit Intervall-/Vertragsbezug. Die zweite Störung ist bereits im PlanBoard geplant. Neue im vorhandenen Störungsmodul erzeugte Simulator-Störungen haben ohne zugeordnetes Intervall/Vertragsmerkmal den internen Standard KEIN.

Die Simulator-Suche wendet `vertragsleistung` und ggf. `stoerungStatusUUIDs` **vor** Paginierung an. Ohne Vertragsleistungsfilter bleibt die vollständige Liste erhalten. Ungültige Filter werden abgewiesen. Keine neue Datenbankstruktur/Migration. Bestehende Termine und Rollen bleiben unverändert.

Interne generische Simulator-Testentitäten vom Typ `service-contract` ermöglichen WARTUNGSVORGANG, historische Zuordnungen ohne aktuelle Referenz und unklare Fälle. Sie werden weder als zusätzliche API-Felder ausgegeben noch über einen erfundenen PDS-Schreibendpunkt angeboten. Das Feld wird in der Plattform nicht manuell gesetzt; es wird ausschließlich aus der API-Mitgliedschaft ermittelt. Die Simulator-interne Ableitung neu angelegter Datensätze ist kein Ersatz für die API-Auswertung der Plattform.

## Farben in HeyElli

Eigener Bereich **Kalenderfarben → Termintypfarben · Vertragsleistung** mit zwei direkt bearbeitbaren Farben:

- MIT: initial Hellblau `#99ccff`.
- OHNE: initial Hellgrün `#ccffcc`.

Das sind lokale HeyElli-Vorgaben entsprechend der Screenshotdarstellung, keine aus PDS gelesenen Originalfarben. Eigene Hexfarben werden als Regeln `{contractService:"MIT"|"OHNE",farbe}` zentral in der vorhandenen Farbdatei gespeichert. Bestehende Farbregeln werden nicht überschrieben. Auch bei älteren Konfigurationsdateien ohne diese neuen Regeln sind die beiden Vorgaben sichtbar und wirksam; eigene Anpassungen werden beim Speichern ergänzt. Das Entfernen einer eigenen Variantenregel stellt die Vorgabe wieder her.

**Präzisierte wirksame Hierarchie:**

1. Konkrete passende Auftrags-/Vorgangsstatusfarbe.
2. Passende Kategorie-Farbe.
3. Bei Störungen bekannte Vertragsleistungsvariante MIT/OHNE; sonst allgemeine Termintypfarbe.
Ohne passende Regel gilt eine feste neutrale Darstellungsfarbe. Eigenständige Terminstatus-, globale Standard- und Auftragsstatus-Auffangregeln sind mit der Beschränkung auf die drei PDS-Bereiche entfernt.

Damit bleiben **Auftragsstatus und Kategorie vor der Vertragsleistungsfarbe**. Die neutrale Darstellung blockiert keine konkret zugeordnete Kategorie- oder Typfarbe; dies präzisiert die frühere pauschale Aussage, unbekannte Auftragsstatus blieben immer neutral. Der Auftragsstatus wird dadurch nicht fachlich geändert. Die neue Differenzierung kann sichtbar werden, wenn keine konkrete Statusfarbe zutrifft; vorhandene Statusfarben wirken weiterhin vorrangig.

Bei UNBEKANNT wird niemals die OHNE-Farbe verwendet. Stattdessen allgemeine Störungsfarbe, falls konfiguriert, danach feste neutrale Darstellung. Termindetails und Balken-Tooltipp zeigen die ermittelte Vertragsleistungszuordnung. Grundtypen bleiben über die dokumentierten API-Typen identifiziert; MIT/OHNE sind keine neuen PDS-Typen. Allgemeine Termintypfarben sind im selben Bereich einstellbar.

## API-/View-Grenze und offene Punkte

Keine View für die Vertragsleistungszuordnung erforderlich, solange die dokumentierten Filter die tatsächlichen Fälle vollständig/korrekt liefern. Originale PDS-Farbwerte sind weiterhin nicht in Termin-/Störungs-/Kategorie-DTOs nachgewiesen: Farb-API bei PDS erfragen, andernfalls freigegebene **lesende** Farb-View. Keine Datenbankschreibzugriffe und kein unbemerkter View-Ersatz bei API-Fehlern. Reale Filtersemantik, Sichtbarkeitsrechte, historische Fälle und Nebenfarbregeln mit PDS bestätigen.
