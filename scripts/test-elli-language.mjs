// Local model quality sample; no session, database, environment files or business data.
import {writeFile} from 'node:fs/promises';
import {greetingRequest,greetingText,greetingFallback} from '../src/apps/askelli/elli/greeting.ts';
import {elliInstructions,readableFunctionality} from '../src/apps/askelli/elli/identity.ts';
import {retrieveHelp,groundedHelpAnswer} from '../src/apps/askelli/elli/help-search.ts';
import {elliAnswerStyle,naturalAnswer} from '../src/apps/askelli/elli/language.ts';
import {permissionLabels} from '../src/apps/askelli/elli/knowledge.ts';
const report={greetings:[],answers:[]};
async function generate(body){const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify(body)});if(!response.ok)throw Error('Lokales Modell nicht erreichbar.');const result=await response.json();return result.message?.content;}
let previous='';
for(let index=0;index<6;index++){
 let accepted=null,attempts=0;const rejected=[];
 for(;attempts<2;attempts++){const content=await generate(greetingRequest(previous));try{accepted=greetingText(content,previous);break;}catch(error){rejected.push({content,reason:error.message});}}
 const text=accepted??greetingFallback;previous=text;report.greetings.push({text,generated:!!accepted,attempts:Math.min(attempts+1,2),rejected});console.log(JSON.stringify(report.greetings.at(-1)));
}
const context=readableFunctionality(()=>true);
for(const question of ['Warum kann ich beim Erfassen einer Störung die Terminplanung überspringen und was muss ich vor dem Speichern noch zuweisen?','Warum benötige ich für die Kalenderfarben Administratorrechte?']){
 const sections=retrieveHelp(question);if(!sections.length)throw Error('Kein belegter Kontext für die Sprachprobe.');
 const direct=groundedHelpAnswer(question,sections,true,true);
 const answer=direct??naturalAnswer(await generate({model:'qwen3:1.7b',stream:false,think:false,keep_alive:'2m',options:{temperature:.2,num_ctx:8192,num_predict:500},messages:[{role:'system',content:elliInstructions(context)+'\nAnleitung:\n'+sections.map(item=>item.topicTitle+' → '+item.title+'\nBerechtigung: '+permissionLabels[item.permission]+'\n'+item.text).join('\n\n')+'\n\n'+elliAnswerStyle},{role:'user',content:question}]}));
 report.answers.push({question,answer,generated:!direct});console.log(JSON.stringify(report.answers.at(-1)));
}
await writeFile('/private/tmp/elli-language-2026-11-11.json',JSON.stringify(report,null,2),{mode:0o600});
console.log('Sprachprobe gespeichert; keine Chat- oder Fachdaten verändert.');
