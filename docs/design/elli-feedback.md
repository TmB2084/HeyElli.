# Ellis Antwortbewertungen

Stand: 11.11.2026. Implementiert als Instrument zur gezielten Wissenspflege, ausschließlich für Administratoren. Bewertungen verändern weder das Modell noch die Wissensbasis automatisch.

## Bedienung und Auswertung

Unter einer gespeicherten eigenen Antwort können Administratoren Daumen hoch oder runter auswählen. Ein erneuter Klick entfernt die eigene Bewertung; ein Wechsel ersetzt sie. Bei negativer Bewertung sind Kategorie und Hinweis optional. Kategorien: falscher Bedienweg, fehlende Information, falsche Berechtigung, falscher Kontext, unverständlich oder Sonstiges. Die Bewertung wird sofort gespeichert; „Grund speichern“ übernimmt die optionalen Ergänzungen. Keine vertraulichen Angaben in den Hinweis eingeben.

Unter **Einstellungen → Elli-Rückmeldungen** sehen Administratoren ausschließlich ausdrücklich eingereichte Bewertungen mit Benutzer, Zeitpunkt, Grund und Hinweis. Bewertete Frage und Antwort lassen sich zusammen mit Quellen und Wissensstand ausklappen. Die Ansicht ist seitenweise geladen. Eigene Rückmeldungen lassen sich dort entfernen; fremde Rückmeldungen können gelesen, aber nicht geändert oder gelöscht werden.

## Gespeicherte Daten und Schutz

Migration `024_assistant_feedback.sql` legt die Tabelle in PostgreSQL an. Pro Benutzer, Chatgeneration und Antwort existiert höchstens eine Bewertung. Benutzer und Rolle stammen aus der geprüften Sitzung und werden zusätzlich im Speicherzugriff geprüft. Der Server übernimmt Frage, Antwort und Quellen ausschließlich aus der bereits gespeicherten eigenen Antwort. Der Browser darf keine fremde Identität oder eigene Antwortkopie liefern. Eingabegrößen, Herkunft und Berechtigungen werden serverseitig geprüft.

Damit Rückmeldungen nach einem Chat-Reset noch verwertbar bleiben, wird bei einer ausdrücklichen Bewertung eine begrenzte Kopie dieser Frage und Antwort gespeichert, zusammen mit Quellen und Wissensversion. Das ersetzt die frühere Konzeptidee einer bloßen Referenz auf den zurücksetzbaren Chat. Die Oberfläche weist auf die Speicherung hin. **„Neuer Chat“ löscht diese eingereichten Rückmeldungen nicht.** Eigene Rückmeldungen können anschließend in der Auswertung entfernt werden. Es gibt keine automatische Ablauffrist; bei Entfernung der Bewertung oder Löschung ihres Benutzers werden sie gelöscht.

Unbewertete fremde Chats werden nicht zugänglich. Bewertungen werden weder in Ellis Modellkontext übernommen noch an einen externen Analysedienst übermittelt. Die Bewertungsberechtigung eröffnet keinen zusätzlichen Zugriff auf Aufträge, Termine oder Geheimnisse.

## Rückmeldungen zur Verbesserung nutzen

1. Wiederkehrende negative Fälle gegen die tatsächliche Implementierung prüfen. Ein Zusatzgrund hilft, fehlendes Wissen, falsche Suchzuordnung und unverständliche Formulierungen zu unterscheiden.
2. Geprüfte Korrekturen im Funktionskatalog oder in der Suche umsetzen. Bewertungen und Freitexte nicht ungeprüft als Produktwissen übernehmen. Positive Stimmen belegen Nützlichkeit, nicht automatisch fachliche Richtigkeit.
3. Einen passenden unabhängigen Prüffall ergänzen und Bedienweg, Fundstelle sowie Berechtigungsgrenzen erneut testen. Neue Fragen zurückhalten, damit nicht allein bekannte Beispiele optimiert werden.

Gezieltes Modelltraining bleibt ein gesondertes Vorhaben mit bereinigten Beispielen und eigener Erfolgsmessung. Präferenztraining wie DPO erfordert beispielsweise bevorzugte und verworfene Antworten als Trainingsdaten; ein Daumenklick allein führt kein Training aus. Hintergrund: [Hugging Face – DPO Trainer](https://huggingface.co/docs/trl/dpo_trainer).

Ausgeführte Prüfungen (Prüfnachweis in der Git-Historie).
