# MissionControl

Planungs- und Fokus-App für den Innendienst (`/missioncontrol`). Die Aufgaben stammen aus der App Aufgaben (PDS-Aufgaben, im MailDesk zugewiesene Mails, Serviceaufträge ohne Termin). MissionControl speichert nur die persönliche Planung, Fokuszeiten und Notizen.

## Funktionen

| Bereich | Verhalten | Speicher |
| --- | --- | --- |
| Heute | Bis zu drei wichtige Aufgaben je Tag (Stern oder Ziehen auf ein freies Feld), darunter weitere Aufgaben mit „Planen“ | `platform.mission_plan` |
| Woche | Aufgaben per Ziehen oder „Planen“ auf Tage verteilen; Auslastungsbalken nach Schätzung (Standard 30 Minuten), am Wochenende beginnt die kommende Woche | `platform.mission_plan` |
| Fokus | Timer, Pause, +5 Minuten, Erledigt; höchstens ein laufender Fokus je Benutzer, Dauer serverseitig | `platform.mission_focus` |
| Schritte | Checkliste der PDS-Aufgabe (aus der App Aufgaben), im Fokus standardmäßig ausgeblendet (Taste S) | `platform.task_extras` |
| Notizen | Notizen zur Aufgabe mit Zeitstempel, standardmäßig ausgeblendet (Taste M); nur der Verfasser löscht | `platform.mission_notes` |
| Erledigt | Nur PDS-Aufgaben (`/crm/updateaufgabe`, Status `ERLEDIGT`), auf Wunsch mit Notizen in der PDS-Beschreibung; echtes PDS ist nur lesend freigegeben | PDS |

Rechte: Lesen von MissionControl und Aufgaben; Planen, Fokus und Notizen erfordern Schreibrecht in MissionControl, Erledigen zusätzlich Schreibrecht in Aufgaben und einen zugeordneten PDS-Benutzer.

## Outlook-Kalender (Microsoft Graph)

Persönlicher Schalter „Fokusblöcke in Outlook eintragen“ (standardmäßig aus, `platform.mission_settings`).

- **Eintragen:** Wird eine Aufgabe einem Tag zugeordnet, sucht MissionControl den nächsten freien Platz zwischen 8:00 und 17:00 Uhr (15-Minuten-Raster, Dauer = Schätzung oder 30 Minuten). Belegte Outlook-Termine, ganztägige Termine ausgenommen, und andere Fokusblöcke werden ausgelassen; am heutigen Tag frühestens ab jetzt. Es entsteht ein Termin „Fokus: …“ mit Kategorie `HeyElli`, Status „Beschäftigt“, ohne Erinnerung.
- **Abgleich:** Beim Öffnen liest MissionControl den Kalender des Planungszeitraums. In Outlook verschobene Fokusblöcke übernehmen Tag und Uhrzeit, in Outlook gelöschte werden als Hinweis am Plan gezeigt. Wird die Planung entfernt, wird der Block gelöscht. Ausschalten entfernt die künftigen eigenen Blöcke.
- **Gelesen** werden nur Beginn, Ende, Betreff, Belegt-Status und Kategorie im Planungszeitraum; private Termine erscheinen als „Privater Termin“. Es werden ausschließlich eigene Fokusblöcke geschrieben.
- **Postfach:** Das Microsoft-Konto aus der Benutzerverwaltung (`platform.users.microsoft_upn`). Fehlt es, erscheint ein Hinweis.
- **Ohne Microsoft-365-Verbindung** (lokale Entwicklung) zeigt MissionControl einen Beispielkalender mit fiktiven Terminen; es wird nichts geschrieben.
- **Testinstanz:** Mit `HEYELLI_EXTERN_SCHREIBEN=aus` werden keine Fokusblöcke eingetragen (Hinweis in der Kalenderkarte); Lesen bleibt möglich.

### Voraussetzungen für die IT

Die zentrale Microsoft-365-App (Einstellungen → Microsoft Graph) benötigt zusätzlich die **Anwendungsberechtigung `Calendars.ReadWrite`**. Sie gilt zunächst für alle Postfächer des Tenants und **muss per Exchange-Zugriffsrichtlinie (`New-ApplicationAccessPolicy` bzw. RBAC for Applications) auf die Postfächer der MissionControl-Benutzer begrenzt werden**. Ohne Berechtigung meldet MissionControl „Kalenderzugriff verweigert“; die Planung funktioniert weiter.

## Ziele und Wochenrückblick

Teamziele (für alle mit MissionControl-Lesezugriff sichtbar, Pflege mit Schreibrecht) mit Zeitraum, Zielwert, Richtung (höchstens = abbauen, mindestens = aufbauen), optionalem Ausgangswert und verantwortlicher Person. Der Wert wird beim Öffnen der Ziele berechnet und je Tag festgehalten (`platform.mission_goal_values`, Verlauf der letzten Wochen).

| Kennzahl | Quelle (OpenAPI) | Stand |
| --- | --- | --- |
| Aufträge ohne Termin | Service-Kontext aus `/service/liststoerungen` (Einsätze ohne Beginn, Auftrag nicht erledigt/storniert) | automatisch |
| Überfällige PDS-Aufgaben | POST `/crm/listaufgaben` mit `status` offen und `faelligkeitVor` = jetzt | automatisch |
| Offene Angebote | POST `/vorgang/listangebote` mit `statusUUIDs` (Status wählbar aus `/vorgang/liststatus` `ANGEBOT`); optional älter als N Tage über `belegDatum` aus POST `/vorgang/details` (höchstens 300 Angebote) | automatisch |
| Manueller Wert | wird im Ziel mit −1/+1 gepflegt, z. B. versendete Prüfberichte | manuell |
| Wartungsquote | **nicht automatisch**: Die API bietet keine Liste fälliger bzw. erledigter Wartungen über alle Objekte (nur je Objekt/Vertrag, `/wartungsvertrag/listvertraegebyobjekt`, Intervalldetails). Als manuelles Ziel abbildbar. | offen |

Fortschritt: Bei „höchstens“ 100 % ab Erreichen des Zielwerts, sonst anteilig vom Ausgangswert; bei „mindestens“ Wert durch Zielwert. Status: erreicht, im Plan (Fortschritt höchstens 10 Prozentpunkte hinter der verstrichenen Zeit), hinter Plan, verfehlt (Zeitraum abgelaufen).

Aufgaben lassen sich unter Heute einem Ziel zuordnen (`platform.mission_goal_items`, ein Ziel je Aufgabe). Daraus entstehen Fokuszeit je Ziel (Team) und der Anteil „Fokus auf Ziele“ im Rückblick.

Der **Wochenrückblick** zeigt Montag bis heute im Vergleich zur Vorwoche bis zum selben Wochentag: erledigte Aufgaben (über MissionControl erledigt, `platform.mission_done`; PDS liefert in der Aufgabenliste kein Erledigt-Datum), eigene Fokuszeit je Tag, Fokus auf Ziele, Fokuszeit im Team und Fokuszeit des Teams je Ziel.

## Bekannte Grenzen

- Fokuszeiten bleiben in heyelli. PDS übernimmt Zeiten laut OpenAPI nur gesammelt je Mitarbeiter und Zeitraum (`/stundenerfassung/stundenverbuchen`), keine Einzelbuchungen.
- Der Abgleich mit Outlook erfolgt beim Öffnen und Aktualisieren der App (alle zwei Minuten), nicht über Graph-Änderungsbenachrichtigungen.
