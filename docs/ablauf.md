# So kommt eine Änderung live

Diese Seite beschreibt den Weg einer Änderung von der Idee bis zur laufenden Anwendung. Sie ist für alle gedacht, die an HeyElli arbeiten (Menschen und KI-Agenten).
Technische Einzelheiten stehen in `docs/ci-deploy.md`.

## Auf einen Blick

| Schritt | Wer | Wo | Was passiert |
|---|---|---|---|
| 1. Branch anlegen und arbeiten | Entwickler (oder dessen KI-Agent) | lokal | Änderung in einem eigenen Branch, nie direkt in `main` |
| 2. Merge Request (MR) öffnen | Entwickler / KI-Agent | GitLab | GitLab prüft automatisch: Code-Prüfung, Typen, Tests, Compose-Datei, Image-Bau |
| 3. Durchsicht | eine zweite Person (empfohlen) | GitLab | Vier-Augen-Prinzip: kurz ansehen, bevor gemergt wird |
| 4. Mergen nach `main` | Entwickler (Mensch) | GitLab | Der Stand liegt in `main`, die Pipeline baut das Image |
| 5. Testinstanz prüfen | Entwickler | https://heyelli-test.elomech.de | Das Image wird **automatisch** auf die Testinstanz ausgerollt, dort ausprobieren |
| 6. Release anlegen | Entwickler (Mensch) | GitLab: Deploy > Releases | Ein Tag `vX.Y.Z` auf dem geprüften Commit startet den Prod-Deploy |
| 7. Live | automatisch | https://heyelli.elomech.de | Prüfung, Sicherung der Datenbank, Start, Gesundheitsprüfung, bei Fehler automatisch zurück |

Die IT ist am täglichen Ablauf nicht beteiligt (siehe "Wann die IT gebraucht wird").

## Wer darf was

| Aktion | Entwickler | KI-Agent des Entwicklers | IT (Maintainer) |
|---|---|---|---|
| Branch anlegen und pushen | ja | ja | ja |
| Merge Request öffnen | ja | ja | ja |
| Merge Request mergen | ja (Mensch) | **nein** | ja |
| Direkt nach `main` pushen | **nein** (gesperrt) | **nein** | **nein** (gesperrt) |
| Release (Tag `vX.Y.Z`) anlegen | ja (Mensch) | **nein** | ja |
| CI-Variablen, Server, Runner ändern | nein | **nein** | ja |
| Testinstanz ausprobieren | ja | ja (nur lesend/Browser) | ja |

---

## Für Entwickler

### 1. Branch anlegen

Immer von einem aktuellen `main`. Namen nach dem Muster `art/kurzbeschreibung`, klein und mit Bindestrichen:

- `feature/kalender-farben` für neue Funktionen,
- `fix/anmeldung-fehlermeldung` für Fehlerkorrekturen,
- `docs/ablauf` für reine Dokumentation.

KI-Agenten verwenden `claude/…` bzw. `codex/…` (damit man sieht, woher der Branch kommt).

Bevor du pushst, lokal prüfen: `npm run lint`, `npm run typecheck`, `npm run test:unit` (siehe `README.md`). Wenn du eine App änderst, erhöhe die Versionsnummer
dieser App in `src/platform/shell/app-releases.ts` (Regeln in `AGENTS.md`).

### 2. Merge Request öffnen

Branch pushen und in GitLab einen Merge Request mit Ziel `main` anlegen. Beschreibe kurz, was sich ändert und wie man es prüft.
GitLab startet dann die **Pipeline** (Reihe automatischer Prüfungen):

| Job | Was er prüft | Farbe |
|---|---|---|
| `check_code` | Code-Stil, Typen, Modultests | muss grün sein |
| `check_compose` | die Server-Konfiguration (`compose.server.yaml`) ist gültig | muss grün sein |
| `npm_audit` | bekannte Sicherheitsmeldungen zu Bibliotheken | darf orange sein (nur Hinweis) |
| `build_image` | das Programm lässt sich als Image bauen und wird abgelegt | muss grün sein |
| `deploy_test` | Knopf: diesen Stand schon vor dem Merge auf die Testinstanz bringen | freiwillig |

Der Merge Request kann erst gemergt werden, wenn die Pipeline grün ist.

### 3. Durchsicht

Wenn möglich schaut eine zweite Person kurz drüber (Vier-Augen-Prinzip): Passt die Änderung zur Beschreibung, gibt es offensichtliche Fehler, sind Zugangsdaten oder echte Personendaten im Code?
Das ist eine Empfehlung, keine technische Sperre.

### 4. Mergen und was dann passiert

Du mergst über den Knopf im Merge Request (Merge-Commit, kein Squash, damit die Geschichte erhalten bleibt). Danach läuft die Pipeline auf `main`:
`check_code` → `check_compose` → `build_image` → **`deploy_test` automatisch**. Dauert einige Minuten.

### 5. Testinstanz prüfen

- Adresse: **https://heyelli-test.elomech.de**
- Anmeldung mit den Demo-Benutzern (Übergangslösung bis Entra ID).
- **So erkennst du den Testschutz:** Oben auf jeder Seite steht ein gelber Balken mit **TESTINSTANZ**. Auf der Testinstanz werden **keine E-Mails verschickt**, es wird **nichts in Microsoft 365 geschrieben** und Elli fragt nie Copilot, sondern antwortet immer über das lokale Ollama.
  Die Testdatenbank ist getrennt von der echten.
- Prüfe, dass wirklich der neue Stand läuft: In GitLab unter **Operate > Environments > test** steht der zuletzt ausgerollte Commit.

### 6. Release anlegen (Prod)

Erst wenn die Testinstanz gut aussieht:

1. In GitLab: **Deploy > Releases > New release**.
2. **Tag name:** die neue Version, zum Beispiel `v1.0.1` (Regel unten). **Create from:** `main`.
   *Wichtig:* Der Release geht auf den Commit, den du getestet hast. Wurde seit dem Test noch etwas anderes nach `main` gemergt, lege den Tag stattdessen unter **Code > Tags > New tag** auf genau den getesteten Commit (die Kurz-Kennung steht in **Operate > Environments > test**) und lege das Release zu diesem Tag an.
3. Release-Titel und kurze Beschreibung (was ist neu) eintragen, **Create release**.

**Was dann automatisch passiert** (Pipeline des Tags, unter **Build > Pipelines**, Name = die Version):

1. `release_check` prüft: Die Versionsnummer ist gültig, der Commit liegt in `main`, und das passende Image existiert und stammt aus genau diesem Commit.
   Er legt außerdem ein Image-Tag mit der Versionsnummer an. **Es wird nichts neu gebaut**: Prod bekommt dasselbe Image, das auf der Testinstanz lief.
   Ist eine Prüfung nicht erfüllt, gibt es **keinen** Prod-Deploy.
2. `release_version` gibt nur einen Hinweis (orange), wenn sich seit dem letzten Release der Code, aber nicht die Versionsnummern in `app-releases.ts` geändert haben. Er blockiert nie.
3. `deploy_prod` rollt auf Prod aus: Datenbank sichern, Image ziehen, starten, Gesundheitsprüfung. Schlägt sie fehl, geht der Server **automatisch** auf den vorherigen Stand zurück.

Danach kurz prüfen: Pipeline grün, https://heyelli.elomech.de/anmeldung erreichbar, Anmeldung funktioniert.

**Versionsnummer-Regel** (SemVer `vX.Y.Z`, immer mit kleinem `v`):

- **Z** (dritte Zahl) hoch bei Fehlerkorrekturen und kleinen Änderungen: `v1.0.0` → `v1.0.1`.
- **Y** (mittlere Zahl) hoch bei neuen oder sichtbar geänderten Funktionen: `v1.0.1` → `v1.1.0`.
- **X** (erste Zahl) hoch bei großen Umstellungen (zum Beispiel die Anmeldung über Entra ID): `v1.4.2` → `v2.0.0`.
- Das erste Release auf dem Container-Betrieb ist `v1.0.0`.
- Jede Nummer nur **einmal** vergeben. Tags nie löschen, verschieben oder neu setzen.
- Tags in anderer Form (`1.0.0`, `v1.0`, `v1.0.0-rc1`) lösen **keine** Pipeline aus.
- Diese Nummer ist die Version des Releases. Sie ist unabhängig von den Zahlen je App in `app-releases.ts` (Schema `26.51`).

### Zurück zum vorherigen Stand (Rollback)

1. **Operate > Environments > production** öffnen.
2. In der Liste der Bereitstellungen die ältere auswählen und **Re-deploy** klicken. Das startet `deploy_prod` der damaligen Release-Pipeline erneut mit dem damaligen Image.
3. Danach wie beim Release prüfen.

**Wichtig:** Hat sich zwischen den beiden Releases `compose.server.yaml` geändert, lehnt der Server den Re-deploy ab („compose.yaml passt nicht zum Image“), denn auf dem Server liegt dann schon die neuere Datei. In dem Fall die IT bitten, die Datei aus dem alten Stand einzuspielen, oder gleich ein Korrektur-Release anlegen.

Gut zu wissen: Vor jedem Deploy sichert der Server die Datenbank. Wurde mit dem neuen Stand die Datenbankstruktur geändert, wird das beim Zurückgehen **nicht** rückgängig gemacht. Bei solchen Änderungen vorher mit der IT über das Einspielen der Sicherung sprechen.
Eine Alternative ist ein neues Release mit der Korrektur (`v1.0.2`), das ist meist der sauberere Weg.
Ein Re-deploy geht für Releases der letzten 90 Tage (so lange bleibt das Image mit der Commit-Kennung in der Registry). Für ältere Stände ein neues Release mit der Korrektur anlegen.

### Was tun bei roter Pipeline

| Job | Bedeutung | Was tun |
|---|---|---|
| `check_code` rot | Prüfung, Typen oder Test schlägt fehl | Meldung im Job lesen, lokal nachstellen (`npm run lint`, `npm run typecheck`, `npm run test:unit`), Korrektur pushen |
| `check_compose` rot | Die Datei `compose.server.yaml` ist ungültig | Änderung an der Datei prüfen |
| `npm_audit` orange | Neue Sicherheitsmeldung zu einer Bibliothek | blockiert nichts; zeitnah bewerten und ggf. Bibliothek aktualisieren |
| `build_image` rot | Image konnte nicht gebaut oder abgelegt werden | Fehler im Programm: Meldung lesen und korrigieren. Meldung zu Netzwerk, Registry oder Runner: **IT** |
| `deploy_test` rot | Test-Server hat den Stand nicht übernommen | Job-Meldung lesen (`docs/ci-deploy.md`, Abschnitt Fehlersuche). Betrifft sie Server, Zugang oder Variablen: **IT** |
| `release_check` rot | Die Release-Voraussetzungen sind nicht erfüllt | Meldung nennt den Grund: Commit nicht in `main` (erst mergen), Image fehlt (war die Pipeline auf `main` grün?), Tag falsch geschrieben, Versionsnummer schon vergeben. Neuen Tag richtig setzen, nichts erzwingen |
| `release_version` orange | Hinweis auf vergessene Versionsnummer | lesen, bei Bedarf mit dem nächsten Release nachholen |
| `deploy_prod` rot | Prod-Deploy fehlgeschlagen. Meist steht im Log „Rollback … erfolgreich“: Prod läuft mit dem alten Stand weiter | Ursache im Log lesen. Hängt sie am Server, am Zugang oder an Variablen: **IT** |

Eine rote Pipeline auf `main` hat Vorrang: erst reparieren, dann weitere Änderungen mergen.

### Was Entwickler nicht tun

- Nicht direkt nach `main` pushen (technisch gesperrt) und nichts erzwingen (`--force`).
- Keine Tags oder Releases für etwas anderes als einen geprüften Commit aus `main`.
- Keine Zugangsdaten, Passwörter oder echten Personendaten in den Code, in Merge Requests oder in Chats.
- Nichts direkt auf den Servern ändern und kein Image von Hand ausrollen.
- Keine eigenen Runner anmelden und keine CI-Variablen ändern.
- Die Testinstanz nicht als Ablage für echte Produktivdaten benutzen.

---

## Für KI-Agenten (Claude Code, Codex)

KI-Agenten arbeiten im Auftrag eines Entwicklers. Für sie gilt:

- **Erlaubt:** Branch anlegen und pushen, Merge Request öffnen, Pipeline-Ergebnis lesen und Korrekturen auf demselben Branch pushen.
- **Nie nach `main` pushen.** Jede Änderung läuft über einen Merge Request.
- **Nicht mergen.** Das macht immer ein Mensch.
- **Keine Releases und keine Tags anlegen.** Das macht immer ein Mensch.
- **Keine CI-Variablen, Server, Zugänge oder Runner ändern** und keine eigenen Runner anmelden. Auch nichts auf den Servern ausrollen.
- **Die Pipeline des eigenen Branches grün halten** (`check_code`, `check_compose`, `build_image`). Bei Rot zuerst die Ursache beheben, nicht abschalten oder umgehen.
- Keine Zugangsdaten ausgeben oder committen; Regeln aus `AGENTS.md` einhalten.
- Im Zweifel beim Entwickler nachfragen, statt etwas an Servern oder GitLab-Einstellungen zu verändern.

---

## Wann die IT gebraucht wird

Die IT (Tobias Wagener) betreut Server, Runner und GitLab-Einstellungen. Am täglichen Ablauf (Branch, Merge Request, Merge, Test, Release) ist sie nicht beteiligt. Melden, wenn:

- eine Pipeline rot ist und die Meldung auf **Server, Runner, Registry, Netzwerk oder Zugang** hinweist (zum Beispiel „Host key verification failed“, „Registry-Login fehlt“, `docker push` abgelehnt),
- **neue CI-Variablen oder Zugangsdaten** nötig sind oder Variablen ablaufen,
- bei einem **Rollback Hilfe** nötig ist, besonders wenn die Datenbank zurückgesetzt werden soll,
- der Prod-Server nach einem Deploy nicht erreichbar ist.

Erreichbar über die üblichen Wege der IT (Teams oder Ticket). Bitte immer angeben: Branch oder Tag, Link zur Pipeline und die Fehlermeldung aus dem Job.

## Einstellungen in GitLab (einmalig, durch IT/Maintainer)

| Einstellung | Wert |
|---|---|
| Geschützter Branch `main` | Allowed to merge: **Developers + Maintainers**, Allowed to push and merge: **No one**, Force push: aus |
| Geschützte Tags `v*` | Allowed to create: **Developers + Maintainers** (nur dadurch sind die geschützten Variablen der Umgebung `production` in der Tag-Pipeline sichtbar) |
| Merge Requests | „Pipelines must succeed“ an; Vier-Augen-Prinzip (mindestens 1 Zustimmung) wenn möglich |
| Auto DevOps | aus |
| CI-Variablen | siehe `docs/ci-deploy.md` (`DEPLOY_PROD_ENABLED` muss `true` sein, sonst gibt es keinen Prod-Deploy) |
| Registry-Aufräumregel | Tags `vX.Y.Z` behalten; Commit-Tags (8 Zeichen) erst nach mindestens 90 Tagen löschen, damit ein Rollback (Re-deploy) möglich bleibt |
