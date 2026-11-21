import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {assistantFeedback} from '../src/platform/store/assistant-feedback.ts';
import {assistantChats} from '../src/platform/store/assistant-chats.ts';
test('user chat persistence, retry, concurrency and reset fencing in isolated PostgreSQL',{skip:!process.env.HEYELLI_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.HEYELLI_TEST_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/heyelli_test');assert.equal(url.username,'heyelli_test');
 const pool=new Pool({connectionString:url.href});try{
 await pool.query('CREATE TABLE schema_migrations(name text PRIMARY KEY)');
 for(let pass=0;pass<2;pass++)for(const name of (await readdir('database/migrations')).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()){if((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;await pool.query(await readFile('database/migrations/'+name,'utf8'));await pool.query('INSERT INTO schema_migrations VALUES($1)',[name]);}
 for(let pass=0;pass<2;pass++)for(const name of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+name,'utf8'));
 const users=(await pool.query('SELECT id FROM platform.users ORDER BY id LIMIT 2')).rows;assert.equal(users.length,2);const a=users[0].id,b=users[1].id,store=assistantChats(pool),initial=await store.read(a);
 const turn={id:randomUUID(),question:'Wie öffne ich einen Termin?',answer:'Mit Doppelklick.',sources:[{title:'PlanBoard',href:'/hilfe#ressourcen'}]};
 await store.change(a,initial.epoch,turn);await store.change(a,initial.epoch,turn);assert.equal((await store.read(a)).turns.length,1);assert.equal((await store.read(b)).turns.length,0);
 const [left,right]=[randomUUID(),randomUUID()];await Promise.all([store.change(a,initial.epoch,{...turn,id:left}),store.change(a,initial.epoch,{...turn,id:right})]);assert.equal((await store.read(a)).turns.length,3);
 const client=await pool.connect();try{assert.equal((await client.query('SELECT jsonb_array_length(turns) AS count FROM platform.assistant_chats WHERE user_id=$1',[a])).rows[0].count,3);}finally{client.release();}
 const editor=randomUUID(),otherEditor=randomUUID(),jobId=randomUUID();
 await store.draft(a,initial.epoch,editor,'Noch nicht gesendet',2);await store.draft(a,initial.epoch,editor,'Alter Text',1);await store.draft(a,initial.epoch,otherEditor,'Anderer Tab',1);
 assert.equal((await store.read(a)).drafts[editor].text,'Noch nicht gesendet');assert.equal((await store.read(a)).drafts[otherEditor].text,'Anderer Tab');assert.deepEqual((await store.read(b)).drafts,{});
 await store.enqueue(a,initial.epoch,{id:jobId,question:'Noch nicht gesendet',draft:{id:editor,revision:3}});await store.enqueue(a,initial.epoch,{id:jobId,question:'Noch nicht gesendet',draft:{id:editor,revision:3}});
 assert.equal((await store.read(a)).pending.length,1);await store.draft(a,initial.epoch,editor,'Alter Text',2);assert.equal((await store.read(a)).drafts[editor].text,'');
 await store.change(a,initial.epoch,{...turn,id:jobId,question:'Noch nicht gesendet'});assert.equal((await store.read(a)).pending.length,0);assert.equal((await store.read(a)).drafts[otherEditor].text,'Anderer Tab');
 await store.enqueue(a,initial.epoch,{id:randomUUID(),question:'Noch offen'});
 const reset=await store.change(a,initial.epoch);assert.notEqual(reset.epoch,initial.epoch);assert.deepEqual(reset.turns,[]);assert.deepEqual(reset.drafts,{});assert.deepEqual(reset.pending,[]);await assert.rejects(store.draft(a,initial.epoch,editor,'Zu spät',4),error=>error.status===409);await assert.rejects(store.change(a,initial.epoch,{...turn,id:randomUUID()}),error=>error.status===409);assert.deepEqual((await store.read(a)).turns,[]);assert.equal((await store.read(b)).turns.length,0);

 const feedback=assistantFeedback(pool);
 for(const [id,role,enabled]of [['feedback-admin','admin',true],['feedback-other','admin',true],['feedback-reader','reader',true],['feedback-planner','dispatcher',true],['feedback-disabled','admin',false]])await pool.query('INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,$1,$2,$3)',[id,role,enabled]);
 const own=await store.read('feedback-admin'),other=await store.read('feedback-other'),answer={...turn,id:randomUUID(),knowledgeVersion:'reviewed-version'};
 await store.change('feedback-admin',own.epoch,answer);await store.change('feedback-admin',own.epoch,{...turn,id:randomUUID(),question:'Unbewertete Frage bleibt privat'});
 const vote={epoch:own.epoch,turnId:answer.id,rating:'down',reason:null,comment:''};
 for(const id of ['feedback-reader','feedback-planner','feedback-disabled']){
  await assert.rejects(feedback.save(id,vote),error=>error.status===403);await assert.rejects(feedback.own(id,own.epoch),error=>error.status===403);await assert.rejects(feedback.review(id,0),error=>error.status===403);await assert.rejects(feedback.remove(id,vote),error=>error.status===403);
 }
 await assert.rejects(feedback.save('feedback-other',vote),error=>error.status===409);
 await assert.rejects(feedback.save('feedback-other',{...vote,epoch:other.epoch}),error=>error.status===404);
 await assert.rejects(feedback.save('feedback-admin',{...vote,userId:'feedback-other'}),error=>error.status===400);
 await Promise.all([feedback.save('feedback-admin',vote),feedback.save('feedback-admin',vote)]);
 assert.equal((await feedback.own('feedback-admin',own.epoch)).length,1);
 await feedback.save('feedback-admin',{...vote,reason:'workflow',comment:'Der Bedienweg fehlt.'});
 assert.equal((await feedback.own('feedback-admin',own.epoch))[0].comment,'Der Bedienweg fehlt.');
 await feedback.save('feedback-admin',{...vote,rating:'up'});
 assert.equal((await feedback.own('feedback-admin',own.epoch))[0].reason,null);
 assert.equal((await feedback.own('feedback-admin',own.epoch))[0].comment,'');
 await feedback.save('feedback-admin',{...vote,reason:'unclear',comment:'Bitte genauer.'});
 const newChat=await store.change('feedback-admin',own.epoch);
 const reopened=new Pool({connectionString:url.href});try{const list=await assistantFeedback(reopened).review('feedback-other',0);assert.equal(list.total,1);assert.equal(list.items[0].answer,answer.answer);assert.equal(list.items[0].question,answer.question);assert.equal(list.items[0].knowledgeVersion,'reviewed-version');assert.equal(JSON.stringify(list).includes('Unbewertete Frage'),false);}finally{await reopened.end();}
 await assert.rejects(feedback.save('feedback-admin',vote),error=>error.status===409);
 await assert.rejects(feedback.save('feedback-admin',{...vote,epoch:newChat.epoch}),error=>error.status===404);
 await feedback.remove('feedback-other',vote);assert.equal((await feedback.review('feedback-admin',0)).total,1);
 await pool.query("UPDATE platform.users SET role='reader' WHERE id='feedback-admin'");
 await assert.rejects(feedback.review('feedback-admin',0),error=>error.status===403);
 await pool.query("UPDATE platform.users SET role='admin' WHERE id='feedback-admin'");
 await feedback.remove('feedback-admin',vote);assert.equal((await feedback.review('feedback-admin',0)).total,0);
 }finally{await pool.end();}
});
