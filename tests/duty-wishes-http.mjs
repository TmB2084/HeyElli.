import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {platformRepository} from '../src/platform/store/repository.ts';
import {dutyWeeks} from '../src/apps/planboard/kalender/duty.ts';
export async function checkDutyWishesHttp(request,pool,adminCookie){
 const year=2028,path='/api/bereitschaft/wuensche',alice='ad:dddddddd-dddd-4ddd-8ddd-dddddddddddd',bob='ad:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',outsider='ad:ffffffff-ffff-4fff-8fff-ffffffffffff';
 for(const [id,name] of [[alice,'Test Alice'],[bob,'Test Bob'],[outsider,'Test Charlie']])await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,$2,'reader',true) ON CONFLICT(id) DO UPDATE SET enabled=true,role='reader'",[id,name]);
 // Isolierte Testdatenbank: Simulator-Mitarbeiter der Beispielkonten freigeben (ein PDS-Benutzer gehört höchstens einem Konto).
 await pool.query("DELETE FROM platform.pds_user_mappings WHERE user_id LIKE 'demo-ad:%'");
 const repository=platformRepository(pool),cookieName=adminCookie.split('=')[0],cookies={},issue=async id=>cookieName+'='+await repository.issue({id,mode:'local',role:'reader'});
 const get=async(cookie=adminCookie)=>(await request(path+'?year='+year,{cookie})).json(),post=(body,cookie=adminCookie)=>request(path,{method:'POST',cookie,body:{...body,year}}),link=(userId,pdsUserUUID,cookie=adminCookie)=>request('/api/verwaltung/benutzer',{method:'POST',cookie,body:{action:'pds-user',userId,pdsUserUUID}}),ensure=async response=>{assert.equal(response.status,200,await response.clone().text());return response.json();};
 assert.equal((await request(path+'?year='+year)).status,401);assert.equal((await request(path,{method:'POST',cookie:adminCookie,origin:'https://evil.example.invalid',body:{year,action:'exclude'}})).status,403);
 assert.equal((await request('/api/verwaltung/benutzer')).status,401);
 // Ohne zugeordneten PDS-Benutzer keine Anmeldung (Konten ohne Administratorrolle).
 await assert.rejects(repository.issue({id:alice,mode:'local',role:'reader'}),/PDS-Zuordnung fehlt/);
 const directory=(await ensure(await request('/api/verwaltung/benutzer',{cookie:adminCookie}))).directory;assert.ok(directory.length>=3);
 const initial=await get(),[a,b,c]=initial.resources.map(item=>item.id),weeks=dutyWeeks(year);assert.ok(c);
 await ensure(await link(outsider,a));cookies[outsider]=await issue(outsider);const outsiderAccount=await ensure(await request('/api/benutzerkonto',{cookie:cookies[outsider]}));assert.equal(outsiderAccount.employeeState,'linked');assert.equal(outsiderAccount.employee.name,directory.find(person=>person.id===a).name);
 await ensure(await link(outsider,null));assert.equal((await request('/api/benutzerkonto',{cookie:cookies[outsider]})).status,401,'Entfernen der Zuordnung beendet die Sitzung');
 const linkAudit=(await (await request('/api/verwaltung',{cookie:adminCookie})).json()).events.filter(entry=>entry.action==='user.pds.assigned'&&entry.targetId===outsider);
 assert.equal(linkAudit.length,2);assert.ok(linkAudit.every(entry=>entry.actorId&&entry.createdAt));assert.equal(linkAudit[0].changes[0].after,null);assert.ok(linkAudit[0].changes[0].before.includes(a));assert.equal(linkAudit[1].changes[0].before,null);assert.ok(linkAudit[1].changes[0].after.includes(directory.find(person=>person.id===a).name));
 const linkMarkdown=await (await request('/api/verwaltung/protokoll',{cookie:adminCookie})).text();assert.ok(linkMarkdown.includes('PDS\\-Benutzer zugeordnet'));assert.ok(linkMarkdown.includes('PDS\\-Benutzer:'));
 await ensure(await link(alice,a));await ensure(await link(bob,b));for(const id of [alice,bob])cookies[id]=await issue(id);
 assert.equal((await link(alice,c,cookies[alice])).status,403,'nur die Verwaltung ordnet zu');
 const ownAccount=await ensure(await request('/api/benutzerkonto?userId='+encodeURIComponent(bob),{cookie:cookies[alice]}));assert.equal(ownAccount.displayName,'Test Alice');assert.equal(ownAccount.role,'reader');assert.equal(ownAccount.employeeState,'linked');assert.equal(ownAccount.employee.name,directory.find(person=>person.id===a).name);assert.ok(!('id' in ownAccount)&&!('userId' in ownAccount));assert.equal((await get()).links,undefined);assert.equal((await get()).users,undefined);
 assert.equal((await link(outsider,a)).status,409);const taken=new Set((await pool.query('SELECT pds_user_uuid FROM platform.pds_user_mappings')).rows.map(row=>row.pds_user_uuid)),spare=directory.find(person=>!taken.has(person.id));assert.ok(spare,'freier PDS-Benutzer für das Vergleichskonto');await ensure(await link(outsider,spare.id));cookies[outsider]=await issue(outsider);
 const blocked=weeks[5],blockId=randomUUID();await ensure(await post({action:'exclude',id:blockId,day:blocked.day,resourceId:b},cookies[alice]));await ensure(await post({action:'exclude',id:blockId,day:blocked.day},cookies[alice]));
 assert.ok((await get(cookies[alice])).exclusions.some(item=>item.id===blockId&&item.resource_id===a));assert.equal((await get(cookies[bob])).exclusions.length,0);
 assert.equal((await post({action:'unexclude',id:blockId},cookies[bob])).status,403);
 const proposal=await ensure(await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'preview',year,resources:[a,b,c]}}));assert.notEqual(proposal.slots.find(slot=>slot.day===blocked.day).resourceId,a);
 assert.equal((await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'preview',year,resources:[a],manualDay:blocked.day}})).status,409);
 // A changed exclusion set invalidates an existing preview even if its ranking stays equal.
 await ensure(await post({action:'unexclude',id:blockId},cookies[alice]));assert.equal((await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'start',year,resources:[a,b,c],hash:proposal.hash,jobId:randomUUID()}})).status,409);
 async function assign(day,resource){const preview=await ensure(await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'preview',year,resources:[resource],manualDay:day}})),jobId=randomUUID();await ensure(await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'start',year,resources:[resource],manualDay:day,hash:preview.hash,jobId}}));await ensure(await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'step',jobId}}));}
 await assign(weeks[0].day,a);await assign(weeks[1].day,b);
 const before=await get(),first=before.events.find(item=>item.start===weeks[0].start),second=before.events.find(item=>item.start===weeks[1].start),ids=before.events.map(item=>item.id).sort();assert.ok(first&&second);
 assert.equal((await post({action:'exclude',id:randomUUID(),day:weeks[0].day},cookies[alice])).status,409);
 // Direct resource-calendar edits must respect personal duty exclusions as well.
 const directBlock=randomUUID();await ensure(await post({action:'exclude',id:directBlock,day:weeks[6].day},cookies[alice]));
 const blockedMove=await request('/api/ressourcenkalender',{method:'POST',cookie:adminCookie,body:{id:first.id,start:weeks[6].start,end:weeks[6].end,resourceIds:[a],acceptPlanningWarnings:true,expected:{start:first.start,end:first.end,resourceIds:first.resourceIds}}});assert.equal(blockedMove.status,409);assert.match((await blockedMove.json()).error,/Sperrwoche/);await ensure(await post({action:'unexclude',id:directBlock},cookies[alice]));
 const swapId=randomUUID();assert.equal((await post({action:'propose',id:swapId,firstId:first.id,secondId:second.id},cookies[bob])).status,403);
 await ensure(await post({action:'propose',id:swapId,firstId:first.id,secondId:second.id},cookies[alice]));await ensure(await post({action:'propose',id:swapId,firstId:first.id,secondId:second.id},cookies[alice]));
 assert.equal((await get(cookies[outsider])).swaps.length,0);assert.equal((await post({action:'agree',id:swapId,version:1},cookies[alice])).status,403);
 assert.equal((await post({action:'approve',id:swapId,version:1})).status,409);await ensure(await post({action:'agree',id:swapId,version:1},cookies[bob]));
 assert.equal((await post({action:'approve',id:swapId,version:2},cookies[bob])).status,403);
 assert.equal((await link(alice,null)).status,409,'offener Tauschwunsch sperrt Zuordnungsänderungen');
 const accepted=(await get()).swaps.find(item=>item.id===swapId);assert.equal(accepted.status,'accepted');await ensure(await request('/api/ressourcenkalender',{method:'POST',cookie:adminCookie,body:{id:first.id,title:'Tausch mit erhaltenem Text',start:first.start,end:first.end,resourceIds:first.resourceIds,expected:{start:first.start,end:first.end,resourceIds:first.resourceIds,title:first.title}}}));const approvals=await Promise.all([post({action:'approve',id:swapId,version:accepted.version}),post({action:'approve',id:swapId,version:accepted.version})]);for(const response of approvals)await ensure(response);
 const after=await get(),complete=after.swaps.find(item=>item.id===swapId);assert.equal(complete.status,'complete');assert.equal(complete.progress,2);assert.equal(after.events.find(item=>item.id===first.id).title,'Tausch mit erhaltenem Text');assert.deepEqual(after.events.map(item=>item.id).sort(),ids);assert.deepEqual(after.events.find(item=>item.id===first.id).resourceIds,[b]);assert.deepEqual(after.events.find(item=>item.id===second.id).resourceIds,[a]);assert.ok(complete.history.some(item=>item.action==='swap.accepted'&&item.actor_name==='Test Bob'));assert.ok(complete.history.every(item=>item.at));
 // Simulate a committed first appointment and lost journal acknowledgement.
 const reversedId=randomUUID();await ensure(await post({action:'propose',id:reversedId,firstId:second.id,secondId:first.id},cookies[alice]));await ensure(await post({action:'agree',id:reversedId,version:1},cookies[bob]));
 await pool.query("UPDATE platform.duty_swaps SET status='executing',approved_by='local-service-user',approved_at=now(),progress=0 WHERE id=$1",[reversedId]);
 const already=after.events.find(item=>item.id===second.id);await ensure(await request('/api/ressourcenkalender',{method:'POST',cookie:adminCookie,body:{id:already.id,start:already.start,end:already.end,resourceIds:[b],acceptPlanningWarnings:true,expected:{start:already.start,end:already.end,resourceIds:already.resourceIds}}}));
 assert.equal((await request('/api/bereitschaft',{method:'POST',cookie:adminCookie,body:{action:'start',year,resources:[a,b,c],hash:'irrelevant',jobId:randomUUID()}})).status,409);
 await ensure(await post({action:'resume',id:reversedId}));const resumed=await get();assert.equal(resumed.swaps.find(item=>item.id===reversedId).status,'complete');assert.deepEqual(resumed.events.map(item=>item.id).sort(),ids);assert.deepEqual(resumed.events.find(item=>item.id===first.id).resourceIds,[a]);assert.deepEqual(resumed.events.find(item=>item.id===second.id).resourceIds,[b]);
 const persistentBlock=randomUUID();await ensure(await post({action:'exclude',id:persistentBlock,day:weeks[8].day},cookies[alice]));return {swapId:reversedId,blockId:persistentBlock};
}
