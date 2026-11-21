import {helpTopics} from './knowledge.ts';
import {rankKnowledge,sectionId,helpTerms} from './knowledge-search.ts';
export const helpSectionId=sectionId;
const entries=helpTopics.flatMap(topic=>topic.sections.map(section=>({...section,topicId:topic.id,topicTitle:topic.title,id:sectionId(topic.id,section.title)})));
export function searchHelp(query:string,topics:typeof helpTopics=helpTopics){const terms=helpTerms(query),topic=terms.length===1?topics.find(item=>helpTerms(item.title).includes(terms[0])):undefined;const ownProfile=/\bmeine?\s+rolle\b/iu.test(query)&&!/anlegen|erstellen|ändern|bearbeiten|freigeben|sperren/iu.test(query);const ranked=rankKnowledge(ownProfile?topics.filter(item=>item.id==='konto'):topic?[topic]:topics,query);return ranked.filter(section=>section.score>=ranked[0].score*.25);}
export function retrieveHelp(query:string,previousQuestion=''){
 const followup=/\b(das|dort|dabei|dafür|damit|dazu|diese|nochmal|genauer|weiter)\b/iu.test(query)||helpTerms(query).length===0;
 let ranked=searchHelp(query+(followup&&previousQuestion?' '+previousQuestion:''));
 if(ranked[0]?.coverage<.4&&/berechtigung|rechte|rolle|\bdarf\b|\bals leser\b/iu.test(query)){const alternative=ranked.find(section=>section.coverage>=.4&&section.score>=ranked[0].score*.9);if(alternative)ranked=[alternative,...ranked.filter(section=>section!==alternative)];}
 // Generic words alone are not evidence that an unknown requested function exists.
 if(!ranked.length||ranked[0].coverage<.4)return [];
 let length=0;return ranked.filter(section=>{if(section.score<ranked[0].score*.22)return false;length+=section.text.length;return length<=7000;}).slice(0,4);
}
export function resolveHelpHash(hash:string){
 const requested=hash.replace(/^#/,'');
 const aliases:Record<string,string>={'mail--graph-testbetrieb-freigabe-und-warteschlange':'mail--graph-versand-freigabe-und-warteschlange','allgemein--statusleiste-und-navigation':'allgemein--menuleiste-und-navigation'};
 const id=aliases[requested]??requested;
 const section=entries.find(entry=>entry.id===id);
 if(section)return {topicId:section.topicId,sectionId:section.id};
 return {topicId:helpTopics.some(topic=>topic.id===id)?id:'allgemein',sectionId:''};
}

function contextualPermission(query:string,section:ReturnType<typeof retrieveHelp>[number],canAdmin:boolean,canWrite:boolean){
 if(/verschieb|verläng|verlang/iu.test(query)&&/öffnen|offnen|anzeige|darstellung/iu.test(query)){
  if(/anzeige|darstellung/iu.test(query))return canWrite?'Deine Anzeige kannst du ändern. Deine Rolle erlaubt auch das Verschieben von Terminen; die App prüft weitere Einschränkungen am Termin.':'Deine Anzeige darfst du mit Leserecht ändern. Zum Verschieben von Terminen brauchst du Schreibrecht in der jeweiligen App oder Administrator.';
  return canWrite?'Du kannst Termine öffnen und bearbeiten. Für Änderungen brauchst du Schreibrecht in der jeweiligen App oder Administrator.':'Termine öffnen kannst du mit Leserecht. Zum Verschieben oder Verlängern brauchst du Schreibrecht in der jeweiligen App oder Administrator. Das erlaubt deine aktuelle Rolle nicht.';
 }
 if(section.permission==='admin')return canAdmin?'Dafür brauchst du Administratorrechte. Die hast du.':'Dafür brauchst du Administratorrechte. Mit deiner aktuellen Rolle kannst du das nicht ändern.';
 if(section.permission==='write')return canWrite?'Dafür brauchst du Schreibrecht in der jeweiligen App oder Administrator. Deine Rolle erlaubt das.':'Dafür brauchst du Schreibrecht in der jeweiligen App oder Administrator. Deine aktuelle Rolle erlaubt diese Änderung nicht.';
 if(section.permission==='linked'){
  if(section.title==='Urlaub und Sperrwochen')return 'Eigene Sperrwochen kannst du auch mit Leserecht ausschließen. Dafür brauchst du eine Mitarbeiterzuordnung; die Woche darf noch nicht begonnen haben.';
  if(/freig/iu.test(query)&&!/vorschlag|partner|beteilig|beide/iu.test(query))return 'Für die Tauschfreigabe brauchst du Schreibrecht in der jeweiligen App oder Administrator. Eine eigene Mitarbeiterzuordnung ist dafür nicht nötig.';
  return 'Für einen Tauschvorschlag brauchen beide Beteiligten eine aktive Mitarbeiterzuordnung. Für die Tauschfreigabe brauchst du Schreibrecht in der jeweiligen App oder Administrator. Eine eigene Mitarbeiterzuordnung ist dafür nicht nötig.';
 }
 return 'Das kannst du mit Leserecht machen.';
}

export function groundedHelpAnswer(query:string,sections:ReturnType<typeof retrieveHelp>,canAdmin:boolean,canWrite:boolean){
 const permissionQuestion=/berechtigung|rechte|rolle|mitarbeiterzuordnung|voraussetzung|\bdarf\b|\bbrauche\b|benötig|\bals leser\b/iu.test(query);
 const first=sections[0];
 if(permissionQuestion&&first?.steps?.length&&first.coverage>=.4){
  const access=contextualPermission(query,first,canAdmin,canWrite);
  // Explain only the requested access rule; a how/where question also needs its route.
  return access+(/\b(wie|wo)\b/iu.test(query)&&!/\bwarum\b/iu.test(query)?' '+first.steps.slice(0,3).join(' '):'');
 }
 if(!first?.steps?.length||first.coverage<.65||sections[1]&&first.score<sections[1].score*1.3||/\b(warum|weshalb|wieso)\b/iu.test(query))return null;
 if(first.permission==='admin'&&!canAdmin||first.permission==='write'&&!canWrite)return contextualPermission(query,first,canAdmin,canWrite);
 const steps=first.steps.length<=3?first.steps.join(' '):first.steps.map((step,index)=>`${index+1}. ${step}`).join('\n');
 // Keep the full constraints in the help article. Quote only notes matching the question.
 const terms=helpTerms(query);
 const note=first.limitations?.find(note=>helpTerms(note).filter(term=>terms.includes(term)).length>=2);
 return steps+(note?'\n\n'+note:'');
}
