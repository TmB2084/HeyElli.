import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {platformRepository} from '../src/platform/store/repository.ts';
import {dataLifecycle} from '../src/platform/data-lifecycle/repository.ts';
import {personalExport,exportResponse} from '../src/platform/data-lifecycle/export.ts';
import {assistantChats} from '../src/platform/store/assistant-chats.ts';
import {privateDrafts} from '../src/apps/planboard/entwuerfe/repository.ts';
import {encryptDraft} from '../src/apps/planboard/entwuerfe/crypto.ts';
import {mailRepository} from '../src/platform/mail/repository.ts';
import {assignPds} from './support/pds-assignment.mjs';
export async function checkDataLifecycle(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-/);
 const folder=await mkdtemp(join(tmpdir(),'heyelli-privacy-')),previous={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=folder;
 const a='privacy:'+randomUUID(),b='privacy:'+randomUUID(),admin='privacy:'+randomUUID(),scope={actor:a,subject:a,admin:false},other={actor:b,subject:b,admin:false},adminScope={actor:admin,subject:a,admin:true},store=dataLifecycle(pool),chats=assistantChats(pool),drafts=privateDrafts(pool),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date()),turnId=randomUUID();
 const selection={categories:['chat','feedback','mail','sessions'],cutoff:today};
 const originalRules=(await pool.query('SELECT * FROM platform.retention_rules')).rows;
 const preview=()=>store.preview(scope,selection),execute=p=>store.execute(scope,{id:p.id,confirm:true});
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktives Konto A','reader',true),($2,'Fiktives Konto B','reader',true),($3,'Fiktiver Administrator','admin',true)",[a,b,admin]);
  const chat=await chats.read(a);await chats.change(a,chat.epoch,{id:turnId,question:'Eigene Frage',answer:'Eigene Antwort',sources:[]});await chats.read(b);await chats.change(b,(await chats.read(b)).epoch,{id:randomUUID(),question:'Fremde Frage',answer:'Nicht ausgeben',sources:[]});
  const token=randomBytes(32).toString('hex'),active=randomUUID(),expired=randomUUID();for(const [id,time]of [[active,"now()+interval '1 day'"],[expired,"now()-interval '1 day'"]])await pool.query(`INSERT INTO platform.sessions(id,token_hash,user_id,auth_mode,pds_user_uuid,expires_at) VALUES($1,$2,$3,'simulator','fictional',${time})`,[id,id===active?token:randomBytes(32).toString('hex'),a]);
  await assignPds(pool,b);await platformRepository(pool).issue({id:b,role:'reader',mode:'local'});assert.equal((await pool.query('SELECT count(*)::int n FROM platform.sessions WHERE id=$1',[expired])).rows[0].n,1);
  const mail=randomUUID(),queued=randomUUID();for(const[id,status]of [[mail,'simulated'],[queued,'queued']])await pool.query("INSERT INTO platform.mail_queue(id,request_id,sender,recipient,subject,body,actor_id,status,processed_at) VALUES($1,$2,'a@example.invalid','b@example.invalid','Eigene Nachricht','Eigener Inhalt',$3,$4,now())",[id,randomUUID(),a,status]);
  await pool.query("INSERT INTO platform.assistant_feedback(user_id,epoch,turn_id,rating,question,answer,sources,knowledge_version) VALUES($1,$2,$3,'up','Eigene Frage','Eigene Antwort','[]','fixture')",[a,chat.epoch,turnId]);
  const key=await drafts.key(a),draftId=randomUUID(),storageKey='heyelli:calendar-draft:v2:fixture:'+draftId,draft={draftId,operationId:randomUUID(),original:{id:'fixture-event'},changed:{id:'fixture-event',notes:'Offener privater Entwurf'}};await drafts.change(a,{key:storageKey,envelope:encryptDraft(key,storageKey,JSON.stringify(draft))});
  // Defaults are advisory, reads do not remove even old data.
  const initial=await store.read(scope);assert.equal(initial.automaticDeletion,false);assert.ok(initial.rules.every(r=>r.review_after_days===null&&!r.hold));assert.equal((await chats.read(a)).turns.length,1);
  await assert.rejects(store.read({...scope,subject:b}),e=>e.status===403);await assert.rejects(store.read({...scope,admin:true}),e=>e.status===403);await assert.rejects(store.rule(scope,{category:'chat',days:30,hold:false,version:1}),e=>e.status===403);
  await assert.rejects(store.preview(scope,{categories:['secrets'],cutoff:today}),e=>e.status===400);await assert.rejects(store.preview(scope,{categories:['chat'],cutoff:'2099-01-01'}),e=>e.status===400);
  const collect=async(s)=>{const result=[];for await(const item of personalExport(pool,s,{business:false,sqlitePath:join(folder,'absent')}))result.push(item);return result;};
  const exported=await collect(scope),text=JSON.stringify(exported);assert.equal(exported.at(-1).complete,true);assert.ok(text.includes('Offener privater Entwurf'));assert.ok(text.includes('Eigene Antwort'));for(const secret of [token,key.key,'wrapped_key','token_hash','Fremde Frage','Nicht ausgeben'])assert.ok(!text.includes(secret),secret);
  const sqlitePath=join(folder,'own.sqlite'),sqlite=new DatabaseSync(sqlitePath);try{sqlite.exec('CREATE TABLE orders(created_by TEXT,payload TEXT);CREATE TABLE uploads(id TEXT,name TEXT,created_at TEXT,created_by TEXT,content BLOB)');sqlite.prepare('INSERT INTO orders VALUES(?,?)').run(a,'Eigener Auftrag');sqlite.prepare('INSERT INTO orders VALUES(?,?)').run(b,'Fremder Auftrag');sqlite.prepare('INSERT INTO uploads VALUES(?,?,?,?,?)').run('own','Fiktiver Anhang','2026-01-01',a,Buffer.alloc(70000,65));sqlite.prepare('INSERT INTO uploads VALUES(?,?,?,?,?)').run('other','Fremder Anhang','2026-01-01',b,Buffer.from('Fremder Inhalt'));}finally{sqlite.close();}
  const business=[];for await(const entry of personalExport(pool,scope,{business:true,sqlitePath}))business.push(entry);assert.ok(JSON.stringify(business).includes('Eigener Auftrag'));assert.ok(!JSON.stringify(business).includes('Fremder Auftrag'));assert.ok(!JSON.stringify(business).includes('Fremder Anhang'));const chunks=business.filter(e=>e.type==='upload-content-base64');assert.equal(chunks.length,2);assert.equal(Buffer.concat(chunks.map(c=>Buffer.from(c.value.content,'base64'))).length,70000);
  const administrative=JSON.stringify(await collect(adminScope));assert.ok(!administrative.includes('Offener privater Entwurf'));assert.ok(!administrative.includes(key.key));await assert.rejects(collect({...scope,subject:b}),e=>e.status===403);
  // Cancellation must release transaction/connection, without data changes.
  const stream=exportResponse(personalExport(pool,scope,{business:false}),new AbortController().signal),reader=stream.body.getReader();await reader.read();await reader.cancel();assert.equal((await chats.read(a)).turns.length,1);
  let plan=await preview();assert.deepEqual(plan.counts,{chat:1,feedback:1,mail:1,sessions:1});assert.equal(plan.protectedDrafts,1);
  await assert.rejects(store.execute(scope,{id:plan.id}),e=>e.status===400);await assert.rejects(store.execute(other,{id:plan.id,confirm:true}),e=>e.status===404);
  // Late input invalidates the plan; a fresh plan protects the entire chat.
  const tab=randomUUID();await chats.draft(a,chat.epoch,tab,'Noch nicht abgesendete Frage',1);await assert.rejects(execute(plan),e=>e.status===409);plan=await preview();assert.equal(plan.counts.chat,0);assert.equal(plan.chatProtected,true);await chats.draft(a,chat.epoch,tab,'',2);
  // Hold and optimistic policy version protect against old confirmations.
  plan=await preview();const rule=(await store.read(adminScope)).rules.find(r=>r.category==='chat');await store.rule(adminScope,{category:'chat',days:30,hold:true,version:rule.version});await assert.rejects(execute(plan),e=>e.status===409);assert.equal((await preview()).counts.chat,0);await assert.rejects(store.rule(adminScope,{category:'chat',days:1,hold:false,version:rule.version}),e=>e.status===409);await store.rule(adminScope,{category:'chat',days:null,hold:false,version:rule.version+1});
  plan=await preview();await pool.query("UPDATE platform.privacy_plans SET expires_at=now()-interval '1 second' WHERE id=$1",[plan.id]);await assert.rejects(execute(plan),e=>e.status===409);
  plan=await preview();const result=await execute(plan);assert.equal(result.ok,true);assert.equal((await execute(plan)).alreadyDone,true);assert.equal((await chats.read(a)).turns.length,0);assert.equal((await chats.read(a)).epoch,chat.epoch);assert.equal((await drafts.read(a)).records.length,1);assert.equal((await chats.read(b)).turns.length,1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM platform.sessions WHERE user_id=$1',[a])).rows[0].n,1);assert.ok((await pool.query('SELECT 1 FROM platform.sessions WHERE id=$1',[active])).rowCount);assert.equal((await pool.query('SELECT count(*)::int n FROM platform.assistant_feedback WHERE user_id=$1',[a])).rows[0].n,0);
  const cleared=(await pool.query('SELECT * FROM platform.mail_queue WHERE id=$1',[mail])).rows[0];assert.ok(cleared.content_cleared_at);assert.equal(cleared.body,'');assert.equal((await pool.query('SELECT body FROM platform.mail_queue WHERE id=$1',[queued])).rows[0].body,'Eigener Inhalt');await assert.rejects(mailRepository(pool).change(admin,{action:'retry',id:mail}),e=>e.status===409);
  await assert.rejects(chats.change(a,chat.epoch,{id:turnId,question:'Eigene Frage',answer:'Späte Antwort',sources:[]}),e=>e.status===409);await assert.rejects(chats.enqueue(a,chat.epoch,{id:turnId,question:'Eigene Frage'}),e=>e.status===409);assert.equal((await chats.read(a)).turns.length,0);
  // A large same-day class remains usable: only the reviewed batch is removed.
  await pool.query("INSERT INTO platform.assistant_feedback(user_id,epoch,turn_id,rating,question,answer,sources,knowledge_version) SELECT $1,$2,gen_random_uuid(),'up','Fiktive Frage','Fiktive Antwort','[]','fixture' FROM generate_series(1,501)",[a,chat.epoch]);
  const bulk=await store.preview(scope,{categories:['feedback'],cutoff:today});assert.equal(bulk.counts.feedback,500);assert.equal(bulk.more.feedback,true);await execute(bulk);assert.equal((await pool.query('SELECT count(*)::int n FROM platform.assistant_feedback WHERE user_id=$1',[a])).rows[0].n,1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM platform.audit_events WHERE actor_id=$1 AND action='privacy.cleanup.completed'",[a])).rows[0].n,2);
 }finally{
  for(const rule of originalRules)await pool.query('UPDATE platform.retention_rules SET review_after_days=$2,hold=$3,version=$4,updated_at=$5 WHERE category=$1',[rule.category,rule.review_after_days,rule.hold,rule.version,rule.updated_at]);
  const users=[a,b,admin];await pool.query('DELETE FROM platform.privacy_executions WHERE subject_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.privacy_plans WHERE actor_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.removed_chat_turns WHERE user_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.mail_queue WHERE actor_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.sessions WHERE user_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[users]);for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(folder,{recursive:true,force:true});
 }
}
