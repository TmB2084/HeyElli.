# Debian 13: Einrichtung der Entwicklungs-/Testumgebung

Stand 17.11.2026. Entwickelt wurde HeyElli auf macOS; diese Anleitung überträgt den Erststart aus der [README](../README.md) auf eine Debian-13-VM („trixie“).

> **Kein freigegebener Produktivbetrieb.** `npm start` startet Next.js im Produktionsmodus, in dem das Plattform-Datenbankmodul und die Demo-Anmeldung bewusst gesperrt sind (siehe README, Abschnitt „Qualität und Build“). Mit dieser Anleitung entsteht eine **Entwicklungs-/Testumgebung** (`npm run dev`) mit fiktiven Daten. Ein Produktionspfad (Prozessverwaltung, TLS, Backup-Betrieb, echte AD-Anbindung) muss gesondert festgelegt und freigegeben werden.
>
> Die Anleitung wurde aus den Repository-Dateien abgeleitet und **noch nicht auf einer Debian-13-VM durchgespielt**. Abweichungen bitte hier nachtragen.

## Technischer Stack

| Komponente | Version | Zweck |
|---|---|---|
| Node.js | **24.11.1 exakt** (`.node-version`) | Laufzeit; `node:sqlite` für PDS-Simulator und Backup |
| npm | mit Node 24 | `npm ci` anhand `package-lock.json` |
| Next.js / React / TypeScript | 16.4.6 / 19.3.0 / 5 | Anwendung (kommt per `npm ci`) |
| PostgreSQL | 17.x (`postgres:17.6-alpine`) | Plattformdatenbank, zur Laufzeit erforderlich |
| Docker Engine + Compose v2 | aktuell | startet PostgreSQL über `compose.yaml` |
| git, tar | Debian-Standard | Verifikation und Backup |
| Python 3 | Debian-Standard | nur `scripts/backup-extract.py` (Restore) |

Optional: Ollama (lokale KI „Elli“, Modell `qwen3:1.7b`), Playwright mit Chromium/WebKit (nur für `test:e2e`/`verify`), Reverse-Proxy mit TLS.

## 1. Systempakete

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg tar python3
```

## 2. Node.js 24.11.1

Das Debian-Paket `nodejs` ist zu alt. Die Version muss exakt `.node-version` entsprechen, sonst bricht `npm run verify` ab. Beispiel mit dem offiziellen Tarball:

```bash
NODE_VERSION=24.11.1
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
grep " node-v${NODE_VERSION}-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c -
sudo mkdir -p /opt/node && sudo tar -xJf "node-v${NODE_VERSION}-linux-x64.tar.xz" -C /opt/node
sudo ln -sfn "/opt/node/node-v${NODE_VERSION}-linux-x64/bin/"{node,npm,npx} /usr/local/bin/
node --version   # muss v24.11.1 ausgeben
```

(ARM-VM: `linux-arm64` statt `linux-x64`. Alternativ NodeSource oder nvm/fnm; entscheidend ist die exakte Version.) Für `xz` ggf. `sudo apt install -y xz-utils`.

## 3. Docker Engine und Compose-Plugin

Gemäß der offiziellen Docker-Anleitung für Debian (`docs.docker.com/engine/install/debian`) das Docker-Repository einrichten und installieren:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"   # danach neu anmelden
docker info
docker compose version
```

Beide Befehle müssen fehlerfrei laufen. Das Skript `scripts/setup-database.sh` nutzt auf macOS `brew`/`colima`; auf Debian **nicht verwenden**, sondern die Schritte aus Abschnitt 5 einzeln ausführen.

Der Datenbankport ist in `compose.yaml` an `127.0.0.1` gebunden und von außen nicht erreichbar. Das so belassen.

## 4. Projekt holen und konfigurieren

```bash
git clone https://gitlab.elomech-gruppe.de/webapps/heyelli.git
cd heyelli
node --version
npm ci
test -e .env || cp .env.example .env
```

Danach `.env` bearbeiten: `POSTGRES_PASSWORD` durch einen eigenen Wert ersetzen (der Platzhalter `local_example_password` ist nur ein Beispiel), `APP_ENV=development` belassen. `.env`, `.env.*.local` und `.local/` sind per `.gitignore` ausgeschlossen und dürfen **nie** ins Repository. Dateirechte: `chmod 600 .env`.

Keine `.env`-Dateien, Datenbanken oder `.local/`-Verzeichnisse von einem anderen Rechner (z. B. dem Mac) übernehmen.

## 5. Datenbank und Erststart

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run auth:admin
npm run dev
```

- `db:seed` legt ausdrücklich fiktive Benutzer und Beispieldaten an.
- `auth:admin` legt den Administrator `admin` an und gibt das Startpasswort einmal aus; es muss bei der ersten Anmeldung geändert werden ([heyelli-Konten](auth/accounts.md)).
- `npm run dev` startet Next.js und den Mail-Worker gemeinsam, standardmäßig nur auf `127.0.0.1:3000`.

Folgestarts: `npm run db:up` und `npm run dev`.

Zugriff von einem anderen Rechner: `npm run dev -- --lan` bindet auf `0.0.0.0`. Dann per Firewall oder Reverse-Proxy einschränken. Alternativ einen SSH-Tunnel verwenden:

```bash
ssh -L 3000:127.0.0.1:3000 <benutzer>@<vm>
```

## 6. Netzwerk-Freigaben (ausgehend)

| Ziel | Zweck |
|---|---|
| `registry-1.docker.io` | Image `postgres:17.6-alpine` (einmalig) |
| `registry.npmjs.org` | `npm ci` |
| `graph.microsoft.com`, `login.microsoftonline.com` | Microsoft 365 / Entra-Anmeldung (optional) |
| `*.directline.botframework.com` | Copilot Studio (optional) |
| PDS, BMACloud | Basis-URLs aus der Konfiguration in der Oberfläche |

## 7. Optional

**Ollama** (nur für lokalen Assistenten statt Copilot): Installation gemäß ollama.com, danach `npm run assistant:setup`. Bindet an `127.0.0.1:11434`.

**Tests** (`npm run verify`, `test:e2e`): zusätzlich Playwright-Browser und deren Systembibliotheken (`npx playwright install --with-deps`). `npm run test:assistive` läuft nur unter macOS und bricht auf Debian ab.

**Backup/Restore:** siehe [operations/backup-restore.md](operations/backup-restore.md). Docker-Volume `serviceplattform_postgres_data` nur mit `docker compose down` stoppen, nie mit `-v` (löscht alle Daten).

## 8. GitLab-CI

> **Überholt (19.11.2026):** Die Pipeline läuft auf dem zentralen Runner (Tag `docker`), siehe `docs/ci-deploy.md`. **Keinen eigenen Runner** mit Tag `heyelli-docker` anmelden. `npm run verify` läuft lokal beim Entwickler. Der folgende Abschnitt bleibt nur zur Nachvollziehbarkeit erhalten.

`.gitlab-ci.yml` führt `npm run verify -- --commit HEAD` aus (dieselben Stufen wie `.github/workflows/verify.yml`: Unit-, Plattform-, Chat-Tests, Lint, Build, Typecheck, Browser-Tests, `npm audit`). Anforderungen an den Runner:

- **Docker-Executor mit gemountetem Socket** (`/var/run/docker.sock`): `verify` startet PostgreSQL per Docker Compose und akzeptiert nur einen lokalen `unix://`-Socket. Docker-in-Docker über TCP wird abgelehnt.
- Der gemountete Socket entspricht Root-Rechten auf dem Runner-Host. Den Runner deshalb nur für dieses Projekt bzw. diese Gruppe freigeben.
- Der Job läuft als root (Playwright installiert Browser-Systembibliotheken selbst). Das Job-Image `node:24.11.1-trixie` muss zu `.node-version` passen und wird bei Änderungen der Node-Version mit angepasst.
- **`network_mode = "host"`** im Runner (`--docker-network-mode host`): PostgreSQL wird über den Host-Socket gestartet und nur an `127.0.0.1` des Hosts gebunden (`ports: "127.0.0.1::5432"`). Ohne Host-Netzwerk scheitert die Stufe `platform` mit `ECONNREFUSED 127.0.0.1:<Port>` (so geschehen im ersten Probelauf auf einem Runner ohne Host-Netzwerk).
- Der Job verlangt den Tag `heyelli-docker`; der Runner auf ELOMHWEB12 wird mit diesem Tag und ohne „Untagged-Jobs“ registriert.
- Pro Projekt läuft höchstens eine Freigabeprüfung gleichzeitig (`resource_group: heyelli-verification`), damit sich Lastprüfungen nicht gegenseitig verfälschen.
- Laufzeit bis ca. 45 Minuten. Berichte und Browser-Belege liegen 14 Tage als Job-Artefakte vor.

Historischer erster Probelauf auf einem vorhandenen Runner ohne Host-Netzwerk: `install` und `unit` bestanden, `platform` scheiterte wie oben beschrieben. Der zweite Lauf (Pipeline 128, Job 901) startete nicht: `stuck_pending_no_matching_runners` für `heyelli-docker`. Bei der Migrationsprüfung am 18.11.2026 lag noch kein grüner GitLab-Lauf vor. Aktuelle Ergebnisse: Migrationsbericht (Prüfnachweis in der Git-Historie). Ein wartender oder nicht gestarteter Job ist kein Prüfnachweis.

## 9. Bekannte offene Punkte

- Kein systemd-Dienst und keine Prozessverwaltung im Repository. `npm run dev` und der Mail-Worker laufen sonst nur im Vordergrund.
- Kein Reverse-Proxy/TLS im Repository. `AUTH_LOGIN_SOURCE_HEADER` ist für einen vorgeschalteten Proxy gedacht und darf nur gesetzt werden, wenn dieser den Header überschreibt und der direkte Zugriff gesperrt ist.
- `.github/workflows/verify.yml` ist unter GitLab wirkungslos und kann entfernt werden, sobald die GitLab-Pipeline grün läuft.
- Die README verwendet die GitLab-Clone-URL; die vollständige ursprüngliche Git-Historie wird mit dem dokumentierten Migrationszweig ergänzt. Beim Zusammenführen **nicht squashen**.
