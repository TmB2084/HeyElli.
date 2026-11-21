# MailDesk – geteiltes Service-Postfach

MailDesk (`/maildesk`, App-Version ab 26.1) zeigt ein geteiltes Postfach im Mail-Stil:
- **Seitenleiste** mit Ordnern, eigenen Ansichten, Kunden mit Mails und verwandten Apps
- **Liste** mit Kennzeichen
- **Lesebereich** mit Zuordnung und Kundenkontext aus PDS

MailDesk ordnet eingehende Mails Kunden zu. Gespeichert werden **nur Entscheidungen und Bearbeitungsstände**, keine Mailinhalte.

## Automatische Zuordnung

Die Regeln stehen in `src/apps/maildesk/matching.ts`. Sie werden der Reihe nach geprüft, die erste passende gewinnt.

| Rang | Hinweis | Ergebnis |
| --- | --- | --- |
| 1 | Eindeutiger Kostenträger im Betreff | zugeordnet (100) |
| 2 | Auftragsnummer im Betreff oder Text | zugeordnet mit Auftrag und Einheit (98) |
| 3 | Kundennummer | zugeordnet (95) |
| 4 | Eindeutiger Kostenträger im Text | zugeordnet (90) |
| 5 | Gemeinsamer Kostenträger (z. B. Rahmenvertrag) plus zweiter Hinweis | zugeordnet (92); Adresse oder Kundenname wiegen schwerer als der Absender |
| 6 | Bekannter (gelernter) Absender | zugeordnet (85) |
| 7 | Gemeinsamer Kostenträger ohne zweiten Hinweis | Vorschlag (70) |
| 8 | Objektadresse (Straße + Hausnummer) im Text | Vorschlag (82, bei mehreren Kunden 60) |
| 9 | Kundenname im Text | Vorschlag (60) |

Weitere Regeln:
- Nummern werden nur als ganze Kennung erkannt. Groß- und Kleinschreibung spielt keine Rolle.
- Fehlt das Objekt, ergänzt MailDesk es innerhalb des gefundenen Kunden über die Adresse im Text.
- Kunden außerhalb des PDS-Bestands werden nie vorgeschlagen.
- Ein Vorschlag erscheint unter „Vorschlag prüfen“ und muss mit „Übernehmen“ oder „Anderer Kunde …“ bestätigt werden.
- Nach einer bestätigten oder manuellen Zuordnung lernt MailDesk die Absenderadresse (`platform.maildesk_senders`).

Die Zuordnungsdaten liest MailDesk über Service (`serviceMatchContext` in `src/apps/servicehub/akten/match-context-server.ts`). Es sind dieselben lesenden PDS-Wege wie bei der Kostenträgersuche:
- `/service/liststoerungen`, `/person/listkunden`, `/objekt/listobjekte`, `/mitarbeiter/listmitarbeiter`
- `/administration/listkostentraeger`, `/administration/listkostenstelle`
- `/objekt/detailsbatch`, `/wartungsvertrag/listvertraegebyobjekt`

Die Daten werden je Datenquelle 5 Minuten im Speicher gehalten und nicht gespeichert.

## Einsatzmöglichkeiten

- **Störungen:** Mail mit Kostenträger → Kunde und Objekt → „Serviceauftrag anlegen“.
- **Rückläufe und Arbeitsnachweise:** Die Auftragsnummer im Betreff hängt die Mail an den Auftrag (Kennzeichen „Rücklauf“).
- **Terminantworten:** Kennzeichen „Termin“; die Antwort läuft über denselben Verlauf.
- **Angebotsanfragen:** Kennzeichen „Angebot“; Zuordnung über Adresse oder Absender.
- **Lieferanten und Rechnungen:** Kennzeichen „Lieferant“; bleiben ohne Kunden unter „Nicht zugeordnet“, bis jemand zuordnet oder archiviert.
- **Teamarbeit:** „Zuständig“ und „Mir zugewiesen“; Markierung und Archiv gelten für alle im Postfach.

## Serviceauftrag aus Mail

1. „Serviceauftrag anlegen“ öffnet `/casedesk?ausMail=<id>`. Der CaseDesk lädt die Vorlage über `/api/maildesk/vorlage` und füllt vor:
   - Objekt und Einheit
   - Beschreibung (bei „dringend“, „heute noch“ usw. mit „DRINGEND – “ vorangestellt)
   - Meldeweg „Per E-Mail“ mit der Mail als Textdokument
2. Nach dem Speichern wird die neue Auftragsnummer über `/api/maildesk/aktion` (`action: order`) mit der Mail verknüpft.
3. Der Server verknüpft nur Aufträge, die tatsächlich in PDS existieren. Kunde und Objekt übernimmt er aus dem Auftrag, nie aus der Eingabe.

Für bestehende Aufträge gibt es „Beim Kunden“ → „Mail anhängen“.

Neuanlagen sind wie im CaseDesk nur im Simulator freigegeben.

## Aufgabe aus Mail

„Aufgabe“ in der Werkzeugleiste öffnet den gemeinsamen Dialog der App Aufgaben (`src/apps/taskhub/create-dialog.tsx`). Vorbelegt sind Betreff (ohne AW/WG), Absender, Datum und Mailtext als Beschreibung sowie Kunde und Objekt aus Zuordnung oder Vorschlag. Die Aufgabe wird in PDS gespeichert (`/crm/createaufgabe`, nur Simulator freigegeben); der Mailtext landet als Beschreibung in der PDS-Aufgabe; heyelli speichert nur die Verknüpfung zur Mail (`platform.task_extras`). Sichtbar nur mit Schreibrecht in Aufgaben.

## Antworten

- Antworten laufen über die zentrale Mail-Warteschlange (`platform.mail_queue`). Dort gelten Testbetrieb, Absenderpostfach und Inhaltsbereinigung.
- Ist der Versand nicht freigegeben, wird die Antwort mit einem Hinweis abgewiesen.
- Kontingent: 30 Antworten je Person und Stunde, 300 insgesamt.
- Wiederholen mit derselben Anfragekennung legt kein Duplikat an.

## Postfachquelle

Die Quelle wird unter **Einstellungen → Integrationen → Microsoft Graph → MailDesk-Postfach** gewählt (nur Administratoren, versioniert, im Änderungsprotokoll `maildesk.settings.updated` / `maildesk.connection.checked`; Tabelle `platform.maildesk_settings`, Migration 050):

- **Beispielpostfach** (Standard): fiktive Mails aus `src/apps/maildesk/simulator-mailbox.ts`.
- **Microsoft 365 (geteiltes Postfach)**: Adresse eintragen, **Verbindung prüfen** (Anmeldung und Lesezugriff auf den Posteingang, ohne Inhalte zu lesen), dann speichern. Gespeichert werden kann Microsoft 365 nur, wenn die Prüfung für genau dieses Postfach in den letzten 24 Stunden erfolgreich war.

Voraussetzungen (IT): die zentrale Microsoft-365-App aus **Einstellungen → Microsoft Graph** mit der **Anwendungsberechtigung `Mail.Read`** (Administratorzustimmung) und eine Exchange-Zugriffsrichtlinie (`New-ApplicationAccessPolicy … -AccessRight RestrictAccess`), die die App auf genau dieses Postfach begrenzt.

MailDesk liest die 100 neuesten Mails des Posteingangs. Mailtexte werden als **Nur-Text** angefordert (`Prefer: outlook.body-content-type="text"`); HTML aus Mails wird nie dargestellt. MailDesk schreibt nie in Microsoft 365 (Archiv, Markierung, Gelesen-Status und Zuordnung bleiben in HeyElli). Der Graph-Anschluss ist implementiert, aber noch nicht gegen ein echtes Postfach geprüft.

## Rechte und Daten

- Lesen über `/api/maildesk` und `/api/maildesk/nachricht` erfordert Leserecht für MailDesk.
- Zuordnen, Zuständigkeit, Markieren, Archivieren und Antworten erfordern Schreibrecht für MailDesk (`/api/maildesk/aktion`, `/api/maildesk/antwort`; Same-Origin).
- Die Vorlage für den CaseDesk erfordert zusätzlich Schreibrecht im CaseDesk.
- Jede Änderung ist versioniert. Gleichzeitige Änderungen werden mit 409 abgewiesen, jede Änderung wird protokolliert (`audit_events`, `maildesk.*`).

Tabellen (Migration 049):
- `platform.maildesk_messages`: Entscheidung je Nachricht
- `platform.maildesk_senders`: gelernte Absender (externe Mailadressen, Geschäftsdaten)
- `platform.maildesk_replies`: Verweis auf die Warteschlange

Eigene Antworten und Entscheidungen sind Teil des persönlichen Datenexports.

## Bekannte Grenzen

- Der Gelesen-Status kommt aus dem Postfach und wird von HeyElli nicht geändert.
- Anhänge werden aufgelistet, aber nicht heruntergeladen.
- Ein Ordnerabgleich mit Exchange findet nicht statt; das Archiv gilt nur in HeyElli.
