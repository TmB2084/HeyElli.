import {test} from 'node:test';import assert from 'node:assert/strict';
import {searchHelp,resolveHelpHash} from '../help-search.ts';
import {appHelpHref} from '../../../../platform/shell/app-help.ts';
test('questions find matching sections across apps and resolve exact targets',()=>{
 for(const [query,topic,title] of [['Wie ändere ich die Kalenderfarben?','ressourcen','Legende & Farben'],['Wie vergebe ich einen Termin für einen bestehenden Einsatz?','stoerung','Bestehenden Einsatz planen'],['hellen Modus','konto','Darstellung']]){
 const found=searchHelp(query).find(result=>result.topicId===topic&&result.title===title);assert.ok(found,query);assert.deepEqual(resolveHelpHash('#'+found.id),{topicId:topic,sectionId:found.id});
 }
 assert.equal(searchHelp('Wie ändere ich die Kalenderfarben?')[0].title,'Kalenderfarben und Reihenfolge');
 assert.equal(searchHelp('Quantenbananendrucker').length,0);assert.equal(searchHelp('wie ich die').length,0);
});
test('existing topic anchors and app-specific menu help remain valid',()=>{
 assert.deepEqual(resolveHelpHash('#ressourcen'),{topicId:'ressourcen',sectionId:''});
 assert.deepEqual(resolveHelpHash('#unknown'),{topicId:'allgemein',sectionId:''});
 for(const [path,topic] of [['/servicehub','service'],['/casedesk','stoerung'],['/planboard','ressourcen'],['/dutyboard','bereitschaft'],['/benutzerkonto','konto'],['/einstellungen','einstellungen']])assert.equal(appHelpHref(path),'/hilfe#'+topic);
 assert.equal(appHelpHref('/'),'/hilfe#hilfe');assert.deepEqual(resolveHelpHash(appHelpHref('/').slice('/hilfe'.length)),{topicId:'hilfe',sectionId:''});assert.equal(appHelpHref('/hilfe'),'/hilfe');
});

test('AskElli help defaults to local read-only guidance and switches only for active Copilot',async()=>{
 const {helpForProvider}=await import('../help-provider.ts');
 const local=helpForProvider(),copilot=helpForProvider(true);
 const localTopic=local.find(t=>t.id==='hilfe'),copilotTopic=copilot.find(t=>t.id==='hilfe');
 assert.equal(localTopic.title,'AskElli mit Ollama');assert.match(localTopic.text,/keine Änderungen aus/);
 assert.equal(copilotTopic.title,'AskElli mit Copilot');assert.match(copilotTopic.text,/Bestätigen und ausführen/);
 const hits=searchHelp('Ollama',local).filter(hit=>hit.topicId==='hilfe');assert.ok(hits.length);assert.ok(hits.every(hit=>hit.topicTitle==='AskElli mit Ollama'));
 assert.equal(helpForProvider().find(t=>t.id==='hilfe').title,'AskElli mit Ollama');
});

test('general HeyElli guidance is the default and navigation questions open its section',()=>{
 assert.deepEqual(resolveHelpHash(''),{topicId:'allgemein',sectionId:''});
 const hit=searchHelp('App-Wechsel').find(item=>item.topicId==='allgemein');assert.ok(hit);assert.equal(resolveHelpHash('#'+hit.id).topicId,'allgemein');
});

test('Menüleiste is canonical and older section links and search terms still resolve',async()=>{
 const {helpTopics}=await import('../knowledge.ts');
 for(const topic of helpTopics)for(const section of topic.sections)assert.doesNotMatch(section.title+' '+section.text,/statusleiste/iu);
 for(const query of ['Menüleiste','Statusleiste','obere Leiste']){const hit=searchHelp(query).find(item=>item.title==='Menüleiste und Navigation');assert.ok(hit,query);assert.equal(hit.id,'allgemein--menuleiste-und-navigation');assert.match(hit.text,/durchgängige Leiste am oberen Fensterrand/);}
 assert.deepEqual(resolveHelpHash('#allgemein--statusleiste-und-navigation'),{topicId:'allgemein',sectionId:'allgemein--menuleiste-und-navigation'});
});
