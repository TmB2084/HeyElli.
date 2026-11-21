# CI/CD und Deployment (ELOMHWEB12)

HeyElli wird wie onboarding und die Meister Apps (ELOMHDOCKER01) ausgerollt: Der GitLab Runner baut das Image und legt es in
der Registry ab, der Server zieht nur fertige Images. Auf ELOMHWEB12 wird **nicht gebaut** und **kein Git benutzt**.
Die Pipeline steht in `.gitlab-ci.yml`, die Server-Vorlagen in `deploy/server/`.

> **Stand (19.11.2026):** Umstellung durchgeführt. Test (`heyelli-test.elomech.de`) und Prod (`heyelli.elomech.de`) laufen als Container,
> das erste Release `v1.0.0` ist am 18.11.2026 live gegangen. Der Abschnitt „Umstellung von systemd auf Container“ unten dokumentiert den damaligen Ablauf.

## Architektur

```
Entwickler (VDI)        GitLab 10.100.11.88                 ELOMHRUN01 10.100.11.89            ELOMHWEB12 10.100.11.79
  (Merge nach main -> Test automatisch; Release-Tag vX.Y.Z -> release_check -> deploy_prod, ohne Neubau)
  git push / MR  --->   Pipeline startet  ------------->    check_code, check_compose, npm_audit
                        Registry <---- docker push ------    build_image
                        (registry.elomech-gruppe.de)         deploy_test / deploy_prod
                                                               ssh gitlab-deploy@ELOMHWEB12 "<Kurz-Hash>"
                                                                     |  Forced Command je Schlüssel
                                                                     v
                                                             sudo /usr/local/sbin/heyelli-deploy.sh <test|prod> <Hash>
                                                               pg_dump -> Tag setzen -> Image ziehen -> Compose-Prüfung
                                                               -> up -d (db -> migrate -> app, Worker) -> HTTPS-Prüfung -> Rollback bei Fehler
```

Je Instanz ein Compose-Projekt mit diesen Diensten (`compose.server.yaml`):

| Dienst | Aufgabe | Netze |
|---|---|---|
| `db` | PostgreSQL 17.6 (Image mit fester Version), Volume `pgdata` | intern |
| `migrate` | einmalig: `node scripts/migrate-db.mjs` (database/migrations, Prüfsummen), vor der App | intern |
| `app` | `next start` (Produktions-Build), Port `127.0.0.1:${HEYELLI_PORT}` | intern, extern, ollama |
| `mail-worker` | Versand über Microsoft Graph (`scripts/mail-worker.mjs`) | intern, extern |
| `assistant-runtime` | `scripts/assistant-runtime.mjs` (prüft nur noch, ob Ollama erreichbar ist) | intern, ollama |
| `monitor` | `scripts/monitor.mjs --managed`, prüft `localhost:3000`, deshalb im Netz von `app` | wie `app` |

Netze: `intern` (internal, nur Dienste und Datenbank), `extern` (Ausgang für Microsoft 365 und PDS; nur `app` und
`mail-worker`), `ollama` (gemeinsames internes Netz zum Ollama-Dienst). Alle Dienste: `read_only`, `cap_drop: [ALL]`,
`no-new-privileges`, Logrotation 10 MB × 5.

| | Test | Produktion |
|---|---|---|
| Verzeichnis | `/opt/heyelli-test` | `/opt/heyelli-prod` |
| Compose-Projekt | `heyelli-test` | `heyelli-prod` |
| Port (nur 127.0.0.1) | 3001 | 3000 |
| URL | https://heyelli-test.elomech.de | https://heyelli.elomech.de |
| Bridges | `br-hey-test-int`, `br-hey-test-ext` | `br-hey-prod-int`, `br-hey-prod-ext` |
| Sicherungen | `/var/backups/heyelli-test` | `/var/backups/heyelli-prod` |
| GitLab-Umgebung | `test` | `production` |

Image: `registry.elomech-gruppe.de/webapps/heyelli/app:<Commit-Kurz-Hash>` und `:<Branch-Slug>`, kein `latest`.
Registry-Login auf dem Server: `DOCKER_CONFIG=/root/.docker-heyelli` (Deploy-Token mit `read_registry`).

`compose.yaml` im Repo bleibt die **lokale Entwicklungsdatenbank** (`npm run db:up`, `npm run verify`). Die Datei für den Betrieb
heißt `compose.server.yaml` und liegt auf dem Server als `/opt/heyelli-<instanz>/compose.yaml` (byte-identisch, das Deploy-Skript prüft den sha256).

## Wichtige Eigenschaften der Anwendung (Befunde der Analyse)

1. **Produktionsmodus war bisher gesperrt.** `databaseConfig` wirft bei `NODE_ENV=production`. Der Container setzt deshalb
   `HEYELLI_SERVER_BETRIEB=1` (im Image) und `APP_ENV=server` (in der `.env`). Ohne diese Freigabe verhält sich der Code wie bisher.
2. **Anmeldung (seit Migration 047):** heyelli-Konten mit Benutzername und Passwort (gehasht in PostgreSQL), bis die Microsoft-Anmeldung aktiviert ist; danach nur noch Microsoft.
   Keine Anmelde-Variablen in der `.env` (früher `AUTH_MODE`, `DEMO_DIRECTORY_*`, `HEYELLI_SIMULATOR_ANMELDUNG`; das Deploy-Skript meldet Reste nur als Hinweis). Erster Administrator: siehe „Anmeldung der Instanzen“.
3. **Elli** (lokaler Assistent) gab es nur im Entwicklungsmodus. Im Container mit `HEYELLI_ELLI_AKTIV=1` (in Test und Prod gesetzt).
4. **Zustand außerhalb der Datenbank:** `.local/*-secrets/master.key` (Master-Schlüssel), verschlüsselte Einstellungen `.env.*.local` im
   Arbeitsverzeichnis, `.local/auth`, `.local/heyelli`, `.local/pds-simulator`. Im Container: Volume `state` unter `/app/state`
   (`HEYELLI_SETTINGS_DIR`; enthält `.local/*-secrets` und die `.env.*.local`) und Volume `local` unter `/app/.local`.
   **Ohne die Master-Schlüssel sind die verschlüsselten PDS-, Graph- und Entwurfsdaten unbrauchbar.** Sie gehören verschlüsselt außerhalb der VM gesichert.
5. Es gibt **keinen Health-Endpunkt** (alles außer `/anmeldung` verlangt eine Sitzung). Die Prüfung nutzt `GET /anmeldung` (HTTP 200).

## Entscheidungen (18.11.2026, Tobi)

| Thema | Entscheidung |
|---|---|
| LDAPS | **Kein LDAPS** (aus HeyElli entfernt am 19.11.2026). Die Anmeldung wird auf Entra ID umgestellt; deren Aktivierung ersetzt die Simulator-/Demo-Anmeldung. |
| Anmeldung bis dahin | **heyelli-Konten mit eigenem Passwort** (seit 19.11.2026, Migration 047), fester Administrator `admin` per `bootstrap-admin.mjs`. Jedes Konto braucht einen PDS-Benutzer der aktiven Quelle. Die Aktivierung von Entra ID ersetzt die Passwortanmeldung. |
| Elli | **Aktiv in Test und Prod** (`HEYELLI_ELLI_AKTIV=1`). |
| Ollama | **Ein gemeinsamer Container-Stack** (`deploy/server/ollama/`, Netz `heyelli-ollama`) für beide Instanzen. Das Deploy-Skript prüft vor dem Start, dass Ollama im Netz erreichbar ist und ein Modell hat, und bricht sonst ab, ohne die laufende Instanz zu ändern. |
| VM-RAM | 12 GB (siehe "Ressourcen"). |

## Gesundheitsprüfungen der Dienste

Das Image bringt einen Healthcheck auf Port 3000 mit. Er passt nur zu `app` (und zu `monitor`, das im Netzwerk von `app` läuft). Die beiden Worker ohne Port haben eigene Prüfungen in `compose.server.yaml`
(Intervall 30 s, 3 Fehlversuche, 60 s Anlaufzeit):

| Dienst | Prüfung | Quelle des Herzschlags |
|---|---|---|
| `app` | TCP-Verbindung zu `127.0.0.1:3000` (Image-Healthcheck) | Port |
| `monitor` | wie `app` (gleiches Netzwerk) | Port von `app` |
| `mail-worker` | `node scripts/health-check.mjs mail-worker`: gesund, wenn `platform.mail_worker_health` `healthy` ist und `last_seen` jünger als 120 s | Der Worker schreibt die Zeile alle ca. 15 s (derselbe Wert, den die App als „bereit“ wertet) |
| `assistant-runtime` | `node scripts/health-check.mjs assistant-runtime`: gesund, wenn `/tmp/heyelli-assistant-runtime.heartbeat` jünger als 120 s | Die Schleife schreibt die Datei alle ca. 3 s (tmpfs, Code in `scripts/heartbeat.mjs`) |
| `db` | `pg_isready` | |

Ein Dienst wird bei „unhealthy“ nicht automatisch neu gestartet (Docker tut das nur bei Prozessende). Die Prüfung gibt nie Konfigurationswerte aus.

## Anmeldung der Instanzen: Administrator anlegen und Fehlersuche

Seit Migration 047 gibt es nur noch heyelli-Konten ([heyelli-Konten](auth/accounts.md)). Nach dem ersten Deploy mit Migration 047 legt die IT je Instanz einmal den festen Administrator an:

```bash
heyelli-compose.sh test exec app node scripts/bootstrap-admin.mjs     # bzw. prod
```

Die Ausgabe nennt Benutzername `admin` und ein Startpasswort, das nur dieses eine Mal angezeigt wird. Es sicher an den Entwickler übergeben; bei der ersten Anmeldung muss es geändert werden. Ein neues Startpasswort (z. B. vergessen) nur mit `--neu`. Danach legt der Administrator in der Oberfläche Konten an bzw. vergibt bestehenden Konten (frühere Demo-Benutzer, Daten bleiben erhalten) Benutzername und Startpasswort und ordnet jedem einen PDS-Benutzer zu.

**Fehlersuche:** Eine abgelehnte Anmeldung schreibt eine Zeile ins Log von `app` (`heyelli-compose.sh test logs --tail 50 app`), ohne Benutzername, Passwort, IP oder Fehlertext:
`Anmeldung abgelehnt: <Grund> (Modus <Modus>, HTTP <Status>)`. Mögliche Gründe: `durch Microsoft ersetzt` (Microsoft-Anmeldung aktiv), `falsches Passwort oder unbekannter Benutzer`, `Benutzer nicht freigeschaltet` (Konto deaktiviert), `PDS-Zuordnung fehlt` (dem Konto ist für die aktive Quelle kein PDS-Benutzer zugeordnet),
`Anmeldequelle oder Datenbank nicht erreichbar`, `Anmeldequelle (Header) fehlt oder ungültig` (nginx muss `x-heyelli-client-ip` setzen), `zu viele Versuche`, `ungültige Eingabe`, `unzulässiger Ursprung`
(Origin passt nicht zu `HEYELLI_PUBLIC_ORIGIN`).

## Ablauf der Pipeline

Der Ablauf für Menschen (Branch, Merge Request, Release, Rollback, rote Pipeline) steht in **`docs/ablauf.md`**. Hier die technische Sicht:

1. **Merge Request:** `check_code` (Lint, `next typegen` + `tsc`, Modultests ohne Datenbank), `check_compose`, `npm_audit`
   und `build_image` laufen. `deploy_test` steht als **manueller** Job bereit.
2. **Merge nach `main`:** `deploy_test` startet **automatisch** nach `build_image`. Auf `main` gibt es **kein** `deploy_prod` mehr.
3. **Produktion = Release (Tag `vX.Y.Z`):** Ein Entwickler legt in GitLab unter Deploy > Releases einen Tag `vX.Y.Z` (SemVer) auf einem Commit aus `main` an. Die Tag-Pipeline (nur für Tags, die zu
   `^v\d+\.\d+\.\d+$` passen; alle anderen Tags starten keine Pipeline) enthält **nur** `release_check`, `release_version` und `deploy_prod`. `check_code`, `check_compose`, `npm_audit`, `build_image` und `deploy_test`
   laufen dort nicht, es wird **nicht neu gebaut**. Prod bekommt das Image `app:<Kurz-Hash des Tag-Commits>`, das auf `main` gebaut wurde und auf der Testinstanz lief.
   - `release_check` (`deploy/ci/release-check.sh check`, Image `docker:cli` mit `bash git jq`): (1) Tag ist eine gültige SemVer-Version ohne führende Nullen; (2) der Tag-Commit ist in `origin/main` enthalten
     (`git merge-base --is-ancestor`); (3) das Image `$CI_REGISTRY_IMAGE/app:<Kurz-Hash>` existiert und sein Label `org.opencontainers.image.revision` ist genau der Tag-Commit und sein Label
     `de.elomech.heyelli.sha.compose` entspricht `compose.server.yaml` des Tag-Commits (gelesen mit `docker buildx imagetools inspect`, ohne das Image zu laden); (4) legt das Zusatz-Tag `app:vX.Y.Z` an
     (`docker buildx imagetools create`, ohne Neubau; ein vorhandenes Release-Tag wird nie überschrieben, wenn es zu einem anderen Commit gehört, bricht der Job ab). **Schlägt eine Prüfung fehl, gibt es keinen Prod-Deploy** (`deploy_prod` hat `needs: [release_check]`).
   - `release_version` (`... version`) ist nur ein Hinweis (`allow_failure` für Exit-Code 2): Er gibt die App-Versionen aus `app-releases.ts` aus und warnt, wenn sich seit dem vorherigen Release-Tag der Code
     (`src`, `database`), aber nicht `src/platform/shell/app-releases.ts` geändert hat. **Entscheidung:** Die Tag-Nummer (SemVer des Releases) und die App-Versionen (`JJ.V` je App, `platformRelease`) sind
     zwei verschiedene Schemata; sie werden deshalb **nicht** verglichen und ein Unterschied blockiert nie. Die Warnung erinnert nur an die Regel aus `AGENTS.md` (Versionsnummer bei jeder Änderung erhöhen).
   - `deploy_prod`: automatisch (`on_success`) nach `release_check`, nur wenn `DEPLOY_PROD_ENABLED == "true"`, Umgebung `production`, `resource_group`, gleiche SSH-Technik wie `deploy_test`, Aufruf mit `$CI_COMMIT_SHORT_SHA`.
4. `npm_audit` hat `allow_failure: true`: Ein neu gemeldeter Befund in einer Abhängigkeit soll die Auslieferung nicht blockieren, bleibt aber als
   Warnung sichtbar und ist zeitnah zu bewerten.
5. **Nicht in der Pipeline:** die Datenbank- und Browserprüfungen aus `npm run verify` (PostgreSQL per Docker, Playwright). Sie laufen weiter lokal
   beim Entwickler. Keinen eigenen Runner dafür anmelden; die Pipeline nutzt ausschließlich den zentralen Runner (Tag `docker`).

## CI/CD-Variablen (in GitLab anlegen, nicht im Repo)

| Variable | Typ | Umgebung | Geschützt | Inhalt |
|---|---|---|---|---|
| `DEPLOY_SSH_KEY` | **File** | `test` | nein | privater Schlüssel, Forced Command `heyelli-deploy.sh test` |
| `DEPLOY_SSH_KEY` | **File** | `production` | **ja** | privater Schlüssel, Forced Command `heyelli-deploy.sh prod` |
| `DEPLOY_KNOWN_HOSTS` | Variable | `test` und `production` | wie oben | `ssh-keyscan -t ed25519 10.100.11.79`, **nach** dem Neuerzeugen der Host-Keys |
| `DEPLOY_HOST` | Variable | `test` und `production` | wie oben | `10.100.11.79` |
| `DEPLOY_USER` | Variable | `test` und `production` | wie oben | `gitlab-deploy` |
| `DEPLOY_TEST_ENABLED` | Variable | ohne Begrenzung (`*`) | **nein** | `true` schaltet `deploy_test` frei |
| `DEPLOY_PROD_ENABLED` | Variable | ohne Begrenzung (`*`) | **nein** | `true` schaltet `deploy_prod` (nur in Release-Tag-Pipelines) frei |
| `DOCKER_BUILD_NETWORK` | Variable | optional | nein | Netz für `docker build` (z. B. wenn npm über einen Proxy läuft) |

Gleiche Regeln wie bei onboarding: gleicher Name, unterschiedlicher Wert je Umgebung; die `*_ENABLED`-Schalter dürfen weder geschützt noch
umgebungsbegrenzt sein; `main` muss ein geschützter Branch sein. Der Testschlüssel ist nicht geschützt (manueller Testjob aus Feature-Branches).
Der Produktionsschlüssel (und die übrigen `production`-Variablen) sind **geschützt**: Sie sind nur in Pipelines auf geschützten Refs sichtbar. Weil der Prod-Deploy jetzt in der **Tag-Pipeline** läuft,
müssen die Tags `v*` geschützt sein (siehe unten), sonst fehlt `DEPLOY_SSH_KEY` und `deploy_prod` schlägt fehl.

### GitLab-Einstellungen (einmalig, IT/Maintainer)

| Einstellung | Wert |
|---|---|
| Geschützter Branch `main` | Allowed to merge: **Developers + Maintainers**; Allowed to push and merge: **No one**; Force push aus |
| Geschützte Tags `v*` | Allowed to create: **Developers + Maintainers** (Entwickler legen Releases selbst an) |
| Merge Requests | „Pipelines must succeed“; mindestens eine Zustimmung (Vier-Augen-Prinzip), wenn möglich; kein Squash (Historie bleibt erhalten) |
| Auto DevOps | aus |
| Variablen | `DEPLOY_PROD_ENABLED=true` (sonst entsteht `deploy_prod` nicht und ein Release macht nichts außer der Prüfung) |
| Registry-Aufräumregel | Release-Tags `vX.Y.Z` behalten; Commit-Tags (8 Zeichen) frühestens nach 90 Tagen löschen (Rollback per Re-deploy braucht das Image mit der Commit-Kennung); Branch-Tags älter als 14 Tage löschen |

## Testinstanz: keine echten Wirkungen nach außen

| Variable (nur Test) | Wirkung |
|---|---|
| `HEYELLI_INSTANZ_HINWEIS=TESTINSTANZ` | Hinweisbalken auf jeder Seite (**Pflicht**, das Skript rollt sonst nicht aus) |
| `HEYELLI_MAIL_MODUS=aus` | Mail-Worker simuliert jede Mail (Status `simulated`), nichts geht raus |
| `HEYELLI_MAIL_MODUS=umleiten` + `HEYELLI_MAIL_UMLEITUNG=<Adresse>` | alle Mails nur an diese Adresse, Originalempfänger im Betreff und Text. Ungültige Werte schalten ab. |
| `HEYELLI_EXTERN_SCHREIBEN=aus` | keine schreibenden Zugriffe auf Microsoft Graph (SharePoint). Copilot wird nicht verwendet (jede Frage wäre ein POST an Microsoft): Elli antwortet über Ollama, der Copilot-Verbindungstest meldet die Sperre. Lesen und Anmeldung bleiben. |

Das Deploy-Skript verlangt diese drei Schutzmaßnahmen für `test`. Weitere Wirkungen nach außen: **PDS** ist im Programm schreibgeschützt
(`ReadonlyPdsTransport`), **Copilot/DirectLine** ist nicht gesperrt: In der Testinstanz Copilot in den Einstellungen deaktiviert lassen.
Die Testdatenbank startet leer (Migrationen) und bekommt **keine** Kopie der Produktionsdaten.

## Einmalige Einrichtung auf ELOMHWEB12 (Aufgabe der IT)

Reihenfolge siehe nächster Abschnitt. Dateien aus dem Repo:

```bash
install -m 0755 -o root -g root deploy/server/heyelli-deploy.sh  /usr/local/sbin/heyelli-deploy.sh
install -m 0755 -o root -g root deploy/server/heyelli-compose.sh /usr/local/sbin/heyelli-compose.sh
install -d -m 0755 /opt/heyelli-test /opt/heyelli-prod
install -m 0644 compose.server.yaml /opt/heyelli-test/compose.yaml     # aus dem auszurollenden Commit, ebenso für prod
cp deploy/server/env.server.example /opt/heyelli-test/.env             # anpassen; root:root, 600
chown root:root /opt/heyelli-test/.env && chmod 600 /opt/heyelli-test/.env
echo "HEYELLI_TAG=0000000" > /opt/heyelli-test/.env.tag && chmod 600 /opt/heyelli-test/.env.tag   # Platzhalter, kein gültiges Tag
```

Registry-Login: `DOCKER_CONFIG=/root/.docker-heyelli docker login registry.elomech-gruppe.de -u <Token-Name>` (Deploy-Token `read_registry`).
sudoers (nur mit `visudo -f /etc/sudoers.d/60-gitlab-deploy`): zusätzlich `heyelli-deploy.sh ^test [0-9a-f]{7\,40}$` und die Prod-Variante;
in `authorized_keys` je ein Schlüssel mit Forced Command `sudo /usr/local/sbin/heyelli-deploy.sh test|prod "$SSH_ORIGINAL_COMMAND"`.

Wenn sich `compose.server.yaml` im Repo ändert, muss die Datei **vor** dem Deploy auf dem Server ersetzt werden, sonst lehnt das Skript wegen der
Label-Prüfung ab.

### nftables (Ergänzung in eigener Datei, z. B. `/etc/nftables.d/60-heyelli.nft`)

Die Datenbank liegt im internen Netz und braucht keine Regel; auch Ollama braucht keine Hostregel, solange es als Container im Netz `heyelli-ollama` läuft.
Nur der Ausgang der Bridges `br-hey-*-ext` braucht Forward-Regeln, jeweils mit Datum und Grund im Kommentar:

- TCP 443 ins Internet/zu Microsoft (`login.microsoftonline.com`, `graph.microsoft.com`) für `app` und `mail-worker`,
- die PDS-API (Host und Port der PDS-Instanz klären; bis zur Aktivierung der Entra-Anmeldung bleibt der echte PDS-Zugang ungenutzt). TCP 636 (LDAPS) ist **nicht** nötig (Entscheidung 18.11.2026),
- DNS läuft über Dockers eingebauten Resolver und den Host (Output zu den DCs ist schon erlaubt).

**Achtung:** `/etc/nftables.conf` enthält `flush ruleset`. Vor dem ersten Neuladen auf `table inet filter` / `delete table inet filter` umstellen, sonst werden
Dockers Tabellen gelöscht. Neu laden nur mit `nft -c -f /etc/nftables.conf && nft -f /etc/nftables.conf`, nie `systemctl restart nftables`.
Die heutige Regel `20-docker.nft` (jeder Forward aus `br-*`) ist breiter als nötig und sollte durch stackbezogene Regeln ersetzt werden.

### Ollama (ein gemeinsamer Dienst)

**Ort auf ELOMHWEB12: `/opt/ollama-stack/`** (`compose.yaml` aus `deploy/server/ollama/compose.yaml`, `.env` mit `OLLAMA_VERSION=0.40.16`, 0600).
`/opt/ollama` ist **nicht** frei: Es ist ein Link auf die Installation des Host-Ollama (`/opt/ollama-v0.40.16`, `ollama.service`), dort nichts ablegen.
Start: `cd /opt/ollama-stack && docker compose -p ollama up -d` (Projekt `ollama`, Container `ollama-ollama-1`, Volume `ollama_models`).
Einstellungen: `OLLAMA_KEEP_ALIVE=5m` (das Modell wird nach 5 Minuten Leerlauf entladen und gibt den Speicher frei), Healthcheck
`OLLAMA_HOST=127.0.0.1:11434 ollama list` alle 30 s, `mem_limit` 3 GB, Netz `heyelli-ollama` (intern, Bridge `br-ollama`), kein veröffentlichter Port.
Modell `qwen3:1.7b` (genau dieser Name, so fragt es der Code an) aus `/var/lib/ollama/models` **lesend** in das Volume `models` kopieren (`cp -a` nach `/data/models`, Besitzer 10003)
oder im Container mit `ollama pull` laden (braucht dann kurz Internet; das Netz ist intern). Das Netz `heyelli-ollama` ist intern. Der Host-Ollama
(`ollama.service`) bleibt bis zur Abnahme bestehen und wird danach abgeschaltet. Alternative (nicht empfohlen): Host-Ollama an die Bridge-Adresse
binden und per nftables nur Port 11434 aus dem HeyElli-Netz erlauben; das braucht einen Neustart von Ollama und eine Hostabhängigkeit.

## Umstellung von systemd auf Container (durchgeführt am 18.11.2026)

**Phase A, ohne Ausfall (Vorbereitung):**
1. MR !3 (Originalhistorie, Tims Branch) mergen, danach den MR dieses Branches. Pipeline baut das Image (Tag = Kurz-Hash).
2. CI-Variablen setzen, Schlüssel und sudoers-Zeilen ergänzen, Skripte installieren, Registry-Login, DNS `heyelli-test.elomech.de`, nginx-Site der Testinstanz, nftables-Datei.
3. Ollama-Dienst starten und Modell einspielen. RAM prüfen (siehe Ressourcen).
4. Testinstanz einrichten (Verzeichnis, `.env` mit Testschutz und neuen Passwörtern, Platzhalter-Tag) und `deploy_test` auslösen. Prüfen: `https://heyelli-test.elomech.de/anmeldung`,
   Anmeldung (Demo-Benutzer, Übergang), Elli antwortet, Mail-Worker im Modus `aus`, `heyelli-compose.sh test ps`. Die Warnung zur Simulator-Anmeldung steht im Start-Log von `app`.

**Phase B, Wartungsfenster Produktion (geschätzt 20–40 Minuten Ausfall):**
1. Letzte Sicherung: `pg_dump -Fc` aus `serviceplattform-db-1`, Kopie von `/opt/heyelli/.env*` und `.local/` (siehe `/var/backups/heyelli`).
2. `systemctl stop heyelli.service` (Ausfall beginnt; der alte Datenbank-Container bleibt unverändert und gestoppt-bereit als Rückfallebene).
3. `/opt/heyelli-prod` anlegen (compose.yaml, `.env`, Platzhalter-Tag), nur die Datenbank starten: `heyelli-compose.sh prod up -d db`
   (`.env.tag` muss vorher ein Tag enthalten; Compose braucht es zur Auflösung des Image-Namens, Platzhalter genügt).
4. Dump einspielen: `heyelli-compose.sh prod exec -T db sh -c 'pg_restore --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < dump.dump`
   (Datenbank vorher leer; `schema_migrations` kommt aus dem Dump, die Migration ändert dann nichts).
5. Zustand in die Volumes kopieren (als root, Besitzer 10002): Inhalt von `.local/*-secrets`, `.env.*.local` nach `heyelli-prod_state`,
   `.local/auth` (enthält `demo-users.json`), `.local/heyelli`, `.local/pds-simulator` nach `heyelli-prod_local`; die Passwörter `DEMO_DIRECTORY_PASSWORD_*` aus `.env.development.local` in die `.env` der Instanz übernehmen, z. B. mit `docker run --rm -v heyelli-prod_state:/d -v <Quelle>:/s:ro alpine cp -a ...` und `chown -R 10002:10002`.
6. **Release `v1.0.0`** in GitLab anlegen (Deploy > Releases, Tag auf dem Commit aus `main`, der auf der Testinstanz lief). Die Tag-Pipeline prüft und startet `deploy_prod` (Image ziehen, Migration, App, Worker, Prüfung). nginx-Site `heyelli.conf` bleibt unverändert (Proxy auf `127.0.0.1:3000`).
7. Abnahme (Anmeldung, Kalender, Mail-Worker, Elli). Erst danach alte Teile abbauen: `heyelli.service` deaktivieren, `serviceplattform-db-1` stoppen (**Volume
   `serviceplattform_postgres_data` mindestens 14 Tage behalten**), Host-Node und `/opt/heyelli`-Checkout, `10-gitlab-ssh.nft`, später Host-Ollama.

**Rückweg (jederzeit vor dem Abbau, ca. 5 Minuten):** `heyelli-compose.sh prod down` (ohne `-v`, Volumes bleiben), `systemctl start heyelli.service`.
Die alte Datenbank wurde nur gelesen und ist unverändert. Daten, die nach der Umstellung im Container entstanden sind, gehen dabei verloren.

## Rollback eines Deploys

(Ablauf für Entwickler: `docs/ablauf.md`.)

- **Automatisch:** schlägt die Gesundheitsprüfung nach dem Start fehl, schreibt das Skript das vorherige Tag zurück, startet neu, prüft erneut und endet mit Exit 1.
  Ohne gültiges Vorgänger-Tag (erste Installation) wird der Platzhalter `0000000` zurückgeschrieben und nichts bleibt halb ausgerollt.
- **Prod, manuell:** In GitLab **Operate > Environments > production** öffnen, bei einer älteren Bereitstellung **Re-deploy** wählen. Das startet `deploy_prod` der damaligen Release-Pipeline
  erneut (mit deren `$CI_COMMIT_SHORT_SHA`; `release_check` läuft dabei nicht noch einmal). Voraussetzung: Das Image `app:<Kurz-Hash>` existiert noch in der Registry (Aufräumregel: Commit-Tags mindestens 90 Tage behalten)
  und `compose.yaml` auf dem Server passt noch zu diesem Image. Alternative: ein neues Release mit der Korrektur.
- **Test, manuell:** Pipeline des gewünschten älteren Commits öffnen und `deploy_test` erneut starten (gleiche Voraussetzungen).
- **Datenbank:** Das Skript sichert vor jedem Deploy mit `pg_dump -Fc` nach `/var/backups/heyelli-<instanz>` (geprüft, letzte 10). **Eine Migration wird bei einem
  Rollback nicht zurückgenommen.** Ein altes Image läuft dann gegen das neuere Schema. Bei Migrationen daher Rückwärtskompatibilität prüfen oder die Sicherung einspielen.

## Admin-Wrapper

`heyelli-compose.sh <test|prod> <compose-Befehl>` (nur root): setzt Projekt, Verzeichnis und `--env-file`-Reihenfolge.

```bash
heyelli-compose.sh prod ps
heyelli-compose.sh test logs --tail 100 -f app
```

`config` ohne `--quiet`, `--images` oder `--services` lehnt der Wrapper ab (würde `.env`-Werte ausgeben).

## Ressourcen (Richtwerte, noch nicht gemessen; Stand 18.11.2026)

Die VM hat heute 7,8 GB RAM (5,3 GB frei), 6 CPUs und 258 GB Platte. Mit den Entscheidungen (Elli in Test **und** Prod, ein gemeinsamer Ollama) ergibt sich:

| Posten | Schätzung |
|---|---|
| Prod: `app` 0,4–0,6 GB, drei Worker je 0,1 GB, Postgres 0,15 GB | ca. 1,0 GB |
| Test: dasselbe | ca. 1,0 GB |
| Ollama (qwen3:1.7b, einmal, `OLLAMA_NUM_PARALLEL=1`, `MAX_LOADED_MODELS=1`, `mem_limit` 3 GB) | 1,5–2 GB, Spitze bis 3 GB |
| onboarding Prod und Test | 0,3 GB |
| Docker, nginx, fail2ban, Betriebssystem, Seitencache | ca. 1,0–1,5 GB |
| **Summe** | **ca. 5,5–6 GB im Normalbetrieb, Spitzen bis 7,5 GB** |

Bei 7,8 GB gibt es keine Reserve und ein Out-of-Memory würde den Docker-Daemon treffen. **Empfehlung: die VM auf 12 GB RAM erhöhen** (mindestens 10 GB), vor dem ersten Test-Deploy. Zusätzlich je Dienst
`mem_limit` setzen (Richtwerte: `app` 1 GB, Worker 256 MB, `db` 512 MB, Ollama 3 GB), sobald es Messwerte gibt. Bis zur Erhöhung den Entwicklungsserver (`heyelli.service`, ca. 1,5 GB) erst nach dem Start der Container abschalten.
Gebaut wird auf dem Runner, nicht auf der VM.

## Zertifikat und Fehlersuche

Das Wildcard-Zertifikat `*.elomech.de` liegt unter `/etc/ssl/heyelli/` und gilt für beide Sites; erneuern wie bei onboarding beschrieben
(`nginx -t && systemctl reload nginx`). Typische Meldungen des Deploy-Skripts entsprechen denen aus onboarding
(`compose.yaml … passt nicht zum Image`, `Registry-Login fehlt`, `Host key verification failed`, fehlender `*_ENABLED`-Schalter). Zusätzlich:

| Meldung | Ursache |
|---|---|
| `Testinstanz: HEYELLI_MAIL_MODUS muss aus oder umleiten sein` u. ä. | Schutz der Testinstanz fehlt in `.env` |
| `pg_dump fehlgeschlagen` | Datenbankdienst läuft, ist aber nicht bereit oder Zugangsdaten stimmen nicht |
| `Für diese Umgebung ist noch kein Datenbankbetrieb freigegeben` | `HEYELLI_SERVER_BETRIEB` fehlt (nur bei einem fremden Image/Start ohne Dockerfile-Umgebung) |
| `release_check`: „Der Commit … liegt NICHT in main“ | Der Tag steht auf einem Commit, der nicht in `main` ist. Erst per Merge Request nach `main`, dann den Tag setzen. |
| `release_check`: „Das Image … gibt es nicht“ | Für den Tag-Commit wurde auf `main` kein Image gebaut (Pipeline rot oder Image schon gelöscht). Pipeline auf `main` prüfen. |
| `release_check`: „Image wurde aus einem anderen Commit gebaut“ / „Compose-Label passt nicht“ | Das Image stammt nicht aus dem Tag-Commit. Tag auf den Commit setzen, dessen Pipeline das Image gebaut hat. |
| `release_check`: „Das Image-Tag vX.Y.Z gibt es schon …“ | Die Versionsnummer wurde schon für einen anderen Commit vergeben. Neue Nummer verwenden. |
| `deploy_prod` fehlt in der Tag-Pipeline | `DEPLOY_PROD_ENABLED` ist nicht `true` (oder geschützt/umgebungsbegrenzt). |
| `deploy_prod`: `DEPLOY_SSH_KEY` leer / Zugriff verweigert | Tags `v*` sind nicht geschützt, die geschützten Variablen der Umgebung `production` sind daher nicht sichtbar. |
| `Elli ist aktiv …, aber Ollama ist im Netz … nicht erreichbar` | Ollama-Stack (`/opt/ollama-stack`) läuft nicht, hat kein Modell oder das Netz `heyelli-ollama` fehlt. Stack prüfen, nichts wurde gestartet. |

## Offene Annahmen

- Der Runner ELOMHRUN01 stellt den Docker-Daemon für den Docker-Executor bereit (wie bei onboarding). Der Build läuft `npm ci` und `next build` im Image und braucht Zugriff auf die npm-Registry.
- Der Produktions-Build wurde **noch nicht gebaut** (auf der VM nicht erlaubt). Ob `next build` ohne Datenbank und Umgebungswerte gelingt, zeigt erst die erste Pipeline.
- Bis zur Aktivierung von Entra ID melden sich alle mit heyelli-Konto und Passwort an (Administrator `admin` per `bootstrap-admin.mjs`). Die Aktivierung ersetzt die Passwortanmeldung; Konten werden vorher mit Microsoft verknüpft ([heyelli-Konten](auth/accounts.md)).
- Ob `next start` die Hintergrunddienste mit `src/*.ts` im Container (Node 24, Type-Stripping) so ausführt wie der Entwicklungsstarter, ist ungetestet.
