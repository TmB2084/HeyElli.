export const greetingStyleVersion = 4;
export const greetingFallback = 'Hallo, ich bin Elli. Wobei kann ich dir in HeyElli helfen?';

export function greetingRequest(previous = '') {
  const openings=['Hallo','Hi'].filter(word=>!previous.startsWith(word));
  const opening=openings[Math.floor(Math.random()*openings.length)];
  return {
    model: 'qwen3:1.7b', stream: false, think: false, keep_alive: '2m',
    format: {type: 'object', properties: {greeting: {type: 'string'}}, required: ['greeting'], additionalProperties: false},
    options: {temperature: 0.5, seed: Math.floor(Math.random() * 2147483647), num_ctx: 2048, num_predict: 180},
    messages: [{role: 'system', content: 'Du bist Elli. Schreibe eine Begrüßung aus deiner eigenen Sicht für einen neuen Chat in HeyElli. Stelle dich als Elli vor und frage, wobei du deinem Gesprächspartner helfen kannst. Schreibe idiomatisches, grammatisch korrektes Deutsch: freundlich, unaufgeregt und ohne Werbesprache. Du heißt Elli. Die andere Person wird ohne Namen angesprochen. Du bietest ihr Hilfe an; du bittest sie nicht um Hilfe. Duze die Person. Nutze ein bis zwei natürliche Sätze und variiere deine Wortwahl. Stelle dich ausschließlich mit deinem Namen vor, ohne Rollenbezeichnung, Selbstlob oder technische Begriffe. Höchstens 25 Wörter und 180 Zeichen. Prüfe vor der Ausgabe Satzbau, Pronomen und die passende Präposition. Natürliche Frageformen sind etwa „Wobei kann ich dir helfen?“ oder „Was möchtest du wissen?“. Formuliere die gesamte Begrüßung selbst und variiere sie, ohne diese Beispiele nur abwechselnd zu kopieren. Keine Aussagen darüber, dass die Person dich sucht oder findet. Keine übertriebenen Hilfsversprechen. Keine Links, keine technischen Erklärungen und keine Behauptungen über ausgeführte Aktionen oder Datenzugriffe. Antworte als JSON mit dem Feld greeting.'}, {role: 'user', content: 'Stelle dich selbst vor. Beginne wörtlich mit: '+opening+', ich bin Elli. Formuliere danach selbst eine kurze, freundliche Frage an die andere Person.'}],
  };
}

export function greetingText(content: unknown, previous = ''): string {
  if (typeof content !== 'string') throw new Error('Begrüßung fehlt.');
  const parsed = JSON.parse(content);
  if (typeof parsed?.greeting !== 'string') throw new Error('Ungültige Begrüßung.');
  const text = parsed.greeting.trim().replace(/\s+/g, ' ');
  if (text.length < 25 || text.length > 180 || text.split(' ').length > 25 || !/\bElli\b/.test(text) || /[<>]|https?:|www\.|\[[^\]]*\]\(/i.test(text) || text === previous) throw new Error('Ungültige Begrüßung.');
  if (!/(?:\bich\s+(?:bin|hei(?:ß|ss)e)\s+Elli\b|\bElli\s+hier\b|\bhier\s+ist\s+Elli\b)/iu.test(text)) throw new Error('Elli soll sich selbst vorstellen.');
  if (/\b(?:KI|Bedienungshilfe|Sprachmodell|Chatbot|Assistent(?:in)?|künstliche(?:n|r)? Intelligenz)\b/iu.test(text)) throw new Error('Die Begrüßung soll Elli einfach beim Namen vorstellen.');
  // A small local model sometimes reverses who offers help or uses the wrong preposition.
  // Reject these greetings for regeneration; never rewrite user questions or factual answers.
  if (/^(?:Hallo|Hi|Hey)[,! ]+Elli\b|\b(?:worauf|woraus|worum|wofür)\b[^?!.]*\b(?:helf|hilfe)|\bwas kann ich dir helfen|\bwie kann ich dich helfen|\bkannst? du (?:mir|mich) helfen|\bkannst? ich\b|\bdu mich (?:suchst|findest)\b|\b(?:alles|allem),? was du (?:brauchst|möchtest)\b/iu.test(text)) throw new Error('Bitte eine natürliche Begrüßung formulieren.');
  if (!/\?\s*$/u.test(text) || (text.replace(/^(?:Hallo|Hi|Hey|Servus|Moin)!\s*/u,'').match(/[.!?]+(?:\s|$)/g)?.length??0)>2) throw new Error('Bitte kurz vorstellen und mit einer Frage einladen.');
  if (!/(?:\b(?:wobei|wie|womit)\s+(?:kann|darf)\s+ich\s+dir\s+(?:(?:heute|jetzt|dabei|in HeyElli)\s+)?helfen|\bwas\s+möchtest\s+du\b|\bwelche\b[^?!.]*\b(?:darf ich|möchtest du|hast du)\b|\bhast du\s+(?:eine\s+)?frage\b)/iu.test(text)) throw new Error('Die Einladung soll klar und natürlich sein.');
  return text;
}
