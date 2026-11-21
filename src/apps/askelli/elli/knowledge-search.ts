export type SearchSection={title:string;text:string;keywords?:string[];permission?:string;route?:string;sourceFiles?:string[];steps?:string[];limitations?:string[]};
export type SearchTopic={id:string;title:string;sections:SearchSection[]};
export function normalizeHelp(value:string){return value.toLocaleLowerCase('de').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ß/g,'ss');}
export function sectionId(topicId:string,title:string){return topicId+'--'+normalizeHelp(title).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
const stop=new Set('heyelli aber keine wie wo was wer welche welcher welches wann warum wieso kann konnen konne ich wir man du mir mich meine meinen meinem deiner deine dein der die das des den dem ein eine einem einer einen und oder fur zu zur zum im in am an auf ist sind es bitte wird werden wurde habe hat auch denn genau etwas noch schon sehe sehen muss darf als bei geht konnen wurde andern andere andern aktiviere aktivieren deaktivieren benutzen machen offnen offne einrichten funktion funktionen'.split(' '));
const synonyms=[['farbe','farben','farbreihenfolge','farbgebung','einfärben'],['wochenende','samstag','sonntag','wochenendschalter'],['fixierung','fixiert','entsperren','fixieren'],['historie','anderungsverlauf','termingeschichte'],['anderung','geandert','anderungen'],['fixierung','entsperre','entsperrt'],['folgewochen','hintereinander','aufeinanderfolgend'],['tausch','tauschen','tauschwunsch','tausche','bereitschaftstausch','bereitschaftstausche'],['freigabe','freigeben','freigibt','freigeben','freigebende','freigebender'],['sperrwochen','sperrzeiten','ausschliessen'],['mobil','ausgeben','ausgabe','mobilitat'],['darstellung','theme','erscheinungsbild','modus','anzeigeeinstellungen','anzeigeeinstellung'],['haupttechniker','hauptmonteur','monteur'],['kunde','kunden'],['kalenderwoche','kw'],['benutzerkonto','account','profil'],['neuladen','reload'],['speichern','speicherung','gespeichert'],['feiertage','feiertag'],['neujahr','jahreswechsel']].map(group=>group.map(normalizeHelp));
const aliases=new Map(synonyms.flatMap(group=>group.map(word=>[word,group[0]] as const)));
function stem(word:string){return word.length>5?word.replace(/(?:ungen|ung|ern|en|er|es|e|n)$/,''):word;}
export function helpTerms(text:string){return [...new Set((normalizeHelp(text).match(/[a-z0-9]{2,}/g)??[]).filter(word=>!stop.has(word)).map(word=>stem(aliases.get(word)??word)))];}
function matches(word:string,term:string){return word===term||term.length>=4&&word.length>=4&&word.startsWith(term);}
export function rankKnowledge(topics:readonly SearchTopic[],query:string){
 const terms=helpTerms(query);if(!terms.length)return [];
 const entries=topics.flatMap(topic=>topic.sections.map(section=>({...section,topicId:topic.id,topicTitle:topic.title,id:sectionId(topic.id,section.title),heading:helpTerms(section.title),topic:helpTerms(topic.title),tags:helpTerms((section.keywords??[]).join(' ')),body:helpTerms(section.text)})));
 const idf=new Map(terms.map(term=>{const count=entries.filter(entry=>[...entry.heading,...entry.topic,...entry.tags,...entry.body].some(word=>matches(word,term))).length;return [term,Math.log(1+(entries.length-count+.5)/(count+.5))];}));
 return entries.map(entry=>{
  let score=0,matched=0;
  for(const term of terms){const weight=entry.heading.some(word=>matches(word,term))?5:entry.tags.some(word=>matches(word,term))?4:entry.body.some(word=>matches(word,term))?1.5:entry.topic.some(word=>matches(word,term))?.5:0;if(weight){matched++;score+=weight*(idf.get(term)??1);}}
  const coverage=matched/terms.length;
  // Reward an actual multiword heading, not unrelated mentions scattered in text.
  const title=normalizeHelp(entry.title),phrase=normalizeHelp(query);
  if(title.length>4&&phrase.includes(title))score+=8;
  return {...entry,score:score*(.3+.7*coverage),coverage};
 }).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
