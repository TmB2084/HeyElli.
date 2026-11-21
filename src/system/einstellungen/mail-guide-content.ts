import {guideMarkdown,type IntegrationGuideData} from './integration-guide-data';
export const mailGuide:IntegrationGuideData={
  "title": "Microsoft 365 mit HeyElli verbinden",
  "intro": "MS365-Graph Testbetrieb: Die Anmeldung und ein lesender Postfachzugriff sind möglich. Im aktivierten MS365-Graph Testbetrieb werden Nachrichten ausschließlich simuliert verarbeitet. Ein erfolgreicher Verbindungstest bestätigt keine Versandberechtigung. Microsoft bestätigt bei erfolgreicher Übergabe nur die Annahme, nicht die Zustellung. Bei unklarem Ergebnis wird nicht automatisch erneut gesendet; vor einer neuen Nachricht den Versand in Exchange prüfen.",
  "setup": [
    {"title":"Zugangsdaten sicher verwalten","steps":[["Speicherung und Wiederherstellung","Neue verschlüsselte Stände werden erst durch eine PostgreSQL-Referenz aktiv. Fehler bei der Veröffentlichung lassen den vorherigen Stand erhalten. Unter Einstellungen → Sicherheit sind vorherige Stände wiederherstellbar; Graph ist danach deaktiviert und im Testbetrieb. Bei fehlendem Master-Schlüssel die geschützte Sicherung wiederherstellen. Vorhandene Konfigurationen werden nicht durch einen neuen Schlüssel ersetzt."]]},
    {
      "title": "1 · Microsoft-365-Admin",
      "steps": [
        [
          "Postfach festlegen",
          "Ein zentrales Exchange-Online-Postfach bestimmen. Dem HeyElli-Admin den Benutzerprinzipalnamen (UPN) mitteilen; eine zusätzliche Aliasadresse ist möglicherweise nicht auflösbar."
        ],
        [
          "App registrieren",
          "Im Microsoft Entra Admin Center unter „App-Registrierungen“ eine App für das eigene Organisationsverzeichnis anlegen. Verzeichnis-ID (Tenant-ID) und Anwendungs-ID (Client-ID) notieren."
        ],
        [
          "Anmeldedaten erstellen",
          "Unter „Zertifikate & Geheimnisse“ ein zeitlich begrenztes Client-Secret anlegen. Den *Wert*, nicht die Secret-ID, einmalig über einen sicheren Kanal an den HeyElli-Betriebsadmin übergeben. Ablaufdatum und Zuständigkeit für die Erneuerung festhalten."
        ],
        [
          "Zugriff begrenzen",
          "In Exchange Online den Service Principal der App registrieren. Dafür die Objekt-ID aus „Unternehmensanwendungen“ verwenden, nicht die Objekt-ID der App-Registrierung. Einen Management Scope ausschließlich für das zentrale Postfach anlegen und die Rolle `Application MailboxSettings.Read` diesem Scope zuweisen. Die genaue Befehlsfolge steht in der unten verlinkten Microsoft-Anleitung."
        ],
        [
          "Begrenzung prüfen",
          "Mit `Test-ServicePrincipalAuthorization` die App für das zentrale Postfach und ein anderes Postfach prüfen: Die Leseberechtigung darf nur beim zentralen Postfach „InScope True“ ergeben. Zusätzliche organisationsweite Entra-Berechtigungen wirken additiv und dürfen die Begrenzung nicht umgehen. Berechtigungsänderungen können verzögert wirksam werden."
        ]
      ]
    },
    {
      "title": "2 · HeyElli-Admin",
      "steps": [
        [
          "Modul aktivieren",
          "Unter Einstellungen → Integrationen → Microsoft Graph → Prüfung & Freigabe die Integration aktivieren. Den MS365-Graph Testbetrieb während der Einrichtung eingeschaltet lassen."
        ],
        [
          "Absender speichern",
          "Als HeyElli-Administrator „Einstellungen → Microsoft Graph → Verbindung“ öffnen. Das vereinbarte Postfach als UPN eintragen. Gültige Änderungen werden nach kurzer Eingabepause automatisch gespeichert; die Bestätigung abwarten. „Konfiguriert“ bedeutet nur, dass die lokalen Angaben vorhanden sind."
        ],
        [
          "Anmeldung hinterlegen",
          "Unter Einstellungen → Microsoft Graph → Verbindung die Tenant-ID, Client-ID und den Client-Secret-Wert im Formular Microsoft-365-Anmeldung eintragen und „Zugangsdaten geschützt speichern“ wählen. Neue Zugangsdaten werden vor der Übernahme bei Microsoft mit Anmeldung und lesendem Postfachzugriff geprüft. Bei Ablehnung oder Verbindungsfehler bleiben die vorherigen Zugangsdaten erhalten. Nach erfolgreicher Prüfung werden die Daten verschlüsselt in einer ausgeschlossenen lokalen Umgebungsdatei gespeichert; das Secret wird nicht zurückgegeben. Zum Ersetzen alle drei Werte neu eingeben. Jede Änderung schaltet in den Testbetrieb zurück."
        ],
        [
          "Verbindung prüfen",
          "„Gespeichertes Postfach prüfen“ ausführen. HeyElli meldet sich mit der App an und liest nur die Zeitzoneneinstellung des gespeicherten Postfachs. Ergebnisse mit Benutzer und Zeitpunkt stehen im Verwaltungsprotokoll. Eine Freigabe benötigt eine erfolgreiche Prüfung des aktuellen Postfachs innerhalb der letzten 24 Stunden und einen bereiten Hintergrunddienst. Wird der Absender geändert, schaltet HeyElli wieder in den Testbetrieb und verlangt eine neue Prüfung."
        ],
        [
          "Ablauf testen",
          "Unter Einstellungen → E-Mail → Nachricht den Versandweg Microsoft Graph wählen und eine Nachricht mit erfundenen Beispielinhalten anlegen. Unter „Warteschlange“ simuliert verarbeiten und im „Versandprotokoll“ prüfen. „Simuliert“ bedeutet ausdrücklich: nicht versendet."
        ]
      ]
    }
  ],
  "gates": [
    [
      "Testbetrieb",
      "Die Anmeldung und der Postfachzugriff werden lesend geprüft. Testnachrichten bleiben Simulationen und werden nicht versendet."
    ],
    [
      "Echter Versand",
      "Application Mail.Send muss auf das zentrale Postfach begrenzt und geprüft sein. Zusätzlich sind ein aktueller erfolgreicher Postfachtest (höchstens 24 Stunden), ein bereiter Hintergrunddienst und die ausdrückliche Bestätigung in HeyElli nötig."
    ],
    [
      "MailDesk-Postfach (lesend)",
      "Für MailDesk dieselbe App zusätzlich mit Application Mail.Read ausstatten und per Exchange-Zugriffsrichtlinie (New-ApplicationAccessPolicy … -AccessRight RestrictAccess) auf genau das geteilte Postfach begrenzen. Unter Microsoft Graph → MailDesk-Postfach das Postfach eintragen, „Verbindung prüfen“ und speichern. MailDesk liest nur und schreibt nichts in Microsoft 365."
    ],
    [
      "Rückkehr zum Testbetrieb",
      "Den MS365-Graph Testbetrieb unter Microsoft Graph → Prüfung & Freigabe wieder einschalten. Wartende echte Nachrichten pausieren; bereits laufende Übergaben werden zuvor abgeschlossen."
    ]
  ],
  "release": [
    "Für diesen Test ist keine Mail.Send-Berechtigung nötig. Für echten Versand muss die IT zusätzlich Application Mail.Send auf das zentrale Postfach begrenzen und prüfen. Anschließend kann ein HeyElli-Administrator den MS365-Graph Testbetrieb ausschalten und den echten Versand ausdrücklich bestätigen.",
    "Eindeutig fehlgeschlagene Nachrichten können erneut eingereiht werden; wartende Nachrichten können abgebrochen werden. Unklare Versandergebnisse zuerst in Exchange prüfen. Die Queue und das Versandprotokoll bleiben in PostgreSQL erhalten. Der automatische Dienst prüft alle 15 Sekunden auf wartende Nachrichten. Der MS365-Graph Testbetrieb wird unter Microsoft Graph → Prüfung & Freigabe ein- oder ausgeschaltet; echter Versand benötigt eine zusätzliche Bestätigung. Bestehende Testnachrichten bleiben Simulationen. Wird der MS365-Graph Testbetrieb wieder eingeschaltet, pausieren wartende echte Nachrichten bis zur erneuten Freigabe. Bereits laufende Übergaben werden zuvor abgeschlossen."
  ],
  "errors": [
    [
      "Konfiguration fehlt",
      "Unter Microsoft Graph → Verbindung zuerst das zentrale Postfach und dann Tenant-ID, Client-ID und Secret-Wert im geschützten Formular hinterlegen. Bei Einrichtung über die Einstellungen ist kein Neustart nötig."
    ],
    [
      "Anmeldung abgelehnt",
      "Tenant-ID, Client-ID und Gültigkeit des Secrets vom Microsoft-365-Admin prüfen lassen."
    ],
    [
      "Postfachzugriff verweigert",
      "Anmeldung funktioniert; MailboxSettings.Read, Scope und mögliche Verzögerungen prüfen lassen."
    ],
    [
      "Postfach nicht gefunden",
      "Gespeicherten UPN und Exchange-Online-Postfach prüfen. Danach erneut testen."
    ],
    [
      "Verbindung unterbrochen",
      "Erreichbarkeit von login.microsoftonline.com und graph.microsoft.com über HTTPS prüfen und Test wiederholen."
    ]
  ],
  "security": "Das Client-Secret wird nach erfolgreicher Prüfung verschlüsselt auf dem Server gespeichert und nicht zurückgegeben. Ablaufdatum und Erneuerung mit dem Microsoft-365-Admin abstimmen. Keine Zugangsdaten im Markdown-Download, in Tickets oder Protokollen hinterlegen.",
  "extras": [
    {
      "title": "Betrieb und optionale Serverkonfiguration",
      "paragraphs": [
        "Bei Einrichtung über die Einstellungen ist kein Neustart nötig. Nur bei Verwendung von .env den HeyElli-Entwicklungsserver neu starten. Die Einrichtungsdatei .env.microsoft365.local wird automatisch neu eingelesen und hat Vorrang. npm run dev startet und überwacht den Maildienst automatisch; bei bereits laufendem Webserver npm run mail:worker starten. Der Dienststatus steht unter Microsoft Graph → Verbindung. Die aktuelle Umgebung ist ausschließlich für Entwicklung vorgesehen.",
        "Die Eingabe über die Einstellungen ist der vorgesehene Einrichtungsweg. Optional kann der Betriebsadmin die Angaben in der lokalen, ausgeschlossenen .env hinterlegen. Keine bestehende lokale Konfiguration überschreiben."
      ],
      "code": "M365_TENANT_ID=<Verzeichnis-ID>\nM365_CLIENT_ID=<Anwendungs-ID>\nM365_CLIENT_SECRET=<Secret-Wert>"
    }
  ],
  "links": [
    [
      "Exchange: App-Berechtigungen und Postfachbegrenzung einrichten",
      "https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac"
    ],
    [
      "Microsoft Graph: Anmeldung ohne Benutzer",
      "https://learn.microsoft.com/en-us/graph/auth-v2-service"
    ],
    [
      "Postfacheinstellungen und erforderliche Leseberechtigung",
      "https://learn.microsoft.com/en-us/graph/api/user-get-mailboxsettings?view=graph-rest-1.0"
    ]
  ]
};
export const mailGuideMarkdown=guideMarkdown(mailGuide);
