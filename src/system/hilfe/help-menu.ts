// Public, client-safe help search for the app launcher.
import {helpForProvider} from '../../apps/askelli/elli/help-provider.ts';
import {searchHelp} from '../../apps/askelli/elli/help-search.ts';
export function helpMenuResults(query:string,copilotActive=false,canAdmin=false){
 const topics=helpForProvider(copilotActive).map(topic=>({...topic,sections:topic.sections.filter(section=>canAdmin||!('permission' in section)||section.permission!=='admin')}));
 return searchHelp(query,topics).slice(0,8).map(result=>({href:'/hilfe#'+result.id,label:result.title,detail:'Hilfe · '+result.topicTitle,topicId:result.topicId}));
}
