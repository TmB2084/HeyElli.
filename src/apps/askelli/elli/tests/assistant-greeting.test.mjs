import {test} from 'node:test';
import assert from 'node:assert/strict';
import {greetingRequest,greetingText} from '../greeting.ts';

test('greeting generation uses a separate bounded instruction without user data or tools',()=>{
 const request=greetingRequest();
 assert.equal(request.model,'qwen3:1.7b');
 assert.equal(request.stream,false);
 assert.equal(request.messages.length,2);
 assert.ok(request.options.num_predict<=180);
 assert.match(request.messages[0].content,/Elli/);
 assert.match(request.messages[0].content,/Deutsch/);
 assert.equal('tools' in request,false);
});

test('accepts a short generated introduction and rejects repeated or unsafe output',()=>{
 const text='Hallo, ich bin Elli! Welche Bedienungsfrage darf ich dir in HeyElli beantworten?';
 const content=JSON.stringify({greeting:text});
 assert.equal(greetingText(content),text);
 assert.throws(()=>greetingText(content,text));
 for(const invalid of [null,'kein JSON',JSON.stringify({greeting:'Zu kurz'}),JSON.stringify({greeting:'Hallo, ich bin Elli. '+ 'a'.repeat(360)}),JSON.stringify({greeting:'Hallo, ich bin Elli. <script>falsch</script>'}),JSON.stringify({greeting:'Hallo, ich bin Elli. Schau auf https://example.invalid nach.'}),JSON.stringify({greeting:'Hallo, ich bin ein anderer Assistent und helfe dir bei Fragen.'})])assert.throws(()=>greetingText(invalid));
 for(const title of ['KI-Bedienungshilfe','KI-Helferin','digitale Assistentin','Chatbot','Sprachmodell'])assert.throws(()=>greetingText(JSON.stringify({greeting:`Hallo, ich bin Elli, deine ${title}. Was möchtest du wissen?`})));
 assert.throws(()=>greetingText(JSON.stringify({greeting:'Hallo Elli! Wie geht es dir heute?'})));
 assert.equal(greetingText(JSON.stringify({greeting:'Hey, ich bin Elli! Was möchtest du heute herausfinden?'})),'Hey, ich bin Elli! Was möchtest du heute herausfinden?');
});

test('rejects observed awkward German and overly long greetings without changing the content',()=>{
 for(const question of ['Worauf benötigst du Hilfe?','Worum kannst du mir helfen?','Woraus kannst ich dir helfen?','Worauf kannst du mich helfen?','Was kann ich dir helfen?','Wie kann ich dich helfen?'])assert.throws(()=>greetingText(JSON.stringify({greeting:'Hallo, ich bin Elli. '+question})),question);
 for(const greeting of ['Hallo, ich bin Elli. Ich freue mich, dass du mich suchst. Wobei kann ich dir helfen?','Hallo, ich bin Elli. Ich helfe dir bei allem, was du brauchst. Was möchtest du wissen?'])assert.throws(()=>greetingText(JSON.stringify({greeting})));
 for(const greeting of ['Hallo, ich bin Elli. Wobei kann ich dir helfen?','Hi, ich heiße Elli! Was möchtest du heute wissen?','Elli hier! Welche Frage darf ich dir beantworten?','Hallo! Ich bin Elli. Wie kann ich dir heute helfen?'])assert.equal(greetingText(JSON.stringify({greeting})),greeting);
 assert.ok(greetingRequest().options.temperature<=.5);
});

test('new greeting requests vary the opening without copying previous text',()=>{
 const previous='Hallo, ich bin Elli. Wobei kann ich dir helfen?';
 const instruction=greetingRequest(previous).messages[1].content;
 assert.doesNotMatch(instruction,/wörtlich mit: Hallo/);
 assert.ok(!instruction.includes(previous));
});
