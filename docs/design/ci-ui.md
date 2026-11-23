# HeyElli · CI-/UI-Leitfaden

Verbindliche Gestaltungsgrundlage für neue Module und Änderungen an bestehenden Oberflächen. Stand: 16. November 2026.

## 1. Gestaltungsziel

HeyElli soll sich wie eine ruhige, kompakte macOS-Anwendung anfühlen: klare Werkzeugleisten, präzise ausgerichtete Inhalte, dezente Flächen und unmittelbar erreichbare Funktionen. Die Anwendung bleibt eine browserbasierte Fachsoftware und muss auch mit Tastatur, auf Windows und auf schmalen Bildschirmen gut funktionieren.

Die aktuellen Referenzen sind die [Service-Arbeitsfläche](../../src/apps/servicehub/akten/workspace.tsx) (Variante V1), die [Arbeitsfläche des PlanBoards](../../src/apps/planboard/kalender/planner-workspace.tsx) (Variante R1) und die [Menüleiste](../../src/platform/shell/platform-bar.tsx); verbindlich ist die „Formensprache macOS 26“ unten. Deren Gestaltung ist die Grundlage für weitere Module. Bestehende Fachseiten sind noch nicht vollständig auf diesen Stil umgestellt; ihre bisherigen Abweichungen gelten nicht als neue Designvorgabe.

Für eine mehrstufige Fachmaske dient zusätzlich die [Arbeitsfläche des CaseDesks](../../src/apps/casedesk/erfassung/incident-workspace.tsx) mit den zugehörigen CSS Modules als Referenz: kompakte Kopfzeile und vier Schrittflächen. Im CaseDesk öffnet sich jede Fläche horizontal an ihrer Position. Die übrigen Schritte zeigen Titel, Kurzvorschau und Status. Im schmalen Menüleisten-Werkzeug und auf schmalen Ansichten liegen die Schritte untereinander, mit demselben Formular und derselben Entwurfssicherung. Der transparente Formularkopf übernimmt die dezente Tönung der ServiceHub-Seitenleiste. Die Schrittüberschriften verwenden einfarbige Flächen ohne Hover-Effekt und behalten den Tastaturfokus.

Warnungen und Bestätigungen verwenden den gemeinsamen [AlertDialog](../../src/platform/shell/alert-dialog.tsx), einfache zustandsgesteuerte Rückfragen den `ConfirmationDialog`. Kompakte, mittige macOS-Fläche mit Hinweis-/Warnsymbol, kurzer Überschrift, verständlicher Auswirkung und abgetrennter Aktionszeile. Neutrale Abbruch-/Weiterbearbeiten-Aktion zuerst, ausdrückliche Bestätigung rechts beziehungsweise darunter in Markenrot. Bei Verwerfen/Löschen erhält die sichere Aktion den Anfangsfokus. Native `dialog.showModal()`-Fokusbegrenzung und Escape-Abbruch erhalten; die Rückkehr zum Auslöser sicherstellen. Lange Inhalte scrollen innerhalb des Dialogs, schmale Ansichten stapeln Aktionen. Keine neuen `window.confirm`-/`window.alert`-Abfragen für Anwendungsabläufe. Die vom Browser selbst verwaltete Warnung beim Schließen/Neuladen mit ungespeicherten Eingaben bleibt aus technischen Gründen systemseitig gestaltet.

Abschlussbereiche mehrstufiger Erfassungen gruppieren die letzten Entscheidungen oberhalb einer ruhigen Aktionszeile. Offene Pflichtangaben stehen kompakt neben der primären Speicheraktion, ohne einen zusätzlichen farbigen Hinweiskasten. Während des Speicherns sind die Abschlussfelder gesperrt. Erst nach bestätigter Anlage ersetzt eine einzige Erfolgsfläche die Felder und bietet den nächsten Vorgang an; Fehlermeldungen bleiben im gemeinsamen roten Meldungsstil. Schmale Ansichten stapeln Entscheidungen und Aktion ohne horizontalen Überlauf.

Für breite Planungsansichten ist die [Arbeitsfläche des PlanBoards](../../src/apps/planboard/kalender/planner-workspace.tsx) die Referenz (Variante R1): volle Arbeitsfläche ohne Seitenleiste, **eine** symmetrische Werkzeugleiste, Token-Suche, Planung bis zum unteren Rand und eine schmale Leiste am unteren Rand für Quelle, Aktualisierung und Summen. Die zugehörigen CSS Modules gestalten Dialoge und Menüs, ohne Terminpositionen, Zeitachsenmaße oder fachliche Farbregeln zu verändern.

Die [Arbeitsfläche des DutyBoards](../../src/apps/dutyboard/duty-workspace.tsx) ergänzt die Referenzen um kompakte Hauptreiter, Jahresmatrix, Verteilungsvorschauen und Fairnesstabellen. Hauptreiter verwenden eine gemeinsame segmentierte Fläche; ihre ARIA-Beziehungen und Tastaturbedienung bleiben erhalten. Auf schmalen Bildschirmen wird die Jahresmatrix pro Mitarbeiter in Wochenblöcke umgeordnet, ohne Wochen zu entfernen.

Für Einstellungsbereiche ist die gemeinsame [SettingsWorkspace](../../src/platform/shell/settings-workspace.tsx) mit ihren CSS Modules die Referenz. Einstellungen und Benutzerkonto verwenden denselben Baustein: seitliche, nach System/Organisation/Integrationen gruppierte Navigation mit Symbolen und Bereichssuche. Rechts stehen die aktuelle Seitenüberschrift und gruppierte Einstellungszeilen. Unterbereiche öffnen als weitere Seiten statt als segmentierte Reiter. Unter 720 px ersetzt eine iOS-artige Bereichsliste die Seitenleiste; die Detailansicht erhält die gemeinsame Kopfzeile mit Verlauf. Tabellen scrollen innerhalb ihres Bereichs. In den zentralen Einstellungen verlinkt ein Kontoeintrag mit dem serverseitig ermittelten Benutzernamen und Initialen auf die persönlichen Einstellungen; Desktop und Mobilansicht verwenden denselben Link. Bestehende automatische Speicherung, Geheimnisschutz und Freigaben bleiben erhalten. Bereichswechsel mit ungespeicherten Eingaben verwenden den gemeinsamen Navigationsschutz; dessen Texte müssen modulneutral bleiben.

Die gemeinsame [AppearanceChoice](../../src/system/benutzerkonto/appearance-choice.tsx) wird sowohl im Benutzerkonto unter Anzeige als auch in den zentralen Einstellungen unter Allgemein verwendet. Persönliche Darstellung und Standardvorgabe behalten getrennte Speicherwege. Die Anzeigeauswahl ergänzt dieses Muster um native Radiokarten mit klar unterscheidbaren Vorschauen für Hell, Dunkel und Wie Gerät. Auswahl und Häkchen müssen auch ohne Farbe verständlich sein. Die Vorschauen stellen das jeweilige Erscheinungsbild unabhängig vom aktuell aktiven Theme dar. Bestehende Speicher-, Versions- und Importlogik bei Darstellungsänderungen unverändert weiterverwenden.

### Formensprache macOS 26 (verbindlich seit 20.11.2026)

Vorbild ist macOS 26/27. Ziel: klar, ruhig, einheitlich; klare Fokuselemente stehen immer im Vordergrund. Grundwerte stehen als Variablen in `globals.css` und werden nicht durch freie Werte ersetzt.

| Regel | Umsetzung |
|---|---|
| Konzentrische Rundungen | Fenster 20 px → Flächen 14 px → Zeilen 8 px → Bedienelemente als Kapsel (siehe Abschnitt 5). |
| Einheitliche Bedienhöhe | `--control-height` (32 px) für Schaltflächen, Suchfelder und Seitenleisten-Einträge; Touch-Ziele auf schmalen Geräten größer. |
| Schließen | Alle Schließen-Schaltflächen (Dialoge, Legende, Teamübersicht, Über-Dialog, Werkzeuge, Notizen, Vorschau) verwenden die gemeinsame Klasse `heyelli-close`: 28-px-Kreis in Markenrot mit gezeichnetem weißem X, zugänglicher Name „… schließen“. Einzige Ausnahme ist Spotlight mit neutralem Kreis. X-Symbole, die etwas entfernen (Filter-Tokens, Auswahl-Chips), sind keine Schließen-Schaltflächen und bleiben klein und neutral. |
| Kapsel nur mit Luft | Kapseln (`--radius-control`) nur für Menüleiste, Spotlight, Such- und Filterfelder, Werkzeugleisten und Seitenleisten-Einträge – mit seitlichem Innenabstand mindestens der halben Höhe (32 px → ≥ 16 px). Übrige Schaltflächen sind abgerundete Rechtecke (`--radius-item`, 8 px). Menüzeilen (App-, Benutzer-, Mehr- und Vorschlagsmenüs) sind abgerundete Rechtecke wie unter macOS. Auswahl- und Hoverrahmen liegen innen (`inset`), damit scrollende Listen sie nicht abschneiden. |
| Popup-Menüs | Keine nativen `<select>` in Werkzeug-, Listen- und Filterköpfen. Stattdessen `PopUpButton` aus `@/system/benutzerkonto`: Kapsel 32 px mit Wert und ⌃⌄, Menü auf der gemeinsamen Glas-Menüoberfläche, Häkchen am gewählten Eintrag, Pfeiltasten, Anfangsbuchstabe, Escape; das Menü klappt am Fensterrand nach links. Aktionsmenüs (z. B. Auftragsstatus) verwenden denselben Auslöser. |
| Werkzeugleiste der Akte | Einzelknöpfe rund 36 px, Gruppen als Kapsel 36 px mit 30-px-Innenknöpfen und Trennstrich; Reihenfolge: Zurück, Vorgangsaktionen (rote Kapsel „Einsatz planen“), Navigation (Kunde · Objekt · Einheit · PDS), rechts Persönliches (Anheften, Ausblenden) bzw. Status. Bezeichnungen sind immer die Aktenart („Objekt“, nie „Übergeordnet“). Leere Gruppen werden nicht angezeigt. Der Hintergrund der Service-Leiste verwendet dickes Glas. Die Kapseln und Einzelknöpfe haben darauf eine eigene getönte Glasfläche mit Lichtkante. Symbole teilen die Fläche ihrer Gruppe. |
| Tastaturfokus | Verbindlich in `globals.css` (zuletzt): Bedienelemente erhalten einen Ring außen (3 px, 2 px Abstand), der der Rundung folgt; Zeilen in Listen, Menüs, Reitern und Navigation einen Ring innen (2 px, −2 px). Felder mit Symbol oder Token in einer Kapsel tragen `heyelli-field`: der Ring liegt um die Kapsel, nicht um das innere Eingabefeld. Module setzen keine eigenen Fokusbreiten oder -abstände. |
| Auswahl | Eine Auswahlfarbe für alle Listen und Bäume: Akzentfläche mit weißer Schrift (wie Mail), keine farbige Kante. |
| Anheften | Stecknadel in einer Farbe (`--pin-color`, hell kräftiges Bernstein): Seitenleiste „Angeheftet“, „Offene Aufträge“, Auftragszeilen, Kundenliste und Werkzeugleiste der Kundenakte. |
| Aktenkopf | Alle Akten beginnen gleich: Kürzel oder Symbol (44 px), Name fett 16 px, darunter Art · Nummer und Status; Aufklappzeilen zeigen › rechts statt ▶. |
| Ein Fokuselement je Ansicht | Genau eine rote Hauptaktion bzw. ein roter Hinweis pro Ansicht (z. B. „Auftrag öffnen“ im Hinweisbalken, „Einsatz planen“ in der Akte, „Neuer Termin“ im PlanBoard, älteste fällige Wartung). Auswahl in Listen und Spotlight ist rot gefüllt (Liste) bzw. rot gerahmt (Raster). |
| Keine doppelten Überschriften | Der App-Name steht nur im App-Menü der Menüleiste, der Bereich nur markiert in der Seitenleiste. Hauptansichten wiederholen beides nicht als sichtbare Überschrift (für Screenreader bleibt eine `sr-only`-Überschrift). Zähler stehen in der Seitenleiste oder in einer Ergebniszeile, nicht in einer zweiten Überschrift. |
| Symmetrie | Werkzeugleisten dreiteilig (links Kontext, Mitte Ansicht, rechts Aktionen); Kennzahlen als durchgehendes Band; Gruppen gleich breit. |
| Glas und Schatten | Bedienoberfläche aus Glas (Menüleiste, Fensterrahmen, Seitenleisten, Menüs, Spotlight, Dialoge), Inhalte deckend; nur die vier Schattenstufen (siehe Abschnitt 4). |
| Wiederkehrende Bausteine | Fenster mit Seitenleiste, Token-Suche, Hinweisbalken, Kapsel-Filter, Menüs „Darstellung“ und „Mehr“, Leiste am unteren Rand. Neue Module verwenden diese Bausteine statt eigener Varianten. |

**Menüleiste:** 42 px (mobil 46 px), deckend, Bedienelemente als Kapseln mit 32 px Höhe, Text 13,5 px, Symbole 18 px. Funktionen: Wortmarke (öffnet Spotlight), Zurück/Vorwärts, App-Menü, Datum und Uhrzeit mittig, Werkzeuge, Benutzermenü. **Spotlight** klappt unter der Wortmarke auf: Kapsel-Suchfeld, Raster/Liste, Bereichsfilter als Kapseln, vier Spalten (mobil zwei), Tastaturhinweise einschließlich `⌘K`.

**Fenster mit Seitenleiste (Service, Variante V1):** ein Fenster mit einklappbarer Seitenleiste wie Mail. **Entscheidung 21.11.2026 (Mockups):** Die Seitenleiste sitzt fest im Fenster – kein eigener Rahmen, Schatten oder Abstand, leicht abgesetzter Hintergrund (`--foreground` 4 %) und nur senkrechte Trennlinien zwischen Seitenleiste, Liste und Inhalt; keine Linie unter dem Kopf der Seitenleiste; Liste und Inhalt behalten ihre Kopflinie. In ServiceHub steht „Seitenleiste ein/aus“ rechts im kompakten Seitenleistenkopf. Die Symbole der Arbeitslisten nutzen die Akzentfarbe. Das Einklappsymbol ist neutral, verwandte Apps zeigen ihre App-Farben. Zähler erscheinen bei positiven Werten. Die Arbeitslisten beginnen direkt darunter. Der neutrale Stift für einen neuen Auftrag steht links in der Aktenwerkzeugleiste. Stift, Lupe und Einklappsymbol nutzen dieselbe Größe, Rundung und Oberfläche. In MailDesk bleibt „Neu laden“ im Seitenleistenkopf. Auf schmalen Bildschirmen bleibt die Bereichsleiste oben. Umgesetzt in Service, MailDesk, Aufgaben und MissionControl. Inhalt: „Arbeitslisten“ mit Zählern, „Angeheftet“ (persönliche Kunden), „Offene Aufträge“ (höchstens fünf Kunden, dann „N weitere …“), „Alle Kunden …“ und „Verwandte Apps“. Lange Listen (Kunden) gehören nie vollständig in die Seitenleiste, sondern in die Liste mit Suche und Filterkapseln. Liste und Akte stoßen ohne Abstand aneinander; beide Köpfe sind gleich hoch und durch dieselbe Linie getrennt. Listenzeilen: Kunde fett mit Termin rechts (rot, wenn er fehlt), darunter Nummer · Titel · Status und eine zweizeilige Vorschau; ein Punkt markiert Planungsbedarf. Seitenleiste, Listenkopf und Aktenkopf bilden eine durchgehende Kopfzeile (57 px, eine Linie); die Seitenleiste ist bündig, keine schwebende Karte. Listenfilter sind Kapseln (Ohne Termin, Ohne Techniker, Heute, Alle), Zeilen tragen ein farbiges Gewerkesymbol. Die Auftragsakte beginnt wie eine Mail: Kundenkürzel, Kunde fett, darunter Nummer · Titel, Objekt und Techniker mit Status; dann Termin- und Technikerkachel, Beschreibung als Fließtext und Einsatzmappe, Rücklauf und Material als zugeklappte Zeilen einer Karte. „Einsatz planen“ ist das rote Kalendersymbol in der Werkzeugleiste. Die Akte erhält mehr Breite als die Liste. Mobil wird die Seitenleiste zur waagerechten Bereichszeile, die Akte ersetzt die Liste.

**MailDesk** verwendet dasselbe Fenster mit drei Spalten (Seitenleiste mit Ordnern und Zählern, Liste, Lesebereich). Kennzeichen in Listenzeilen sind Kapseln mit fester Bedeutung: grün zugeordnet, orange Vorschlag, blau Auftrag, grau offen. Eine Zuordnung steht als farbiger Balken über der Mail mit genau einer Hauptaktion. Bei schmalem Lesebereich zeigt die Werkzeugleiste nur Symbole (Containerabfrage), statt umzubrechen.

**Aufgaben** übernimmt das MailDesk-Fenster (Seitenleiste mit Ansichten, Quellen und Team; Liste; Detail). Listenzeilen beginnen mit einem Status-Ring (leer offen, halb blau in Bearbeitung, orange warten), rechts die Fälligkeit (rot überfällig, orange heute). Herkunftskapseln haben feste Farben: orange PDS-Aufgabe, blau Mail, rot Auftrag. Inhalte, die nur heyelli speichert, tragen im Kartenkopf „nur in heyelli“; PDS-Inhalte „aus PDS“. Der Dialog „Aufgabe anlegen“ ist ein kompaktes Sheet mit dem Hinweis „Wird in PDS gespeichert“.

**MissionControl** nutzt das Fenster mit Seitenleiste, Hauptbereich und rechter Spalte (Jetzt im Fokus, Heute mit Fokusziel, Woche je Ziel, Kalender heute; in Ziele und Rückblick: Fokuszeit je Tag, Wohin ging die Zeit). Wichtige Aufgaben sind Karten (höchstens drei, freie Plätze als gestrichelte Ablageflächen), weitere Aufgaben eine Liste, die Woche fünf Tagesspalten mit Auslastungsbalken. Der Fokus belegt das ganze Fenster; Schritte und Notizen sind standardmäßig ausgeblendet und werden über Kapselknöpfe einzeln eingeblendet (Zustand je Gerät gemerkt).

**Volle Arbeitsfläche (PlanBoard, Variante R1):** Planungsansichten haben keine Seitenleiste. Eine Werkzeugleiste: links Zeitraum mit Heute, Mitte Tag/Woche/Monat, rechts Token-Suche, „Darstellung“ (Anzeigeschalter), „Mehr“ (Teamübersicht, Ressourcenauswahl, Legende, Bereitschaft), „Mobil ausgeben“ und „Neuer Termin“. Erläuterungen stehen nicht als Fließtext unter der Planung, sondern kompakt in der Leiste am unteren Rand bzw. als Tooltip.

**Token-Suche:** ein Suchfeld; aktive Filter erscheinen als Kapseln mit × und lassen sich mit ⌫ entfernen. Im PlanBoard wählt man beim Tippen, ob der Begriff Ressourcen eingrenzt (grün) oder Termine hervorhebt (blau); beide Filter können gleichzeitig mit unterschiedlichen Begriffen aktiv sein. Terminfilter **blenden ab statt aus**, damit die Belegung sichtbar bleibt; Kapazitäten bleiben ungefiltert.

**Hinweisbalken:** ein rot getönter Balken oben in der Ansicht mit Anzahl, kurzer Aussage und einer Aktion. Im Cockpit haben Aufträge ohne Termin Vorrang, gefolgt von Aufträgen ohne Haupttechniker und überfälligen Wartungen. Ohne Handlungsbedarf entfällt der Balken. Weitere Hinweise (z. B. Wartungen ohne eindeutige Fälligkeit) verwenden denselben Baustein.

In **Service → Aufträge** wechseln ↑ und ↓ zwischen den sichtbaren Treffern. Am Desktop setzt ein Klick den Fokus in die Auftragszeile und zeigt die Akte. Die Pfeiltasten funktionieren auch direkt von der Aktenüberschrift aus. Enter führt zur Akte, Escape zur gewählten Listenzeile. Auf schmalen Geräten öffnet Enter die Akte als eigene Ansicht. Eingerückte Trenner ab der Textspalte, einzeilige Vorschauen und kleinere Gewerkesymbole gliedern die Auftragszeilen.

**Kunden & Objekte** verwendet dieselbe zweiteilige Kopfzeile und die rechte Aktenwerkzeugleiste. Die Kategorien Alle, Angeheftet und Mit offenen Aufträgen stehen direkt unter dem Titel. Ausgeblendete Einträge sind über das Auge rechts im Listenkopf erreichbar. Die aufschiebbare Suche rechts oben bietet Treffer für Kunden, Objekte und technische Einheiten. Die Liste bleibt alphabetisch gegliedert. Feine, eingerückte Trenner wie in der Auftragsliste gliedern Kunden, Objekte und technische Einheiten. Die Kundenzeile öffnet die Kundenakte. Der separate Pfeil am Zeilenende klappt Objekte und Einheiten auf. Pfeil hoch und runter wechseln zwischen den sichtbaren Zeilen, Enter öffnet die Akte, Escape gibt den Fokus an die gewählte Zeile zurück. Am Desktop bleibt die Akte dabei sichtbar. Bei Hover behalten ausgewählte Zeilen ihre Auswahlfarben. Die Pinnadel steht in der Kundenakte neben dem Auge. Kleine Statusmarkierungen wie in MailDesk zeigen offene Aufträge und fällige Wartungen mit eigenem Symbol und Zähler. Aufgeklappte Objekte und technische Einheiten zeigen die jeweils zugeordneten Vorgänge. Zeilen ohne Treffer erhalten keine Markierung.

In **Service → Aufträge** steht rechts im Listenkopf eine gemeinsame Kapsel. Links in der Kapsel öffnet „…“ die Filteroptionen. Rechts schaltet das Filtersymbol die Kriterien ein oder aus. In der zweiten Zeile desselben Listenkopfs stehen die Auswahlkategorien Ohne Termin, Ohne Techniker, Heute und Alle. Inaktive Kategorien zeigen ihr Symbol, die aktive Kategorie zeigt zusätzlich den Namen. Planung, Auftragsstatus und Markiert lassen sich kombinieren. Der Schalter pausiert alle drei Kriterien und stellt dieselbe Auswahl beim Einschalten wieder her. Suche und Kundenauswahl gelten unabhängig davon. Die Auftragssuche sitzt rechts oben in der Aktenleiste. Ein Klick auf die Lupe schiebt das Feld nach links auf und setzt den Fokus hinein. Passende Aufträge erscheinen direkt darunter und öffnen sich per Klick oder per Pfeiltasten und Enter. Die Werkzeugleiste verteilt vier Blöcke mit gleichmäßigen Zwischenräumen: Neuer Auftrag, Aktennavigation, weitere Aktionen und Suche. Einklappsymbol, Filterkapsel und Aktenwerkzeuge teilen dieselbe Höhe und obere Ausrichtung. Zwischen Listenkopf und erstem Auftrag gilt derselbe Abstand wie vom Trenner zur nächsten Zeile. Bei wenig Platz wechseln die Aktionen in eine zweite Zeile. Leere Service-Listen zeigen einen eingerückten Leerzustand mit neutralem Symbol und bei Bedarf einer passenden Aktion. Der ungewählte Aktenbereich zeigt den Hinweis mittig unter der Werkzeugleiste. Auf schmalen Bildschirmen bleibt der Listenhinweis sichtbar. Kunden-Direktlinks unter „Offene Aufträge“ öffnen die gefilterte Auftragsliste mit dem regulären Listenkopf. Die Fahne sitzt in der Aktenwerkzeugleiste neben dem Status und erscheint bei markierten Aufträgen in der Liste. „Markiert“ in der Seitenleiste öffnet die persönliche Arbeitsliste.

**Wartungen** verwenden dieselbe Kopfzeile, Filterkapsel, aufschiebbare Suche, Zeilentrenner und Tastatursteuerung wie Aufträge. Rechts zeigt die gewählte Wartung Fälligkeit, Vertrag, Leistungsumfang, Standort und die verfügbaren Angaben der technischen Einheit. „Auftrag erzeugen“ öffnet die Vorschau aus der Aktenwerkzeugleiste. Auf schmalen Bildschirmen führt „Zurück zu Wartungen“ zur gewählten Zeile.

### Gemeinsame Webkomponenten

Fachmodule beziehen allgemeine Bedienelemente über [`@/platform/ui`](../../src/platform/ui/index.ts). Aktuell verfügbar sind `Card` als gemeinsame macOS-Kartenfläche, `Button` (Hauptaktion, Umriss, neutral, Filter, Link und Schließen, optional mit Symbolgröße oder Kapselform), `Input`, `Textarea`, `NativeSelect`, `Switch`, `Dialog` und `Popover` mit Menüzeile und Trenner. In ServiceHub verwenden Objekt, Einheit, Filter, Auftragsstatus und Suchvorschläge dieselbe Popover-Oberfläche. Themevariablen steuern Glas, Zeilen, Trenner und Fokusrahmen. Auswahlmenüs und Suchvorschläge bleiben Listenfelder, und Statusaktionen bleiben ein Menü. Die Bausteine basieren auf [shadcn/ui mit Radix](https://ui.shadcn.com/docs/components/radix/button). Ihre CSS-Module verwenden HeyElli-Themevariablen für Systemschrift, Oberflächen, Kanten, Rundungen und Bedienhöhen. Die globalen Regeln für Tastaturfokus gelten auch hier. Normale Schaltflächen beginnen bei 32 px am Desktop und 44 px bis 600 px Ansichtsbreite oder bei grobem Zeiger. Für kompakte Aktenwerkzeuge und die Schließen-Schaltfläche gelten die Größen aus der Formensprache.

Für Gespräch, Nachrichten, Quellen, Vorschläge und Eingabe verwenden KI-Ansichten [`@/platform/ui/ai-elements`](../../src/platform/ui/ai-elements/index.ts), abgestimmt auf die aktuellen [AI-Elements-Muster von shadcn/ui](https://ui.shadcn.com/docs/ai-elements). Die erste umgestellte Ansicht ist AskElli. Text wird mit Enter gesendet, Umschalt+Enter erzeugt einen Zeilenumbruch. Beschriftungen, Antwortzustände und Quellen bleiben für assistive Technik erreichbar. Ansichtsbausteine erhalten Nachrichten als Daten vom Fachmodul. Anbieterwahl, Berechtigungen und Entwurfssicherung bleiben in AskElli.

Service verwendet die gemeinsamen Bausteine in Cockpit, Auftragsliste, Wartungen, Kunden- und Objektakten, Kunde 360 sowie in der Einsatzmappe und den Service-Dialogen. Die Standardvariante für Filterkapseln verwendet `aria-pressed`. Suchfelder mit integriertem Symbol zeigen den Fokusring um die gemeinsame Hülle `heyelli-field`. Popup-Auswahl und Bestätigungsdialoge verwenden die Bausteine auch in gemeinsam genutzten Ansichten. Native Dialoge nutzen die Browser-Fokussperre und können von der Plattform bei Sitzungsablauf vorübergehend geschlossen werden.

Neue Bedienelemente zentral ergänzen und über den öffentlichen Einstieg exportieren. ESLint sperrt direkte Radix- und interne UI-Importe sowie native Buttons, Eingabefelder, Auswahlfelder und Dialoge außerhalb der UI-Schicht. `eslint-suppressions.json` erfasst vorhandene Stellen während der Umstellung je Datei. Nach einer Migration über `npm run lint -- --prune-suppressions` verkleinern. Fachlayouts wie Terminraster, Listen und Tabellen können ihr eigenes semantisches HTML verwenden. Ihre Bedienelemente nutzen dieselbe UI-Schicht.

## 2. Identität und Sprache

| Element | Vorgabe |
| --- | --- |
| Produktname | **HeyElli**, Schreibweise beibehalten; Wortmarke „HeyElli.“ mit rotem „Elli“ |
| Arbeitsbereich | **Service** |
| Durchgängige obere Leiste | **Menüleiste**; davon getrennt: Werkzeugleisten innerhalb der Apps |
| Fachmodule | **CaseDesk**, **PlanBoard**, **DutyBoard** |
| Übergreifende Bereiche | **Einstellungen**, **Benutzerkonto** |
| Ton | Kurz, sachlich, freundlich; konkrete Tätigkeiten benennen |
| Aktionen | „Öffnen“, „Umbenennen“, „Löschen“, „Automatisch verteilen“ statt technischer Bezeichnungen |

Modulnamen in Navigation, Service-Menü, Hauptüberschrift, Browser-Titel und Anleitungen identisch verwenden. Bestehende technische URLs, Kennungen und Speicherschlüssel bei einer rein sprachlichen Änderung erhalten.

Erklärungen dort zeigen, wo sie eine Entscheidung unterstützen. Keine wiederholten Einleitungen, Pfadzeilen, dauerhaften Erfolgstexte oder doppelt benannten Überschriften. Technische Details gehören in die Anleitung oder in einen gezielt geöffneten Detailbereich.

Aktuelle Pfade: zentrale Einstellungen `/einstellungen` (Administrator), persönliche Einstellungen `/benutzerkonto` (gültige Sitzung mit Leserecht). `/verwaltung` ist ausschließlich ein geschützter Weiterleitungsalias. Technische API-Pfade bleiben unabhängig von den sichtbaren Bereichsnamen stabil.

Das Benutzerkonto bietet „Benutzerkonto“ mit der Unterseite „Profil“ und „Anzeige“ als separaten Bereich in der Seitenleiste beziehungsweise mobilen Bereichsliste. Ältere Links zur verschachtelten Anzeige öffnen weiterhin die Darstellungswahl. Schreibgeschützte Kontoinformationen stehen ausschließlich unter Profil, die Darstellungswahl unter Anzeige. Schreibgeschützte Kontoinformationen werden als ruhige Profilkarte dargestellt: Initialen-Avatar und Name, darunter klar beschriftete Zeilen für Rolle und Mitarbeiter. Fehlende Zuordnungen neutral benennen; nicht erreichbare Daten nicht als fehlende Zuordnung darstellen. Keine bearbeitbar wirkenden Eingabefelder für reine Informationen.

## 3. Aufbau einer Seite

```text
Gemeinsame Menüleiste – einmal pro geschützter Ansicht
  HeyElli. (App-Suche) · Zurück / Vorwärts · Aktuelle App ⌄ | Datum / Uhr | Benutzer

Modulinhalt
  Hauptüberschrift
  Hauptreiter, falls mehrere Arbeitsbereiche vorhanden sind
  Unterreiter, falls fachlich erforderlich
  Werkzeugleiste: Zeitraum / Auswahl / Aktionen
  Suche und Filter unmittelbar beim betroffenen Inhalt
  Tabelle, Kalender, Formular oder Liste
```

- Die Menüleiste kommt aus dem gemeinsamen geschützten Layout. Fachmodule erzeugen keine eigene Kopie und kein zweites Logo.
- In Planer-Apps steht der App-Name ausschließlich in der Menüleiste; keine sichtbare Titel-/Symbolzeile über dem Inhalt. Eine unsichtbare Hauptüberschrift für assistive Technik erhalten. Das jeweilige App-Symbol steht im „Über …“-Dialog. Andere Seiten behalten höchstens eine sichtbare Hauptüberschrift. Unterreiter nicht durch eine identische Überschrift wiederholen.
- Bestehende Module gleicher Art als strukturelle Vorlage verwenden. Reihenfolge, Abstände und Aktionspositionen nicht pro Seite neu erfinden.
- Das Service-Menü ist ein Einstieg mit App-Symbolen. Fachplaner erhalten eine arbeitsorientierte, möglichst breite Inhaltsfläche; sie werden nicht in eine zusätzliche kleine Fensterattrappe gezwängt.
- Tabellen und Kalender dürfen verfügbaren Platz nutzen. Keine großen Leerflächen zwischen Suche, Werkzeugleiste und Inhalt.
- Verwandte Auswahlmöglichkeiten gruppieren, etwa Tag/Woche/Monat oder Jahresnavigation. Unterschiedliche Aktionen wie „Heute“ und „Weiter“ optisch klar trennen.
- „Neu laden“ nur bei fachlichem Nutzen vorsehen; wenn vorhanden, rechts an der zugehörigen Werkzeugleiste. Automatische Hintergrundaktualisierung bevorzugen.

## 4. Farben und Materialien

Vorhandene CSS-Variablen verwenden. Gemeinsame Grundwerte stehen in [globals.css](../../src/app/globals.css), lokale Service-Variablen in [workspace.module.css](../../src/apps/servicehub/akten/workspace.module.css).

| Rolle / Variable | Hell | Dunkel | Verwendung |
| --- | --- | --- | --- |
| `--background` | `#f5f6f8` | `#202124` | Arbeitsfläche |
| `--surface` | `#ffffff` | `#2b2c30` | Fenster, Menüs, Inhaltsflächen |
| `--foreground` | `#20242c` | `#f4f4f5` | Haupttext |
| `--muted` | `#535d6b` | `#bfc0c7` | Begleittext, Metadaten |
| `--border` | `#c8cdd5` | `#494a50` | Sichtbare Formularkanten und Trennungen |
| `--primary` | `#d82b3c` | `#d82b3c` | Marke und wichtigste Aktion |
| `--focus` | `#a51e35` | `#ff8591` | Tastaturfokus |

Für besonders feine Linien und Hoverflächen aus `--foreground` mit `color-mix()` ableiten: etwa 10–11 % für Linien und 4–6 % für Hoverflächen. Farbe nie als alleinige Zustandsinformation verwenden. Lesbarkeit in beiden Darstellungen prüfen: Ziel mindestens 4,5:1 für normalen Text und 3:1 für große Schrift sowie wesentliche Bedienelemente.

**Materialien und Schatten (verbindlich, Stufe B „Ausgewogen“, 20.11.2026):** Glas für die Bedienoberfläche nach macOS 26 – Menüleiste und Fensterrahmen `--glass-thin`, Seitenleisten, Menüs, Popover und Spotlight `--glass-regular`, Dialoge `--glass-thick`, jeweils mit `--glass-blur` und Lichtkante `--glass-edge`. Inhalte (Listen, Akten, Planung, Formulare) bleiben deckend (`--surface`). Hinter den Fenstern liegt der dezente Hintergrundverlauf `--wallpaper`. Schatten nur über die vier Stufen `--shadow-1` (Flächen/Karten), `--shadow-2` (schwebende Teile), `--shadow-3` (Fenster, Menüs, Popover) und `--shadow-4` (Dialoge, Spotlight); Bedienelemente in Leisten und Menüs haben keinen Schatten, Fokusringe und Innenschatten sind keine Stufenschatten. Bei „Transparenz reduzieren“ oder ohne `backdrop-filter` werden alle Materialien deckend. Neue Module setzen keine eigenen Schatten- oder Transparenzwerte.

App-Symbole besitzen feste Identitätsfarben: CaseDesk Korallrot, PlanBoard Blau, DutyBoard Violett. Diese Farben unterscheiden Module; sie sind keine fachlichen Statusfarben. Kalenderfarben, Kategorien und ihre Reihenfolge stammen aus den zentralen Einstellungen beziehungsweise der angebundenen Datenquelle und dürfen nicht durch das Oberflächendesign ersetzt werden.

### Anmeldebildschirm

Anmeldung (`/anmeldung`) und Pflicht-Passwortwechsel (`/passwort-aendern`) verwenden den gemeinsamen `LockScreen` aus [lock-screen.tsx](../../src/system/anmeldung/anmeldung/lock-screen.tsx) im Stil des macOS-Sperrbildschirms (Entwurf B1, 19.11.2026):

- Immer dunkel, unabhängig von der persönlichen Darstellung; ruhiger, gedeckter Hintergrund, der ohne Unschärfe vollständig deckend ist. Keine Menüleiste.
- Oben Datum und Uhrzeit (Europe/Berlin, tabellarische Ziffern), unten die große Wortmarke „Hey**Elli**.“ als einziges Markenzeichen; keine zusätzliche kleine Marke, keine Initialen oder Personenbilder vor der Anmeldung.
- Eingaben als abgerundete Pillen (Höhe 36 px) mit unsichtbarer, aber zugänglicher Beschriftung; Absenden über den roten Pfeil im Passwortfeld (zugänglicher Name „Anmelden“). „Mit Microsoft anmelden“ als zurückhaltende Pille darunter; nach Aktivierung der Microsoft-Anmeldung bleibt nur diese.
- Keine funktionslosen Elemente („Angemeldet bleiben“, „Passwort vergessen“-Links o. Ä.). Auf schmalen Flächen werden Uhr und Wortmarke kleiner, die Eingaben bleiben ohne Scrollen sichtbar.

## 5. Schrift, Abstände und Formen

| Bereich | Richtwert |
| --- | --- |
| Schriftfamilie | **Verbindlich:** `var(--font-ui)` = `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (definiert in `globals.css`); Wortmarke: `var(--font-wordmark)` = `Arial, Helvetica, sans-serif` |
| Modulüberschrift | 20–24 px, Gewicht 600–650; keine große Werbeüberschrift |
| Text / Formular / Tabelle | 13–14 px; bei komplexen Eingaben entsprechend größer |
| Werkzeugleisten / Menüs | 12–13 px |
| Ergänzende Metadaten | 11–12 px; nicht für wichtige Eingaben oder Entscheidungen |
| Abstände | Grundraster 4 / 8 / 12 / 16 / 24 / 32 px |
| Kontrollhöhe | Desktop mindestens 32 px; bei Touchbedienung nach Möglichkeit 44 px |
| Rundung | **Verbindlich, konzentrisch:** Fenster/Arbeitsflächen `--radius-window` (20 px) → Flächen, Gruppen, Menüs `--radius-panel` (14 px) → Zeilen, Eingabefelder `--radius-item` (8 px) → Kennzeichen `--radius-small` (6 px); Bedienelemente als Kapsel `--radius-control`. Keine freien px-Werte. |
| Fokus | Sichtbarer Ring, 3 px mit 2 px Abstand, Farbe `--focus` |
| Bewegung | Kurz und dezent, etwa 120–180 ms; `prefers-reduced-motion` beachten |

**Schrift verbindlich festgelegt:** Die gesamte Anwendung einschließlich Anmeldebildschirm, Dialogen und Menüleiste verwendet ausschließlich die Systemschrift über die CSS-Variable `--font-ui`. Neue Module setzen `font-family: var(--font-ui)` und wiederholen die Schriftliste nicht. Keine Webfonts, eingebetteten oder nachgeladenen Schriften (auch nicht von Google Fonts) und keine weiteren Schriftfamilien. Ausnahmen: `monospace` für Code und technische Kennungen sowie die **Wortmarke „Hey**Elli**.“**: Sie ist ein Logo und verwendet überall dieselbe feste Schrift `var(--font-wordmark)` = `Arial, Helvetica, sans-serif` (Gewicht 750–800, Laufweite −0,06 em), in Menüleiste, Anmeldebildschirm und Über-Dialogen. Auf macOS erscheint damit SF Pro, unter Windows Segoe UI.

Zeilenhöhe für Lesetext etwa 1,5–1,6. Für Zahlen und Uhrzeiten tabellarische Ziffern verwenden. Schatten dienen der Hierarchie: stärkere Schatten für schwebende Menüs, schwache für Fenster, keine Schatten an jeder Tabellenzelle.

Die Menüleiste ist regulär 56 px und auf schmalen Flächen 52 px hoch. Für davon abhängige Höhen `--platform-bar-height` verwenden, nicht einen zweiten festen Wert einführen. Das Service-Menü besitzt bewusst größere App-Symbole; diese Größe nicht für normale Werkzeugleisten übernehmen.

Oben links verwendet die Menüleiste ein zusammengehöriges Paar schlichter Chevron-Schaltflächen für Zurück und Vorwärts. Die Pfeile navigieren im bekannten internen Verlauf; fehlende Ziele werden deaktiviert. Hauptbereiche in Einstellungsansichten werden über den validierten Parameter `bereich` mitgeführt, damit Browser- und App-Navigation denselben Zustand herstellen. Der gemeinsame Navigationsschutz gilt auch bei Query-Wechseln.

## 6. Gemeinsame Bausteine verwenden

| Bedarf | Bestehender Baustein / Referenz |
| --- | --- |
| Menüleiste und zentrale Navigation | `PlatformBar`, Navigationsbaum in `src/platform/shell/navigation.ts` |
| Interne Navigation mit Schutz ungespeicherter Eingaben | `GuardedLink`, `useGuardedNavigation` aus `@/system/benutzerkonto` |
| Aufklappmenüs, gegenseitiges Schließen, Escape | `Dropdown` in `src/platform/shell/dropdown.tsx` |
| Fehler-, Erfolgs- und Statusmeldungen | `Notice` und bei Bedarf `useNoticeState` aus `@/system/benutzerkonto` |
| Darstellung Hell / Dunkel / Gerät | Bestehende `AppearanceSettings` und persönliche Einstellungen |
| App-Einstieg | `ServiceMenu` aus `@/apps/servicehub/katalog` |
| Ressourcen auswählen | Vorhandener gemeinsamer `ResourceSelectionDialog` im PlanBoard |
| Fachliche Reiter und dichte Werkzeugleisten | DutyBoard und Einstellungen als funktionale Referenzen; neue Gestaltung an diesen Leitfaden anpassen |

Fachmodule nur über öffentliche Einstiegspunkte anbinden; den vorhandenen öffentlichen Export nutzen oder ergänzen. Komponenten, die noch keinen öffentlichen Export besitzen, nicht für eine zweite Implementierung kopieren. Wiederkehrende Muster zuerst zentralisieren. Fachbezogene Darstellung über CSS Modules kapseln; übergreifende Variablen und Bausteine zentral pflegen. Keine pauschalen Änderungen an `button`, `a` oder `main` für eine einzelne Fachseite.

## 7. Bedienelemente und Interaktion

- Hauptaktionen klar hervorheben, sekundäre Aktionen neutral gestalten. Nicht jede Schaltfläche rot füllen.
- Zusammengehörige Optionen als zusammenhängende Auswahl darstellen. Aktiver Zustand muss auch ohne Hover erkennbar sein.
- Einfache Linien-SVGs mit einheitlicher Strichstärke nutzen: ca. 1,6–1,8 bei 18–20 px in Werkzeugleisten. Keine gemischten Emoji-, Schriftzeichen- und Icon-Stile für Fachaktionen.
- Reine Symbolaktionen benötigen einen zugänglichen Namen und eine verständliche Beschriftung beim Darüberfahren. „Kopieren“ darf dezent beim Hover erscheinen, muss aber auch mit Tastatur erreichbar sein.
- Keine dekorativen Schließen-/Minimieren-Knöpfe ohne Funktion und keine Browser-Sicherheitsmechanismen nachbauen. macOS-Anmutung entsteht durch Anordnung und Material, nicht durch funktionslose Fensterknöpfe.
- Kontextmenüs neben dem Auslöser öffnen. Untermenüs bevorzugt rechts, bei Platzmangel links. Löschen und Stornieren bestätigen, ohne den Bezug zum betroffenen Eintrag zu verlieren.
- Bei Kalenderterminen öffnet Einfachklick das Quickmenü, Doppelklick die vollständige Bearbeitung. Diese bestehende Bedienung erhalten.
- Dialoge mit klarer Überschrift, geordneten Feldgruppen und eindeutigen Aktionen. Fokus beim Öffnen sinnvoll setzen, innerhalb eines modalen Dialogs halten und beim Schließen zum Auslöser zurückführen. Escape respektieren; ungespeicherte Eingaben nicht verlieren.

## 8. Formulare, Speichern und Rückmeldung

Eingaben eindeutig beschriften, Einheiten direkt am Feld zeigen und zusammengehörige Werte in einer Zeile gruppieren, soweit Platz vorhanden ist. Platzhalter ersetzen keine Beschriftung. Kurze Feldhilfe nur bei tatsächlichem Erklärungsbedarf.

Einstellungen bevorzugt automatisch speichern. Dabei „Wird gespeichert …“, Erfolg und Fehler korrekt unterscheiden; keine Erfolgsmeldung vor Serverbestätigung. Bereits automatisch gespeicherte Einstellungen erhalten keinen zusätzlichen überflüssigen Speichern-Knopf. Fachaktionen wie das Anlegen eines Serviceauftrags können weiterhin eine ausdrückliche Bestätigung benötigen.

| Zustand | Darstellung und Verhalten |
| --- | --- |
| Laden beim ersten Aufruf | Ruhiger Ladebereich mit verständlichem Statustext; keine Fachdaten vor Sitzungsprüfung zeigen |
| Hintergrundaktualisierung | Bestehende Inhalte bedienbar lassen; kein Sperren oder Flackern der gesamten Ansicht |
| Einzelner Termin wird gespeichert | Ladekringel am Termin; Öffnen bleibt möglich, seine Bearbeitungsfelder vorübergehend deaktiviert |
| Erfolgreich gespeichert | Kurze dezente positive Rückmeldung, falls sie einen Nutzen hat |
| Fehler | Roter `Notice`-Kasten am betroffenen Bereich, verständlicher Text und mögliche nächste Aktion |
| Neutraler Hinweis | Dezente neutrale `Notice`; keine rote Fehlersignalisierung |
| Dauerhafter Speicherfehler / echter Feldkonflikt | Sichtbare, handlungsorientierte Meldung; Eingaben erhalten |
| Leere Ansicht | Klar sagen, was fehlt, und bei Bedarf die passende Aktion anbieten |

Gesicherte Entwürfe bleiben im Hintergrund. Bei Konflikten nur widersprüchliche Änderungen desselben Felds zur Entscheidung vorlegen und Benutzer sowie Zeitpunkt beider Änderungen nennen. Unabhängige Änderungen automatisch zusammenführen. Vorhandene Wiederholungs-, Entwurfs- und Hintergrundspeichermechanismen bei Designänderungen erhalten.

Ellis Antwortbewertungen verwenden kompakte Daumensymbole mit zugänglicher Beschriftung, sichtbarem Tastaturfokus und `aria-pressed`. Nur Administratoren sehen diese Aktionen. Negative Bewertungen werden sofort gespeichert; optionale Gründe und Hinweise erscheinen direkt darunter und werden ausdrücklich übernommen. Der Hinweis „Speichert Frage & Antwort“ erklärt die Speicherung; bewertete Inhalte bleiben nach „Neuer Chat“ in der administrativen Auswertung erhalten. Fehler erscheinen lokal als rote Notice, ohne Eingaben zu verlieren. Auf schmalen Ansichten müssen die Felder und Aktionen ohne horizontales Scrollen erreichbar bleiben.

`Notice`-Beispiel:

```tsx
import { Notice } from "@/system/benutzerkonto";

<Notice tone="error" role="alert">
  Die Änderung konnte nicht gespeichert werden. Ihre Eingaben bleiben erhalten.
</Notice>
```

## 9. Reiter, Tabellen und Kalender

- Hauptreiter und Unterreiter klar unterscheiden; nicht mehrere gleich starke Navigationsleisten übereinander setzen.
- Echte Tab-Panels mit zusammengehörigen ARIA-Beziehungen und Pfeiltastenbedienung implementieren. `aria-pressed` nur für tatsächliche Umschaltaktionen verwenden.
- Gemeinsame Filter erhalten ihren Zustand beim Reiterwechsel. Nur passende Aktionen im jeweiligen Reiter anzeigen.
- Tabellen mit präzisen, kurzen Spaltenüberschriften, dezenten Zeilentrennern, erkennbarer Auswahl und zurückhaltendem Hover. Zahlen rechtsbündig, Text linksbündig; Aktionsspalten kompakt.
- Datenflächen nicht bei jeder Aktualisierung neu aufbauen oder ihre Scrollposition zurücksetzen. Öffnen von Menüs und Dialogen darf den Kalender weder horizontal noch vertikal verschieben.
- Jahresübersichten möglichst ohne horizontales Scrollen gestalten. Wo ein dichter Fachkalender unvermeidbar breiter ist, nur dessen Inhaltsbereich scrollen lassen.
- Fachliche Farben durch Text, Legende oder Symbole ergänzen. Haupt- und Nebenfarbe eines Termins müssen unterscheidbar bleiben.

## 10. Schmale Ansichten und Barrierefreiheit

Desktop und mindestens eine schmale Ansicht um 390 px prüfen; zusätzlich auf Überläufe bei kleineren verfügbaren Breiten achten. Inhalte neu anordnen statt die ganze Oberfläche zu verkleinern. Das Service-Menü wechselt bei 650 px in eine vertikale Liste. In der Menüleiste bleiben Navigation, Zurück, Wortmarke, Zeit und Benutzerzugang erreichbar; Datum und ergänzende Bereichsangabe dürfen platzabhängig entfallen.

Alle Funktionen per Tastatur erreichbar halten, Fokus sichtbar lassen und native Links und Schaltflächen verwenden. Ein Link navigiert, eine Schaltfläche führt eine Aktion aus. Aktuellen Navigationspunkt mit `aria-current` kennzeichnen. Überschriften, Labels, Statusmeldungen und Tabellen semantisch korrekt auszeichnen. Hover darf keine notwendige Information exklusiv verstecken.

Persönliche Darstellung respektieren; keinen zweiten Theme-Schalter in einem Fachmodul einführen. Dunkle und helle Darstellung jeweils prüfen. Deaktivierte Felder müssen erkennbar sein, dürfen jedoch nicht die einzige Erklärung einer fehlenden Berechtigung darstellen.

## 11. Umsetzung neuer Module

1. Fachzweck und passende Seitenart wählen: Einstieg, Planung, Einstellungen oder Eingabe.
2. Name und Navigation zentral festlegen; Titel und Dokumentation angleichen.
3. Gemeinsames Layout und vorhandene Bausteine einsetzen; genau eine Hauptüberschrift und geordnete Werkzeuge vorsehen.
4. Themenfarben und Abstände aus dieser Anleitung übernehmen; neue lokale Styles kapseln.
5. Alle Zustände berücksichtigen: initiales Laden, Hintergrundaktualisierung, leer, Erfolg, Fehler und fehlende Berechtigung.
6. Serverseitige Sitzung und Berechtigung am Datenzugriff prüfen. Gestaltung ersetzt keinen Zugriffsschutz. Bei dynamischer Sitzungskontrolle die passende `Suspense`-Grenze innerhalb der Seite vorsehen; Sicherheit nicht zur Unterdrückung eines Next.js-Hinweises zwischenspeichern.
7. Browserprüfung durchführen und Ergebnis nachvollziehbar festhalten. Nach Codeänderungen die in `AGENTS.md` geforderten Prüfungen ausführen.

## 12. Abnahme einer UI-Änderung

- Stimmen Modulname, Browser-Titel und Navigation überein?
- Gibt es nur eine Menüleiste und keine doppelten Überschriften oder Erklärungstexte?
- Passen Typografie, Flächen, Abstände, Icons und Aktionshierarchie zu Service-Menü und Menüleiste?
- Funktionieren Hell und Dunkel, schmale Ansicht, Tastaturfokus, Escape und Rücknavigation?
- Bleiben Position und Eingaben beim Öffnen, Aktualisieren und bei Fehlern erhalten?
- Sind Meldungen korrekt eingeordnet und Aktionen eindeutig beschriftet?
- Bleiben Rollen, Sitzungen und fachliche Schutzmechanismen erhalten?
- Sind Dokumentation und wiederverwendbare Bausteine bei neuen Mustern aktualisiert?

Abweichungen nur dann einführen, wenn die Fachaufgabe davon profitiert; den Grund im Änderungsbericht dokumentieren. Etablierte gemeinsame Bausteine bei einer Verbesserung zentral ändern. Dieser Leitfaden beschreibt Gestaltungsregeln und Referenzen, keine Behauptung, dass alle vorhandenen Seiten bereits vollständig vereinheitlicht oder auf Barrierefreiheit abgenommen sind.

### Zentrale App-Suche

Das Logo steht ganz links und öffnet die gemeinsame `AppLauncher`-Palette; kein zusätzliches Modulmenü daneben einführen. Danach folgen die Verlaufspfeile und die Bereichsangabe. Die Palette zeigt standardmäßig Apps mit Symbolen und durchsucht bei Eingabe auch bekannte Einstellungsbereiche. Keine Fachdaten-Suche suggerieren. Administratorziele nur nach geprüfter Rolle anzeigen; serverseitige Berechtigungsprüfungen bleiben maßgeblich.

Die native Dialogfläche ist deckend und viewportbegrenzt, mit eigener scrollbarer Trefferliste. Suche erhält beim Öffnen Fokus. `⌘/Strg K`, Pfeiltasten, Enter und Escape bedienen die Palette; Schließen gibt den Fokus ans Logo zurück. Mobil eine zweispaltige App-Auswahl verwenden und direkte Bereichstreffer in der Detailansicht öffnen. Navigation verwendet weiterhin den gemeinsamen Schutz ungespeicherter Eingaben.

### Menü der aktuellen App

Direkt rechts neben den Verlaufspfeilen steht der konkrete App-Name als Dropdown (`CurrentAppMenu`), keine feste Eltern- oder Pfadangabe. „Über …“ öffnet einen kompakten nativen Dialog mit App-Name und kurzer Beschreibung. „Einstellungen …“ nur anbieten, wenn ein vorhandener, passender Bereich erreichbar ist; Administratorbereiche nur mit geprüfter Rolle anzeigen. Navigationsschutz und serverseitige Berechtigungsprüfung beibehalten. Auf schmalen Flächen App-Name sichtbar lassen, gegebenenfalls mit Ellipse; Uhr und ausgeschriebener Benutzername weichen zuerst.

Die Logo-Palette öffnet direkt unter der Wortmarke, links am Logo ausgerichtet, mit 6 px Abstand. Ihre Position wird beim Öffnen und bei Größenänderungen aus der Logo-Position ermittelt; am Viewportrand mindestens 10 px Abstand lassen und die Höhe auf den verfügbaren Platz begrenzen. Keine zentrierte Spotlight-Position verwenden.

Die Logo-Palette bietet in der Suchzeile unmittelbar links neben dem X eine segmentierte Symbolauswahl für Raster und Liste. Native Schaltflächen mit verständlichem Namen, Tooltip und `aria-pressed` verwenden. Raster ist Standard (mobil zwei Spalten); Listenansicht zeigt Symbol und Beschriftung nebeneinander. Die Wahl gilt auch für Suchergebnisse und wird automatisch pro Benutzer gespeichert. Während Laden/Speichern nur die Ansichtsschalter deaktivieren; Navigation weiterhin ermöglichen. Speicherfehler mit dem gemeinsamen Fehlerhinweis anzeigen.

Direkt unter der Suchzeile steht eine Kategorieauswahl mit „Alle“, „Service“ und „System & Konto“. Die Auswahl filtert die darunter angezeigten Apps, kombiniert mit dem Suchtext; keine getrennten Kategorieblöcke im Ergebnisbereich verwenden. Native Radios mit sichtbarem Auswahlzustand und Fokus ermöglichen auch Pfeiltastenbedienung. Beim erneuten Öffnen startet der Filter mit „Alle“. Raster und Liste verwenden denselben Filter.

Kanonische Meister-App-Pfade: `/casedesk`, `/planboard`, `/dutyboard`. Interne Navigation verwendet diese Adressen. Die bisherigen Seitenpfade `/stoerungen`, `/ressourcenkalender` und `/bereitschaft` leiten dauerhaft mit erhaltenen Suchparametern weiter. Fach-API-Pfade und Speicherschlüssel bleiben unabhängig von den Seitennamen stabil.

### Verschachtelte Einstellungsseiten

`SettingsPages` und `useSettingsPage` sind die gemeinsame Referenz für Unterbereiche: gruppierte Zeilen mit Chevron und optionalem Zähler öffnen eine Unterseite. Keine segmentierte Navigation zusätzlich stehen lassen. Die Hierarchie steht im validierten Bereich und einem `seite`-Pfad, etwa `?bereich=colors&seite=resources:colors/palette:2`. Hauptbereichswechsel entfernen den bisherigen Unterpfad. Die Hauptüberschrift nennt die aktuelle Unterseite und steht rechts neben dem Pfeilpaar in derselben Kopfzeile. Zusätzliche Eltern-/Zurück-Buttons entfallen. Oben links im Hauptbereich der Einstellungsapp stehen die Verlaufspfeile neben der Seitenleiste. Für Bereichs- und Verlaufswechsel den gemeinsamen Navigationsschutz verwenden. Auswahlfelder wie Hell/Dunkel bleiben echte Einstellungen und werden nicht in Navigationsseiten umgedeutet.

Das gleiche Pfeilpaar wird auch im Benutzerkonto verwendet, mit einem eigenen Verlauf innerhalb dieser App. Dessen Kontobereich bietet Profil über `SettingsPages` an, Anzeige bleibt ein separater Navigationspunkt; Profil- und Darstellungsinhalte nicht zusätzlich auf der Übersicht wiederholen. Mobil führt der bestehende Zurückpfeil nach dem letzten appinternen Verlaufsschritt zur Bereichsauswahl; keine zusätzlichen Zurück-Buttons auf Unterseiten anzeigen. Bestehende Direktlinks zu Profil/Anzeige kompatibel übernehmen.

### App-Grenzen im Einstellungsverlauf

Die Pfeile im Hauptbereich verwenden `useAppHistory` und ausschließlich den während des aktuellen App-Aufenthalts besuchten Verlauf desselben Pfads. Sie rufen keine appübergreifenden Browser-Schritte auf. Nach App-Wechsel oder Neuladen beginnt die Spur an der aktuellen Unterseite; fehlende Ziele deaktivieren. Neue Seiten nach Zurück ersetzen den bisherigen Vorwärtszweig. Navigationsschutz vor dem Wechsel anwenden. Die globalen Menüleistenpfeile behalten ihre bisherige Funktion.

Die Seitensuche steht unter dem App-Titel und oberhalb des Kontoeintrags. Das Verlaufspaar erhält eine gemeinsame, themeabhängige Hintergrundfläche, sichtbaren Rand, Trennlinie und mindestens 38 × 34 px große Schaltflächen mit 21-px-Chevrons. Aktive, deaktivierte und fokussierte Zustände deutlich unterscheiden.

Kopfzeile in Einstellungen und Benutzerkonto: links das app-lokale Pfeilpaar, rechts daneben Symbol und aktuelle Überschrift. Auf schmalen Ansichten das Überschriftssymbol bei Platzbedarf weglassen und Titel umbrechen; die Bereichsauswahl wird nach dem letzten appinternen Verlaufsschritt über den vorhandenen Zurückpfeil erreicht. Kein zusätzliches Menüsymbol verwenden.

### Einheitliche Schalter

Checkbox-Eingaben verwenden `type="checkbox"` mit `className="heyelli-switch"` und bei binären Zuständen `role="switch"`. Native Beschriftung, `checked`, `disabled`, Formularname und Ereignisse beibehalten; keine separaten klickbaren Divs als Ersatz. Die gemeinsame Darstellung in globals.css ist 36 × 22 px mit rundem Griff, HeyElli-rotem Ein-Zustand (`--primary`), neutralem Aus-Zustand, Fokusrahmen und dezenter Bewegung. Reduzierte Bewegung und erzwungene Systemfarben berücksichtigen.

Ressourcengruppen mit Teilauswahl behalten die native Checkbox-Semantik für den gemischten Zustand und verwenden dieselbe Schalterdarstellung mit mittigem Griff und Minuszeichen. Deaktivierte Eingaben bleiben gesperrt und visuell gedämpft. Radio-Auswahlen wie Hell/Dunkel oder Kategorieauswahl nicht in unabhängige Schalter umwandeln. Änderungen am Schalter dürfen keine bestehenden ausdrücklichen Freigaben oder Speicherschritte umgehen.

### Aufbau einzelner Einstellungssektionen

Gemeinsame Bausteine in `settings-controls.tsx` und deren CSS Module verwenden: `SettingsGroup` für Gruppen mit ruhiger Überschrift, `SettingsRow` für links beschriftete Werte und rechts ausgerichtete Eingaben, `SettingsDestination` für navigierbare Listeneinträge, `SettingsIdentity` für eine ausgewählte Person. Beschriftungen über `controlId` mit Eingaben verbinden; bestehende Formular-, Versions- und Berechtigungslogik außerhalb dieser Darstellungsbausteine halten. Keine fachlichen Speicheraktionen in Layoutkomponenten einbauen.

Benutzer erhalten eine Liste mit eigener Detailansicht statt gleichzeitig offener Bearbeitungsfelder für alle Benutzer. Rolle, Mitarbeiter und Aktivierung stehen gemeinsam in einer Zugriffsgruppe; zusätzliche Mitarbeiterverfügbarkeit ist eine lokale Auswahlhilfe. Sitzungen als kompakte Zeilen mit Zeitangaben und Aktion zeigen. Allgemein enthält Darstellung und Info; Sicherheitsbereiche stehen separat unter System → Sicherheit. Integrationsformulare bleiben explizite Formulare mit ihren vorhandenen Prüf-/Freigabeschritten, erhalten aber dieselben Feldraster und Abstände. Tabellen bleiben für echte Protokoll-/Warteschlangendaten zulässig.

`settings-page-model.ts` definiert die erlaubten Eltern-/Kindbeziehungen; UI und Seitentitel verwenden dasselbe Modell. Einträge anderer Bereiche dürfen nicht als Unterseite interpretiert werden. Benutzerdetails verwenden zusätzlich `benutzer`; Bereichs-/Unterseitenwechsel entfernen diese Auswahl. Bereichsspezifische Daten erst bei Bedarf laden. Überholte Reiter-Stile entfernen, neue Gestaltung in den passenden CSS Modules pflegen.

### Breite und Scrollen in Einstellungen

Die gemeinsame Arbeitsfläche ist auf 1120 px Gesamtbreite begrenzt; die Desktop-Seitenleiste bleibt 240 px breit. Dadurch wird der rechte Bereich kompakter, ohne unterschiedliche Sektionsbreiten einzuführen. Sie bleibt innerhalb der verfügbaren Fensterhöhe, einschließlich Menüleistenrand und Außenabständen. Keine Inhaltslänge darf die gesamte App nach unten aufziehen. Seitenleiste und rechter Inhalt besitzen eigene Scrollbereiche, die Kopfzeile bleibt außerhalb des rechten Scrollbereichs. Für den Inhalt `scrollbar-gutter: stable` verwenden und keine zusätzliche maximale Breite pro Sektion einführen. Die gemeinsame Inhaltsfläche füllt den rechten Bereich. Bei Navigation zum neuen Bereich scrollt sie zum Anfang; Hintergrundaktualisierungen lösen keinen Scrollsprung aus. Mobil die sichtbare Sidebar oder Detailansicht ebenfalls innerhalb der Fensterhöhe halten.

Die feste Kopfzeile in Einstellungen und Benutzerkonto erhält unter Pfeilpaar und Überschrift eine durchgehende 1-px-Trennlinie in `--settings-line`, passend zur Seitenleistenabgrenzung. Linie und Abstand bleiben außerhalb des scrollenden Inhalts.

Das Benutzerkonto verwendet auch innerhalb der Unterseiten dieselben Bausteine wie die zentralen Einstellungen: `SettingsIdentity` für den angemeldeten Benutzer, `SettingsGroup` und `SettingsRow` für Rolle, Mitarbeiter und Darstellung. Keine separate Profilkarten-Gestaltung parallel pflegen; reine Kontowerte bleiben lesbare Texte. Die persönliche Darstellungswahl behält ihren bisherigen automatischen Speicherweg.

Unter 480 px stehen Auswahlfelder in gemeinsamen Einstellungszeilen unter ihrer Beschriftung; Schalter bleiben rechts in der Zeile. Protokollfilter wechseln auf eine Spalte, damit Datumswerte und Auswahltexte lesbar bleiben. Das Pfeilpaar wird dort etwas schmaler und die Kopfzeilenschrift auf 16 px reduziert.

Microsoft Graph ist ein eigener Integrationsbereich mit den Unterseiten Verbindung, Prüfung & Freigabe und Anleitung. E-Mail steht unter Anwendungen und enthält Nachricht sowie – nur bei aktivierter Graph-Integration – Warteschlange und Versandprotokoll. Die Graph-Konfiguration wird nicht im E-Mail-Formular dupliziert. Ohne Graph keine Versandweg-Auswahl mit nur einer Option; Outlook bleibt verfügbar. Statusänderungen beim Öffnen, bei Fensterfokus und im Hintergrund laden, ohne Nachrichteneingaben zurückzusetzen.

Die mobile Rückkehr zur Bereichsliste ist ausschließlich Darstellungszustand: keine URL- oder Browser-Verlaufsänderung, kein Wechsel in andere Apps. Auf dem Desktop bleiben die Verlaufspfeile unverändert und ohne Ziel deaktiviert. Auch das Ausblenden der Detailansicht muss den gemeinsamen Schutz ungespeicherter Eingaben durchlaufen. Der Fokus kehrt zum ausgewählten Bereich zurück.

Die Service-Arbeitsfläche folgt Variante V1 (siehe „Formensprache macOS 26“): Seitenleiste mit Cockpit, Aufträge, Wartungen und Kunden & Objekte sowie „Verwandte Apps“; Aufträge, Wartungen und Kunden & Objekte sind dreispaltig (Liste 300–380 px, rechts Akte bzw. Platzhalter „Auftrag auswählen“). Bis 900 px ersetzt die Akte die Liste und bietet eine eindeutige Rückkehr. Kennzahlen sind anklickbare Filterzugänge im durchgehenden Band. Datenaktualisierungen sperren keine Kontrollen; Fehler und Leerzustände bleiben klar unterscheidbar. Auftragszeilen sind kompakt: Nummer und Status, darunter die einzeilige Beschreibung, dann „Kunde · Objektadresse“ und „Termin · Haupttechniker“ ohne zusätzliche Feldbezeichnungen (Bezeichnung als Tooltip); fehlender Termin oder Haupttechniker erscheint rot. Planung und Status sind Filterkapseln mit sichtbarer Bezeichnung; aktive Filter stehen zusätzlich als entfernbare Kapseln im Suchfeld. Im Aktenkopf stehen links Zurück sowie beschriftete Kapseln „Kunde“ und „Objekt“/„Einheit“ (zugänglicher Name mit vollem Aktennamen), rechts neutrale Einsatzaktionen und der Status. Die Auftragsakte folgt dem Mockup: zuerst je Einsatz eine Karte mit den Fokusfeldern Termin und Haupttechniker und der Hauptaktion „Einsatz planen“, darunter Einsatzort und Auftragsbeschreibung; dann Kunde als gruppierte Zeile; dann aufklappbare Zeilen Einsatzmappe (Dokumente, Ansprechpartner, BMACloud – startet zugeklappt, lädt erst beim Öffnen und bleibt in der Sitzung offen), Rücklauf & Abschlusskontrolle sowie Material & Leistungen (starten geöffnet). Die Akte zeigt die Originalbeschreibung vollständig.

Im Cockpit sitzt der Stift zum Anlegen eines Auftrags links in der durchgehenden Werkzeugleiste. Die Lupe rechts öffnet die Service-Suche mit Vorschlägen. Die Ergebnisse sind nach Aufträgen, Wartungen, Kunden, Objekten und technischen Einheiten gruppiert. Ein Treffer öffnet direkt die zugehörige Akte. Gemeinsame Karten gruppieren die Cockpit-Kennzahlen für Aufträge und Wartungen. Jede Kennzahl öffnet direkt die zugehörige Arbeitsliste. „Fällig bis heute“ schließt überfällige Wartungen ein. „Überfällig“, „Bevorstehend“ und „Fälligkeit prüfen“ haben eigene Direktlinks. Solange die Wartungsdaten unvollständig sind, zeigt das Cockpit einen Lade- oder Fehlerhinweis statt scheinbar vollständiger Zahlen. Vorschauen verwenden die gemeinsamen Listentrenner und öffnen die gewählte Akte in ihrer Arbeitsliste. Bei mehreren Störungen pro Auftrag müssen Adresse, Termin und Haupttechniker aus derselben, zum aktiven Planungsfilter passenden Störung stammen; weitere Störungen kenntlich machen. Objektadressen technischer Einheiten dürfen aus dem übergeordneten Objekt aufgelöst werden. Vorschautexte kürzen ausschließlich die Darstellung, nicht die gespeicherten Daten.

Service zeigt keine zusätzliche sichtbare Titel-/Quellenzeile über den Meister-Zugängen; eine unsichtbare Hauptüberschrift bleibt für assistive Technik erhalten. Die drei Meister-Symbole stammen zentral aus `PlannerGlyph` (Zwischenablage, Kalender/Zeitachse, Mond mit Sternen). Service-Zugänge, App-Suche und Über-Dialog verwenden dieselben SVG-Geometrien; keine Unicode-Ersatzzeichen oder voneinander abweichenden Nachzeichnungen einführen.

Service verwendet eine einzige Werkzeugleiste: links Cockpit/Aufträge/Kunden & Objekte, rechts die drei Meister-Zugänge. Keine zusätzliche Kopfzeile für die Apps. Bei schmalen Fenstern die App-Beschriftungen verkürzen, auf dem Handy reine gemeinsame Symbole verwenden; zugängliche Namen bleiben vollständig. Keine Stand- oder Aktualisierungsanzeige in der Service-Werkzeugleiste; automatische Hintergrundaktualisierung beibehalten. Beide Navigationsgruppen bleiben ohne Überlappung in derselben Zeile.

Nachträgliche Terminvergabe in Service verwendet `PlanningFields` aus dem CaseDesk, damit Haupttechniker, Zeitpunkt, Dauer und Begleiter dieselbe Bedienung behalten. Die Planung erfolgt im Vordergrunddialog für den gewählten vorhandenen Einsatz. Während Speicherung alle Felder sperren; Fehler im gemeinsamen roten Hinweis darstellen und Eingaben im offenen Dialog erhalten. Keine Neuanlage über diesen Einstieg.

Die lokale Bedienungshilfe auf der Startseite verwendet eine kompakte Karte mit eindeutigem Nur-Lesen-Hinweis, beschriftetem Fragefeld, sichtbarem Antwortzustand und Quellenlinks zur internen Anleitung. Modelltext ausschließlich als Text rendern, niemals als ausführbares HTML. Fehler verwenden den gemeinsamen roten Hinweis; Eingaben bei Fehler erhalten. Antworten dürfen keine tatsächlich ausgeführten Aktionen suggerieren. Kein Zugriff auf Fach- oder Zugangsdaten.

Die Bedienungsanleitung unter `/hilfe` verwendet dieselbe Inhaltsbreite und Flächen wie die Startseite. Links stehen die Gruppen Apps, Konto & System und Bedienungshilfe; rechts jeweils ein Bereich mit kurzen Themenblöcken und optionalem App-Zugang. Gemeinsame Meister-Symbole verwenden. Auf dem Handy wird die Seitenleiste zu einer Themenauswahl oberhalb des Inhalts. Navigation und Quellenlinks verwenden die bestehenden Hash-Anker; Auswahl nach Direktaufruf, Neuladen und Browsernavigation wiederherstellen. Text und Themenblöcke stammen aus derselben Wissensgrundlage wie die lokale Bedienungshilfe. Einstellungen nur für Administratoren direkt verlinken; Sitzung vor der Ausgabe prüfen und die seitenlokale Suspense-Grenze erhalten.

Die Hilfesuche steht über der Themenfläche und durchsucht alle Apps zugleich. Treffer nennen App, Abschnitt und einen kurzen Textauszug. Ein Klick oder Eingabetaste öffnet den exakten Abschnitt, setzt den Fokus dorthin und übernimmt dessen dauerhaften Hash-Link. Alte Themenanker bleiben gültig. Leere Ergebnisse verständlich benennen und eine Löschaktion für die Suche anbieten. Die Suche verarbeitet ausschließlich mitgelieferte Anleitungstexte lokal im Browser, ohne Modellaufruf oder Fachzugriff. Im Überschriftsmenü jeder App steht „Hilfe“ als normaler geschützter Link zum passenden Thema; unbekannte Bereiche öffnen die allgemeine Anleitung.

Das Überschriftsmenü gliedert sich wie ein macOS-App-Menü: „Über …“, optional „Einstellungen …“, zuletzt „Hilfe“. Zwischen den vorhandenen Gruppen stehen feine horizontale Trenner mit kurzen vertikalen Abständen. Bei fehlender Einstellungsgruppe keinen leeren oder doppelten Trenner erzeugen. Menüzeilen mindestens 32 px hoch, bei grobem Zeiger 44 px; HeyElli-rote Hover- und Auswahlfläche mit weißer Schrift, Tastaturfokus zusätzlich sichtbar. Native Links und Schaltflächen sowie bestehendes Escape-/Außenklick-Verhalten erhalten.

Die Menüleiste verwendet `--toolbar-material` (dunkel 88 % Deckkraft, hell `#f9fafbdf`) auf einer eigenen `::before`-Hintergrundebene mit 24 px Unschärfe. Den gesamten Leistencontainer nicht mit `backdrop-filter` versehen: Er würde den Hintergrundbereich für enthaltene Menüs begrenzen. Das Überschriftsmenü verwendet 72 % der Theme-Oberfläche und 12 px Unschärfe mit 140 % Sättigung, damit dahinterliegende Inhalte erkennbar durchscheinen. Text und Trenner bleiben deckend. Standard-`backdrop-filter` verwenden; eine nachfolgende Präfixdeklaration darf die wirksame Regel im kompilierten CSS nicht verdrängen. Wirkung visuell und anhand berechneter Browserstile prüfen, nicht nur anhand eines Alpha-Wertes.

Alle anwendungseigenen Dropdowns und Kontextmenüs verwenden zentral `--floating-menu-background` und `--floating-menu-filter` in globals.css (72 % Oberfläche, 12 px Unschärfe, 140 % Sättigung). Dies gilt für Menüleisten-Popover, App-Suche, Suchvorschläge, Kalenderauswahl, Sammelausgabe und Kontext-/Untermenüs beider Planer. Neue lokale Menübausteine mit `heyelli-menu-surface` kennzeichnen. Keine eigene Materialdefinition je Modul pflegen. Das Kalender-Kontextmenü legt sein Material auf `::before`, damit seitliche Untermenüs keinen gefilterten Vorfahren haben. Suchergebnislisten innerhalb einer Glasfläche bleiben transparent. Bei fehlender Filterunterstützung oder bevorzugter reduzierter Transparenz deckende Oberfläche verwenden. Betriebssystemseitig gezeichnete native Auswahlmenüs behalten ihre Systemdarstellung; Bearbeitungs- und Bestätigungsdialoge sind keine Menüflächen.

Die Startseite ist ein kompakter Arbeitsplatz statt einer Werbe-/Begrüßungsfläche: eine kleine Hauptüberschrift, eine gruppierte Fläche für Service-Bereiche und die drei Meister-Apps sowie darunter die lokale Bedienungshilfe. Keine künstlichen Kennzahlen, erneute Produktwortmarke oder großen Einführungstexte. Service-Links öffnen Cockpit, Aufträge und Kunden & Objekte direkt. Meister-Symbole aus `PlannerGlyph` verwenden. Auf dem Desktop drei Ziele nebeneinander, unter 800 px ruhige Listen mit Trennlinien. Benutzerkonto und berechtigungsabhängige Einstellungen stehen als sekundäre Links darunter.

Häufige Bedienungsfragen sind native, neutral gestaltete Schaltflächen mit kurzen Beschriftungen. Ihr Klick übernimmt die vollständige Frage ins Feld und sendet sie unmittelbar; keine Vorbelegung mit zusätzlichem Bestätigungsschritt. Während einer Antwort alle Vorschläge und die Sendeaktion deaktivieren und den Zustand als Text anzeigen. Das Fragefeld startet einzeilig und wächst in unterstützenden Browsern mit `field-sizing: content` bis zur begrenzten Höhe, mit weiterhin vergrößerbarem und scrollbar nutzbarem Textfeld als Rückfall. Mobil Vorschläge zweispaltig, bei sehr schmalen Ansichten einspaltig; Touchhöhe mindestens 44 px. Quellen bleiben bei jeder Antwort erreichbar.

Befehlsmenüs verwenden `heyelli-command-menu`, Trenner `heyelli-menu-separator`. Gemeinsame Werte in globals.css: 5 px Außenpolster, 6 × 9 px Zeilenpolster, 12 px Schrift, 10 px Symbolabstand, 5 px Zeilenrundung, 1-px-Trenner mit 4 × 7 px Abstand. `--command-menu-line`, `--command-menu-hover` und `--command-menu-row-height` steuern alle Anwendungen zentral. Das PlanBoard-Kontextmenü bleibt die Referenz. Infoköpfe, Navigation und destruktive Aktionen als sinnvolle Gruppen trennen, keine Linie zwischen jede gleichartige Aktion setzen. App-Raster und Kalenderauswahl behalten ihre zweidimensionale Anordnung; die App-Auswahl verwendet bewusst eine dezente neutrale Fläche; rote Hervorhebungen gelten für Befehlsmenüs.

Menüauswahl und Hover-/Tastaturhervorhebung verwenden `--command-menu-hover: var(--primary)` mit weißer Schrift, auch in Suchvorschlägen. Ausnahme: Das HeyElli-App-Menü behält eine dezente neutrale Auswahl-/Hoverfläche mit regulärer Textfarbe und gedämpften Zusatztexten. Deaktivierte Aktionen behalten ihren gedämpften Zustand.

Der Einstieg heißt „AskElli“ (Menüleiste, App-Suche, Navigation und Seitentitel). Elli nutzt die verfügbare Höhe unter der Menüleiste. Service & Planung steht zunächst aufgeklappt oberhalb und blendet sich bei der ersten gültigen Anfrage aus. Der Gesprächsbereich scrollt unabhängig über dem unten feststehenden Eingabebereich. Beim Öffnen eine kurze Vorstellung ohne Modellanfrage anzeigen. Fragen und Antworten als lesbaren Verlauf oberhalb des Eingabefelds anzeigen, Quellen je Antwort erhalten. Enter sendet außerhalb einer laufenden Texteingabekomposition, Umschalt+Enter erzeugt eine neue Zeile. Während der Antwort doppelte Anfragen sperren, bei Fehlern Frage und bisherigen Verlauf erhalten. Nach Erfolg Eingabe leeren und Fokus dorthin zurückgeben. Der lokale Nur-Lesen- und Entwicklungsumfang bleibt bestehen.

Rückfragen an Elli enthalten einen begrenzten Gesprächskontext aus dem benutzerbezogen in PostgreSQL gespeicherten Verlauf. Beim Öffnen zuerst den eigenen Verlauf laden und bis dahin die Eingabe sperren. „Neuer Chat“ setzt sowohl sichtbaren Verlauf als auch mitgesendeten Kontext zurück; alte oder abgebrochene Antworten dürfen nicht in den neuen Chat gelangen. Anleitungstexte bleiben die Wissensquelle, frühere Modellantworten dienen nur zur Einordnung und können korrigiert werden.

„Neuer Chat“ muss den gespeicherten Verlauf und die serverseitige Chatkennung atomar zurücksetzen. Erst nach bestätigtem Reset Verlauf leeren und Service & Planung einblenden. Bei Lade-/Resetfehlern bestehende Texte erhalten und „Chat erneut laden“ anbieten. Wiederholte Anfragen mit derselben Kennung dürfen keine doppelten Beiträge erzeugen; alte Antworten dürfen nach Reset nicht mehr gespeichert werden.

Nicht gesendete Fragen unmittelbar benutzer-/chatbezogen lokal sichern und im Hintergrund mit PostgreSQL synchronisieren. Bereits gesendete Fragen als offene Anfragen vor dem Modellaufruf vormerken; nach Wiederkehr automatisch mit gleicher Anfragekennung fortsetzen. Veraltete Sicherungsrevisionen dürfen neuere Texte nicht ersetzen. Mehrere Eingabestände getrennt erhalten und über „Weitere gesicherte Fragen“ zugänglich machen. Neuer Chat setzt Verlauf, offene Anfragen und Fragesicherungen gemeinsam zurück. Bei Ausfall Wiederholung anbieten, keine Eingaben still verwerfen.

Elli spricht als schlaue, freundliche KI-Helferin mit eigener Identität. Beim Öffnen eine kurze, einladende Vorstellung direkt im Gespräch anzeigen. Neue Chats lassen die Vorstellung vom lokalen Modell frisch formulieren; keine feste Variantenliste verwenden. Nur einen allgemeinen Begrüßungsauftrag übermitteln, keine Gesprächs- oder Benutzerdaten. Während der Erzeugung einen dezenten Status zeigen, das Fragefeld aktiv lassen und bei Ausfall einen erkennbaren neutralen Ersatztext verwenden. Innerhalb desselben Chats den gewählten Text beim Neuladen beibehalten. Die Vorstellung erscheint zügig Wort für Wort, ohne die Eingabe zu sperren. Bei bevorzugter reduzierter Bewegung den vollständigen Text sofort zeigen; assistive Technik erhält eine einzige vollständige Nachricht. Explizite Identitätsfragen bleiben zuverlässig beantwortbar. Funktionsfragen dürfen einen serverseitig geprüften, festen Einblick in Apps und eigene Berechtigungen nutzen. Der Hinweis „nur lesend“ bleibt sichtbar; keine Fachzugriffe oder tatsächlich ausgeführten Aktionen suggerieren. Keine Benutzerkennungen, Konfigurationswerte oder Geheimnisse in den Modellkontext aufnehmen. Fragen nach der eigenen Rolle aus der aktuellen Sitzung beantworten, nicht aus Behauptungen im Gespräch. Die Hilfe beschreibt diese Grenze ebenso wie die Chatansicht.

Die App-Symbole verwenden zentral `AppGlyph` und `appIconBackground` aus der Plattformhülle. Die drei Meister behalten die bestehenden Geometrien aus `PlannerGlyph` mit ihren roten, blauen und violetten Verläufen. AskElli verwendet eine Sprechblase mit Funkeln auf einem rosa-roten Verlauf. App-Menü, Chatkopf, Hilfe und Über-Dialog verwenden dieselbe SVG-Geometrie; keine Haus- oder Unicode-Ersatzsymbole für Elli.

Benutzerkonto verwendet zentral das Profilzeichen im Kreis mit grünem Verlauf; Einstellungen ein Zahnrad mit blau-grauem Verlauf. Beide sind in App-Menü, Über-Dialogen, Hilfe und Bereichsköpfen über `AppGlyph` eingebunden. Das Benutzermenü verwendet dieselbe Profilgeometrie ohne App-Hintergrund. Persönliche Initialen in Kontokarten bleiben persönliche Kennzeichen.

Bedienwissen stammt für Hilfe und Elli aus demselben statischen Funktionskatalog. Neue Funktionsbeschreibungen enthalten konkrete Schritte, Berechtigung, Voraussetzungen und Grenzen; Herkunft im Katalog mit Implementierungsreferenzen belegen. Treffer öffnen exakte Abschnittsanker und setzen dort den Fokus. Mehrzeilige Schritte bleiben in der Hilfe lesbar, Quellen je Chatantwort erreichbar. Ohne belegte Fundstelle eine Rückfrage zeigen. Persönliche Mitarbeiteraktionen nicht mit allgemeinen Planungsrechten verwechseln; keine aktuellen Integrations- oder Fachzustände aus Dokumentation ableiten.

### Ellis Antwortstil

Bei normalen Bedienungsfragen den konkreten Weg kurz und natürlich erklären. Keine wiederholten Katalogüberschriften, allgemeinen Rollenblöcke oder vollständigen Listen aller Voraussetzungen. Berechtigungen nur bei Nachfrage, fehlendem Recht oder entscheidender Relevanz nennen. Persönliche Anzeigeeinstellungen nicht mit fachfremden Voraussetzungen zu Mitarbeiterzuordnung oder Planung belasten. Vollständige Anleitung über den vorhandenen Quellenlink erreichbar halten. Kürzung darf bestätigte Zugriffsbeschränkungen nicht auslassen oder Rollenrechte erweitern.

Ellis Sprache verwendet kurze, grammatisch korrekte Hauptsätze und gebräuchliche Verben. Begrüßungen stellen Elli vor und laden zu einer Frage ein; keine übertriebene Hilfszusage oder künstliche Begeisterung. Generierte Begrüßungen auf 25 Wörter/180 Zeichen begrenzen. Bekannte Sprachfehler neu erzeugen, Rollenformulierungen und bestätigte Fakten dabei nicht automatisch umschreiben. Ein korrekter kurzer Ersatztext ist besser als eine holprige Begrüßung.

Die App-Verknüpfungen über AskElli behalten ihre natürliche Höhe; keine prozentuale Höhenbegrenzung mit abgeschnittenen Kartenenden. In niedrigen Fenstern die Arbeitsfläche vertikal scrollbar halten und dem Chat ausreichend Mindesthöhe für Eingabe und Aktionen geben. Den eigenen Scrollbereich des Gesprächsverlaufs beibehalten und Tastaturfokus in kleinen Fenstern prüfen.

Im CaseDesk führen die Schrittübersichten mit dem eigentlichen Inhalt: Objekt/TE, Störung vor Kontaktdaten, Techniker/Zeitraum. Deaktivierte Schritte durch Status und zurückhaltende Farben kennzeichnen, Text nicht durch pauschale Halbtransparenz unleserlich machen. `CalendarDateTimeField` über den öffentlichen PlanBoard-UI-Einstieg für Datum/Uhrzeit verwenden: Freitext TT.MM.JJJJ, kompakter gemeinsamer Kalender und separates Uhrzeitfeld. Innerhalb bestehender Formulare keine verschachtelten Formulare erzeugen. Mobile Ausgabe im Speicherbereich als roter/grauer Schalter mit sichtbarem Haupttechniker, bei fehlender Planung deaktiviert.


## Bestätigte KI-Aktionen

Elli zeigt geplante Änderungen als kompakte Karte im Gespräch: eindeutiger Titel, Ziel und betroffene Mitarbeiter, bisherige/neue Zeiten sowie getrennte Aktionen „Verwerfen“ und „Bestätigen und ausführen“. Nur die ausführende Aktion erhält die rote Primärfarbe. Ein Chattext oder eine Modellantwort gilt niemals als Bestätigung. Laufende, abgeschlossene, verworfene, abgelaufene und unklare Vorgänge müssen textlich erkennbar sein. Unklare Schreibergebnisse bieten keine automatische Wiederholung. Das Eingabefeld bleibt unter dem scrollbaren Gespräch; schmale Ansichten umbrechen Kartenwerte und Aktionen.

## Über-Dialoge und Versionen

Alle Apps verwenden den gemeinsamen Über-Dialog mit App-Name, App-Symbol soweit vorhanden, Beschreibung, Version im Format JJ.V (Kalenderjahr und Veröffentlichung im Jahr), tatsächlichem Veröffentlichungsdatum ohne wiederholte Nummer sowie Tim Braun als Ersteller. Ausgangspunkt ist 26.1 für alle Apps. Öffentliche Metadaten stehen in `app-releases.ts`; jede abgeschlossene Änderung erhöht die Veröffentlichung der betroffenen Apps gemäß AGENTS.md. Die HeyElli-Wortmarke steht mit 16 px ganz unten im Dialog. Version, Veröffentlichung und Ersteller verwenden normale Schriftstärke. Ein zugängliches X oben rechts ersetzt den Schließen-Knopf; Escape und Fokusrückgabe bleiben erhalten.

Das Hilfe-App-Symbol verwendet ein weißes Fragezeichen im Kreis auf einer türkisblauen App-Fläche. Gemeinsam über `AppGlyph` und `appIconBackground.help` im Launcher, Über-Dialog und allgemeinen Hilfe-Einstieg verwenden.

Das Service-App-Symbol ist ein weißer Servicekoffer mit Griff und mittigem Verschluss auf einer warmen kupferfarbenen App-Fläche. `AppGlyph` mit `service` und `appIconBackground.service` in App-Auswahl, Über-Dialog und Hilfe-Navigation gemeinsam verwenden.

Versionsstände und Veröffentlichungsdaten sind unabhängig pro App. Ein neues App-Symbol oder eine Änderung an der App-Auswahl erhöht ausschließlich die fachlich betroffene App. Gemeinsame Komponenten dürfen keine pauschale Versionsänderung aller Apps auslösen; jeder Eintrag in `app-releases.ts` wird separat gepflegt.

Die App-Auswahl sortiert Apps nach benutzerbezogenen Aufrufen, Suchtreffer zuerst nach Textrelevanz und danach nach Nutzung. Kategorien, Raster-/Listenwahl und Tastaturnavigation bleiben erhalten. Es gibt keinen externen Suchindex: aktuelle Katalogeinträge werden unmittelbar durchsucht. Nur App-Pfad und Zähler werden gespeichert, keine Suchbegriffe oder Fachinhalte. Plattformversion für diese Menüfunktion erhöhen; Fach-App-Versionen bleiben unabhängig.

Rollen verwenden pro App eine kompakte Auswahl „Kein Zugriff“, „Lesen“ und bei Fach-Apps „Lesen & Schreiben“. Keine übergeordnete Grundberechtigung. Bei Hilfe und Benutzerkonto nur Zugriff/Lesen anbieten und persönliche Änderungen verständlich abgrenzen. Bestehende Rollen speichern automatisch; neue Rollen erst über „Rolle speichern“.

## Verbindungsstatus und fortgesetzte Eingaben

Vorübergehend nicht prüfbare Sitzungen zeigen eine kompakte, neutrale Verbindungsfläche mit „Erneut prüfen“. Geschützte Inhalte und native Dialoge sind dann nicht sichtbar oder bedienbar; Formulare bleiben montiert. Nach erfolgreicher Prüfung Dialoge und Fokus ohne Scrollsprung wiederherstellen. Nur bestätigte Ungültigkeit oder tatsächlicher Ablauf führt zur Anmeldung. Zusatzdaten laden mit dezentem Statushinweis neben bereits nutzbaren Kerndaten; ein Quellenfehler ersetzt nicht die vollständige Akte. Automatische Aktualisierung darf weder Eingaben zurücksetzen noch den Fokus erneut auf die Überschrift ziehen.

## Begriffe, Hilfe und geschützte Gerätesicherung

Bei jeder Funktionsänderung sichtbare Begriffe, `feature-catalog.ts`, Hilfe-Suche, README und die konkrete Integrationsanleitung gemeinsam abgleichen. Datensatzart und Name getrennt darstellen: Eine technische Einheit heißt im Aktenkopf „Technische Einheit“, ein Objekt „Objektakte“. Eigene Rollennamen aus der geprüften Sitzung anzeigen; Grundberechtigung im Profil ausdrücklich getrennt kennzeichnen.

Geräte- und Geheimnisfunktionen in kompakten `SettingsGroup`-/`SettingsRow`-Abschnitten unter Benutzerkonto beziehungsweise Sicherheit darstellen. Erst eine erfolgreiche Sicherung erlaubt die Bestätigung zum Entfernen lokaler Kopien. `ConfirmationDialog` mit Abbrechen als anfänglichem Fokus verwenden. Fehlgeschlagene Sicherung in rotem `Notice` anzeigen; Prüfung und erfolgreiche Wiederherstellung dezent neutral bestätigen. Keine Token, Dateiinhalte oder Schlüssel in Statuszeilen anzeigen. Bei schmaler Ansicht Aktionen umbrechen, keine festen Mindestbreiten einführen.

## Tastaturmodelle für Menüs und Popover

Dropdowns: Enter/Leertaste öffnen, Pfeiltasten wechseln zwischen sichtbaren Einträgen, Escape schließt mit Rückkehr zum Auslöser. Tab darf den Bereich verlassen und schließt ihn. Kalender-Kontextmenüs verwenden Pfeile/Home/End; ein Untermenü fokussiert sein Eingabefeld beziehungsweise die erste verfügbare Aktion. Die Löschbestätigung fokussiert zuerst Abbrechen. Escape führt zunächst zum Untermenüauslöser und danach zum Termin zurück, ohne Scrollen auszulösen.

Nichtmodale Popover verwenden `usePopoverFocus`: Anfangsfokus, Escape und Rückkehr zum Auslöser; Tab bleibt frei und schließt beim Verlassen. Bei laufender Ausgabe verhindert der bestehende Schutz unbeabsichtigtes Schließen. Modale Dialoge verwenden weiterhin die gemeinsame Fokusfalle. Nichtmodale Inhalte erhalten keine künstliche Fokusfalle. Sichtbarer Fokus bleibt auch in Hell/Dunkel erkennbar; reduzierte Bewegung gilt anwendungsweit. Kalenderbeschriftungen wählen Schwarz/Weiß anhand der tatsächlichen Hauptfarbe, Status und Kategorien behalten ihre textlichen Bezeichnungen.


### Screenreader und hohe Vergrößerung

Schalter erhalten den Funktionsnamen als zugänglichen Namen; längere Voraussetzungen stehen separat in einer über `aria-describedby` verbundenen Beschreibung. Ein Hinweis darf den Funktionsnamen nicht ersetzen. Die App-Auswahl darf eine Tastaturauswahl nur bei tatsächlicher Mausbewegung ändern; ein ruhender Zeiger über neu angeordneten Treffern übernimmt nicht die Auswahl.

Modale Kalenderdialoge erfassen den Auslöser vor dem Anfangsfokus. Nach dem Entfernen des Dialogs Fokus ohne Scrollsprung zurückgeben, sofern der Auslöser noch existiert und inzwischen kein anderer Dialog oder bewusst fokussiertes Element aktiv ist. Bei hoher Seitenvergrößerung nur den Dialog zum ersten Feld scrollen, nicht die Kalenderfläche. In kurzen Ansichten unter 500 Pixel Höhe werden angeheftete Dialogüberschrift und Aktionszeile normal mitgescrollt, damit sie keine Felder verdecken. Anfangsfeld und Abschlussaktionen müssen auch bei 400 Prozent erreichbar sein.

Betriebsstatus unter Allgemein als eigene Unterseite mit `SettingsGroup`/`SettingsRow` darstellen. Hintergrundaktualisierung erhält die vorhandenen Werte; fehlende aktuelle Lebenszeichen ausdrücklich von Bereitschaft unterscheiden. Alarmbestätigung als dezente Aktion pro Eintrag; keine automatische Entwarnung durch Bestätigen. Vorgangskennung kopierbar als Text, keine technischen Rohfehler oder Geheimnisse anzeigen.

Unter „System“ stehen „Allgemein“ (Darstellung, Info) und „Sicherheit“ als getrennte Bereiche. Sicherheit bündelt Sitzungsdauer, geschützte Zugangsdaten, Browser-Schutz, Daten & Aufbewahrung sowie Betriebsstatus als einzelne Unterseiten. Bestehende Allgemein-Direktlinks zu Sicherheitsinhalten werden ohne zusätzlichen Verlaufseintrag auf den neuen Bereich umgestellt. Sicherheitsfunktionen nicht erneut unter Allgemein anbieten; Organisation und Integrationskonfigurationen bleiben in ihren eigenen Kategorien.


SharePoint-Verbindung unter Integrationen mit den bestehenden Seiten Verbindung, Prüfung & Freigabe und Anleitung darstellen. Freigabe verlangt den gemeinsamen Bestätigungsdialog; Fehler bleiben im roten Notice, Erfolg dezent. Akten verwenden kompakte Dokumentbereiche mit Dateiname, Größe, Zeitpunkt und SharePoint-Link. Vertragsdokumente bei Bedarf aufklappen; Dateiauswahl und laufende Übertragungen erhalten den Navigationsschutz. Keine stillen Uploads, kein Überschreiben vorhandener Dateien.

### Service: Fokus und Akten

Die Service-Arbeitsfläche reserviert Markenrot für ausgewählte Datensätze, den Tastaturfokus und die Aktion „Termin vergeben“. Auswahl bleibt zusätzlich über Rahmen beziehungsweise Randlinie und `aria-current`/`aria-pressed` erkennbar. Die Cockpit-Kennzahlen erhalten kleine, zurückhaltend eingefärbte Symbole; fachliche Status- und Kalenderfarben werden dadurch nicht verändert.

Bei geöffneter Akte erhält der Detailbereich mehr Breite als die Übersicht. Auf schmalen Ansichten ersetzt die Akte die Liste. Escape führt zurück zur Liste; auf dem Desktop wechselt Escape aus der Auftragsakte zur gewählten Auftragszeile. Akten gruppieren Stammdaten in beschrifteten Zeilen und Verträge in kompakten Karten. Bereits sichtbare Kunden-/Objekthierarchien stehen in der Akte einklappbar bereit, leere Untereinheitenabschnitte entfallen. Verknüpfte Aufträge zeigen Nummer und gekürzte Beschreibung; der vollständige Text bleibt in der Auftragsakte.

Persönliche Ausblendungen in Service werden in der geöffneten Akte über „Ausblenden“ bedient. Der Punkt „Ausgeblendete Einträge“ als Augensymbol rechts im Kopf der Kunden-/Objektliste öffnet eine kompakte Wiederherstellungsliste mit je einer Aktion „Einblenden“. Während der Speicherung sind die betreffenden Aktionen gesperrt; erst die Serverbestätigung ändert die Ansicht. Fehler bleiben als roter Hinweis mit Wiederholungsmöglichkeit sichtbar. Ausblenden ist eine persönliche Ansichtsoption und keine Fachlöschung oder Zugriffssperre.

Akten übernehmen die ruhige Kopfzeilenfläche und Scrollleistenfarben des PlanBoards. Links in der Aktenleiste steht eine Kapsel mit vier gleich breiten Symbolsegmenten in fester Reihenfolge: Kunde, Objekt, Einheit, Auftrag. Das aktuelle Segment wird hervorgehoben. Kunde öffnet die Kundenakte. Objekt und Einheit zeigen die jeweiligen Auswahlmenüs, auch bei nur einem Eintrag. In der Auftragsakte stehen die zugehörigen Ziele zuerst und tragen das Etikett „Passend zum Auftrag“. Eine feine Trennlinie grenzt sie von weiteren Treffern ab. Alle Zeilen sind linksbündig, der Tastaturfokus hat einen eigenen Rahmen. Das Auftragssymbol führt aus den über die Kapsel geöffneten Akten zurück zum Ausgangsauftrag. Ohne passende Einträge bleibt das jeweilige Segment sichtbar und deaktiviert. PDS- und BMACloud-Verweise erhalten eine eigene Gruppe; Ausblenden steht rechts. Symbolaktionen besitzen zugängliche Namen und Tooltips, Fokusrahmen und mobil ausreichende Bedienflächen. Bei mehreren BMACloud-Treffern Nummer, Namen und AID im zugänglichen Namen beziehungsweise Tooltip unterscheiden. Navigation und externe Links nicht im Akteninhalt wiederholen; Vertragsfehler bleiben bei den jeweiligen Verträgen.

Service unterscheidet Objekte mit einem Gebäudesymbol und technische Einheiten mit einem Anlagensymbol. Übersicht, Aktenkopf und Aktenverweise verwenden dafür gemeinsam `objectActionIcon` und `FileActionIcon`. Bei Symbolsegmenten vermitteln zugängliche Namen und Tooltips die Datenart.

Die Service-Reiter Cockpit, Aufträge und Kunden & Objekte übernehmen die segmentierte Tag-/Woche-/Monat-Auswahl des PlanBoards: dezente gemeinsame Hintergrundfläche, 8-Pixel-Außenradius, 5-Pixel-Segmente und eine neutrale aktive Fläche mit feinem Rahmen, Schatten und kräftigerer Schrift. Bestehende Navigationssemantik und mobile Umbrüche erhalten.

In der Service-Werkzeugleiste werden Reitergruppe und Meister-App-Links auf dieselbe Zeilenhöhe gestreckt (mindestens 40 Pixel). Keine starre Maximalhöhe: bei mehrzeiligen Beschriftungen oder vergrößerter Schrift wachsen beide Gruppen gemeinsam.

Kostenträgertreffer stehen als kompakte zusätzliche Zeilen direkt beim Objekt beziehungsweise der technischen Einheit: dezente Rollenmarke „Kostenträger“, „Wartung“ oder „Rechnung“, daneben Nummer und Bezeichnung. Zahlen und Bezeichnungen umbrechen ohne Abschneiden. Nur passende Zuordnungen zeigen; keine geerbten Kostenzeilen an reinen Hierarchieknoten. Keine zusätzliche Aktion innerhalb der bereits anklickbaren Objektzeile.

Der Service-Reiter „Wartungen“ verwendet dieselbe segmentierte Auswahl, Such-/Filterzeile und gruppierte Listenfläche wie die übrigen Service-Bereiche. Pro Wartung stehen Kunde, Objekt, technische Einheit und Fälligkeit in einer kompakten Faktenzeile; schmale Ansichten bilden zwei Spalten. Fehlende Termine werden ausdrücklich als prüfbedürftig angezeigt, nicht als fällig berechnet. Die native Auftragsvorschau zeigt nur vorhandene Fakten und eine kurze neutrale Sperrinformation; technische Freigabefragen gehören in die PDS-Anleitung. Die ausführende Aktion bleibt sichtbar gesperrt. Fokus nach Escape/Schließen zum tatsächlichen Auslöser zurückgeben, auch wenn Safari diesen beim Mausklick nicht automatisch fokussiert.

Wartungszeilen gruppieren die vier Kernangaben Kunde, Objekt, technische Einheit und Fälligkeit auf Desktop horizontal; die Aktion steht in derselben Zeile rechts. Titel/Status bleiben kompakt darüber, zusätzliche Vertrags-/Prüfangaben nur bei Bedarf darunter. Unter 750 Pixel Inhaltsbreite vier Angaben in zwei Spalten und die Aktion darunter rechts anordnen, ohne Text abzuschneiden. Eine bestätigte spätere Wartungsanlage wechselt in den vorhandenen Service-Planungsdialog statt eine zweite Techniker-/Terminmaske aufzubauen; die aktuelle Erzeugungssperre dabei ausdrücklich erhalten.

### Dynamische Aktenmappe

Die Einsatzmappe gruppiert aktuelle Daten, Dokumentauswahl und externe Verknüpfungen in einem kompakten, per Tastatur aufklappbaren Aktenbereich. Quellen erscheinen als einzelne Ordnergruppen. Rote/Graue Schalter ändern ausschließlich Dokumentverweise; die separate Auswahlansicht hält den Einsatz lesbar. Quellenfehler stehen am betroffenen Bereich. Nicht prüfbare gewählte Verweise bleiben sichtbar, erhalten jedoch keinen veralteten Öffnungslink. Auf schmalen Ansichten wechseln Datenpaare auf eine Spalte; Dateinamen umbrechen.

Die Terminbestätigung öffnet aus dem jeweiligen Einsatz einen kompakten nativen Dialog mit X rechts oben, scrollbarem Nachrichtenbereich und ständig erreichbarer Aktionszeile. Empfänger ist bearbeitbar, die aus PDS erzeugte Vorschau schreibgeschützt. Eine separate Bestätigung nennt Empfänger und tatsächliche Betriebsart. Graph-Optionen nur bei aktiviertem Modul zeigen. Erfolgstexte präzise als „vorbereitet“ beziehungsweise „in Warteschlange erfasst“ formulieren, niemals als Zustellnachweis. Eingaben nach Fehlern erhalten; Fokus beim Schließen auf den auslösenden Einsatzbutton zurückführen.

Die Anlagenchronik ist ein aufklappbarer Bereich direkt in der technischen Einheitenakte. Kompakte segmentierte Filter und Monatsgruppen gliedern eine gemeinsame Zeitleiste. Termin, Fälligkeit, Dokumentdatum und Änderungszeit bleiben textlich unterscheidbar; Farbe ergänzt nur die Eintragsart. Unbekannte Daten stehen am Ende, ohne ersatzweise errechnete Zeitpunkte. Verweise öffnen vorhandene Akten/Originale. Quellenstatus und Unvollständigkeit sichtbar innerhalb der Chronik, ohne die gesamte Akte zu sperren. Mobil Zeitangaben unter den Eintrag verschieben und lange Bezeichnungen umbrechen.

Material & Leistungen steht als eigener aufklappbarer Bereich in der Einsatzmappe. Gruppierung nach Einsatz, kleine Positions-/Typkennzeichnung und rechtsbündige Mengen; lange Texte und Identifikationsnummern aufklappbar. Unterschiedliche Positionstypen/Sonderarten textlich kennzeichnen, nicht nur färben. Auf dem Handy Positionsnummer/Menge als kompakte Kopfzeile über der Beschreibung anordnen; Tabellenüberschriften für assistive Technik erhalten. Keine Pflicht-Menge oder Einheit erfinden. Quellenausfälle am Bereich anzeigen und vorhandenen Stand als solchen kennzeichnen; keine globale Sperrfläche.

### Serviceauftragsakte · Fokusfelder

Auftragsnummer und Auftragsstatus stehen in einer gemeinsamen kompakten Kopfzeile. Kunde ist einmal am Auftragskontext sichtbar. Je Einsatz bilden Objektadresse, Termin und Haupttechniker die visuelle Hierarchie: klar beschriftete Standortzeile, zwei ruhige Fokusflächen für Termin und Team, Begleiter als Zusatzinformation. Fehlende Planung bleibt durch Text und eine zurückhaltende rote Tönung erkennbar. „Termin vergeben“ ist bei entsprechender Berechtigung die rote Hauptaktion; unterstützende Aktionen bleiben neutral. Kein automatischer Status- oder Abschlusswechsel durch die Darstellung.

Lange Beschreibungen zeigen geschlossen eine kurze Vorschau und aufgeklappt den vollständigen gespeicherten Text. Die Vorschau verschwindet beim Öffnen, damit Text nicht doppelt erscheint. Rückläufe, Material, Dokumente, Ansprechpartner und Anlagenlinks bilden einheitliche Gruppen mit zwölf Pixeln Radius, feinen Trennlinien, gleichen Überschriftsgrößen und ruhigen Hintergrundflächen. Auf schmalen Ansichten stapeln sich Termin und Team, Aktionen erhalten mindestens 44 Pixel Höhe. Datenabrufe, Schreibrechte, Entwürfe und vorhandene Dialogabläufe bleiben unabhängig von dieser Darstellung.

Symbolmenüs der Menüleiste behalten auch dann einen zugänglichen Namen, wenn ihre sichtbare Beschriftung in schmaler Ansicht entfällt. Der gemeinsame Dropdown unterstützt dafür eine optionale explizite Beschriftung; die Tastatur- und Schließlogik bleibt unverändert.

### Kunden-, Objekt- und technische Einheitenakten

Die gemeinsame Kopfzeile zeigt Aktenart mit dem bestehenden Kunden-/Objekt-/Einheitensymbol, Namen und gegebenenfalls Status. Kundenakten setzen Kundennummer, Anschrift und Ansprechpartner in den Fokus. Objektakten betonen Kunde, Objektadresse, Objektnummer und eigenen Kostenträger. Technische Einheiten zeigen Kunde, tatsächlichen beziehungsweise geerbten Standort, TE-Nummer sowie Hersteller/Typ; eigene Kostenreferenz und Wartungs-/Rechnungskostenträger bleiben getrennt bezeichnet. Geerbte Adressen werden ausdrücklich als Standort des übergeordneten Objekts gekennzeichnet.

Fokusflächen verwenden dieselben Schriftgrößen, feinen Linien und zwölf Pixel Radius wie die Auftragsakte. Weitere Metadaten, Kontakte, Verträge, Chronik, Dokumente und Verknüpfungen erscheinen in ruhigen Gruppen. Bereits hervorgehobene Metadaten werden nicht noch einmal in der Restliste wiederholt; vollständige Werte bleiben sichtbar. Fehlende optionale Angaben sind neutral, tatsächliche Ladefehler behalten den gemeinsamen roten Meldungsstil. Auf schmalen Ansichten stapeln sich Fokusflächen; Symbole, Aktennavigation und Rechte ändern sich nicht.

### Menüleisten-Werkzeuge

Werkzeuge stehen ausschließlich als zugängliche Symbolschaltflächen links neben dem Benutzermenü. Das Symbol entspricht der zugehörigen App; Name als Tooltip und zugängliche Beschriftung, geöffneter Zustand über `aria-expanded`. Der kompakte Bereich öffnet darunter, enthält eine ruhige Kopfzeile mit beschriftetem X und nutzt maximal die verfügbare Fensterhöhe. Der erste CaseDesk verwendet seine unveränderte mobile Oberfläche in einem gleichursprünglichen Fenster mit schmalem Viewport; keine zweite Formularvariante. Innenliegende Dialoge bleiben auf dieses Fenster beschränkt. Zuklappen und Ein-/Ausblenden erhalten die laufende Erfassung im geöffneten HeyElli-Fenster. Die eingebettete Ansicht übernimmt den tatsächlichen Hell-/Dunkelmodus der Hauptanwendung. Schwebende Flächen setzen eigene Außenabstände ausdrücklich zurück und bleiben horizontal wie vertikal innerhalb des Fensters. Werkzeug- und Hauptverlauf erhalten getrennte Ablageschlüssel. Die Sichtbarkeit wird unter Benutzerkonto → Werkzeuge pro Benutzer gespeichert; die Freigabe erfolgt getrennt im Rolleneditor.

Benutzer- und Werkzeugsymbole in der Menüleiste verwenden dieselbe Größe (18 px), Strichdarstellung und dezente Hervorhebung der gesamten Schaltfläche. Das Benutzersymbol erhält keine zusätzliche Avatarfläche oder Umrandung. Zwischen Werkzeugen und Benutzermenü stehen kompakte 2 px Abstand.

Bei Smartphone-Breite bis einschließlich 650 px bleiben Menüleisten-Werkzeuge ausgeblendet; persönliche Sichtbarkeit und laufende Erfassungen werden dadurch nicht zurückgesetzt. Der aktuelle App-Name wird dort durch das gemeinsame App-Symbol mit Abwärtspfeil ersetzt. Der vollständige Name bleibt als zugängliche Menübeschriftung erhalten. Das App-Menü öffnet innerhalb der Fenstergrenzen. Auf größeren Ansichten bleibt der App-Name sichtbar.

Angefangene Werkzeug-Aufträge erhalten einen dezenten roten Punkt am Werkzeugsymbol sowie eine zugängliche Beschreibung und einen Tooltip. Der Status wird ausschließlich als Boolean vom eigenen gleichursprünglichen Werkzeugfenster übernommen; Fachinhalte werden nicht an die Menüleiste übertragen. App-Wechsel, Kalenderaktualisierung und Vor-/Zurücknavigation der Hauptanwendung verwerfen oder bestätigen keinen Werkzeug-Auftrag. Der Navigationsschutz eines eingebetteten Werkzeugs darf die gemeinsame Browserhistorie nicht zurückdrehen.

Dauerhafte Werkzeug-Erfassungen werden benutzergebunden und verschlüsselt im Hintergrund gesichert. Der Punkt bezeichnet den noch nicht angelegten Auftrag, nicht einen Sicherungsfehler. Nach erfolgreicher lokaler Sicherung darf reguläres Neuladen die Erfassung wiederherstellen. Nur bei mehreren gesicherten Erfassungen erscheint eine kompakte Auswahl im Werkzeug. Nach unklarer Auftragserstellung „Speicherergebnis prüfen“ anbieten und Änderungen sperren, bis derselbe Vorgang mit derselben Kennung bestätigt wurde. Keine automatische Auftragsanlage beim Wiederöffnen.

Solange eine lokale Sicherung fehlgeschlagen oder eine Dateisicherung noch nicht abgeschlossen ist, zeigt Neuladen per ⌘/Strg R oder F5 einen kompakten macOS-Hinweis mit „Zum angefangenen Auftrag“. Browser-eigene Neuladeschaltflächen verwenden hierfür die native Sicherheitsabfrage; deren Text ist browserseitig festgelegt. Nach Abbrechen bleiben Erfassung und gezielter Hinweis geöffnet. Abgelaufene/widerrufene Sitzungen dürfen durch den Eingabeschutz nicht am geschützten Abmelden gehindert werden.

In der Service-Auftragsakte führt „Im PlanBoard anzeigen“ mit dem gemeinsamen PlanBoard-Symbol je geplantem Einsatz zum konkreten Termin. Die bestehende Aktionsgruppe erhält einen kompakten Link im Stil ihrer Schaltflächen. Der Kalender öffnet die Tagesansicht, zeigt die betreffende Ressource und hebt den Termin mit dem Fokusfarbton hervor; keine automatische Bearbeitung. Dabei dürfen persönliche Ressourcen-, Wochenend- oder Arbeitszeitvorgaben nicht dauerhaft überschrieben werden. Ohne Termin oder Kalender-Leserecht keine wirkungslose Verknüpfung anbieten.

Temporäre Ressourcenfilter aus Kalenderlinks stehen mit dem aufgelösten Mitarbeiternamen im Suchfeld „Ressourcen“ und nutzen dieselbe aktive Umrandung wie eingegebene Suchtexte. Ein zugängliches X im Feld entfernt den Filter; Bearbeiten ersetzt ihn durch die normale Ressourcensuche. Beim Entfernen auch die betreffenden Linkparameter lösen, damit Neuladen den Filter nicht erneut anwendet. Datum und persönliche Ressourcenauswahl bleiben erhalten. Suchfelder besitzen jeweils nur eine sichtbare Löschen-Schaltfläche; native zusätzliche Suchfeld-X unterdrücken.

Fixierte Kalendertermine tragen vor dem Titel ein kleines Schloss als SVG in der kontrastreichen Termintextfarbe. Kein Quadrat oder plattformabhängiges Emoji. Die zugängliche Beschriftung nennt weiterhin „fixiert“; ein laufender Speichervorgang verwendet zusätzlich seinen eigenen Ladekringel.

Der persönliche Notizblock verwendet ein eigenes Notizsymbol, ein einzelnes beschriftetes Textfeld und eine dezente Speicher-/Zeichenanzeige. Automatisches Speichern benötigt keinen zusätzlichen Speichern-Knopf. Ein Punkt kennzeichnet noch nicht bestätigte Änderungen; Fehler erscheinen über den gemeinsamen Hinweisbaustein. Escape schließt das Werkzeug und gibt den Fokus an sein Symbol zurück. Immer nur ein Menüleisten-Werkzeug aufklappen; Zuklappen beendet keine laufende Sicherung. Bei überlappenden Änderungen bleiben die eigene und die gespeicherte Fassung sichtbar, bis der Benutzer sie ausdrücklich zusammenführt.

Serviceauftragsakten bündeln Navigation, PDS-Verweise und Einsatzaktionen im oberen Aktenkopf links von der Status-Schaltfläche. Aktionssymbole erhalten zugängliche Namen und native Tooltips; keine wiederholten Textschaltflächen unter den Einsatzdaten. Bei mehreren Einsätzen bleiben die Aktionen pro Einsatz gruppiert und über Tooltips identifizierbar. Der aktuelle Status öffnet eine kompakte Auswahl im gemeinsamen durchscheinenden Menüstil. Bestätigungen verwenden den macOS-Hinweisdialog, Fehler den roten Hinweisbaustein. Schmale Akten lassen die Aktionszeile umbrechen, ohne Felder oder Menüs abzuschneiden.

Im Service-Aktenkopf bleibt die Navigation links. Einsatzaktionen und Status bilden rechts eine eng verbundene Gruppe mit denselben neutralen Symbolschaltflächen. Das Statusmenü nutzt die gemeinsamen `heyelli-command-menu`-/`heyelli-menu-surface`-Klassen: kompakte Zeilen, rote Hervorhebung und die gemeinsamen Trenner. Mobile Ausgabe steht vor, Stornierung nach den normalen Statuswechseln, jeweils durch eine feine Linie getrennt.

In den Einsatzaktionen kennzeichnet ausschließlich das rote Symbol „Termin vergeben“ eine noch offene Planung. Der Kalenderverweis verwendet die normale Textfarbe (dunkel in heller Darstellung, hell im Dunkelmodus); beide Schaltflächen behalten ihre neutrale Fläche.

Technische Einheiten verwenden einheitlich das Schaltschrank-Symbol aus `FileActionIcon` (`unit`): rechteckige Tür, Lüftungsschlitze und Griff. Übersichten, Aktenüberschriften und Aktenverweise nutzen denselben Baustein; Objekte behalten das Haussymbol.

Auch die Objekt- und Einheitenauswahl im CaseDesk nutzt die gemeinsamen `RecordGlyph`-Symbole (Haus/Schaltschrank), einschließlich ausgewählter Einträge. Suchtreffer und technische Einheiten erhalten bei Maus-/Tastaturhervorhebung eine gemeinsam gesetzte rote Fläche und weiße Schrift; keine helle lokale Hoverfläche mit geerbter weißer Schrift kombinieren.

CaseDesk-Einstellungen liegen unter Apps mit dem gemeinsamen App-Symbol und verschachtelter Unterseite „Standardpositionen“. Kompakte neutrale Artikel-Auswahl neben Positionsnummer und Menge; schmale Ansichten stellen den Artikelnamen über die Eingabefelder. Vollständige Zeilen speichern automatisch. Die Anzeige „Gespeichert“ darf erst nach Serverbestätigung erscheinen; offene/unvollständige Eingaben und Fehler bleiben unterscheidbar. Der Katalog zeigt echte Treffer, keine freien Namensersatzwerte.

Erledigte Schritte erscheinen grün mit Häkchen. Übersprungene Einsatzplanung erscheint in Schritt 3 gelb mit dem Status „Später planen“. Schritt 4 „Abschluss“ gruppiert Auftragsdaten, vollständigen Meldungstext, optionale PDS-Bemerkung und Zuweisung. Auswahlmenüs verwenden die gemeinsame Popover-Oberfläche. Die Suche zeigt zehn Treffer, die technische Einheitenliste acht pro Seite. Für die ausgewählte technische Einheit kann Schritt 1 mit Service-Leserecht die Anlagenchronik anzeigen. Sie ist zunächst eingeklappt und lädt erst beim Öffnen. Dann zeigt sie zunächst fünf Einträge. Nach dem Speichern zeigt der CaseDesk-Abschluss unter „Weiteren Auftrag aufnehmen“ die Direktlinks zum bestätigten Kalendertermin und zur Service-Auftragsakte, jeweils in einer eigenen Zeile. Nur vorhandene Ziele mit Ziel-App-Leserecht anzeigen. Links aus dem kompakten Werkzeug öffnen die Haupt-App unter Beachtung ihres Navigationsschutzes.

## Suche in Einstellungen und Benutzerkonto

Die linke Suche folgt der Bedienung des HeyElli-Menüs: stabiles Suchfeld mit Suchsymbol, explizitem X zum Leeren, Pfeiltasten zur Trefferauswahl und Enter zum Öffnen. Escape leert zuerst die Suche; normale Texteingabe und Eingabemethoden bleiben erhalten. Treffer stehen in der linken Navigation mit Symbol und Einstellungsweg; der Suchtext bleibt beim Öffnen erhalten. Nur die Trefferliste scrollt, das Feld bleibt erreichbar. Auf schmalen Ansichten öffnet eine Auswahl die Detailseite; die bestehende appinterne Zurücknavigation führt zurück zur Bereichsliste.

Neue Einstellungsseiten werden aus `settings-page-model.ts` indexiert. Einzelne Funktionen und Synonyme sind zusätzlich unter `settings-search.ts` nachzuführen, mit gültigem Zielweg. Dynamisch auszuwählende Konten oder Rollen führen zuerst zu ihrer Auswahlliste. Keine Geheimniswerte, Benutzernamen oder Protokollinhalte in diesen Index übernehmen. Kontosuche und administrative Suche bleiben getrennt. Treffer ändern keine Vorgaben und umgehen keine Freigabe oder den Navigationsschutz.
