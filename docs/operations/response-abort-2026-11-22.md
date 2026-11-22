# Abgebrochene Antworten: Korrektur und Prüfnachweis

Stand: 22. November 2026. Der vollständige isolierte Lauf für Codecommit `21cc31a4664c2d3224ddb042d9bac1ae2803ae72` ist erfolgreich. Der [maschinenlesbare Nachweis](response-abort-2026-11-22.json) enthält Quelldigest, Laufzeiten und Ergebnisse.

## Ursache und Korrektur

Bei schnellen App-Wechseln wurden noch laufende Antworten abgebrochen. Die Zugriffsabsicherung stornierte den Antwort-Stream und gab anschließend dieselbe Antwort weiter. Die Überwachung verpackte diesen bereits verwendeten Stream erneut in eine `Response`. Das führte zu `Response body object should not be disturbed or locked`.

- Die Überwachung verändert ausschließlich veränderbare Header und übernimmt keinen Antwort-Stream mehr. Bei unveränderlichen Headern bleibt die ursprüngliche Antwort erhalten.
- Ein früher Abbruch verwirft den Stream und liefert eine frische leere Antwort. Während der Übertragung beendet das Abbruchsignal auch wartende Lesevorgänge. Aufnahmebelegungen werden genau einmal freigegeben, selbst wenn die Quellstornierung hängt.
- Abgebrochene Anfragen erzeugen keine falschen Ausfallmeldungen. Echte Serverfehler bleiben erfasst. Fachaktionen werden nicht wiederholt; Zugriffsschutz und Speicherlogik bleiben erhalten.
- Die Plattformversion steigt auf 26.51. Fach-App-Versionen ändern sich nicht.

## Tests und Ergebnis

```bash
npm run verify -- --commit 21cc31a4664c2d3224ddb042d9bac1ae2803ae72 --report .local/verification/response-abort-verify-final-2026-11-22.json
```

Lauf am 22. November 2026 von 02:00:22 bis 02:09:55 Uhr (Europe/Berlin), Node `v24.11.1`.

| Prüfung | Ergebnis |
| --- | --- |
| Frische Quellkopie und Lockinstallation | bestanden |
| Modultests | 542 bestanden |
| Plattformtests mit eigener PostgreSQL-Datenbank | 70 bestanden |
| Chat-Datenbanktest | 1 bestanden |
| Lint, Build und anschließende Typprüfung | bestanden |
| Chromium / WebKit | 58 / 57 bestanden; insgesamt 115 ohne Fehlschlag |
| Serverdiagnosen während Browserprüfung | 0 Fehler mit verwendetem/gesperrtem Antwort-Stream; 0 bereits geschlossene Stream-Controller |
| Absichtlich falsches Navigationsziel und Schreibrecht | beide Fehler erkannt |
| Abhängigkeitsprüfung | 0 bekannte Schwachstellen |
| Bereinigung aller drei Browser-Prüfbestände | eigene Server, Datenbanken, Volumes und Quellkopien entfernt |

19 zusätzliche Modultests prüfen Antwortbeobachtung, vorzeitigen Abbruch, wartende Übertragungen, hängende Stornierungen, genau einmalige Freigabe, echte Fehler sowie den Browser-Prüfprozess. Die registrierte HTTP-Prüfung verwendet echte Verbindungsabbrüche vor den Headern und während drei paralleler Übertragungen. Sie prüft freigegebene Belegungen, unveränderte Ausfallzähler, weiterhin erfasste echte Fehler und anonyme Abweisung.

Die Browserabnahme zählt jetzt zusätzlich feste Server-Fehlerklassen und schlägt bei deren Auftreten auch bei bedienbarer Oberfläche fehl. Sie speichert keine Rohprotokolle. Im ersten vollständigen Lauf mit Commit `6131c17` blockierte die neu angehängte Ausgabepipe, weil der synchrone Browseraufruf ihr Einlesen verhinderte. Der Prüfer wartet jetzt asynchron, liest weiter und beendet nur seine eigenen Prüfprozessgruppen. Zusätzliche Tests prüfen große parallele Ausgaben, Zeitüberschreitung und Abbruch. Der oben genannte erfolgreiche Lauf verwendet diese Korrektur; der erste Lauf gilt nicht als erfolgreiche Abnahme.

## Schutz und Grenzen

Der Lauf verwendet ausschließlich den exportierten Commit, eigene Datenbanken, Volumes, Ports, neu erzeugte Zugangsdaten und fiktive Datensätze. Vorhandene Umgebungsdateien, Geheimnisse, Entwürfe und lokale Datenbanken werden nicht in die Prüfung übernommen. Der Vergleich der vorhandenen Konfiguration und des Entwurfsschlüssels mit dem gesicherten Ausgangsstand ist unverändert. Es wurden keine Migrationen, Seeds oder Kontoeinrichtungen auf bestehenden Beständen ausgeführt und keine Integration freigegeben.

Details: [Betriebsüberwachung](monitoring.md#abgebrochene-anfragen-und-antwortdaten). Lokale Zwischenläufe liegen unter `.local/verification/response-abort-*`; diese Protokolle und Browserbilder werden nicht eingecheckt.

Dies ist eine lokale Abnahme auf `codex/aborted-response-fix`, keine ausgeführte GitHub- oder GitLab-Pipeline. Der nachträgliche Bericht wird getrennt vom geprüften Codecommit eingecheckt. Es wurden weder Push noch Merge, Tag, Release oder Deployment ausgeführt.

## Nachprüfung auf GitHub

Der erste [GitHub-Lauf 44970502934](https://github.com/TmB2084/HeyElli./actions/runs/44970502934) prüfte den PR-Mergecommit `30dc90ef9cd33109c184857b4bb9d563fd4041d7`. Installation, Modul-/Datenbanktests, Lint, Build und Typprüfung bestanden. Von 115 Browserfällen bestanden 114; E46 (WebKit, mobile Benutzerkonto-Suche) meldete einen Timeout in der zusammengefassten mobilen Navigationszeile. Beide Server-Streamfehlerzähler waren 0, die Prüfbestände wurden vollständig entfernt. Der Lauf war insgesamt fehlgeschlagen; Gegenprüfungen und Abhängigkeitsprüfung wurden danach nicht ausgeführt.

E46 prüft die mobile Navigation jetzt in fünf benannten Schritten. Der Test wartet ausdrücklich auf die Detailansicht, den mobilen Zurückmodus, die sichtbare Bereichsliste und den abgeschlossenen Fokuswechsel. Es gibt keine feste Wartezeit, keine automatische Wiederholung und keine gelockerte fachliche Erwartung. Der genaue ursprüngliche Teilschritt ist aus dem ersten, gröberen Nachweis nicht rekonstruierbar; eine zusätzliche numerische Spaltenangabe verbessert künftige Fehlernachweise ohne Fachinhalte oder Zugangsdaten. Der überarbeitete gezielte WebKit-Lauf und der ergänzte Reporter-Modultest bestehen lokal. Die vollständige erneute Abnahme wird getrennt erfasst.

Im zweiten [GitHub-Lauf 44972457016](https://github.com/TmB2084/HeyElli./actions/runs/44972457016) bestand E46; stattdessen meldete E28 in WebKit einen Timeout beim tastaturgesteuerten Öffnen der Kundenobjekte (Zeile 453, Spalte 267). Wieder bestanden die vorherigen sieben verify-Schritte, 114 Browserfälle und die Serverdiagnose ohne Streamfehler. Der zusätzliche lokale Gesamtlauf deckte außerdem einen zu breiten neuen E46-Selektor auf, der kurzzeitig eine versteckte Übergangsansicht miterfasste. Dieser selektiert jetzt nur die sichtbare Ansicht und wartet auf deren Eindeutigkeit. E28 richtet die Eingabetaste direkt an die Summary statt getrennt zu fokussieren und anschließend eine globale Taste zu senden; der offene Zustand und die erwarteten Objekte werden ausdrücklich geprüft. Der gezielte gemeinsame Lauf von E28/E46 besteht in beiden Browsern (vier Fälle). Diese Zwischenläufe sind keine vollständige erfolgreiche Freigabe.

Ein weiterer lokaler Komplettlauf (`33fd81c`) deckte in E51 einen tatsächlichen Eingabeverlust auf: Der initiale SharePoint-Ladeeffekt besaß keine Abbruchbehandlung. Eine verspätete erste Antwort im Entwicklungs-Strict-Mode konnte nach einer zweiten Antwort und einer Benutzereingabe deren Feldwert überschreiben. Der Effekt bricht nun bei Bereinigung ab und verwirft sowohl Ergebnisse als auch Fehlermeldungen abgebrochener Anfragen. Die Version der betroffenen Einstellungs-App steigt unabhängig auf 26.42.

E51 hält die erste echte Ladeantwort absichtlich zurück, bearbeitet nach der zweiten Antwort einen Feldwert und gibt die alte Antwort anschließend frei. Die bearbeitete Bezeichnung und die Speichermöglichkeit müssen erhalten bleiben. Dieser stärkere Test besteht isoliert in Chromium und WebKit. Eine zusätzliche frische Wegwerfkopie verwendet denselben Test mit dem alten SharePoint-Code aus `33fd81c`: Sie schlägt genau an der Prüfung des erhaltenen Feldwerts fehl. Die Gegenprüfung bestätigt damit den Defekt statt ihn durch längere Wartezeiten zu verdecken. Beide isolierten Bestände wurden bereinigt; bestehende Daten wurden nicht verwendet. Die vollständige erneute Abnahme und das tatsächliche GitHub-Ergebnis werden im Pull Request ergänzt.
