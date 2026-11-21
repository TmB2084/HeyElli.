# heyelli-Konten

Stand: 19.11.2026 (Migration `047_accounts.sql`). Ersetzt Demo-Anmeldung, Simulator-Anmeldung, eigenständige Microsoft-Identitäten, die Mitarbeiterzuordnung des DutyBoards und die Bearbeiterzuordnung im PDS-Panel.

## Grundsatz

Die **einzige Identität** ist das heyelli-Konto (`platform.users`). Ein Konto

1. meldet sich mit **Benutzername und Passwort** an, solange die Microsoft-Anmeldung (Entra ID) nicht aktiviert ist,
2. kann mit **genau einem Microsoft-Konto verknüpft** werden; nach Aktivierung der Microsoft-Anmeldung gilt nur noch diese,
3. ist für die aktive PDS-Quelle **einem PDS-Benutzer zugeordnet**; ohne Zuordnung keine Anmeldung (Administratoren ausgenommen).

Rollen und App-Rechte (Administrator, Disposition, Lesezugriff, eigene Rollen) bleiben unverändert und hängen am Konto.

## Fester Administrator

`npm run auth:admin` (Server: `heyelli-compose.sh <instanz> exec app node scripts/bootstrap-admin.mjs`) legt das Konto `admin` an, erzeugt ein zufälliges Startpasswort, speichert nur dessen Hash und gibt es **einmal** aus. Bei der ersten Anmeldung muss es geändert werden. Ist bereits ein Passwort gesetzt, verweigert der Befehl; ein neues Startpasswort nur mit `--neu`. Das Passwort erscheint nie in Code, Migration, Doku, Git oder Protokoll.

## Passwörter

- Hash: `scrypt` aus Node (N=32768, r=8, p=1, 16 Byte Salz, 64 Byte Schlüssel), Vergleich in konstanter Zeit; auch bei unbekanntem Benutzernamen wird gerechnet.
- Neue Passwörter: mindestens 12, höchstens 256 Zeichen, keine Steuerzeichen.
- **Startpasswort** (Administrator: beim Anlegen vorausgewählt oder Konto → „Startpasswort erzeugen“/„neu vergeben“): 24 zufällige Zeichen. Es erscheint **einmalig** im grünen Kasten unter „Passwort“ (mit Kopieren-Knopf) und bleibt sichtbar, bis ein anderes Konto geöffnet oder die Seite verlassen wird. Es wird weder gespeichert noch verschickt noch protokolliert; der Administrator übergibt es sicher (persönlich/telefonisch). Pflicht zur Änderung bei der ersten Anmeldung. Solange es nicht geändert ist, sind alle Seiten außer `/passwort-aendern` und alle APIs außer `POST /api/benutzerkonto/passwort` gesperrt (`requirePolicy`, geschütztes Layout).
- **Eigenes Passwort ändern**: Benutzerkonto → Anmeldung. Weitere Sitzungen des Kontos enden.
- Anmeldeversuche laufen über die bestehende Begrenzung je Benutzername und Quelle; abgelehnte Anmeldungen schreiben nur feste Gründe ins Log.

## Microsoft-Verknüpfung

- **Selbst verknüpfen**: Benutzerkonto → Anmeldung → „Mit Microsoft verknüpfen“ (Flow-Zweck `link`), sobald die Microsoft-Anmeldung eingerichtet ist, auch vor der Aktivierung.
- **Per Anmeldeadresse**: Der Administrator hinterlegt im Konto die Microsoft-Anmeldeadresse (UPN). Die erste Microsoft-Anmeldung mit genau dieser Adresse (`preferred_username`, Groß-/Kleinschreibung egal) verknüpft das Konto; danach gilt dauerhaft die Objekt-ID (`entra:<tenant>:<oid>`).
- Der **Anmeldetest** des Administrators verknüpft dessen Konto. Die Aktivierung verlangt einen höchstens 24 Stunden alten Test eines verknüpften Administrators; damit kann sich nach der Aktivierung mindestens ein Administrator anmelden.
- Nicht verknüpfte Microsoft-Konten werden abgewiesen; es werden keine Konten automatisch angelegt.
- Ein Microsoft-Konto gehört höchstens einem heyelli-Konto. Der Administrator kann Verknüpfungen lösen; bei aktiver Microsoft-Anmeldung bleibt mindestens ein verknüpfter Administrator erhalten.
- Nach Aktivierung ersetzt Microsoft die Passwortanmeldung: kein Passwortfeld, Passwortanmeldung wird abgewiesen, lokale Sitzungen sind gesperrt. Deaktivieren stellt die Passwortanmeldung als Rückweg wieder her.

## PDS-Benutzer

- Zuordnung je **PDS-Quelle** (`platform.pds_user_mappings`, Schlüssel Arbeitsbereich + Konto): Der Simulator hat den festen Arbeitsbereich `00000000-0000-4000-8000-000000000001`, jede echte PDS-Konfiguration ihren eigenen. Nach einem Quellenwechsel braucht jedes Konto eine Zuordnung in der neuen Quelle.
- Auswahl aus den Mitarbeitern der aktiven Quelle (Kalenderadapter: Simulator bzw. `/mitarbeiter/…`). Gespeichert wird die Mitarbeiter-UUID. **Offen:** PDS muss bestätigen, ob `bearbeiterUUID` die Mitarbeiter-UUID oder die `benutzerUUID` erwartet.
- Ein PDS-Benutzer gehört höchstens einem Konto. Offene Tauschwünsche sperren eine Änderung.
- Jede Anfrage verwendet die **aktuelle** Zuordnung; fehlt sie (Entfernen, Quellenwechsel), endet die Sitzung. Änderungen in der Benutzerverwaltung beenden die Sitzungen des Kontos.
- Administratoren dürfen sich ohne Zuordnung anmelden (Erstinstallation, Quellenwechsel); PDS-Schreibaktionen und Bereitschaftsfunktionen verlangen sie trotzdem (`assignBearbeiter`).
- Der DutyBoard liest die Mitarbeiter-Ressource eines Kontos aus derselben Zuordnung.

## Verwaltung

Einstellungen → Benutzer & Zugriff:

- **Konto anlegen** (ein Schritt, `action: create`): Anzeigename, Benutzername, Rolle, PDS-Benutzer, optional Microsoft-Anmeldeadresse und „Startpasswort erzeugen“. Der PDS-Benutzer wird vorab geprüft (vorhanden und frei), damit kein halb eingerichtetes Konto entsteht; belegte PDS-Benutzer sind in der Auswahl gekennzeichnet. Kennung `konto:<uuid>` wird serverseitig erzeugt. Bestehende Kennungen (`demo-ad:…`, `entra:…`, `local-service-user`) bleiben gültig.
- **Konto** (ein Formular, ein „Änderungen speichern“, `action: update`): Anzeigename, Benutzername, Microsoft-Anmeldeadresse, PDS-Benutzer, Rolle, aktiv; „Verwerfen“ setzt zurück, Verlassen mit ungespeicherten Eingaben fragt nach. Startpasswort und Verknüpfung lösen sind eigene Aktionen. Alle Änderungen sind versioniert und im Änderungsprotokoll (`user.password.reset`, `user.password.changed`, `user.pds.assigned`, `user.microsoft.linked`, `user.microsoft.unlinked`).
- Der letzte aktive Administrator bleibt geschützt.

## Übernahme bestehender Daten (Migration 047)

- Bestehende Konten bleiben samt Daten erhalten, haben aber zunächst keinen Benutzernamen und kein Passwort: Der Administrator vergibt beides im Konto.
- Frühere `entra:…`-Konten gelten als verknüpft.
- Die Mitarbeiterzuordnungen des DutyBoards werden zur PDS-Zuordnung der damals aktiven Quelle; die Tabelle `duty_employee_links` entfällt.
- Bisherige Demo-/Simulator-Sitzungen enden; einmal neu anmelden.

## Lokale Entwicklung

Der Seed legt die fiktiven Konten `alex` (Administrator), `kim` (Disposition) und `service` an, **ohne Passwörter**, mit PDS-Benutzern des Simulators. Passwörter vergibt der Administrator in der Oberfläche. Isolierte Prüfumgebungen setzen für `service` ein je Lauf zufälliges Passwort (`scripts/test-account.mjs`).
