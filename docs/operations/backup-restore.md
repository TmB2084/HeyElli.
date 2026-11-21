# HeyElli sichern und Wiederherstellung prüfen

Dieser Ablauf ist ausschließlich für die lokale Entwicklungsumgebung mit Beispieldaten freigegeben. Er erstellt eine verschlüsselte Anwendungssicherung und prüft sie auf einer getrennten leeren PostgreSQL-Instanz. Er überschreibt oder restauriert niemals die bestehende Umgebung.

## Sicherung erstellen

Im Projektverzeichnis mit der in `.node-version` genannten Node-Version und installierten Paketen:

```sh
npm run backup
```

Voraussetzungen: laufendes lokales PostgreSQL aus der vorhandenen Compose-Konfiguration, Docker Compose, Python 3, `tar` und die lokale Node-Umgebung. Der aktuelle Arbeitsbaum wird einschließlich noch nicht eingecheckter Anwendungsdateien gesichert. Quelländerungen und Fachbearbeitungen während des kurzen Sicherungsfensters möglichst vermeiden; bei veränderlichem Bestand wird keine gültige Sicherung veröffentlicht und der Vorgang höchstens dreimal versucht.

Die Ausgabe nennt ausschließlich Status, Anzahl der gesicherten Objekte, Dateipfade, Zeitpunkt und Archivprüfsumme. Sie enthält keine Zugangsdaten, Rohschlüssel oder Fachtexte. Es entstehen zwei neue Dateien:

- `.local/backups/<Kennung>.hebackup`: AES-256-GCM-verschlüsseltes und authentifiziertes Archiv, Rechte 0600.
- `.local/backup-unlock/<Kennung>.key`: separater zufälliger Entsperrschlüssel, Rechte 0600; Verzeichnis 0700. Ohne ihn kann das Archiv nicht wiederhergestellt werden. Den Inhalt niemals in Chat, Protokoll oder Git kopieren.

Die Dateien werden exklusiv neu angelegt; vorhandene Archive, Schlüssel und Ausgabedateien werden nicht ersetzt. Entsperrschlüssel und Archiv zusätzlich **getrennt geschützt außerhalb dieses Macs** aufbewahren. Zwei Verzeichnisse auf derselben Festplatte schützen nicht vor Geräteverlust. Eine solche externe Ablage oder Cloud-Übertragung wird durch diesen Befehl nicht automatisch eingerichtet.

## Enthaltene Bestände

| Bestand | Verfahren |
| --- | --- |
| Gesamte Anwendungsdatenbank | PostgreSQL-Custom-Dump aller Anwendungsschemas einschließlich PDS-Quellenbereichen, Daten, Sequenzen und Migrationen aus einem exportierten schreibgeschützten Snapshot. Dazu gehören Benutzer, Rollen, Sitzungen, Farben, Einstellungen, Historien, Chats, Bewertungen, Warteschlangen und bestätigte Entwurfssicherungen. |
| Simulator einschließlich Anhängen | SQLite-Online-Backup, auch wenn bestätigte Änderungen noch im WAL stehen. Keine unsichere Kopie einer alleinstehenden laufenden Hauptdatei; `integrity_check` und logische Tabellenprüfsummen. |
| Lokale Konfiguration und Schlüssel | Alle vorhandenen `.env`-/`.env.*`-Dateien außer dem bereits als Quelle enthaltenen Beispiel sowie persistente `.local`-Bestände: Authentifizierungsdateien, Integrationsstände/-archive, Master-Schlüssel und alte Einstellungsdateien. Nur lesender Zugriff auf die Originale. |
| Externe Konfigurationsdateien | Vorhandene außerhalb des Projekts liegende Datei aus `DEMO_DIRECTORY_USERS_FILE` werden separat mit Originalpfad-Zuordnung verschlüsselt aufgenommen. Keine generische Sicherung beliebiger externer Dienste oder Hostverzeichnisse. |
| Anwendung | Git-inventarisierter aktueller Quellstand einschließlich vorhandener neuer Dateien, SQL-Migrationen, Compose-Dateien, README, `.node-version`, Paket- und Lockdatei. Basiscommit und Datei-Prüfsummen im geschützten Inventar; ein schmutziger Arbeitsbaum ist kein neuer Git-Commit. |

Nicht enthalten: `.git`-Historie, installierte Pakete, Next-Build-/Entwicklungs-Cache, Docker-Images/-Volumes als physische Kopie, flüchtige SQLite-WAL-/SHM-Dateien, `.local/verification`, die Sicherungsarchive selbst und deren Entsperrschlüssel. Daten aus WAL werden logisch in das SQLite-Backup übernommen. Pakete werden bei der Prüfung mit `npm ci` neu installiert; Node, Docker, Python und Paket-/Image-Verfügbarkeit bleiben Wiederherstellungsvoraussetzungen. Die Anwendungssicherung ist kein komplettes Betriebssystem- oder Offline-Installationsabbild.

**Browsergrenze:** Noch nicht serverseitig bestätigte Browserentwürfe, offene Formulare und rein lokale Fragesicherungen liegen nicht im Serverbackup. Bestehende Browserdaten werden weder gelesen noch entfernt. Vor Gerätebereinigung die vorhandene bestätigte Entwurfssicherung verwenden. Eine serverseitige Sicherung kann unbekannte, noch nicht übertragene Eingaben nicht ersetzen.

## Konsistenz und Geheimnisschutz

PostgreSQL wird ausschließlich mit schreibgeschütztem Zugang gelesen. Derselbe exportierte Snapshot wird für Tabelleninventar und `pg_dump` verwendet. SQLite-Verbindungen bleiben schreibgeschützt geöffnet; ihr `data_version`-Zähler erkennt auch zwischenzeitliche Änderungen, deren Werte später zurückgesetzt wurden. Dateiidentitäten, Änderungsmerkmale, Prüfsummen und Referenzen werden vor/nach dem Vorgang verglichen. Zwischenzeitliche Fachänderungen führen zum Verwerfen des Versuchs, nicht zum Überschreiben der Änderung.

Der Maildienst-Heartbeat darf normal weiterlaufen: `platform.mail_worker_health` ist ausschließlich beim Vergleich des lebenden Quellbestands ausgenommen. Die Tabelle wird dennoch vollständig im Datenbankdump gesichert und vor dem Wiederanlauf exakt verglichen. Weder Server noch Hintergrunddienste werden für die Sicherung beendet.

Temporäre Klartextkopien liegen ausschließlich in neu erzeugten Verzeichnissen mit 0700 und Dateien mit 0600 und werden anschließend entfernt. Das ist keine Zusage forensischer Löschung auf SSDs; Host-/Festplattenverschlüsselung und Schutz des Betriebskontos bleiben nötig. Die vollständige Inventardatei befindet sich nur im verschlüsselten Archiv, nicht im öffentlichen Prüfbericht.

## Isolierte Wiederherstellung

Die tatsächlichen Dateinamen aus der Sicherungsausgabe einsetzen:

```sh
npm run backup:check -- --archive .local/backups/NAME.hebackup --key-file .local/backup-unlock/NAME.key
```

1. Archiv authentifizieren und entschlüsseln. Falscher Schlüssel oder manipuliertes Archiv beendet den Vorgang vor dem Import. Das geschützte temporäre Archiv wird erst nach erfolgreicher GCM-Prüfung entpackt. Verzeichniswechsel, Links, Spezialdateien und Überschreiben bestehender Ziele sind beim Entpacken gesperrt.
2. Neue Compose-Instanz über `compose.restore.yaml` mit zufälligem Projektnamen, eigenem Volume, zufälligem Loopback-Port und neuen lokalen Datenbankzugangsdaten anlegen. Es gibt keine Option, die originale Datenbank als Importziel zu verwenden.
3. Dump in die leere Datenbank importieren und vollständige Tabellen-/Sequenz-/Strukturwerte mit dem Sicherungsinventar vergleichen. Datei- und Quellprüfsummen sowie SQLite-Inhalte prüfen. Referenzierte/archivierte Integrationsstände und vorhandene verschlüsselte Entwürfe mit den gesicherten Schlüsseln entschlüsseln, ohne Inhalte auszugeben.
4. **Nur die wiederhergestellte Kopie** absichern: alle alten Sitzungen widerrufen, OAuth-Flows entfernen, PDS auf Simulator setzen, Microsoft-Anmeldung/BMACloud/Copilot/Graph deaktivieren, Graph-Testbetrieb erzwingen und unversendete Warteschlangen/Aktionsvorschläge abbrechen. Originale Zugangsdaten bleiben in den gesicherten Dateien; die Anwendungsinstanz lädt keine originalen `.env`-Dateien als Laufzeitkonfiguration.
5. Gesicherte Anwendung mit frischen Paketen und einer neuen rein lokalen Prüfanmeldung starten. Service, Datenabruf und geschützte Einstellungen per HTTP prüfen. Es startet kein Mail-/KI-Hintergrunddienst und keine echte Integration. Der temporäre Prüfbenutzer und seine neue Sitzung existieren ausschließlich in dieser Kopie.
6. Quelldaten erneut schreibgeschützt vergleichen. Anschließend ausschließlich Prüfserver, eigenes Compose-Projekt, Volume und temporäre Dateien entfernen. Die verschlüsselte Sicherung und ihr Schlüssel bleiben erhalten.

Der Bericht steht unter `.local/verification/restore-latest.json`. Er enthält ausschließlich Prüfergebnisse und Mengen, keine Fachwerte oder Schlüssel. Bei Fehlern wird kein Erfolg behauptet. Ein Fehler bei der Bereinigung bleibt ein Fehler; Ressourcen müssen anhand des zugehörigen eindeutigen Projektnamens geprüft werden, niemals pauschal fremde Volumes entfernen.

## Nach einem echten Datenverlust

Eine bestandene Probe berechtigt nicht zum Überschreiben einer laufenden Installation. Echte Wiederinbetriebnahme benötigt einen ausdrücklich festgelegten Zielbestand, gesicherten Originalstand, passende Versionen, Rücknahmeplan und Betreiberfreigabe. Externe Zertifikats-/Zuordnungsdateien anhand der geschützten Pfadzuordnung im Ziel ablegen; Pfade nur in der Zielkonfiguration anpassen. Alte Sitzungen widerrufen. PDS, Microsoft-Anmeldung und Versand erst nach neuer Prüfung und ausdrücklicher Freigabe aktivieren. Unklaren Versand vor erneuter Ausgabe mit Exchange abgleichen.

## Betriebsvorschlag und Aufbewahrung

Verantwortlichkeit und externen Verwahrort vor Echtnutzung festlegen. Vorschlag: täglich sichern (RPO-Ziel höchstens 24 Stunden), monatlich eine isolierte Wiederherstellungsprobe, RTO-Ziel höchstens 60 Minuten. Diese Ziele sind noch keine vereinbarte oder gemessene Betriebs-SLA. Der einmalige Prüflauf nennt seine tatsächlich gemessene Dauer und seinen konkreten Datenstand.

Es ist kein automatischer Zeitplan und keine automatische Alterslöschung eingerichtet. Mindestens zwei unabhängig geprüfte Generationen getrennt geschützt aufbewahren. Löschen ausschließlich nach bewusster Betreiberentscheidung und erfolgreicher Prüfung eines verbleibenden Stands samt passendem Schlüssel. Ein fehlender Entsperrschlüssel kann nicht aus dem Archiv rekonstruiert werden; ein neues zufälliges Passwort ersetzt ihn nicht.

Technische Grundlagen: [PostgreSQL 17 · pg_dump und Snapshot](https://www.postgresql.org/docs/17/app-pgdump.html), [PostgreSQL · exportierte Snapshots](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION), [Node 24 · SQLite-Online-Backup](https://nodejs.org/download/release/v24.11.0/docs/api/sqlite.html).

### Laufende Überwachung und Stabilitätsvergleich

Der Vergleich des laufenden Quellbestands ignoriert ausschließlich flüchtige Tabellen: `platform.mail_worker_health`, `platform.operation_monitor`, `platform.operation_metrics`, `platform.resource_leases` und `platform.resource_windows`. Bei `platform.operation_alarms` werden nur `last_seen` und `occurrences` ausgeblendet. Alarmidentität, Zustandswechsel, erste Erkennung, Auflösung und insbesondere Bestätigungen bleiben Bestandteil des Vergleichs. Fachänderungen, Historien und ausstehende Historienaufträge sind weiterhin relevant. Vollständiger Snapshot, Dump und Wiederherstellungsprüfung enthalten auch die flüchtigen Daten; die Ausnahmen gelten nicht für Integrität oder Wiederherstellung.
