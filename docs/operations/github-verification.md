# GitHub Prüfungen für Pull Requests

Der GitHub-Spiegel prüft Pull Requests automatisch mit dem vollständigen `npm run verify`. GitLab bleibt das führende Projekt und führt weiterhin die Bereitstellung aus. Der GitHub-Workflow erzeugt weder Images für den Betrieb noch Tags, Releases oder Deployments.

## Ausführung und Prüfumfang

`.github/workflows/verify.yml` startet beim Öffnen, Aktualisieren, Wiederöffnen und Freigeben eines Pull Requests. Der Job `verify` läuft auf `ubuntu-24.04` mit der exakten Node-Version aus `.node-version`, Docker Compose, Python und Git. Es werden keine eigenen Runner angelegt oder GitLab-Runner verändert. Ein neuer Stand ersetzt einen noch laufenden Job desselben Pull Requests; das Zeitlimit beträgt 45 Minuten.

GitHub stellt für `pull_request` einen temporären Mergecommit aus Zielbranch und PR-Stand bereit. Genau dessen `github.sha` wird ausgecheckt und unveränderlich geprüft:

```bash
npm run verify -- --commit "$VERIFY_COMMIT" --report .local/verification/github-verify.json
```

Die bestehende Prüfung exportiert diesen Commit in eine frische Quellkopie und installiert die Lockdatei neu. Sie umfasst Modultests, getrennte Plattform- und Chat-Datenbanken, Lint, Build vor Typprüfung, Chromium und WebKit, Gegenprüfungen mit absichtlich falschem Navigationsziel und Schreibrecht sowie das vollständige npm-Audit. Browser-Systempakete werden unter Linux durch Playwright installiert; die von GitHub bereitgestellte Umgebung erlaubt dafür passwortloses `sudo`. Fehlende Voraussetzungen oder fehlgeschlagene Stufen lassen den Job scheitern. Die Einzelbudgets des bestehenden Prüfablaufs bleiben unverändert.

## Schutz der bestehenden Umgebungen

Der Workflow verwendet `pull_request`, kein `pull_request_target`. Der Repositorytoken hat ausschließlich `contents: read`; Checkout speichert keine Zugangsdaten im Git-Verzeichnis. Die Actions sind auf vollständige Commitkennungen festgelegt. Anwendungsgeheimnisse und Datenbankadressen werden weder benötigt noch als Repository-Secrets eingebunden. Der bestehende Umgebungsfilter reicht den Token nicht an die Prüfschritte in der isolierten Quellkopie weiter.

Die Tests erzeugen eigene zufällige Zugangsdaten, Compose-Projektnamen, Ports und Volumes sowie ausschließlich fiktive Datensätze. Sie übernehmen keine lokalen `.env`-Dateien oder `.local`-Bestände. Die Bereinigung betrifft nur die eigenen Prüfressourcen. Bei hartem Abbruch endet zusätzlich die kurzlebige GitHub-Umgebung; es gibt keine Verbindung zu Entwicklungs-, Testserver- oder Produktionsdatenbanken.

## Ergebnisse und Aufbewahrung

Unter **Actions → HeyElli PR verification** und im Pull Request steht der tatsächliche Jobstatus. Ein vorhandener Workflow oder ein wartender Job ist kein erfolgreicher Prüfnachweis. Die Mergecommitkennung im Bericht ist vom PR-Headcommit zu unterscheiden.

Der abschließende Upload versucht auch bei Fehlern, ausschließlich acht fest benannte JSON-Berichte unter `.local/verification/` aufzubewahren: Commitnachweis, Browserergebnis, Browserbereinigung und die Ergebnisse/Bereinigungen der beiden Gegenprüfungen. Aufbewahrung: 14 Tage. Rohprotokolle, Cookies, temporäre Zugangsdaten, Traces und Screenshots werden nicht als Artefakte hochgeladen. Endet der Job vor der Berichterstellung oder wird hart abgebrochen, kann der Bericht fehlen; der Jobstatus bleibt maßgeblich. Bei Gegenprüfungen sind die absichtlich fehlgeschlagenen Einzelfälle erwartet, das übergeordnete `mutations.json` muss ihre Erkennung bestätigen.

Nach Änderung einer Action deren offiziellen Release- und Commitstand prüfen. Grundlagen: [PR-Ereignisse und Mergecommit](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [Tokenberechtigungen](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication), [Artifact-Upload](https://github.com/actions/upload-artifact).

Der erste tatsächlich ausgeführte Lauf wird nach Anlage des Pull Requests gesondert dokumentiert. Der Workflow ändert keine Branchschutzregeln; Merge und Release bleiben menschliche Aufgaben.
