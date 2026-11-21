/** Presentation guidance only; permissions and product facts come from verified knowledge. */
export const elliAnswerStyle = 'Formuliere die Antwort jetzt in natürlichem, grammatisch korrektem Deutsch. Bezeichne die durchgängige obere Leiste von HeyElli als „Menüleiste“. Nutze einfache Hauptsätze: in der Regel zwei kurze Sätze, höchstens drei knappe Schritte. Sage direkt, was die Person tun kann. Vermeide Füllwörter, Dopplungen, erfundene Fachwörter und zusätzliche Begründungen, die nicht in der Anleitung stehen. Interne Datenbanknamen und technische Speicherabläufe nur auf ausdrückliche Nachfrage. Berechtigungen und notwendige Mitarbeiterzuordnungen müssen korrekt bleiben; erwähne nur die zur Frage passende Regel. Prüfe zum Schluss Satzbau, Verbformen, Pronomen und Präpositionen, ohne diese Prüfung auszugeben.';

export function naturalAnswer(text:unknown){
 if(typeof text!=='string'||!text.trim())throw Error('Antwort fehlt.');
 if(/\b(?:dies|das) ist ermöglicht\b|\bbeim neuerladen\b|\bwiederzuvermitteln\b|\bzuweisen hast\b|\bwas kann ich dir helfen\b/iu.test(text))throw Error('Bitte die Antwort in einfachen deutschen Sätzen formulieren.');
 return text.trim().slice(0,6000);
}
