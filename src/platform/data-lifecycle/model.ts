import {PlatformError} from '../store/model.ts';
export const categories={chat:'Abgeschlossene Chatantworten',feedback:'Eigene Elli-Bewertungen',mail:'Erledigte E-Mail-Inhalte',sessions:'Beendete Sitzungen'} as const;
export type Category=keyof typeof categories;
export const protectedClasses=[
 {name:'Persönliche Notizen',reason:'Keine automatische Löschung. Offene lokale Fassungen und gespeicherte Notizen bleiben erhalten.'},
 {name:'Kalenderentwürfe und offene Fragen',reason:'Bleiben unabhängig vom Alter erhalten; keine Löschung von Entwürfen oder Schlüsseln.'},
 {name:'Wiederholungsschutz und Abschlussmarkierungen',reason:'Bleiben zur Vermeidung doppelter Vorgänge erhalten.'},
 {name:'Fachakten, Historien und Dokumente',reason:'Gemeinsame Auftragsnachweise und möglicherweise noch benötigte Uploads werden nicht pauschal gelöscht.'},
 {name:'Profil, Rollen und Zuordnungen',reason:'Keine Kontolöschung. Für einen Austritt zuerst den Zugriff in Benutzerkonten deaktivieren und Daten fachlich prüfen.'},
 {name:'Sicherungen und Browserdaten',reason:'Vorhandene Sicherungen und nicht übertragene Geräteeingaben werden nicht verändert.'},
];
export function selection(input:Record<string,unknown>){
 if(!Array.isArray(input.categories)||!input.categories.length||input.categories.length>4||input.categories.some(c=>typeof c!=='string'||!Object.hasOwn(categories,c)))throw new PlatformError('Gültige Datenarten auswählen.');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date()),cutoff=input.cutoff;
 if(typeof cutoff!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)||!Number.isFinite(Date.parse(cutoff))||new Date(cutoff).toISOString().slice(0,10)!==cutoff||cutoff>today)throw new PlatformError('Gültigen Stichtag bis heute auswählen.');
 return {categories:[...new Set(input.categories)] as Category[],cutoff};
}
