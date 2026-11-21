# PDS-Operationen aus openapi.yaml

Automatisch erfasst; nicht jede dokumentierte Operation ist im Simulator implementiert.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| POST | `/administration/listkostenstelle` | Kostenstellensuche |
| POST | `/administration/listkostentraeger` | Kostentraegersuche |
| POST | `/administration/listarbeitsgruppen` | Gibt Liste an Arbeitsgruppen zurück. |
| GET | `/administration/listerloesgruppen` | Gibt Liste der Erlösgruppen zurück |
| GET | `/administration/listfeiertage` | Gibt Liste der Feiertage zurück |
| GET | `/administration/listfeiertagsgruppen` | Gibt Liste der Feiertagsgruppen zurück |
| GET | `/administration/listkalkulationsgruppen` | Gibt Liste der Kalkulationsgruppen zurück |
| GET | `/administration/listkostenarten` | Gibt Liste der Kostenarten zurück |
| GET | `/administration/listkostengruppen` | Gibt Liste der Kostengruppen zurück |
| GET | `/administration/listlaender` | Gibt Liste der Länder zurück |
| GET | `/administration/listmasseinheiten` | Gibt Liste der Masseinheiten zurück |
| GET | `/administration/listmehrwertsteuer` | Gibt Liste der MwSt.-Typen zurück |
| GET | `/administration/listressourcengruppen` | Gibt Liste der Ressourcengruppen zurück |
| POST | `/crm/createaufgabe` | Erstellt eine Aufgabe |
| POST | `/crm/createaufgabezuweisung` | Zuweisen einer Aufgabe |
| POST | `/crm/deleteaufgabe` | Löschen einer Aufgabe |
| POST | `/crm/aufgabedetails` | Details zu einer Aufgabe |
| GET | `/crm/listaufgabentypen` | Gibt Liste der Aufgabentypen zurück |
| POST | `/crm/listaufgaben` | Gibt Liste an Aufgaben zurück. |
| POST | `/crm/removeaufgabezuweisung` | Löschen einer Aufgabezuweisung |
| POST | `/crm/updateaufgabe` | Aktualisieren einer Aufgabe |
| POST | `/datenansichten/listdaten` | Gibt die Daten für eine Datenansicht paginiert zurück. |
| GET | `/datenansichten/list` | Gibt Liste der initialisierten und verfügbaren Datenansichten zurück. |
| GET | `/dokument/downloaddokument/{uuid}` | Dokument herunterladen |
| GET | `/dokument/listexternedokumententypen` | Gibt Liste der Dokumententypen zurück. |
| POST | `/dokument/uploaddokument` | Dokument mit Referenzen hochladen |
| POST | `/katalog/changeentry` | Anlegen Änderungseintrag für Katalogeintrag. Wird u.a. auch für die Schnittstelle zur Kasse flour genutzt. |
| POST | `/katalog/create` | Erstellt einen Katalogeintrag. |
| POST | `/katalog/addlieferanteneintrag` | Erstellt einen neuen Lieferanteneintrag zu gegebenen Katalogeintrag und Lieferanten |
| POST | `/katalog/delete` | Löscht nach Prüfung auf Bestand und anderer Verwendung einen Katalogeintrag. |
| POST | `/katalog/details` | Details zu einem Katalogeintrag. |
| POST | `/katalog/detailsbatch` | Details zu einer Liste von Katalogeinträgen |
| POST | `/katalog/getkassenartikelbybarcode` | Ermittlung eines eindeutigen Katalogs anhand eines Barcode Inhalts. Wird u.a. auch für die Schnittstelle zur Kasse flour genutzt. |
| POST | `/katalog/kategoriedetails` | Details zu einer Katalogkategorie. |
| POST | `/katalog/listkassenartikel` | Katalogsuche für Artikel und Artikel inkl. Lohn mit einem Kassenpreis. Wird u.a. auch für die Schnittstelle zur Kasse flour genutzt. |
| POST | `/katalog/listartikel` | Katalogsuche für Artikel und Artikel inkl. Lohn |
| POST | `/katalog/listkategorien` | Suche nach Katalogkategorien. Gibt die Root-Kategorie zurück, wenn keine parentUUID angegeben wird. |
| POST | `/katalog/listwarengruppen` | Gibt Liste an Warengruppen zurück. |
| POST | `/katalog/removelieferanteneintrag` | Setzt das Löschkennzeichen zu einem Lieferanteneintrag. |
| POST | `/katalog/update` | Aktualisiert einen Katalogeintrag. |
| POST | `/katalog/updateAbbildung` | Aktualisieren der Abbildung für Katalogeintrag |
| POST | `/katalog/updatelieferanteneintrag` | Ändert einen Lieferanteneintrag zu gegebenen Katalogeintrag und Lieferanten |
| POST | `/lager/createumbuchung` | Lagerumbuchung anlegen |
| POST | `/lager/listlager` | Lagerortsuche |
| GET | `/lager/listlagertypen` | Gibt Liste der Lagertypen zurück. |
| POST | `/lager/listzaehllisten` | Suche nach Zähllisten |
| GET | `/lager/listzaehllistenstatus` | Gibt eine Liste der möglichen Vorgangsstatus einer Zählliste zurück. |
| POST | `/lager/updateInventur` | Aktualisieren einer Inventurerfassung aufgrund einer Zähllisten-UUID |
| POST | `/lager/updateInventurZeilen` | Aktualisieren von Inventurzeilen mit der erfassten Menge aufgrund der UUID der Zeile |
| POST | `/mitarbeiter/create` | Erstellen eines Mitarbeiters |
| POST | `/mitarbeiter/createEKommunikationsweg` | Erstellen eines EKommunikationswegs |
| POST | `/mitarbeiter/createPostKommunikationsweg` | Erstellen eines Post-Kommunikationswegs |
| POST | `/mitarbeiter/details` | Details zu einem Mitarbeiter |
| POST | `/mitarbeiter/detailsbatch` | Details zu einer Liste von Mitarbeitern |
| POST | `/mitarbeiter/listmitarbeiter` | Mitarbeitersuche |
| GET | `/mitarbeiter/listfachbereiche` | Gibt Liste der Fachbereiche zurück |
| GET | `/mitarbeiter/listqualifikationen` | Gibt Liste der Qualifikationen zurück |
| POST | `/mitarbeiter/removeEKommunikationsweg` | Löschen eines EKommunikationswegs |
| POST | `/mitarbeiter/removePostKommunikationsweg` | Löschen eines Post-Kommunikationswegs |
| POST | `/mitarbeiter/updateEKommunikationsweg` | Aktualisieren eines EKommunikationswegs |
| POST | `/mitarbeiter/updatePostKommunikationsweg` | Aktualisieren eines Post-Kommunikationswegs |
| POST | `/mitarbeiter/uploaddokument` | Mitarbeiterdokument hochladen |
| POST | `/objekt/createhistorie` | Historieneintrag am Objekt erstellen |
| POST | `/objekt/create` | Objekt erstellen |
| POST | `/objekt/findstrukturobjekt` | Gibt Struktur Objekt einer Person zurück |
| POST | `/objekt/details` | Details zu einem Objekt |
| POST | `/objekt/detailsbatch` | Details zu einem Objekt |
| GET | `/objekt/listinfofelder` | Gibt Liste aller Objekt Info Felder zurück. |
| POST | `/objekt/listobjekte` | Objektsuche |
| POST | `/objekt/removestandort` | Löschen eines Standorts an einem Objekt |
| POST | `/objekt/updateinfofelder` | Aktualisieren von Objekt Info Felder |
| POST | `/objekt/update` | Aktualisieren eines Objekts |
| POST | `/objekt/updatestandort` | Aktualisieren eines Standorts an einem Objekt |
| POST | `/person/addansprechpartnerrolle` | Anlegen einer Ansprechpartnerrolle |
| POST | `/person/addinteressentenrolle` | Anlegen einer Interessentenrolle |
| POST | `/person/addKundenrolle` | Anlegen einer Kundenrrolle |
| POST | `/person/addlieferantenrolle` | Anlegen einer Lieferantenrolle |
| POST | `/person/create` | Erstellen einer Person |
| POST | `/person/createEKommunikationsweg` | Erstellen eines EKommunikationswegs |
| POST | `/person/createPostKommunikationsweg` | Erstellen eines Post-Kommunikationswegs |
| POST | `/person/details` | Details zu einer Person |
| POST | `/person/detailsbatch` | Details zu einer Liste von Personen |
| POST | `/person/detailsbyapiid` | Details zu einer Person (Suche über die apiID) |
| POST | `/person/listkunden` | Kundensuche |
| POST | `/person/listpersonen` | Personensuche |
| GET | `/person/listabteilungen` | Gibt Liste der Abteilungen zurück |
| GET | `/person/listanreden` | Gibt Liste der Anreden zurück |
| POST | `/person/listbankverbindungen` | Gibt Liste der Bankverbindungen zu einer Person zurück |
| GET | `/person/listfunktionen` | Gibt Liste der Funktionen zurück |
| POST | `/person/removeansprechpartnerrolle` | Entfernen einer Ansprechpartnerrolle |
| POST | `/person/removeEKommunikationsweg` | Löschen eines EKommunikationswegs |
| POST | `/person/removeinteressentenrolle` | Entfernen einer Interessentenrolle |
| POST | `/person/removePostKommunikationsweg` | Löschen eines Post-Kommunikationswegs |
| POST | `/person/update` | Aktualisieren einer Person |
| POST | `/person/updateansprechpartnerrolle` | Aktualisieren einer Ansprechpartnerrolle |
| POST | `/person/updateEKommunikationsweg` | Aktualisieren eines EKommunikationswegs |
| POST | `/person/updateinfofelder` | Aktualisieren von Person Info Felder |
| POST | `/person/updatePostKommunikationsweg` | Aktualisieren eines Post-Kommunikationswegs |
| POST | `/projektakte/create` | Erstellt einer Projektakte |
| POST | `/projektakte/details` | Details zu einer Projektakte |
| POST | `/projektakte/detailsbatch` | Details zu einer Liste von Projektakten |
| POST | `/projektakte/listdokumente` | Gibt Liste der Dokumente für eine Projektakte zurück. |
| GET | `/projektakte/listinfofelder` | Gibt Liste aller Vorgangsdetails Felder zurück. |
| GET | `/projektakte/listvorlagen` | Gibt Liste der Vorlagen für Projektakten zurück. |
| GET | `/projektakte/liststatus` | Gibt Liste der Vorgangsstatus zurück. |
| POST | `/projektakte/listprojektakten` | Projektaktensuche |
| POST | `/projektakte/searchprojektakten` | Projektaktensuche mit mehreren Kriterien |
| POST | `/projektakte/updateinfofelder` | Aktualisieren von Projektakte Info Felder |
| POST | `/projektakte/updateprojektakte` | Aktualisieren einer Projektakte |
| POST | `/ruecklauf/create` | Erstellt einen Rücklauf |
| POST | `/ruecklauf/createebene` | Erstellt eine Rücklaufebene |
| POST | `/ruecklauf/createposition` | Erstellt eine Rücklaufposition |
| GET | `/ruecklauf/listinfofelder` | Gibt eine Liste aller Vorgangsdetails Felder zurück. |
| GET | `/ruecklauf/details/{uuid}` | Details zu einem Rücklauf |
| GET | `/ruecklauf/listauftragsdokumente/{uuid}` | Gibt eine Liste der Auftragsdokumente für den Rücklauf zurück. |
| GET | `/ruecklauf/listdokumente/{uuid}` | Gibt eine Liste der Dokumente für den Rücklauf zurück. |
| GET | `/ruecklauf/liststatus` | Gibt eine Liste der Vorgangstatus für den Rücklauf zurück |
| POST | `/ruecklauf/updateinfofelder` | Aktualisieren von Rücklauf Info Felder |
| POST | `/ruecklauf/updatestatus` | Aktualisieren des Status eines Rücklaufs |
| POST | `/ruecklauf/uploadauftragsdokument` | Auftragsdokument hochladen |
| POST | `/service/create` | Erstellt einen Serviceauftrag |
| POST | `/service/createstoerung` | Erstellt eine Störung |
| POST | `/service/createposition` | Erstellt eine Position zu einer Störung |
| POST | `/service/findstoerungtermin` | Gibt den Termin einer Störung zurück |
| GET | `/service/listinfofelder` | Gibt eine Liste aller Vorgangsdetails Felder zurück. |
| POST | `/service/details` | Details zu einem Serviceauftrag |
| GET | `/service/listvorlagen` | Gibt Liste der Vorlagen für Serviceauftrag/Rücklauf zurück. |
| POST | `/service/liststoerungen` | Gibt Liste an Störungen zurück. |
| GET | `/service/listauftragsdokumente/{uuid}` | Gibt eine Liste der Auftragsdokumente für den Serviceauftrag zurück. |
| GET | `/service/listdokumente/{uuid}` | Gibt eine Liste der Dokumente für den Serviceauftrag zurück. |
| GET | `/service/liststatus` | Gibt Liste der Vorgangstatus für Serviceaufträge zurück |
| GET | `/service/liststoerungprioritaeten` | Gibt Liste der Störungsprioritäten zurück |
| POST | `/service/mobilausgeben` | Serviceaufträge mobil ausgeben |
| POST | `/service/mobileausgabestornieren` | Stornieren der mobilen Ausgabe von Serviceaufträgen. Wenn der Serviceauftrag mehrere Serviceauftragsebenen enthält, werden nur die Serviceauftragsebenen storniert die dem Flag 'auftragspool' entsprechen. |
| POST | `/service/updateinfofelder` | Aktualisieren von Serviceauftrag Info Felder |
| POST | `/service/update` | Aktualisieren eines Serviceauftrags |
| POST | `/service/updatestoerung` | Aktualisieren einer Störung. |
| POST | `/service/updatestatus` | Aktualisieren des Status eines Serviceauftrag |
| POST | `/service/uploaddokument` | Auftragsdokument hochladen |
| POST | `/stundenerfassung/stundenverbuchen` | Zeit-Buchungen übernehmen |
| POST | `/termin/create` | Anlegen eines Termins |
| POST | `/termin/delete` | Löschen eines Termins |
| POST | `/termin/details` | Details zu einem Termin |
| POST | `/termin/detailsbatch` | Details zu einer Liste von Terminen |
| GET | `/termin/listkategorien` | Gibt Liste der Kategorien zurück |
| POST | `/termin/listplanung` | Gibt Liste der verplanten Zeiträume zu mehreren Mitarbeitern zurück |
| POST | `/termin/listterminebymitarbeiter` | Gibt Liste der Termine eines Mitarbeiters zurück |
| POST | `/termin/update` | Aktualisieren eines Termins |
| POST | `/vorgang/addseriennummer` | Anlegen einer Seriennummer an einer Vorgangsposition |
| POST | `/vorgang/createnachtragsangebot` | Erstellt einen Nachtrag für ein Angebot |
| POST | `/vorgang/createnachtragsauftrag` | Erstellt einen Nachtrag für ein Auftrag |
| POST | `/vorgang/create` | Erstellt einen Vorgang. |
| POST | `/vorgang/createzahlungsbedingung` | Erstellt eine Zahlungsbedingung an einem Vorgang |
| GET | `/vorgang/listinfofelder` | Gibt eine Liste aller Vorgangsdetails Felder zurück. |
| POST | `/vorgang/details` | Details zu einem Vorgang. |
| POST | `/vorgang/listangebote` | Gibt Liste der Angebote zurück. |
| POST | `/vorgang/listauftraege` | Gibt Liste der Aufträge zurück. |
| POST | `/vorgang/listbedarfsmeldungen` | Gibt Liste der Bedarfsmeldungen zurück. |
| POST | `/vorgang/listbestellungen` | Gibt Liste der Bestellungen zurück. |
| POST | `/vorgang/listdokumente` | Gibt Liste der Dokumente für Vorgänge zurück. |
| POST | `/vorgang/listlieferscheine` | Gibt Liste der Lieferscheine zurück. |
| POST | `/vorgang/listpositionsstatus` | Gibt Liste der Vorgangpositionsstatus zu dem Vorgangstyp zurück. |
| POST | `/vorgang/listrechnungen` | Gibt Liste der Rechnungen zurück. |
| POST | `/vorgang/listruecknahmen` | Gibt Liste der Rücknahmen zurück. |
| POST | `/vorgang/listvorgaengebyperson` | Gibt Liste der Vorgänge zu einer Person zurück. |
| POST | `/vorgang/listvorgaengebyprojektakte` | Gibt Liste der Vorgänge zu einer Projektakte zurück. |
| POST | `/vorgang/listvorlagen` | Gibt Liste der Vorlagen für Vorgänge zurück. |
| POST | `/vorgang/listwareneingaenge` | Gibt Liste der Wareneingänge zurück. |
| POST | `/vorgang/liststatus` | Gibt Liste der Vorgangsstatus zu dem Vorgangstyp zurück. |
| POST | `/vorgang/removeseriennummer` | Anlegen einer Seriennummer an einer Vorgangsposition |
| POST | `/vorgang/removezahlungsbedingung` | Löschen einer Zahlungsbedingung am Vorgang |
| POST | `/vorgang/updateposition` | Aktualisieren einer Vorgangsposition. |
| POST | `/vorgang/updatevorgang` | Aktualisieren eines Vorgangs. |
| POST | `/vorgang/updateinfofelder` | Aktualisieren von Vorgang Info Felder |
| POST | `/wartungsvertrag/createmustervertrag` | Erstellt einen Muster-Wartungsvertrag. |
| POST | `/wartungsvertrag/createrechnungsintervall` | Erstellen eines neuen Rechnungsintervalls. |
| POST | `/wartungsvertrag/createwartungsintervall` | Erstellen eines neuen Wartungsintervalls. |
| POST | `/wartungsvertrag/create` | Erstellt einen Wartungsvertrag auf Grundlage eines Muster-WartungsVertrag zu einem Objekt. |
| POST | `/wartungsvertrag/deletemustervertrag` | Löschen eines Muster-Wartungsvertrages. |
| DELETE | `/wartungsvertrag/deleterechnungsintervall/{rechnungsintervallUUID}` | Löschen eines bestehenden Rechnungsintervall. |
| DELETE | `/wartungsvertrag/deletewartungsintervall/{wartungsintervallUUID}` | Löscht ein bestehendes Wartungsintervall. |
| POST | `/wartungsvertrag/delete` | Löschen eines Wartungsvertrages |
| POST | `/wartungsvertrag/listintervalldokumente` | Gibt die Dokumente zu einem Intervall aus. |
| GET | `/wartungsvertrag/rechnungsintervalldetails/{rechnungsintervallUUID}` | Details zu einem Rechnungsintervall |
| POST | `/wartungsvertrag/listvertraegebyobjekt` | Gibt die Liste von Verträgen zu einem Objekt aus. |
| POST | `/wartungsvertrag/details` | Gibt die Details zu einem Wartungsvertrag aus. |
| GET | `/wartungsvertrag/wartungsintervalldetails/{wartungsintervallUUID}` | Details zu einem Wartungsintervall |
| POST | `/wartungsvertrag/listdokumente` | Gibt die Dokumente zu einem Wartungsvertrag aus. |
| POST | `/wartungsvertrag/listmustervertraege` | Suche nach Muster-Wartungsverträgen. |
| POST | `/wartungsvertrag/updatemustervertrag` | Ändern eines Muster-Wartungsvertrags. |
| POST | `/wartungsvertrag/updaterechnungsintervall` | Bearbeiten eines neuen Rechnungsintervalls. |
| POST | `/wartungsvertrag/updatewartungssintervall` | Bearbeiten eines vorhandenen Wartungsintervall. |
| POST | `/wartungsvertrag/update` | Ändern eines Wartungsvertrags. |
