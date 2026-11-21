# Servertestumgebung heyelli.elomech.de

> **Überholt seit 18.11.2026:** HeyElli läuft nicht mehr als systemd-Dienst mit `npm run dev`. Test (`heyelli-test.elomech.de`) und Produktion (`heyelli.elomech.de`) laufen als Container, siehe `docs/ci-deploy.md` und `docs/ablauf.md`. Dieses Dokument beschreibt den früheren Aufbau und bleibt nur zur Nachvollziehbarkeit erhalten.

Stand: 17.11.2026

## Einordnung

Mit der Servertestumgebung unter `https://heyelli.elomech.de` geht der bisherige Testmodus mit erfundenen Beispieldaten **schrittweise in einen Testmodus mit echten Testdatensätzen** über. Die Umgebung bleibt eine Testumgebung: HeyElli läuft weiterhin mit `npm run dev` (Entwicklungsmodus). Der Produktivmodus (`NODE_ENV=production`) ist im Code unverändert gesperrt.

- Lokale Entwicklung, Seeds (`database/seeds/`) und automatisierte Tests verwenden weiterhin ausschließlich erfundene Beispieldaten in getrennten Datenbanken.
- Echte Testdatensätze werden ausschließlich in der Servertestumgebung erfasst.
- Externe Anbindungen (PDS, Microsoft 365/Entra, Copilot, BMACloud, SharePoint) bleiben bis zur ausdrücklichen Freigabe im Simulator- bzw. Testbetrieb.

## Aufbau

| Komponente | Ort / Wert |
| --- | --- |
| Server | Debian 13, `10.100.11.79`, DNS `heyelli.elomech.de` |
| Anwendung | `/opt/heyelli`, Systembenutzer `heyelli`, systemd-Dienst `heyelli.service` |
| Web (intern) | Next.js-Entwicklungsserver ausschließlich auf `127.0.0.1:3000` |
| Web (extern) | nginx-TLS-Proxy auf Port 443 (`/etc/nginx/sites-available/heyelli.conf`), Port 80 leitet auf HTTPS um |
| Zertifikat | Wildcard `*.elomech.de` (Sectigo), `/etc/ssl/heyelli/` |
| Datenbank | PostgreSQL 17.6 per Docker Compose (`serviceplattform-db-1`), nur `127.0.0.1:5432` |
| Firewall | nftables, Regeln unter `/etc/nftables.d/` |
| Elli (lokale KI) | Ollama als systemd-Dienst `ollama.service` (Benutzer `ollama`, nur `127.0.0.1:11434`), Modell `qwen3:1.7b` in `/var/lib/ollama/models`, Programm unter `/opt/ollama` |

Ollama läuft als eigener Dienst. Das Programm liegt bewusst nicht im Suchpfad des Dienstes `heyelli` (Link nur in `/usr/local/sbin`). Sonst startet `scripts/local-assistant.mjs` bei kurzer Nichterreichbarkeit eine zweite Instanz als Benutzer `heyelli`: Sie belegt den Port und hat keine Modelle (Fehler 404 bei `/api/chat`, Meldung „Elli ist lokal gerade nicht erreichbar“).

HTTPS ist erforderlich: Die Oberfläche verwendet `crypto.randomUUID()`, das Browser nur in einem sicheren Kontext (HTTPS oder localhost) bereitstellen. Über unverschlüsseltes HTTP mit Hostnamen schlägt unter anderem das Laden des gesicherten Chats fehl.

## Proxy-Konfiguration der Anwendung

Gesetzt in `heyelli.service` bzw. `.env`:

| Variable | Wert | Zweck |
| --- | --- | --- |
| `HEYELLI_PUBLIC_ORIGIN` | `https://heyelli.elomech.de` | Öffentlicher Ursprung für Same-Origin-Prüfung (Anmeldung) und CSP-Meldeweg. Gilt nur, wenn der geprüfte `Host` exakt übereinstimmt; Weiterleitungs-Header werden nicht ausgewertet. |
| `HEYELLI_DEV_ORIGINS` | `heyelli.elomech.de` | `allowedDevOrigins` des Next-Entwicklungsservers, damit Skripte und HMR über den Hostnamen geladen werden. |
| `AUTH_LOGIN_SOURCE_HEADER` | `x-heyelli-client-ip` | nginx überschreibt den Header mit der echten Client-IP; direkter Zugriff auf Port 3000 ist durch die Bindung an `127.0.0.1` ausgeschlossen. |

## Betrieb

```bash
systemctl status heyelli nginx docker
journalctl -u heyelli -f                 # Anwendung
tail -f /var/log/nginx/heyelli.*.log     # Proxy
cd /opt/heyelli && docker compose logs db
```

Update:

```bash
cd /opt/heyelli && git pull
sudo -u heyelli npm ci
npm run db:migrate
systemctl restart heyelli
```

Nach `systemctl restart nftables` (enthält `flush ruleset`) zusätzlich `systemctl restart docker heyelli` ausführen, da sonst die Docker-Regeln fehlen.
