# Microsoft-Anmeldung mit Entra ID

Stand: 08.11.2026. Das zusätzliche Modul ist standardmäßig deaktiviert. Die bisherige Anmeldung, der Graph-Mailmodus und die PDS-Quelle werden nicht umgeschaltet. Ausschließlich mit fiktiven Identitäten und lokalen signierten Testtokens geprüft; keine reale Entra-Anmeldung durchgeführt.

## Einrichtung in der Verwaltung

Unter **Microsoft-Anmeldung** stehen Verbindung, Prüfung & Freigabe und Anleitung bereit. Die Anleitung verwendet dieselbe Darstellung wie PDS und Microsoft Graph und ist über `GET /api/verwaltung/microsoft-anmeldung/anleitung` als Markdown herunterladbar. Die dortige Schrittfolge ist maßgeblich für Microsoft-365- und HeyElli-Admin.

Eine eigene Single-Tenant-Web-App in Entra registrieren. Exakte Rücksprungadresse: `https://<HeyElli-Host>/api/auth/microsoft/callback`; für lokale fiktive Tests ist `http://localhost:3000/api/auth/microsoft/callback` erlaubt. Nur `openid profile`, keine Mail-/Graph-Freigaben, keine Refresh-Tokens. Tenant-ID, Client-ID und Secret-Wert in der Verwaltung hinterlegen. Die Metadatenprüfung allein bestätigt weder Secret noch Benutzeranmeldung.

Microsoft-Benutzer unter **Benutzer & Zugriff → Benutzer freischalten** über Tenant-ID und Benutzer-Objekt-ID explizit provisionieren. Die stabile Kennung lautet `entra:<tenant-uuid>:<user-object-uuid>`. Bestehende AD-/Simulator-Konten werden nicht automatisch verknüpft. Anzeigenamen, E-Mail-Adressen und fremde Rollen-Claims dienen nicht der Autorisierung.

Den ersten Microsoft-Benutzer als aktiven HeyElli-Administrator provisionieren, anschließend einen echten interaktiven Anmeldetest mit diesem Konto ausführen. Im deaktivierten Modul ist nur der von einem bereits angemeldeten Administrator gestartete Test möglich; er erstellt keine HeyElli-Sitzung. Freigabe erfordert einen erfolgreichen Test derselben Konfiguration innerhalb von 24 Stunden sowie ein weiterhin aktives Microsoft-Administratorkonto. Erst danach erscheint der zusätzliche Anmeldeknopf.

## Zugriffsschutz und Speicherung

- Migration 019: Modulmetadaten und kurzlebige Anmeldeanfragen in PostgreSQL; Sitzungen mit Konfigurationsversion. Strukturänderungen erfolgen ausschließlich als neue Migration.
- Konfigurationsdatei `.env.microsoft-auth.ui.local`, Variable `MS_AUTH_ENCRYPTED_CONFIG`, ausschließlich serverseitig AES-256-GCM verschlüsselt, Modus 0600. Separater Schlüssel `.local/microsoft-auth-secrets/master.key` (0600, Verzeichnis 0700). Beide Dateien sind ausgeschlossen; unabhängig von PDS und Graph-Mail.
- Rücksprungadresse fest konfiguriert, keine offenen Weiterleitungen. Nur HTTPS, Ausnahme localhost für Entwicklung. Microsoft-Endpunkte sind fest an `login.microsoftonline.com` und den UUID-Tenant gebunden.
- Authorization Code Flow mit PKCE S256, zufälligem State und Nonce. Verschlüsseltes HttpOnly-/SameSite=Lax-Cookie für den Rücksprung; Secure bei HTTPS. Temporäre PKCE-Daten verbleiben im verschlüsselten Cookie, nicht im Datenbankklartext.
- Die Datenbank speichert State-/Cookie-Hashes mit zehn Minuten Ablauf und verbraucht die Anfrage vor dem Tokenaustausch genau einmal. Konfigurationswechsel/Deaktivierung sperren laufende Login-Anfragen. Ein paralleler zweiter Versuch im selben Browser ersetzt das temporäre Cookie; der erste muss neu gestartet werden.
- `jose` prüft RS256-Signatur gegen Microsoft-JWKS, Issuer, Ziel-App, Zeitgültigkeit, Nonce, Tenant, Version und Benutzer-Objekt-ID. ID-, Access- und Refresh-Tokens werden nicht persistiert. Providerfehler werden nicht durchgereicht.
- HeyElli-Rollen aus PostgreSQL; bestehender opaque Sitzungscookie und konfigurierbare Sitzungsdauer. Moduldeaktivierung, Konfigurationswechsel, Benutzerdeaktivierung, Rollenänderung oder Sitzungswiderruf entwerten den Zugang.
- Audit: Konfiguration, erfolgreicher Test und Freigabeänderungen, letzteres mit altem/neuem Wert, Benutzer und Zeitpunkt; keine Secrets oder Tokens.

Die Next-Entwicklungsprotokollierung ignoriert den Callback-Pfad, damit Codes nicht als URL geloggt werden. Vor einem produktiven Betrieb zusätzlich Reverse-Proxy-/Zugriffsprotokolle so konfigurieren, dass Callback-Querys nicht gespeichert werden. Verschlüsselte Konfiguration und zugehörigen Schlüssel getrennt und zugriffsgeschützt sichern. Ohne passenden Schlüssel ist die Konfiguration nicht wiederherstellbar.

## Betriebsgrenzen

Die Plattform blockiert derzeit weiterhin nicht freigegebene Produktivdatenbanken. Getrennte Infrastruktur und reale Mandantenabnahme sind gesonderte Schritte. MFA, Conditional Access, Benutzerzuweisung sowie Secret-Ablauf werden in Entra verwaltet. Entra-Deaktivierungen werden nicht laufend abgefragt: Eine HeyElli-Sitzung bleibt bis zum lokalen Ablauf/Widerruf gültig. Passende Sitzungsdauer und Widerrufsprozess festlegen. Abmeldung in HeyElli beendet nur die lokale Sitzung, nicht die Microsoft-Browsersitzung; der nächste Einstieg zeigt die Kontoauswahl.

**Konten und Verknüpfung:** Microsoft-Konten sind keine eigenen Identitäten mehr, sondern werden mit heyelli-Konten verknüpft: selbst im Benutzerkonto, über die vom Administrator hinterlegte Anmeldeadresse (UPN, einmalig bei der ersten Anmeldung) oder durch den Anmeldetest des Administrators. Nicht verknüpfte Microsoft-Konten werden abgewiesen. Einzelheiten: [heyelli-Konten](accounts.md).

**Ersetzt die eigene Anmeldung:** Mit der Aktivierung entfällt die Passwortanmeldung. Die Anmeldeseite zeigt nur noch „Mit Microsoft anmelden“, Passwortanmeldungen werden abgewiesen (Logzeile „durch Microsoft ersetzt“) und lokale Sitzungen sind gesperrt, solange die Microsoft-Anmeldung aktiv ist. Die Aktivierung setzt einen höchstens 24 Stunden alten Anmeldetest eines **verknüpften** Administrators voraus. Deaktivieren stellt die Passwortanmeldung als Rückweg wieder her.

Die aktive Microsoft-Anmeldung ist Voraussetzung für die Freigabe echter PDS-Lesedaten. Den PDS-Bearbeiter liefert die Zuordnung „PDS-Benutzer“ des Kontos.

## Validierung

`node --test src/system/anmeldung/microsoft/tests/microsoft-auth.test.mjs`: Tokenmanipulation, Claim-/Signaturprüfung, PKCE/Scopes, Konfigurationsvalidierung, Verschlüsselung und Rechte der Konfigurationsdatei. `npm run test:platform`: isolierte PostgreSQL-/HTTP-Tests, Migration/Seeds/Persistenz, Einmalverbrauch, Parallelität, unbekannte Konten, explizite Freigabe, Versionswechsel, Sitzungswiderruf, Administrator- und Same-Origin-Schutz. Der isolierte HTTP-Test durchläuft zusätzlich mit einem lokalen signierenden Anbieter Test → Freigabe → Anmeldung → persistierte Sitzung → Deaktivierung; echte Microsoft-Endpunkte werden dabei nicht aufgerufen. Kein echter Microsoft-Provider wird von den Tests kontaktiert.

## Microsoft-Verträge

- [Authorization Code Flow mit PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [ID-Token-Claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)

## Fehlgeschlagene Einrichtung und Ersatzangaben

Formal ungültige Angaben oder Fehler beim Metadatenabruf verändern keine bestehende Konfiguration. Neue formal gültige Ersatzangaben bleiben verschlüsselt in `.env.microsoft-auth.pending.local`; die bisherige `.env.microsoft-auth.ui.local` bleibt erhalten. Die Einrichtung ist kein Nachweis für die Gültigkeit des Secrets. Erst ein erfolgreicher vollständiger Administratortest übernimmt den Ersatz; der vorherige Stand bleibt zusätzlich verschlüsselt in `.env.microsoft-auth.previous.local`. Alle Dateien nutzen die bestehende ausgeschlossene Konfiguration und Dateirechte 0600.

Bei Fehlern können Administratoren über „Vorherige Zugangsdaten wiederherstellen“ den ungeprüften Ersatz verwerfen. Aktion und Identität werden protokolliert, Versionen und Berechtigungen serverseitig geprüft. Wiederherstellung deaktiviert das Modul und setzt Tests zurück. Unbekannte Providerdetails werden nicht weitergereicht; die Fehlerseite unterscheidet lokale Gründe für Zugangsdaten-, Verbindungs- und sonstige Antwortfehler. Kein automatischer Wechsel auf den früheren Stand und keine automatische Freigabe.
