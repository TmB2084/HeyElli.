# Browser-Schutz und Verletzungsmeldungen

Stand 13.11.2026. Lokale Entwicklung und ausdrücklich isolierte Prüfungen; keine Produktionsfreigabe.

## Durchgesetzte Richtlinie

`src/platform/http-safety/headers.ts` definiert die Quellenrichtlinie. Der Proxy erzeugt für jede Antwort eine kryptografisch zufällige 192-Bit-Nonce, ersetzt fremde `x-nonce`-/CSP-Eingaben und übergibt die Richtlinie auch intern an Next.js. Next versieht seine Render-/Startskripte mit dieser Nonce. HTML wird pro Anfrage erzeugt (`connection()` im Rootlayout); Cache Components und die bisherige partielle Vorabdarstellung sind abgeschaltet. Eine vorgerenderte Seitenschale kann keine anfragegebundene Nonce besitzen. Das erhöht den Renderaufwand; keine Last-/Kapazitätsfreigabe daraus ableiten (A06).

Durchgesetzt, nicht mehr nur beobachtet:

- `default-src 'none'`; Skripte mit `nonce` und `strict-dynamic`, keine pauschale Inline-Skriptfreigabe. Erlaubte Skripte dürfen weitere Skripte laden; ihre Vertrauensweitergabe ist Bestandteil von `strict-dynamic`, kein Schutz gegen beliebige Fehler innerhalb bereits vertrauenswürdigen Codes.
- `script-src-attr 'none'`: keine Inline-Ereignishandler. `frame-src`, `frame-ancestors`, `object-src` und `base-uri` jeweils `'none'`; Formulare ausschließlich zur eigenen Quelle.
- Eigene API-Verbindungen, eigene Fonts und Styles; Bilder zusätzlich aus `data:`/`blob:`, lokale Medien/Worker aus `blob:`. Keine direkten Browserfreigaben für Microsoft-, PDS-, BMACloud- oder Ollama-API-Adressen. Diese Anbindungen laufen serverseitig. Normale externe Links/Anmeldeweiterleitungen bleiben möglich.
- `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`; Kamera, Mikrofon, Geolocation, Payment und USB über Permissions Policy gesperrt.

Bewusste Ausnahmen: **Inline-Stile** bleiben wegen vorhandener dynamischer Kalender-/UI-Styles erlaubt. Ausschließlich in Entwicklung ist **`unsafe-eval`** für Next/React-Diagnostik erlaubt; WebSocket-Verbindungen sind auf localhost/127.0.0.1 begrenzt. Die gebaute Richtlinie enthält keine Eval-Freigabe. Lokales HTTP setzt weder HSTS noch `upgrade-insecure-requests`. Produktives TLS/HSTS und weitere Stilumstellung sind gesonderte Betreiber-/Entwicklungsaufgaben. Es wird keine vollständig ausnahmefreie CSP oder XSS-Freiheit behauptet.

Statische Ressourcen und API-Antworten erhalten ebenfalls Quellenbeschränkungen. Downloadhandler können zusätzlich eine Sandbox-CSP setzen; der Proxy ersetzt diese strengere API-CSP nicht. HTML mit Nonce darf nicht über einen vorgeschalteten Cache wiederverwendet werden. Next-Konfigurationsänderungen benötigen den regulären Entwicklungsstart, falls Next sie nicht selbst neu lädt; kein paralleler Start in denselben Bestand.

## Meldungen prüfen

**Einstellungen → Sicherheit → Browser-Schutz** zeigt höchstens 100 aktuelle Tagesgruppen: Regel, Quellenart, Appbereich, letzte Meldung, Durchsetzung/Beobachtung und Anzahl. Nur Administratoren dürfen sie lesen. Meldungen sind vom Client gelieferte Hinweise, **kein Nachweis eines Angriffs oder einer tatsächlichen Ausführung**. Bei unerwarteten Meldungen den Bedienweg und die Browserkonsole prüfen; nicht pauschal externe Quellen oder Inline-Skripte freigeben.

Der geschützte Empfänger `/api/sicherheit/csp` nimmt ausschließlich Meldungen mit gültiger Sitzung an. Keine öffentliche Telemetrieausnahme und kein anonymer Zugriff auf die Anwendung. Ein angemeldeter Benutzer kann nur Diagnostik unter seiner eigenen serverseitigen Identität schreiben; keine Benutzerkennung aus dem Bericht verwenden. Dokumentursprung und gegebenenfalls Origin-/Fetch-Site-Header müssen zur tatsächlichen Browseradresse passen. `localhost` und `127.0.0.1` werden anhand des validierten Host-Headers korrekt behandelt; ungeprüfte Forwarded-Header werden nicht benutzt.

Zwei Zustellwege:

1. Native CSP-Meldungen über `report-uri`; zusätzlich `report-to` und `Reporting-Endpoints` für unterstützende Browser. Der native Weg kann verzögert, deaktiviert oder im lokalen HTTP-Betrieb nicht verfügbar sein.
2. Ein begrenzter `securitypolicyviolation`-Listener nach der Hydrierung sendet mit eigener Sitzung. Er entfernt private Pfadteile, Query, Fragment und externe Adressen **vor** der Übertragung. Maximal zehn unterschiedliche Hinweise pro Dokument und Minute; identische Hinweise werden innerhalb dieses Fensters zusammengefasst. Keine lokale Warteschlange, kein automatischer Wiederholungssturm. Beide Zustellwege können dieselbe Verletzung melden: Anzahl bedeutet Meldungen, nicht eindeutige Angriffe.

Der Server akzeptiert Legacy-`application/csp-report` und moderne `application/reports+json`-Batches mit höchstens fünf Einträgen und 16 KiB Gesamtumfang. Er speichert ausschließlich erlaubte App-/Regel-/Quellenklassen, Durchsetzungstyp, Tageszähler und erste/letzte Zeit unter der geprüften Identität. Keine vollständigen URLs, Query-/Fragmentwerte, Codebeispiele, Originalrichtlinien/Nonces, IPs oder User Agents. Native Browser können solche Rohfelder an den Empfänger senden; sie werden verworfen, nicht protokolliert oder persistiert. Fehlerantworten spiegeln keine Nutzdaten zurück.

Transaktional durchgesetzte Budgets: höchstens 60 Meldungen je Konto und Minute, insgesamt 600 je Minute; parallele Einsendungen umgehen sie nicht. Tageszähler sind begrenzt. Diagnosewerte sind keine unbeschränkt gespeicherten Rohereignisse. Bei ungültiger Sitzung 401, fremdem Ursprung 403, unzulässigem Format 400/415, Übergröße 413, überschrittenem Budget 429. Empfangs-/Datenbankfehler ändern den Browser-Schutz nicht und geben keine Verbindungseinstellungen aus.

## Aufbewahrung und Prüfumfang

Migration 035 ergänzt ausschließlich `platform.browser_reports` und `platform.browser_report_budgets`. Diagnosegruppen bleiben als Sicherheitsmetadaten erhalten und werden nicht automatisch gelöscht. Eigene Gruppen sind im persönlichen Datenexport enthalten; sie gehören zu den geschützten Nachweisen, nicht zu den vier persönlich bereinigbaren Freitextklassen. Budgets sind technische, überschriebene Minutenstände, keine Fachhistorie. Gemeinsame Aufbewahrung siehe [Datenlebenszyklus](data-lifecycle.md); Fristen/organisatorische Freigaben durch Betreiber bestimmen.

Ohne gültige Sitzung keine zentrale Speicherung; sehr frühe Verstöße vor Start des Ereignislisteners, deaktiviertes JavaScript, Offlinezustand und blockierte/verzögerte native Meldungen können unerfasst bleiben. Fehlende Meldungen sind keine Garantie. Das lokale HTTP-Prüfverfahren beweist nicht die native Zustellung über produktives HTTPS oder das Verhalten aller Browser.

Isolierte Prüfungen: Modultests für Richtlinien/Datensparsamkeit; PostgreSQL-Prüfung für Aggregation, Parallelität, Berechtigungen und Budgets; HTTP für Nonce-Wechsel, überschriebenen fremden Nonce-Header, Zugriff, Ursprung und Grenzen. Zusätzliche temporäre Browserprobe mit erlaubtem Nonce-Skript, parserseitigem Skript ohne Nonce und Inline-Ereignishandler; diese Probe ist kein Teil der ausgelieferten Anwendung. Status und tatsächlich ausgeführte Nachweise im Auditbericht A05 (Prüfnachweis in der Git-Historie).

Technische Referenzen: installierte Next.js-Anleitung `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, [W3C CSP Level 3](https://www.w3.org/TR/CSP3/), [Chrome Reporting API](https://developer.chrome.com/docs/capabilities/web-apis/reporting-api). Plattformrichtlinie bleibt an die tatsächlich installierte Next-Version gebunden.

### Gleichursprüngliche Menüleisten-Werkzeuge

Ab 15.11.2026 ist `frame-src 'self'` für die mobile Werkzeugansicht erforderlich. Nur `/werkzeuge/casedesk` erhält `frame-ancestors 'self'` und `X-Frame-Options: SAMEORIGIN`, nach serverseitiger Sitzungs-, App- und Werkzeugprüfung. Alle anderen HTML-Antworten behalten `frame-ancestors 'none'` und `DENY`. Externe Ursprünge bleiben ausgeschlossen, Nonces bleiben anfragegebunden. Nachrichten zwischen Werkzeug und Leiste enthalten nur ein Schließsignal; der Empfänger prüft Ursprung und Fensterreferenz, es werden keine Daten- oder Schreibbefehle darüber entgegengenommen.
