# Kalender-Fortsetzungen ohne zusätzliche Aufträge

Stand: 04.11.2026. Implementiert im lokalen Simulator. Gewünschte Verteilung: Restdauer auf die nächsten Arbeitszeiten übertragen.

## Bedienung und Planungsverhalten

Beim Anlegen sowie beim zeitlichen Verschieben/Verlängern eines normalen Kalendertermins prüft HeyElli, ob die gewählte Dauer weitere Arbeitstage benötigt. Vor einem Schreibzugriff erscheint eine Vorschau aller vorgeschlagenen Zeitfenster und Ressourcen:

- Weiter bearbeiten: keine Änderung speichern.
- Zusammenhängend speichern: bisherigen Zeitraum verwenden; die bisherigen Planungswarnungen gelten weiter.
- Auf Arbeitstage verteilen: ursprünglichen Termin auf das erste Fenster begrenzen bzw. dort neu anlegen und zusätzliche Kalendertermine für die restlichen Fenster erstellen.

Die ausgewählte Termindauer in Minuten bleibt als Summe der Arbeitszeitfenster erhalten. Pausen zählen dabei nicht als Arbeit und erhalten keinen Termin; deshalb können auch zwei Einträge am selben Tag entstehen. Danach folgen weitere Arbeitstage. Bei mehreren Technikern wird die Schnittmenge ihrer Arbeitszeitfenster verwendet. Feiertage, Wochenenden und bestätigte Abwesenheiten werden ausgespart; normale konkurrierende Einsätze werden weiterhin über Planungswarnungen gemeldet, nicht automatisch verdrängt.

Die Vorschau betrachtet maximal 62 Kalendertage und 120 Teile. Jeder Eintrag hat mindestens 15 Minuten. Fehlende Arbeitszeiten, unklarer Urlaubsgenehmigungsstatus oder unzureichende gemeinsame Zeiten erzeugen keine geratenen Folgetermine. Ganztägige Termine, Urlaub und Abwesenheiten werden nicht automatisch aufgeteilt. Reine Text-/Rollenänderungen ohne Zeitänderung verteilen einen bestehenden Termin nicht neu. Bereits gespeicherte Folgetermine bleiben eigenständige Termine; es gibt keine automatische Kaskadenänderung oder -löschung einer ganzen Gruppe.

## Dokumentierte API und konkrete Grenze

`POST /termin/create`, `PdsAPITerminAnlegenRESTModel`, erlaubt die Typen FREIER, VORGANG, PROJEKT, ABWESENHEIT, PRIVATE_ABWESENHEIT. Auftrag, Angebot usw. können als VORGANG-Termine über die vorhandene `vorgangUUID` und den erlaubten `vorgangtyp` verknüpft werden. Projektakten verwenden `projektUUID`. Es werden ausschließlich Kalendertermine erzeugt; keine Auftrag-/Projekt-/Serviceanlage-Endpunkte aufgerufen.

Für Serviceeinsätze erlaubt dieses Create-DTO weder den Typ SERVICEAUFTRAGEBENE noch SERVICEAUFTRAG als `vorgangtyp`. Eine Störungsebene kann ebenfalls nicht als eigene Referenz übergeben werden. `/service/findstoerungtermin` liefert einen einzelnen Termin, und `/service/updatestoerung` aktualisiert die existierende Ebene. Es gibt in der bereitgestellten Spezifikation keinen nachgewiesenen Endpunkt zum Anlegen weiterer nativer Störungstermine an derselben Ebene.

Daher ist im **Simulator ausdrücklich** folgende Ergänzung aktiviert: Der vorhandene native Serviceeinsatz bleibt das erste Zeitfenster an derselben Ebene. Weitere Zeitfenster werden mit dem dokumentierten `/termin/create` als **FREIER** angelegt. Die HeyElli-Zuordnung verweist auf den bestehenden Serviceauftrag und dieselbe Störungsebene. Die Vorschau erklärt diese Einschränkung vor Bestätigung. Die generische Fortsetzungsimplementierung gibt diesen Serviceweg standardmäßig nicht frei (`allowServiceFreeContinuations=false`); nur der Simulator-Einstieg aktiviert ihn ausdrücklich. Kein erfundener PDS-Endpunkt, kein Datenbankschreibzugriff als Ersatz für fehlende API-Felder.

Die Referenz liegt als strukturierter Block `[HeyElli-Fortsetzung]` im dokumentierten Termin-Textfeld. Darin stehen Operation, Prüfsummen, Teilindex, Quellreferenz sowie bei Servicekopien vorhandene Service-/Ebenen-UUID und Haupttechniker. Dies sind HeyElli-Metadaten, keine nativen PDS-Felder. HeyElli zeigt den beschreibenden Text ohne den Metadatenblock an; in PDS bzw. Roh-Exporten kann der Block sichtbar sein. Er darf extern nicht entfernt werden, wenn die Zuordnung erhalten bleiben soll. Native Termin-DTOs enthalten weiterhin keine zusätzlichen erfundenen Felder.

Beim Lesen prüft HeyElli Service- und Ebenenreferenz über `/service/details` und stellt Statusfarbe, Vertragsleistungsvariante und H/B-Rollen entsprechend dar. Die native PDS-Mobilitätszuweisung gehört weiterhin zum ursprünglichen Serviceeinsatz. Eine zusätzliche freie Fortsetzung besitzt nur eine HeyElli-Rollenzuordnung; sie verspricht keine zusätzliche native mobile Ausgabe. Änderungen an Haupt-/Begleittechnikern oder Zeiten einer solchen Kopie erfolgen ausschließlich per `/termin/update` plus Aktualisierung des Textverweises und verschieben den ursprünglichen Serviceeinsatz nicht mit.

## Speicherung und Wiederholung

Die Vorschau ist serverseitig und lesend. Die bestätigte Auswahl wird mit Operation-UUID und Vorschau-Prüfsumme erneut geprüft. Geänderte Zeitfenster verlangen erneut Bestätigung. Alle Texte einschließlich Referenz müssen vor dem ersten Schreibzugriff in die vorhandene 4000-Zeichen-Grenze passen.

Erst danach werden Kalenderänderungen seriell ausgeführt. Ein vorhandener Ausgangstermin wird mit dem bestehenden Updateablauf angepasst. Für jede Neuanlage gibt es im Simulator einen eigenen idempotenten Workflowteil. Referenzblöcke erlauben das Wiederfinden bereits gespeicherter Teile. Nach einem Teilfehler meldet HeyElli die gespeicherte Anzahl; beim Wiederholen werden passende Teile wiederverwendet. In der Terminbearbeitung bietet „Fortsetzung erneut speichern“ dieselbe Anfrage erneut an. Bei Neuanlage bleiben Formular und Anlagekennung erhalten. Bereits extern veränderte Teile oder abweichende Prüfsummen werden nicht still überschrieben.

Es gibt keine globale PDS-Transaktion über mehrere Termine und keinen bestätigten nativen Idempotenz-Endpunkt. Die Simulator-Wiederholung ist geprüft; vor Echtnutzung sind Sichtbarkeit/Konsistenz der Listenantworten und Verhalten nach verlorenen API-Antworten zu bestätigen. Teilweise gespeicherte Termine werden nicht automatisch gelöscht.

## Nachtrag 19.11.2026 (Anwenderdokumentation v9)

S. 3551: PDS teilt Serviceaufträge bei Überschreitung der Arbeitszeit nicht automatisch auf. S. 3549: Serviceaufträge und Störungen können nicht Teil einer Terminserie sein. Fortsetzungen für Serviceeinsätze sind damit eine HeyElli-Erweiterung ohne Gegenstück in PDS; die Fragen unten bleiben offen. „Auf Arbeitstage verteilen“ entspricht der PDS-Variante „An Arbeitszeit anpassen und Dauer beibehalten“ (S. 3552). Abgleich mit den PDS-Handbüchern vom November 2026: [handbuch-abgleich-2026-11.md](handbuch-abgleich-2026-11.md).

## Offene Fragen an PDS

1. Welcher dokumentierte Endpunkt legt einen weiteren nativen Termin an derselben SERVICEAUFTRAGEBENE an, ohne einen neuen Serviceauftrag oder eine neue Störungsebene zu erzeugen?
2. Gibt es dafür eine zusätzliche Terminart/-Referenz im Create-DTO oder einen Mehrfach-/Serien-Endpunkt?
3. Wie werden Haupt-/Begleittechniker und Mobilitätsausgabe je zusätzlichem Einsatz gesetzt, und wie liefert `findstoerungtermin` mehrere Termine zurück?
4. Welche Idempotenz-/Transaktionsgarantien gelten bei mehreren Terminen und verlorenen Antworten?

Bis zur Klärung ist die native PDS-Serviceverknüpfung zusätzlicher Einsätze offen. Eine View kann diese fehlenden Schreibfelder nicht ersetzen. Eine echte Anbindung darf die Simulatorergänzung nicht unbesehen übernehmen.
