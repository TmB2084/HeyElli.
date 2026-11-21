import {pdsViewsMarkdown} from './pds-view-guide-data';
import {guideMarkdown,type IntegrationGuideData} from './integration-guide-data';
export const pdsGuideGates=[
 ['Vorbereitet','Zentrale Datenquellenumschaltung, echter API-Leseadapter, strikte serverseitige Schreibsperre und Rückkehr zum Simulator.'],
 ['Getrennte Daten','Je PDS-Konfiguration eigener lokaler Arbeitsbereich für Kalenderfarben, Ressourcenauswahl und Browserentwürfe. Simulator-Einstellungen bleiben erhalten; alte Bereitschaftspläne werden nicht in die echte Quelle übernommen.'],
 ['Anmeldung','Echte Daten erfordern die aktive Microsoft-Anmeldung (Entra ID). API-Token und PDS-Lizenz kommen von der PDS-Administration.'],
 ['Schreiben – noch gesperrt','Bauleiter-Schreibfeld und widersprüchliche Pflichtfelder für Ansprechpartner mit PDS klären. Es gibt keinen dokumentierten Idempotenzschlüssel; verlorene Create-Antworten benötigen einen nachgewiesen sicheren Abgleich.'],
 ['Fachliche Abnahme','Zunächst getrennten PDS-Testmandanten verwenden und Rechte, Seitenzählung, Arbeitszeiten und Rollen prüfen. Echte Bearbeiter-UUIDs administrativ bestätigen.'],
 ['Produktivbetrieb','Die gesamte Plattform benötigt weiterhin eine getrennte freigegebene Produktivumgebung. Die lokale Entwicklungskonfiguration ist keine Produktivbereitstellung.'],
];
export const pdsWriteQuestions=[
 ['Zugang & Kennungen','Welche PDS-/API-Version, Lizenz und Rechte gelten für den zentralen Zugang? Welche echten Bearbeiter-UUIDs gehören zu unseren Benutzern, und darf der Zugang in deren Namen schreiben? Bitte gültige Servicevorlage, Dokumententyp, Zielordner sowie Uploadlimits nennen.','Alle Schreibabläufe'],
 ['Bauleiter / Projektleiter','Welcher unterstützte Endpunkt setzt oder entfernt bauleiterUUIDs am Serviceauftrag? In den vorliegenden Create-/Update-Modellen fehlt das Feld. Bitte UUID-Typ, Ersetzen/Ergänzen und eventuelle Vererbung aus der Projektakte bestätigen.','Serviceanlage / Verantwortliche'],
 ['Ansprechpartner','Bei /person/addansprechpartnerrolle: Gilt eKommunikationswege oder ekommunikationswege (Pflichtfeld und Property widersprechen sich)? Welcher Endpunkt setzt ansprechpartnerUUID strukturiert am Auftrag? Das Feld ist bisher nur lesbar.','Personen- und Serviceanlage'],
 ['Antwortverlust & Wiederholung','Wie finden wir nach verlorener Erfolgsantwort eine bereits ausgeführte Anlage eindeutig wieder? Gibt es einen Idempotenzschlüssel oder eine eindeutige externe Referenz, und wann ist das Ergebnis lesbar? Bitte auch Wiederholung von Dokumentupload und Mobil-Ausgabe klären.','Doppelte Anlagen / Ausgaben verhindern'],
 ['Gleichzeitige Änderungen','Unterstützen Termin-, Service- und Statusänderungen eine atomare Versionsprüfung, ETag oder Compare-and-Swap? Wie werden veraltete Änderungen abgelehnt? Vorheriges Rücklesen allein verhindert kein Überschreiben durch parallele PDS-Benutzer.','Ändern / Löschen / automatische Wiederaufnahme'],
 ['Service ↔ Kalender','Erzeugt /service/createstoerung genau einen Planungstermin, und wie ordnet /service/findstoerungtermin ihn zu? Welche Felder gleichen /termin/update und /service/updatestoerung gegenseitig ab? Für welche Terminarten ist /termin/delete erlaubt, mit welchen Folgen und welchem Weg zur Neuplanung?','Verschieben / Rollenwechsel / Löschen'],
 ['Mobilität & Storno','Was bewirkt /service/mobilausgeben bei mehreren Störungsebenen oder geändertem Hauptmonteur? Ist erneute Ausgabe nötig? Sind „Storniert“ bzw. bei „Mobil abgeholt“ „Manuell storniert“ über /service/updatestatus zulässig, und wie wird die mobile Ausgabe tatsächlich zurückgenommen?','Einzel- / Sammelausgabe und Storno'],
 ['Mehrteilige Einsätze','Wie werden mehrere native Termine an derselben Service-Störungsebene angelegt, inklusive Haupt-/Begleitmonteuren und Mobilität? /termin/create dokumentiert dafür keine passende Service-Referenz. Gibt es eine unterstützte Transaktion oder einen sicheren Fortsetzungsablauf?','Auf Arbeitstage verteilte Serviceeinsätze'],
 ['Wartung aus Fälligkeit','Bewirkt /service/createstoerung mit intervallUUID die native Übernahme einer Fälligkeit? Wann und wie wird intervallSerie.naechstesDatum fortgeschrieben? Welche Positionen/Vorgangsvorlage/Pflichtfelder werden übernommen? Wie wird je Intervall und Fälligkeitsdatum eine doppelte Erzeugung auch nach Antwortverlust atomar verhindert? Darf zunächst ohne Techniker/Termin angelegt und anschließend über /service/updatestoerung geplant werden, ohne zusätzliche Termine zu erzeugen? Bitte Transaktions-, Fehler- und Rücknahmeverhalten bestätigen. HeyElli zeigt vorerst nur Übersicht und Vorschau; die anschließende Terminvergabe ist vorbereitet.','Wartungsauftrag erzeugen – gesperrt'],
 ['Test & Abnahme','Welcher getrennte PDS-Testmandant mit ausschließlich fiktiven Daten steht bereit, und wer bestätigt die Ergebnisse? Anlage, Änderung, Löschen, Mobilität, Paralleländerungen, Antwortverlust und Wiederaufnahme müssen je freizugebendem Ablauf geprüft werden.','Freigabe jedes unterstützten Ablaufs'],
];

export const pdsGuideIntro="Bitte bei Bedarf mit dem PDS-Support klären: je Antwort API-Version, unterstützten Endpunkt, Requestfelder, nötige Rechte und ein Beispiel mit fiktiven Daten beilegen. Keine Tokens oder Passwörter in die Rückmeldung aufnehmen.";
export const pdsGuideViews="Die Übersicht unter dieser Anleitung beschreibt die vier konfigurierbaren Datenansichten mit Spalten, Formaten, Regeln und fiktiven JSON-Beispielen. Sie ist auch im Markdown-Download enthalten. Nur nachgewiesene API-Lücken ergänzen; die konkrete PDS-Ansicht muss der PDS-Admin bereitstellen und freigeben.";
export const pdsGuideSecurity="Token als unveränderlicher verschlüsselter Stand auf dem Server; aktive Referenz in PostgreSQL. Vorherige Stände unter Sicherheit wiederherstellen; danach Simulator aktiv und erneute Prüfung nötig. Bei fehlendem Schlüssel die geschützte Sicherung wiederherstellen, keine Neuerzeugung über vorhandenem Bestand; keine Geheimnisse in PostgreSQL oder Protokollen. Keine direkte Verbindung zur PDS-Datenbank.";
export const pdsGuideRelease="Antworten allein aktivieren keinen Schreibbetrieb. Bestätigte Verträge müssen in HeyElli umgesetzt und im Testmandanten abgenommen werden. Ungeklärte Funktionen bleiben gesperrt; der Simulator bleibt bis zur ausdrücklichen Freigabe aktiv.";
export const pdsSetupSections=[
 {title:'1 · PDS-Admin',steps:[
  ['Testsystem bereitstellen','Einen getrennten PDS-Testmandanten mit ausschließlich erfundenen Beispieldaten, installierter PDS-/API-Version und passender API-Lizenz bereitstellen. Die unterstützte Einrichtung der API und Token-Ausstellung ist versionsabhängig; den konkreten PDS-Menüweg bei Bedarf mit dem PDS-Support klären.'],
  ['API-Zugang einrichten','Einen zentralen technischen API-Zugang für genau diesen Mandanten bereitstellen. Zunächst nur die benötigten Leserechte vergeben; ein HeyElli-Benutzer erhält dadurch keine eigenen PDS-Rechte. Zuständigkeit, Ablauf und Erneuerung des Bearer-Tokens festhalten.'],
  ['Adresse und Netzwerk prüfen','Die vollständige HTTPS-API-Basisadresse einschließlich API-Präfix bestätigen. Beispiel ausschließlich als Platzhalter: https://pds.example.invalid/pds/rest/api. Die Adresse darf keine Zugangsdaten oder Suchparameter enthalten. Erreichbarkeit vom HeyElli-Server, DNS, Firewall und eine gültige vertrauenswürdige TLS-Zertifikatskette sicherstellen; Zertifikatsprüfungen nicht abschalten.'],
  ['Leserechte bestätigen','Die Prüfungen benötigen GET /termin/listkategorien, POST /mitarbeiter/listmitarbeiter, GET /person/listfunktionen und GET /datenansichten/list. Der Kalender liest zusätzlich Ressourcen, Mitarbeiterdetails, Planung, Termindetails und Statuskataloge. Rechte anhand der angezeigten API-/Kalenderprüfung prüfen; eine erfolgreiche Kategorienabfrage allein genügt nicht.'],
  ['Angaben sicher übergeben','Dem HeyElli-Admin Basisadresse, Mandant und API-Version mitteilen; den Bearer-Token ausschließlich über einen vereinbarten sicheren Kanal übergeben. Keine Zugangsdaten in die Anleitung, Tickets oder das Änderungsprotokoll aufnehmen. Echte Bearbeiter-UUIDs getrennt von Mitarbeiter-UUIDs bestätigen.'],
 ]},
 {title:'2 · HeyElli-Admin',steps:[
  ['Microsoft-Anmeldung aktivieren','Der HeyElli-Betriebsadmin richtet unter Einstellungen → Integrationen → Microsoft-Anmeldung die Entra-ID-Anmeldung ein, testet sie und aktiviert sie; sie ersetzt dann die eigene Anmeldung. Dazu eine getrennte Betriebsumgebung. Benutzer in Einstellungen → Benutzer & Zugriff ausdrücklich aktivieren und Rollen zuweisen. Simulierte Anmeldungen dürfen keinen echten PDS-Zugriff freigeben; die Ausnahme gilt ausschließlich für isolierte automatische Tests.'],
  ['Verbindung hinterlegen','Als Administrator Einstellungen → PDS-Anbindung → Verbindung öffnen. HTTPS-API-Basisadresse und Bearer-Token eingeben und „Prüfen und geschützt speichern“ wählen. Die Angaben werden lesend geprüft; Kategorien- und Mitarbeitersuche müssen erfolgreich sein. Bei Ablehnung bleiben bisherige Zugangsdaten erhalten. Gespeicherte Adresse und Token werden nicht zurückgegeben; zum Ersetzen beide neu eingeben.'],
  ['Simulator aktiv lassen','Das Hinterlegen der Zugangsdaten aktiviert kein echtes PDS. Neue Zugangsdaten setzen die Quelle auf Simulator zurück und erzeugen einen getrennten Arbeitsbereich. Auch eine Tokenrotation kann deshalb mit neuen Kalender-Einstellungen beginnen; bisherige Arbeitsbereiche bleiben erhalten. Die Einrichtung über die Einstellungen benötigt weder Konsole noch Neustart.'],
  ['Optionale Ansichten abstimmen','Datenansichten zunächst leer lassen. Nur für bestätigte API-Feldlücken unter Datenansichten freigegebene Namen für Kalenderfarben, Arbeitszeiten, Urlaubsfreigaben oder Rücklaufzuordnung eintragen. Spalten, UUID-Bezüge und Mandantenbegrenzung mit PDS abstimmen. Simulator-Ansichtsnamen sind nicht zulässig; Änderungen verlangen neue Prüfungen.'],
  ['Prüfungen ausführen','Unter API-Prüfung „API-Verbindung prüfen“ und „Kalenderadapter prüfen (7 Tage)“ ausführen. Fehler zuerst beheben. Die Kalenderprüfung liest einen Zeitraum von sieben Tagen und speichert nur technischen Status und Anzahlen. Leere Ergebnislisten können korrekt sein und müssen im Testmandanten fachlich plausibilisiert werden.'],
  ['Lesezugriff ausdrücklich freigeben','Erst nach Freigabe des Testmandanten unter Quelle & Freigabe „Echten PDS-Lesezugriff ausdrücklich freigeben“ bestätigen und „Echtes PDS lesend aktivieren“ wählen. Der Server verlangt passende Zugangsdaten, Unternehmensanmeldung und erfolgreiche API-/Kalenderprüfungen derselben Konfiguration, höchstens 24 Stunden alt. Kalender und Suchansichten anschließend mit bekannten fiktiven Testfällen prüfen. Echte Schreibfunktionen bleiben gesperrt.'],
  ['Bearbeiter und Schreibfreigabe vorbereiten','Unter Bearbeiter die von PDS bestätigten Benutzer-/Bearbeiter-UUIDs den HeyElli-Benutzern zuordnen. Diese Zuordnung aktiviert keine Schreibrechte. Die offenen Fragen unten mit PDS beantworten, betroffene Abläufe danach in HeyElli ergänzen und getrennt abnehmen. Es gibt derzeit keinen Schalter für echten Schreibbetrieb.'],
  ['Bei Problemen zurückschalten','Unter Quelle & Freigabe „Zum Simulator zurückkehren“ wählen. Die bisherige Simulator-Auswahl und dessen Kalenderfarben bleiben verfügbar. Bei API-Fehlern erfolgt kein automatischer Rückfall; ein stiller Wechsel würde echte Daten und Beispieldaten verwechselbar machen.'],
 ]},
];
export const pdsTroubleshooting=[
 ['HTTP 401','Bearer-Token, dessen Gültigkeit und den vorgesehenen Mandanten durch den PDS-Admin prüfen lassen.'],
 ['HTTP 403','PDS-API-Lizenz und Rechte des zentralen technischen Zugangs prüfen. Die HeyElli-Rolle kann fehlende PDS-Rechte nicht ersetzen.'],
 ['HTTP 404','Vollständige API-Basisadresse mit Präfix und die installierte API-Version prüfen; keinen Einzel-Endpunkt als Basisadresse eintragen.'],
 ['Verbindung / TLS / Zeitüberschreitung','Erreichbarkeit vom HeyElli-Server, DNS, Firewall und Zertifikatskette prüfen. Bei unbestätigtem Speichern den Status neu öffnen und prüfen; Prüfungen können erneut gestartet werden.'],
 ['Kalenderprüfung oder Freigabe scheitert','API-Rechte, Antwortvertrag, konfigurierte Ansichten und aktive Microsoft-Anmeldung prüfen. Nach Konfigurationsänderungen API- und Kalenderprüfung wiederholen; beide müssen zur gleichen Version gehören und aktuell sein. Ein grüner Verbindungstest bestätigt keine Schreibberechtigung.'],
];

export const pdsGuide:IntegrationGuideData={
 title:'PDS mit HeyElli verbinden',
 intro:'Simulator bleibt bis zur ausdrücklichen Freigabe aktiv. Vorbereitet ist ein echter Lesezugriff; echter Schreibbetrieb ist weiterhin gesperrt.',
 setup:pdsSetupSections,
 gates:pdsGuideGates,
 release:[pdsGuideRelease],
 questions:{intro:pdsGuideIntro,items:pdsWriteQuestions},
 errors:pdsTroubleshooting,
 security:pdsGuideSecurity,
 extras:[{title:'Optionale Ergänzungen',paragraphs:[pdsGuideViews]}],
};
export const pdsGuideMarkdown=guideMarkdown(pdsGuide)+'\n'+pdsViewsMarkdown();
