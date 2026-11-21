# Browserregression und lokale Abnahme

Stand: 21. November 2026. Die vollständige isolierte Abnahme des Commits `fce1681a212926aa0a2bf08b7bd15261c9b8efd0` ist erfolgreich. Alle 115 Browserfälle bestehen ohne automatische Wiederholungen. Der maschinenlesbare [Prüfnachweis](browser-regression-2026-11-21.json) enthält Commit, Quelldigest, Laufzeiten und Ergebnisse.

## Ursachen und Korrekturen

Die ursprünglichen 19 Fehlschläge verteilen sich auf folgende Ursachen:

| Fälle | Anzahl | Korrektur |
| --- | ---: | --- |
| E01, E04, E29, E31 und E33 in beiden Browsern | 10 | Veraltete Erwartungen an `/service` auf den tatsächlichen Zielpfad `/servicehub` umgestellt; Navigation und Rücksprünge bleiben vollständig geprüft. |
| E02, E14 und E17 in beiden Browsern | 6 | Testrollen nach den Migrationen mit `/servicehub` und `/planboard` statt alten App-Kennungen anlegen. Lese- und Schreibrechte sowie 401/403-Abweisungen bleiben geprüft. In E14 verwenden parallele Schreibversuche außerdem die eigene Kontokennung statt der zuvor absichtlich fremden Kennung. |
| E28 in beiden Browsern | 2 | Die graue Zeilenschrift überschrieb die weiße Schrift der roten Kalenderkacheln in der Kundenakte. Die spezifische Farbregel stellt den Kontrast wieder her; Accessibility-Prüfung in Hell, Dunkel und schmaler Ansicht bleibt aktiv. |
| K01 in WebKit | 1 | Beim Tab-Wechsel aus dem nichtmodalen Menü kann Safari den Browserrahmen fokussieren, ohne `focusin` zu senden. Der gemeinsame Menübaustein schließt an der Grenze und führt zum nächsten Bedienelement. Umschalt+Tab und Escape führen zum Auslöser zurück. |

Zusätzlich ist die Gegenprüfung mit einem absichtlich fehlerhaften Navigationsziel auf den aktuellen PlanBoard-Pfad umgestellt. Fehlerhafte Schreibrechte werden weiterhin gezielt eingespeist und müssen erkannt werden.

## Weitere Befunde aus Zwischenläufen

In Zwischenläufen schlugen die WebKit-Fälle E18 und E32 zusätzlich fehl. Beide bestanden bei getrennter Wiederholung. E18 scheiterte im Gesamtlauf erneut am Aufklappzustand: Die Einsatzmappe steuert den Wechsel nun synchron über den Summary-Klick. Der Test öffnet eine bereits offene Mappe nicht versehentlich erneut und prüft ausdrücklich, dass sie nach Neuladen offen bleibt.

Der einzelne zusätzliche E32-Fehlschlag war nicht erneut reproduzierbar. Dafür wurde keine unbelegte Änderung an der Speicherlogik vorgenommen. Der abschließende vollständige Commit-Lauf prüft und besteht weiterhin die erneute Schlüsselanforderung, den Erhalt der Eingaben und exakt einen gespeicherten Termin mit dem geänderten Titel.

Der Browserreporter speichert bei Fehlern zusätzlich ausschließlich numerische Vergleichswerte. Ein Modultest prüft, dass Antwortinhalte, Fachtexte, URLs, Cookies und Geheimnisse daraus ausgeschlossen bleiben. Seine absichtlich erzeugten Diagnosefehler sind keine fehlgeschlagenen Browserfälle.

## Abschließender Prüfnachweis

Befehl:

```bash
npm run verify -- --commit fce1681a212926aa0a2bf08b7bd15261c9b8efd0 --report .local/verification/browser-fixes-commit-2026-11-21.json
```

Lauf: 21. November 2026, 22:47:03 bis 22:55:50 UTC. Node: `v24.11.1`.

| Prüfung | Ergebnis |
| --- | --- |
| Frische Quellkopie und Lockinstallation | bestanden |
| Modultests | 523 bestanden |
| Plattformtests mit getrennter PostgreSQL-Datenbank | 70 bestanden |
| Chat-Datenbanktest | 1 bestanden |
| Lint, Build und anschließende Typprüfung | bestanden |
| Chromium und WebKit | 115 bestanden, 0 fehlgeschlagen |
| Absichtlich falsches Navigationsziel und Schreibrecht | beide Fehler erkannt |
| Abhängigkeitsprüfung | 0 bekannte Schwachstellen |
| Bereinigung der drei Browser-Prüfbestände | Server beendet, eigene Datenbank und Volume entfernt, Quellkopie entfernt |

## Schutz und Geltungsbereich

Die Prüfung exportiert ausschließlich den bezeichneten Git-Commit. Lokale Umgebungsdateien, `.local/`, Abhängigkeiten und laufende Datenbestände werden nicht übernommen. Sie installiert die Abhängigkeiten frisch und erzeugt eigene Datenbanken, Volumes, Ports, Zugangsdaten und ausschließlich fiktive Datensätze. Entwicklungsdaten, vorhandene Zugangsdaten und offene Entwürfe sind kein Prüfziel. Echte Integrationen werden nicht freigegeben.

Die lokalen bereinigten Detailnachweise liegen unter `.local/verification/browser/`; fehlgeschlagene Zwischenläufe bleiben in den Dateien `browser-fixes-verify-2026-11-21.*` und `browser-fixes-final-2026-11-21.*` nachvollziehbar. Der erfolgreiche Commitnachweis liegt unter `browser-fixes-commit-2026-11-21.*`. Diese lokalen Artefakte und Protokolle werden nicht in Git übernommen.

Dies ist eine lokale Abnahme auf `codex/browser-regression-fixes`, keine ausgeführte GitHub- oder GitLab-Pipeline und kein Deployment. Geprüfter Codecommit und nachträglicher Dokumentationscommit werden getrennt geführt. Es wurden weder Merge noch Tag oder Release angelegt.
