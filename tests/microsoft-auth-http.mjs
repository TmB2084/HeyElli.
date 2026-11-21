import {join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function checkMicrosoftAuthHttp({port,cookie,modeFile,request,pool}){
 const tenantId='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',id=`entra:${tenantId}:33333333-3333-4333-8333-333333333333`,origin=`http://localhost:${port}`;
 let settings=(await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json()).settings;
 assert.equal((await request('/api/verwaltung/benutzer',{cookie,method:'POST',body:{id,displayName:'Fictional HTTP Microsoft admin',role:'admin',enabled:true,version:0}})).status,200);
 const config={action:'save',version:settings.version,tenantId,clientId,secret:'fictional-http-ms-secret',redirectUri:origin+'/api/auth/microsoft/callback'};
 assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:config})).status,200);
 let publicState=await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json();assert.equal(publicState.settings.enabled,false);assert.ok(!JSON.stringify(publicState).includes(config.secret));
 settings=publicState.settings;assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{action:'mode',version:settings.version,enabled:true,confirm:true}})).status,409);
 async function flow(purpose){const start=await fetch(origin+'/api/auth/microsoft/start'+(purpose==='test'?'?purpose=test':''),{method:'POST',headers:{origin,...purpose==='test'?{cookie}:{}},redirect:'manual'});assert.equal(start.status,303,start.status===303?'':await start.text());const location=new URL(start.headers.get('location'));assert.equal(location.hostname,'login.microsoftonline.com');assert.equal(location.searchParams.get('code_challenge_method'),'S256');const flowCookie=start.headers.get('set-cookie');assert.match(flowCookie,/HttpOnly/);assert.match(flowCookie,/SameSite=lax/);
 const mode=JSON.parse(await readFile(modeFile,'utf8'));await writeFile(modeFile,JSON.stringify({...mode,msNonce:location.searchParams.get('nonce')}));return {url:origin+'/api/auth/microsoft/callback?state='+encodeURIComponent(location.searchParams.get('state'))+'&code=fictional-code',cookie:flowCookie.split(';')[0]};}
 async function finish(value){return fetch(value.url,{headers:{cookie:value.cookie},redirect:'manual'});}
 const test=await finish(await flow('test'));assert.equal(test.status,303);assert.equal(test.headers.get('location'),'/einstellungen?microsoft_auth=test-ok');assert.ok(!test.headers.get('set-cookie').includes('service-session='));
 // Der Anmeldetest verknüpft das Konto des testenden Administrators mit seinem Microsoft-Konto.
 assert.equal((await pool.query("SELECT microsoft_subject FROM platform.users WHERE id='local-service-user'")).rows[0].microsoft_subject,id);
 assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{action:'mode',version:settings.version,enabled:true,confirm:true}})).status,200);
 const replacedStatus=await (await request('/api/simulator-session')).json();assert.equal(replacedStatus.microsoftAvailable,true);assert.equal(replacedStatus.configured,false);
 // Aktive Microsoft-Anmeldung ersetzt die eigene Anmeldung: lokale Sitzung gesperrt, Passwortanmeldung abgewiesen.
 assert.equal((await request('/api/verwaltung',{cookie})).status,401);
 const localLogin=await request('/api/simulator-session',{method:'POST',body:{username:'demo.alex',password:'fictional'}});assert.equal(localLogin.status,403);assert.match((await localLogin.json()).error,/über Microsoft/);
 const loginFlow=await flow('login'),login=await finish(loginFlow);assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/servicehub');const sessionCookie=login.headers.getSetCookie().find(value=>value.startsWith('service-session='));assert.ok(sessionCookie);assert.match(sessionCookie,/HttpOnly/);assert.match(sessionCookie,/SameSite=strict/);const msCookie=sessionCookie.split(';')[0];
 assert.equal((await (await request('/api/simulator-session',{cookie:msCookie})).json()).authenticated,true);assert.equal((await request('/api/verwaltung',{cookie:msCookie})).status,200);
 settings=(await (await request('/api/verwaltung/microsoft-anmeldung',{cookie:msCookie})).json()).settings;
 const replay=await finish(loginFlow);assert.equal(replay.headers.get('location'),'/anmeldung?status=microsoft-failed');assert.ok(!replay.headers.get('set-cookie').includes('service-session='));
 // Deaktivieren durch den Microsoft-Administrator stellt die eigene Anmeldung wieder her; die lokale Sitzung gilt wieder.
 assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie:msCookie,method:'POST',body:{action:'mode',version:settings.version,enabled:false}})).status,200);
 assert.equal((await request('/api/verwaltung',{cookie})).status,200);assert.equal((await (await request('/api/simulator-session')).json()).configured,true);
 settings=(await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json()).settings;
 const baselineText=await readFile(join(dirname(modeFile),'.local/test-settings/.env.microsoft-auth.ui.local'),'utf8');
 const broken=await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{...config,version:settings.version,tenantId:'common'}});assert.equal(broken.status,400);
 await writeFile(modeFile,JSON.stringify({...JSON.parse(await readFile(modeFile,'utf8')),auth:'disconnect'}));
 const disconnected=await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{...config,version:settings.version}});assert.equal(disconnected.status,503);assert.match((await disconnected.json()).error,/Verbindung/);
 await writeFile(modeFile,JSON.stringify({...JSON.parse(await readFile(modeFile,'utf8')),auth:'success'}));
 assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{...config,version:settings.version,secret:'fictional-invalid-replacement'}})).status,200);
 assert.equal((await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json()).pending,true);
 await writeFile(modeFile,JSON.stringify({...JSON.parse(await readFile(modeFile,'utf8')),auth:'reject'}));
 const rejected=await finish(await flow('test'));assert.match(rejected.headers.get('location'),/reason=credentials/);
 const errorPage=await fetch(origin+rejected.headers.get('location'));const errorText=await errorPage.text();assert.ok(errorText.includes('Microsoft lehnt die Zugangsdaten ab'));assert.ok(!errorText.includes('PROVIDER-DETAIL-MUST-NOT-LEAK'));
 const stillPending=await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json();assert.equal(stillPending.settings.enabled,false);assert.equal(stillPending.pending,true);
 assert.equal(await readFile(join(dirname(modeFile),'.local/test-settings/.env.microsoft-auth.ui.local'),'utf8'),baselineText);
 assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie,method:'POST',body:{action:'restore',version:stillPending.settings.version}})).status,200);
 assert.equal((await (await request('/api/verwaltung/microsoft-anmeldung',{cookie})).json()).pending,false);
 await writeFile(modeFile,JSON.stringify({...JSON.parse(await readFile(modeFile,'utf8')),auth:'success'}));

 assert.equal((await request('/api/verwaltung',{cookie:msCookie})).status,401);assert.equal((await request('/api/verwaltung',{cookie})).status,200);
 await pool.query('UPDATE platform.users SET enabled=false WHERE id=$1',[id]);
}
