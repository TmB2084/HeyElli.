import {spawnTestProcess,stopTestProcess} from '../scripts/test-process.mjs';
import {checkResourceLoad,installMemoryProbe} from './resource-load.mjs';
import {encryptDraft} from '../src/apps/planboard/entwuerfe/crypto.ts';
import {dutyFingerprint} from '../src/apps/planboard/kalender/duty.ts';
import {checkMicrosoftAuthHttp} from './microsoft-auth-http.mjs';
import {checkSourceIsolation} from './pds-source-isolation.mjs';
import {installMailProviderFixture} from './mail-provider-fixture.mjs';
import {checkMailWorker} from './mail-worker.mjs';
import {checkDutyWishesHttp} from './duty-wishes-http.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,cp,symlink,rm,mkdir,readFile,stat,writeFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareTestAdmin} from '../scripts/test-account.mjs';

export async function checkPlatformHttp(pool) {
  const directory=await mkdtemp(join(tmpdir(),'heyelli-http-test-'));
  for(const name of ['src','database','package.json','tsconfig.json','next.config.ts'])await cp(name,join(directory,name),{recursive:true});
  await symlink(resolve('node_modules'),join(directory,'node_modules'),'dir');const providerMode=await installMailProviderFixture(directory);
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const settingsDirectory=join(directory,'.local','test-settings');await mkdir(settingsDirectory,{recursive:true});
  const base=`http://127.0.0.1:${port}`,password=randomBytes(32).toString('hex');
  const memory=await installMemoryProbe(directory);
  let server;
  async function stop(){await stopTestProcess(server);}
  async function start(){
    server=spawnTestProcess(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,APP_ENV:'test',HEYELLI_TEST_SETTINGS_DIR:settingsDirectory,NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:memory.option},stdio:'ignore',cwd:directory});
    for(let attempt=0;attempt<120;attempt++) {
      if(server.exitCode!==null)throw new Error('Isolated HTTP test server exited.');
      try{const response=await fetch(base+'/api/simulator-session',{signal:AbortSignal.timeout(3000)});if(response.ok)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('Isolated HTTP test server did not become ready.');
  }
  async function request(path,{cookie,body,method='GET',origin=base}={}) {
    const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{origin,'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const json=response.json.bind(response);response.json=()=>{assert.match(response.headers.get('content-type')??'',/application\/json/,'Expected JSON: '+path+' status '+response.status);return json();};return response;
  }
  async function login() {
    const response=await request('/api/simulator-session',{method:'POST',body:{username:'service',password}});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=strict'));assert.ok(cookie.includes('Expires='));const expiry=new Date(cookie.match(/Expires=([^;]+)/i)[1]);const persisted=await pool.query('SELECT expires_at FROM platform.sessions WHERE token_hash=$1',[ (await import('node:crypto')).createHash('sha256').update(cookie.split(';')[0].slice(cookie.split(';')[0].indexOf('=')+1)).digest('hex') ]);assert.ok(Math.abs(expiry.getTime()-persisted.rows[0].expires_at.getTime())<1000);
    return {cookie:cookie.split(';')[0],body:await response.json()};
  }
  try {
    await prepareTestAdmin(pool,password);
    await pool.query('DELETE FROM platform.login_limits');
    await start();
    // The catalog has no separate API. Guessed API URLs must still fail closed,
    // and HTML/RSC responses must not disclose catalog entries without a session.
    async function catalogDenied(cookie) {
      for (const headers of [{}, {RSC:'1','Next-Router-Prefetch':'1'}, {'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy'}]) {
        const response=await fetch(base+'/servicehub',{headers:{...headers,...(cookie?{cookie}:{})},redirect:'manual'});
        assert.equal(response.status,303);
        assert.equal(new URL(response.headers.get('location'),base).pathname,'/anmeldung');
        assert.match(response.headers.get('cache-control'),/no-store/);
        assert.doesNotMatch(await response.text(),/Bereitschaften planen, fair verteilen und Tauschwünsche verwalten|00000000-0000-4000-8000-000000000003/);
      }
      for (const path of ['/api/service-catalog','/api/service']) {
        const response=await request(path,{cookie});
        assert.equal(response.status,401);
        assert.match(response.headers.get('cache-control'),/no-store/);
        assert.deepEqual(await response.json(),{error:'Bitte zuerst anmelden.'});
      }
    }
    for(const path of ['/anmeldung','/servicehub','/api/service','/api/verwaltung/protokoll']){const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('content-security-policy-report-only'),null);}
    for(const path of ['/api/ressourcenkalender/entwuerfe?key=1','/api/benutzerkonto/geraet','/api/verwaltung/geheimnisablage'])assert.equal((await request(path)).status,401);
    await catalogDenied();
    await catalogDenied('service-session='+'a'.repeat(43));
    assert.equal((await request('/api/verwaltung/microsoft-anmeldung')).status,401);assert.equal((await request('/api/verwaltung/microsoft-anmeldung/anleitung')).status,401);assert.equal((await request('/api/auth/microsoft/start',{method:'POST'})).status,503);assert.equal((await request('/api/auth/microsoft/start',{method:'POST',origin:'https://attacker.invalid'})).status,403);assert.equal((await request('/api/verwaltung')).status,401);assert.equal((await request('/api/verwaltung/email')).status,401);assert.equal((await request('/api/verwaltung/email/anleitung')).status,401);assert.equal((await request('/api/verwaltung/pds/anleitung')).status,401);
    assert.equal((await request('/api/verwaltung/protokoll')).status,401);
    assert.equal((await request('/api/verwaltung/einstellungen')).status,401);
    assert.equal((await request('/api/einstellungen')).status,401);
    assert.equal((await request('/api/benutzerkonto')).status,401);
    assert.equal((await request('/api/benutzerkonto/navigation')).status,401);
    assert.equal((await request('/api/benutzerkonto/navigation',{method:'POST',body:{}})).status,401);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl')).status,401);
    assert.equal((await request('/api/verwaltung/benutzer',{method:'POST',body:{}})).status,401);
    assert.equal((await request('/api/verwaltung/sitzungen',{method:'DELETE',body:{}})).status,401);
    for(const path of ['/','/servicehub','/verwaltung','/planboard','/casedesk','/dutyboard','/einstellungen','/benutzerkonto']){const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location'),base).pathname,'/anmeldung');const text=await response.text();assert.ok(!text.includes('Ihr digitaler Arbeitsplatz'));}
    assert.equal((await request('/api/pds-simulator?resource=objects&q=abc')).status,401);
    assert.equal((await request('/api/pds/rest/api/termin/listkategorien')).status,401);
    const fake=await fetch(base+'/verwaltung',{headers:{cookie:'service-session='+'a'.repeat(43),'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy'},redirect:'manual'});assert.equal(fake.status,303);
    const signIn=await request('/anmeldung');assert.equal(signIn.status,200);assert.ok(!(await signIn.text()).includes('HeyElli Navigation'));
    for(const [oldPath,newPath] of [['/stoerungen','/casedesk'],['/ressourcenkalender','/planboard'],['/bereitschaft','/dutyboard']]){
      const query='?datum=2026-11-09&mitarbeiter=fictional-one&filter=a%2Bb';
      const alias=await fetch(base+oldPath+query,{redirect:'manual'});assert.equal(alias.status,308);
      const target=new URL(alias.headers.get('location'),base);assert.equal(target.pathname,newPath);assert.equal(target.search,query);
      const protectedTarget=await fetch(target,{redirect:'manual'});assert.equal(protectedTarget.status,303);assert.equal(new URL(protectedTarget.headers.get('location'),base).pathname,'/anmeldung');
    }
    let {cookie,body}=await login();
    await checkResourceLoad({pool,base,cookieName:cookie.split('=')[0],memoryFile:memory.memoryFile,adminCookie:cookie,sqlitePath:join(directory,'.local/pds-simulator/development.sqlite')});

    const loginPage=await request('/anmeldung'),loginPolicy=loginPage.headers.get('content-security-policy');assert.match(loginPolicy,/'nonce-([A-Za-z0-9+/=]+)' 'strict-dynamic'/);assert.doesNotMatch(loginPolicy.split(';')[1],/unsafe-inline/);assert.equal(loginPage.headers.get('content-security-policy-report-only'),null);const pageMarkup=await loginPage.text(),nonce=loginPolicy.match(/'nonce-([^']+)'/)[1];assert.ok(pageMarkup.includes('nonce="'+nonce+'"'));const nextPolicy=(await request('/anmeldung')).headers.get('content-security-policy');assert.notEqual(nextPolicy,loginPolicy);
    const spoofed=await fetch(base+'/anmeldung',{headers:{'x-nonce':'attacker-controlled','Content-Security-Policy':"script-src 'unsafe-inline'"}});assert.ok(!spoofed.headers.get('content-security-policy').includes('attacker-controlled'));
    const sample={'csp-report':{'document-uri':base+'/servicehub?token=fictional-secret','effective-directive':'script-src-elem','blocked-uri':'inline','script-sample':'fictional-secret',disposition:'enforce'}};
    async function reportRequest(options={}){return fetch(base+'/api/sicherheit/csp',{method:'POST',headers:{'Content-Type':'application/csp-report',origin:base,...(options.auth===false?{}:{cookie}),...options.headers},body:options.raw??JSON.stringify(sample)});}
    assert.equal((await reportRequest({auth:false})).status,401);assert.equal((await reportRequest({headers:{origin:'https://untrusted.invalid'}})).status,403);assert.equal((await reportRequest({raw:'x'.repeat(16385)})).status,413);assert.equal((await reportRequest()).status,204);
    const reported=await request('/api/verwaltung/browser-schutz',{cookie});assert.equal(reported.status,200);const reportedText=JSON.stringify(await reported.json());assert.ok(reportedText.includes('script-src-elem'));assert.ok(!reportedText.includes('fictional-secret'));assert.ok(!reportedText.includes('token='));

    for(const path of ['/api/benutzerkonto/daten','/api/benutzerkonto/daten/export','/api/verwaltung/datenschutz?userId=local-service-user'])assert.equal((await request(path)).status,401);
    assert.equal((await request('/api/benutzerkonto/daten?userId=another',{cookie})).status,403);
    assert.equal((await request('/api/benutzerkonto/daten',{cookie,method:'POST',origin:'https://untrusted.invalid',body:{action:'preview'}})).status,403);
    assert.equal((await request('/api/benutzerkonto/daten',{cookie,method:'POST',body:{action:'preview',userId:'forged'}})).status,403);
    const privacy=await request('/api/benutzerkonto/daten',{cookie});assert.equal(privacy.status,200);assert.equal((await privacy.json()).automaticDeletion,false);
    const exportDownload=await request('/api/benutzerkonto/daten/export',{cookie});assert.equal(exportDownload.status,200);assert.match(exportDownload.headers.get('content-type'),/application\/x-ndjson/);const exportText=await exportDownload.text();assert.equal(JSON.parse(exportText.trim().split('\n').at(-1)).complete,true);assert.doesNotMatch(exportText,/token_hash|wrapped_key|SIMULATOR_PASSWORD|COPILOT_DIRECT_LINE_SECRET/);

    const createdRoleResponse=await request('/api/verwaltung/rollen',{method:'POST',cookie,body:{action:'save',name:'Fiktive HTTP Servicerolle',writeApps:['/servicehub'],apps:['/servicehub']}});assert.equal(createdRoleResponse.status,200);const createdRole=await createdRoleResponse.json();
    assert.equal((await request('/api/verwaltung/rollen',{method:'POST',cookie,origin:'https://untrusted.invalid',body:{action:'save'}})).status,403);
    const userVersion=(await pool.query("SELECT version FROM platform.users WHERE id='local-service-user'")).rows[0].version;
    assert.equal((await request('/api/verwaltung/rollen',{method:'POST',cookie,body:{action:'assign',userId:'local-service-user',version:userVersion,roleId:createdRole.id}})).status,403);
    await pool.query("UPDATE platform.users SET role='dispatcher',app_role_id=$1 WHERE id='local-service-user'",[createdRole.id]);
    assert.equal((await (await request('/api/simulator-session',{cookie})).json()).user.roleName,'Fiktive HTTP Servicerolle');
    try{
     assert.deepEqual((await (await request('/api/simulator-session',{cookie})).json()).allowedApps,['/servicehub']);
     assert.equal((await request('/api/verwaltung/browser-schutz',{cookie})).status,403);

     assert.equal((await request('/api/benutzerkonto/daten',{cookie})).status,200);assert.equal((await request('/api/verwaltung/datenschutz?userId=local-service-user',{cookie})).status,403);

     assert.equal((await request('/api/service',{cookie})).status,200);
     const entry=await fetch(base+'/',{headers:{cookie},redirect:'manual'});assert.equal(entry.status,303);assert.equal(new URL(entry.headers.get('location'),base).pathname,'/start');assert.match(entry.headers.get('cache-control'),/no-store/);const start=await request('/start',{cookie});assert.equal(start.status,200);const startHtml=await start.text();assert.match(startHtml,/Willkommen bei HeyElli/);assert.match(startHtml,/href="\/servicehub"/);assert.doesNotMatch(startHtml,/Fragen zur Bedienung stellen/);assert.equal((await request('/api/assistent/verlauf',{cookie})).status,403);
     for(const path of ['/api/ressourcenkalender','/api/bereitschaft','/api/assistent/status','/api/verwaltung/rollen'])assert.equal((await request(path,{cookie})).status,403,path);
     assert.equal((await request('/api/ressourcenkalender',{method:'POST',cookie,body:{}})).status,403);
     const denied=await fetch(base+'/planboard',{headers:{cookie},redirect:'manual'});assert.equal(denied.status,303);assert.equal(new URL(denied.headers.get('location'),base).pathname,'/kein-zugriff');
     await pool.query("UPDATE platform.app_roles SET apps='[\"/servicehub\",\"/planboard\",\"/dutyboard\",\"/casedesk\"]'::jsonb WHERE id=$1",[createdRole.id]);
     const readCalendar=await request('/api/ressourcenkalender?from=2026-11-09&to=2026-11-16',{cookie});assert.equal(readCalendar.status,200);assert.equal((await readCalendar.json()).permissions.write,false);
     const readDuty=await request('/api/bereitschaft?year=2026',{cookie});assert.equal(readDuty.status,200);assert.equal((await readDuty.json()).write,false);
     for(const path of ['/api/ressourcenkalender/termine','/api/bereitschaft','/api/pds-simulator/orders','/api/pds/rest/api/termin/update'])assert.equal((await request(path,{method:'POST',cookie,body:{}})).status,403,path);
     assert.notEqual((await request('/api/service/planung',{method:'POST',cookie,body:{}})).status,403);
     await pool.query("UPDATE platform.app_roles SET apps='[]',write_apps='[]' WHERE id=$1",[createdRole.id]);
     const empty=await fetch(base+'/',{headers:{cookie},redirect:'manual'});assert.equal(empty.status,303);assert.equal(new URL(empty.headers.get('location'),base).pathname,'/start');assert.equal((await request('/kein-zugriff',{cookie})).status,200);const emptyStart=await request('/start',{cookie});assert.equal(emptyStart.status,200);assert.match(await emptyStart.text(),/noch keine Apps freigegeben/);assert.equal((await (await request('/api/simulator-session',{cookie})).json()).authenticated,true);
    }finally{await pool.query("UPDATE platform.users SET role='admin',app_role_id=NULL WHERE id='local-service-user'");}
    const roleData=await (await request('/api/verwaltung/rollen',{cookie})).json();const testedRole=roleData.roles.find(r=>r.id===createdRole.id);assert.equal((await request('/api/verwaltung/rollen',{method:'POST',cookie,body:{action:'delete',id:testedRole.id,version:testedRole.version}})).status,200);

    for(const path of ['/casedesk','/planboard','/dutyboard'])assert.equal((await request(path,{cookie})).status,200);
    for(const [oldPath,newPath] of [['/stoerungen','/casedesk'],['/ressourcenkalender','/planboard'],['/bereitschaft','/dutyboard']]){
      const alias=await fetch(base+oldPath+'?datum=2026-11-09',{headers:{cookie},redirect:'manual'});assert.equal(alias.status,308);assert.equal(new URL(alias.headers.get('location'),base).pathname,newPath);
    }
    const draftKey=await (await request('/api/ressourcenkalender/entwuerfe?key=1',{cookie})).json(),draftName='heyelli:calendar-draft:v2:fictional-owner:fictional-http-draft';
    const draftPayload=encryptDraft(draftKey,draftName,JSON.stringify({draftId:'fictional-http-draft',original:{id:'fictional'},changed:{id:'fictional',notes:'Fiktiv gesicherte Eingabe'},operationId:'fictional-operation'}));
    assert.equal((await request('/api/ressourcenkalender/entwuerfe',{cookie,method:'POST',body:{key:draftName,envelope:draftPayload},origin:'https://untrusted.invalid'})).status,403);
    assert.equal((await request('/api/ressourcenkalender/entwuerfe',{cookie,method:'POST',body:{key:draftName,envelope:draftPayload}})).status,200);
    const privateStatus=await (await request('/api/benutzerkonto/geraet',{cookie})).json();assert.equal(privateStatus.stored,1);assert.ok(!JSON.stringify(privateStatus).includes(draftKey.key));
    const encryptedCopies=await (await request('/api/ressourcenkalender/entwuerfe',{cookie})).json();assert.equal(encryptedCopies.records.length,1);assert.ok(!JSON.stringify(encryptedCopies).includes('Fiktiv gesicherte Eingabe'));
    assert.equal((await request('/api/benutzerkonto/geraet',{cookie,method:'POST',body:{key:draftName,complete:true}})).status,200);
    const oldRetry=await (await request('/api/ressourcenkalender/entwuerfe',{cookie,method:'POST',body:{key:draftName,envelope:draftPayload}})).json();assert.equal(oldRetry.completed,true);
    assert.equal((await (await request('/api/ressourcenkalender/entwuerfe',{cookie})).json()).records.length,0);
    const retained=await (await request('/api/verwaltung/geheimnisablage',{cookie})).json();assert.equal(retained.items.length,5);assert.ok(retained.items.every(item=>typeof item.configured==='boolean'&&typeof item.enabled==='boolean'));assert.ok(!JSON.stringify(retained).includes('config_id'));
    const ownAdminProfile=await (await request('/api/benutzerkonto',{cookie})).json();assert.equal(ownAdminProfile.role,'admin');assert.equal(ownAdminProfile.displayName,body.user.displayName);
    const movedSettings=await fetch(base+'/verwaltung?microsoft_auth=test-ok',{headers:{cookie},redirect:'manual'});assert.equal(movedSettings.status,307);assert.equal(new URL(movedSettings.headers.get('location'),base).pathname,'/einstellungen');assert.equal(new URL(movedSettings.headers.get('location'),base).search,'?microsoft_auth=test-ok');
    assert.equal((await request('/einstellungen',{cookie})).status,200);assert.equal((await request('/benutzerkonto',{cookie})).status,200);

    for(const kind of ['expired','revoked']){
      const validStatus=await (await request('/api/simulator-session',{cookie})).json();assert.ok(validStatus.sessionRemainingMs>0);
      const token=cookie.slice(cookie.indexOf('=')+1),digest=(await import('node:crypto')).createHash('sha256').update(token).digest('hex');
      await pool.query(kind==='expired'?"UPDATE platform.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1":"UPDATE platform.sessions SET revoked_at=now() WHERE token_hash=$1",[digest]);
      const invalidStatus=await (await request('/api/simulator-session',{cookie})).json();assert.equal(invalidStatus.authenticated,false);assert.equal(invalidStatus.sessionRemainingMs,0);
      await catalogDenied(cookie);
      for(const path of ['/','/servicehub','/verwaltung','/planboard','/dutyboard','/einstellungen','/benutzerkonto']){
        for(const extra of [{},{RSC:'1','Next-Router-Prefetch':'1'}]){const response=await fetch(base+path,{headers:{cookie,...extra},redirect:'manual'});assert.equal(response.status,303,kind+' '+path);assert.equal(new URL(response.headers.get('location'),base).pathname,'/anmeldung');assert.match(response.headers.get('cache-control'),/no-store/);}
      }
      for(const path of ['/api/verwaltung','/api/benutzerkonto','/api/ressourcenkalender','/api/pds-simulator?resource=objects&q=abc'])assert.equal((await request(path,{cookie})).status,401);
      ({cookie,body}=await login());
    }
    const msSettings=await request('/api/verwaltung/microsoft-anmeldung',{cookie});assert.equal(msSettings.status,200);assert.equal((await msSettings.json()).settings.enabled,false);
    const msGuide=await request('/api/verwaltung/microsoft-anmeldung/anleitung',{cookie});assert.equal(msGuide.status,200);assert.match(msGuide.headers.get('content-type'),/text\/markdown/);assert.ok((await msGuide.text()).includes('Single Tenant'));
    assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{method:'POST',cookie,body:{action:'save',tenantId:'common'}})).status,400);
    const badCallback=await fetch(base+'/api/auth/microsoft/callback?state=forged&code=SECRET-CODE',{redirect:'manual'});assert.equal(badCallback.status,303);assert.equal(badCallback.headers.get('location'),'/anmeldung?status=microsoft-failed');assert.ok(!badCallback.headers.get('location').includes('SECRET-CODE'));
    assert.equal(body.user.role,'admin');
    const catalog=await request('/servicehub',{cookie});assert.equal(catalog.status,200);const catalogHtml=await catalog.text();assert.ok(catalogHtml.includes('DutyBoard'));assert.ok(catalogHtml.includes('href="/dutyboard"'));assert.ok(!catalogHtml.includes('Onboarding'));
    assert.equal((await request('/api/service-catalog',{cookie})).status,403);
    assert.equal((await request('/api/verwaltung',{cookie})).status,200);
    assert.equal((await request('/api/verwaltung/benutzer',{cookie,method:'POST',origin:'https://evil.example.invalid',body:{}})).status,403);
    assert.equal((await request('/api/verwaltung/benutzer',{cookie,method:'POST',body:{padding:'x'.repeat(9000)}})).status,413);
    assert.equal((await request('/api/bereitschaft?year=2027')).status,401);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,origin:'https://evil.example.invalid',body:{action:'preview',year:2027,resources:[]}})).status,403);
    assert.equal((await request('/api/bereitschaft/ressourcenauswahl')).status,401);
    await checkMicrosoftAuthHttp({base,port,cookie,modeFile:providerMode,request,pool});
    let dutyPreference=await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json();
    assert.equal((await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,origin:'https://evil.example.invalid',body:{owner:dutyPreference.owner,expectedVersion:dutyPreference.version,selection:[]}})).status,403);
    assert.equal((await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:'forged-user',expectedVersion:dutyPreference.version,selection:[]}})).status,409);
    const initialPlanSelection=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();
    const copiedPlan=await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:dutyPreference.owner,expectedVersion:dutyPreference.version,source:'resource-plan',selection:['forged-ignored']}});assert.equal(copiedPlan.status,200);const copiedValue=await copiedPlan.json();assert.deepEqual(copiedValue.selection,initialPlanSelection.selection);assert.equal(copiedValue.selection,null);dutyPreference=copiedValue;
    const savedDutyPreference=await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:dutyPreference.owner,expectedVersion:dutyPreference.version,selection:['fictional-http-resource']}});assert.equal(savedDutyPreference.status,200);
    assert.equal((await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:dutyPreference.owner,expectedVersion:dutyPreference.version,selection:[]}})).status,409);
    assert.deepEqual((await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json()).selection,['fictional-http-resource']);
    assert.equal((await request('/api/bereitschaft/feiertage')).status,401);
    assert.equal((await request('/api/bereitschaft/fairness?year=2027')).status,401);
    assert.equal((await request('/api/bereitschaft/fairness?year=invalid',{cookie})).status,400);
    const holidayPreference=await (await request('/api/bereitschaft/feiertage',{cookie})).json(),personalHolidays={...holidayPreference.holidays,enabled:true,state:'TH',historyYears:6,localCorpus:true,weights:{newYear:5,christmas:7,easter:3,pentecost:4,other:2}};
    assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,origin:'https://evil.example.invalid',body:{owner:holidayPreference.owner,expectedVersion:holidayPreference.version,holidays:personalHolidays}})).status,403);
    assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,body:{owner:'forged-user',expectedVersion:holidayPreference.version,holidays:personalHolidays}})).status,409);
    assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,body:{owner:holidayPreference.owner,expectedVersion:holidayPreference.version,holidays:{...personalHolidays,state:'XX'}}})).status,400);
    assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,body:{owner:holidayPreference.owner,expectedVersion:holidayPreference.version,holidays:personalHolidays}})).status,200);
    assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,body:{owner:holidayPreference.owner,expectedVersion:holidayPreference.version,holidays:personalHolidays}})).status,409);
    assert.deepEqual((await (await request('/api/bereitschaft/feiertage',{cookie})).json()).holidays,personalHolidays);
    const duty=await (await request('/api/bereitschaft?year=2027',{cookie})).json();assert.ok(duty.resources.length);assert.ok(Array.isArray(duty.resourceGroups));assert.ok(duty.resourceGroups.length);
    const dutyIds=duty.resources.slice(0,3).map(person=>person.id),dutyProposal=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:dutyIds}});assert.equal(dutyProposal.status,200);const proposed=await dutyProposal.json();assert.equal(proposed.slots.length,52);
    const dutyId='00000000-0000-4000-8000-000000000062';
    const holidays={enabled:true,state:'NW',localAssumption:false,localCorpus:false,localPeace:false,weights:{christmas:3,easter:2,pentecost:2,other:1}};
    const holidayResponse=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:dutyIds,holidays}});assert.equal(holidayResponse.status,200);const holidayProposal=await holidayResponse.json();assert.ok(holidayProposal.slots.some(slot=>slot.holidayPoints>0));assert.notEqual(holidayProposal.hash,proposed.hash);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:dutyIds,holidays:{...holidays,state:'XX'}}})).status,409);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2027,resources:dutyIds,holidays,hash:proposed.hash,jobId:dutyId}})).status,409);
    const startDuty=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2027,resources:dutyIds,holidays,hash:holidayProposal.hash,jobId:dutyId}});assert.equal(startDuty.status,200);
    const dutyStep=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:dutyId}});assert.equal(dutyStep.status,200,await dutyStep.clone().text());assert.equal((await dutyStep.json()).cursor,1);
    const resumedDuty=await (await request('/api/bereitschaft?year=2027',{cookie})).json();assert.equal(resumedDuty.active.cursor,1);assert.ok(resumedDuty.events.some(event=>event.categories.some(id=>duty.categories.some(category=>category.id===id&&category.name==='Bereitschaft'))));
    const firstDutyEvents=resumedDuty.events.map(event=>event.id);
    await pool.query('UPDATE platform.duty_plans SET cursor=0 WHERE id=$1',[dutyId]);
    const repeatedStep=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:dutyId}});assert.equal(repeatedStep.status,200);assert.equal((await repeatedStep.json()).cursor,1);
    const afterRepeat=await (await request('/api/bereitschaft?year=2027',{cookie})).json();assert.deepEqual(afterRepeat.events.map(event=>event.id),firstDutyEvents);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'stop',jobId:dutyId}})).status,200);
    const replaceProposal=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:dutyIds}})).json();assert.equal(replaceProposal.slots[0].old.length,1);
    const replaceId='00000000-0000-4000-8000-000000000063';assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2027,resources:dutyIds,hash:replaceProposal.hash,jobId:replaceId}})).status,200);
    const replaceStep=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:replaceId}});assert.equal(replaceStep.status,200,await replaceStep.clone().text());
    const replaced=await (await request('/api/bereitschaft?year=2027',{cookie})).json();assert.equal(replaced.events.length,1);assert.notEqual(replaced.events[0].id,firstDutyEvents[0]);assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'stop',jobId:replaceId}})).status,200);
    const manualDay=replaceProposal.slots[0].day,manualPerson=dutyIds.find(id=>id!==replaced.events[0].resourceIds[0]);
    const manualPreview=await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:[manualPerson],manualDay}});assert.equal(manualPreview.status,200);const manualProposal=await manualPreview.json();assert.equal(manualProposal.slots.length,1);assert.equal(manualProposal.slots[0].resourceId,manualPerson);
    const manualId='00000000-0000-4000-8000-000000000064';assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2027,resources:[manualPerson],manualDay,confirmConsecutive:true,hash:manualProposal.hash,jobId:manualId}})).status,200);assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:manualId}})).status,200);
    // Explicit exception is server-checked and persists across start/step.
    const consecutiveResources=[dutyIds[0]];
    const firstWeek={year:2030,resources:consecutiveResources,manualDay:'2030-01-07'};
    const firstPreview=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',...firstWeek}})).json();
    const firstJob=randomUUID();assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',...firstWeek,hash:firstPreview.hash,jobId:firstJob}})).status,200);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:firstJob}})).status,200);
    const secondWeek={...firstWeek,manualDay:'2030-01-14'};
    const secondPreview=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',...secondWeek}})).json();
    assert.match(secondPreview.slots[0].consecutiveWarning,/zwei Bereitschaftswochen/);
    for(const confirmation of [undefined,false,'true'])assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',...secondWeek,hash:secondPreview.hash,jobId:randomUUID(),confirmConsecutive:confirmation}})).status,409);
    const secondJob=randomUUID();assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',...secondWeek,hash:secondPreview.hash,jobId:secondJob,confirmConsecutive:true}})).status,200);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:secondJob}})).status,200);
    const savedException=await pool.query('SELECT payload FROM platform.duty_plans WHERE id=$1',[secondJob]);assert.equal(savedException.rows[0].payload[0].consecutiveConfirmed,true);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',...firstWeek,manualDay:'2030-01-21'}})).status,409);
    const firstRecord=(await pool.query('SELECT payload FROM platform.duty_plans WHERE id=$1',[firstJob])).rows[0].payload[0];
    const beforeSplit=await (await request('/api/ressourcenkalender?from=2030-01-07&to=2030-01-14',{cookie})).json();
    const originalDuty=beforeSplit.events.find(event=>event.id===firstRecord.createdId);assert.ok(originalDuty);
    const splitBody={action:'split',id:originalDuty.id,expected:dutyFingerprint(originalDuty),operationId:randomUUID(),splitAt:'2030-01-10T07:00',resourceId:dutyIds[1]};
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',body:splitBody})).status,401);
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',cookie,body:splitBody})).status,200);
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',cookie,body:splitBody})).status,200);
    // Replay a partially acknowledged operation: both writes already succeeded.
    await pool.query('UPDATE platform.duty_event_operations SET complete=false WHERE id=$1',[splitBody.operationId]);
    const resumedSplit=await request('/api/bereitschaft/termine',{method:'POST',cookie,body:splitBody});assert.equal(resumedSplit.status,200,await resumedSplit.text());
    const afterSplit=await (await request('/api/ressourcenkalender?from=2030-01-07&to=2030-01-14',{cookie})).json();
    const firstPart=afterSplit.events.find(event=>event.id===originalDuty.id),secondParts=afterSplit.events.filter(event=>event.notes?.endsWith('HeyElli Bereitschaftsteilung '+splitBody.operationId));
    assert.equal(secondParts.length,1);assert.equal(firstPart.end,secondParts[0].start);assert.equal(firstPart.start,originalDuty.start);assert.equal(secondParts[0].end,originalDuty.end);assert.equal(secondParts[0].status,'FREI');assert.deepEqual(secondParts[0].resourceIds,[dutyIds[1]]);
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',cookie,body:{...splitBody,operationId:randomUUID()}})).status,409);
    const deleteBody={action:'delete',id:secondParts[0].id,expected:dutyFingerprint(secondParts[0]),operationId:randomUUID()};
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',cookie,body:deleteBody})).status,200);
    assert.equal((await request('/api/bereitschaft/termine',{method:'POST',cookie,body:deleteBody})).status,200);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform.calendar_history WHERE event_id=$1 AND changes @> $2::jsonb',[secondParts[0].id,JSON.stringify([{operationId:deleteBody.operationId}])])).rows[0].n,1);
    const manualResult=await (await request('/api/bereitschaft?year=2027',{cookie})).json();assert.equal(manualResult.events.length,1);assert.deepEqual(manualResult.events[0].resourceIds,[manualPerson]);assert.equal(manualResult.events[0].status,'FREI');


    // Save a prior-year Christmas duty through the protected API, then prove
    // that the next year's proposal reads it and rejects changed history.
    const priorDay='2026-12-21',priorResources=[dutyIds[0]],historyHolidays={...holidays,historyYears:5,weights:{...holidays.weights,newYear:7}};
    const priorProposal=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2026,resources:priorResources,manualDay:priorDay}})).json();
    const priorJob='00000000-0000-4000-8000-000000000065';assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2026,resources:priorResources,manualDay:priorDay,confirmConsecutive:true,hash:priorProposal.hash,jobId:priorJob}})).status,200);assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:priorJob}})).status,200);
    const historicalProposal=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2027,resources:dutyIds,holidays:historyHolidays}})).json();assert.ok(historicalProposal.historyCount>=1);assert.ok(historicalProposal.slots.filter(slot=>slot.resourceId).every(slot=>slot.selectionReason));
    const fairnessResponse=await request('/api/bereitschaft/fairness?year=2027',{cookie});assert.equal(fairnessResponse.status,200);const fairness=await fairnessResponse.json();assert.ok(fairness.accounts.some(account=>account.id===dutyIds[0]&&account.plannedHolidayPoints+account.holidayPoints>=14));assert.equal(fairness.settingsVersion,(await (await request('/api/bereitschaft/feiertage',{cookie})).json()).version);
    assert.equal(historicalProposal.historyFrom,2022);assert.notEqual(historicalProposal.slots.find(slot=>slot.day==='2027-12-20').resourceId,dutyIds[0]);assert.equal(historicalProposal.slots.find(slot=>slot.day==='2027-12-27').holidayPoints,7);
    const priorReplacement=await (await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'preview',year:2026,resources:[dutyIds[1]],manualDay:priorDay}})).json();
    const priorReplacementJob='00000000-0000-4000-8000-000000000066';assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2026,resources:[dutyIds[1]],manualDay:priorDay,confirmConsecutive:true,hash:priorReplacement.hash,jobId:priorReplacementJob}})).status,200);assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'step',jobId:priorReplacementJob}})).status,200);
    assert.equal((await request('/api/bereitschaft',{method:'POST',cookie,body:{action:'start',year:2027,resources:dutyIds,holidays:historyHolidays,hash:historicalProposal.hash,jobId:'00000000-0000-4000-8000-000000000067'}})).status,409);

    const savedWishes=await checkDutyWishesHttp(request,pool,cookie);
    const pdsGuide=await request('/api/verwaltung/pds/anleitung',{cookie});assert.equal(pdsGuide.status,200);assert.match(pdsGuide.headers.get('content-type'),/text\/markdown; charset=utf-8/);assert.match(pdsGuide.headers.get('content-disposition'),/attachment; filename="heyelli-pds-anleitung.md"/);assert.match(pdsGuide.headers.get('cache-control'),/no-store/);const pdsGuideText=await pdsGuide.text();for(const text of ['## Einrichtung','### 1 · PDS-Admin','### 2 · HeyElli-Admin','## Fehlerbehebung','HTTP 401','Zum Simulator zurückkehren','## Aktueller Stand','Bauleiter / Projektleiter','Ansprechpartner','Antwortverlust & Wiederholung','Gleichzeitige Änderungen','Service ↔ Kalender','Mobilität & Storno','Mehrteilige Einsätze','Test & Abnahme','Schutz der Zugangsdaten'])assert.ok(pdsGuideText.includes(text));
    const guide=await request('/api/verwaltung/email/anleitung',{cookie});assert.equal(guide.status,200);assert.match(guide.headers.get('content-type'),/text\/markdown/);assert.match(guide.headers.get('content-disposition'),/attachment/);const guideText=await guide.text();assert.ok(guideText.includes('Microsoft-365-Admin'));assert.ok(guideText.includes('HeyElli-Admin'));assert.ok(guideText.includes('M365_CLIENT_SECRET=<Secret-Wert>'));assert.ok(guideText.includes('Application MailboxSettings.Read'));for(const heading of ['## Einrichtung','## Aktueller Stand','## Prüfung und Freigabe','## Fehlerbehebung','## Schutz der Zugangsdaten']){assert.ok(guideText.includes(heading));assert.ok(pdsGuideText.includes(heading));}
    const mail=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(mail.mode,'test');
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',origin:'https://evil.example.invalid',body:{action:'process'}})).status,403);
    const mailBody={action:'enqueue',requestId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',recipient:'test@example.invalid',subject:'Test',body:'Fiktiver Inhalt'};
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:mailBody})).status,200);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:mailBody})).status,200);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{...mailBody,subject:'Andere Nachricht'}})).status,409);
    let mailState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(mailState.queue.length,1);assert.equal(mailState.log.length,1);assert.equal(mailState.queue[0].status,'queued');
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'process'}})).status,200);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'process'}})).status,200);
    mailState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(mailState.queue[0].status,'simulated');assert.equal(mailState.log.length,2);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'live'}})).status,400);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'mode',testMode:false,version:1}})).status,400);
    await checkMailWorker(pool);
    let moduleState=await (await request('/api/verwaltung/email',{cookie})).json();
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'module',enabled:false,version:moduleState.settings.version}})).status,200);
    for(const action of ['connect','process','mode','enqueue'])assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action}})).status,409);
    moduleState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(moduleState.settings.enabled,false);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'module',enabled:true,version:moduleState.settings.version}})).status,200);
    moduleState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(moduleState.settings.test_mode,true);

    const uiSecret=randomBytes(32).toString('hex'),uiTenant=randomUUID(),uiClient=randomUUID();
    let credentialState=await (await request('/api/verwaltung/email',{cookie})).json();
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:{action:'settings',sender:'mailbox@example.invalid.test',version:credentialState.settings.version}})).status,200);
    credentialState=await (await request('/api/verwaltung/email',{cookie})).json();
    const credentials={action:'credentials',tenantId:uiTenant,clientId:uiClient,secret:uiSecret,version:credentialState.settings.version};
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',origin:'https://evil.example.invalid',body:credentials})).status,403);
    const savedCredentials=await request('/api/verwaltung/email',{cookie,method:'POST',body:credentials});assert.equal(savedCredentials.status,200,await savedCredentials.clone().text());assert.ok(!(await savedCredentials.text()).includes(uiSecret));
    credentialState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(credentialState.connection.configured,true);assert.equal(credentialState.settings.test_mode,true);assert.equal(credentialState.settings.connection_ok,false);assert.ok(!JSON.stringify(credentialState).includes(uiSecret));assert.ok(!JSON.stringify(credentialState).includes(uiTenant));
    const secretPath=join(settingsDirectory,'.env.graph.'+credentialState.settings.config_id+'.local'),keyPath=join(settingsDirectory,'.local/mail-secrets/master.key');const encryptedConfig=await readFile(secretPath,'utf8');assert.ok(!encryptedConfig.includes(uiSecret));assert.ok(!encryptedConfig.includes(uiTenant));assert.equal((await stat(secretPath)).mode&0o777,0o600);assert.equal((await stat(keyPath)).mode&0o777,0o600);
    assert.equal((await request('/api/verwaltung/email',{cookie,method:'POST',body:credentials})).status,409,'stale credentials cannot replace newer configuration');
    const preserved=await readFile(secretPath,'utf8');
    for(const provider of ['reject','disconnect']){
     await writeFile(providerMode,JSON.stringify({provider,response:'normal'}));credentialState=await (await request('/api/verwaltung/email',{cookie})).json();
     const rejected=await request('/api/verwaltung/email',{cookie,method:'POST',body:{...credentials,secret:randomBytes(32).toString('hex'),version:credentialState.settings.version}});assert.equal(rejected.status,422);assert.match((await rejected.json()).error,/Vorhandene Zugangsdaten wurden nicht ersetzt/);assert.equal(await readFile(secretPath,'utf8'),preserved);
     credentialState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(credentialState.settings.test_mode,true);assert.equal(credentialState.connection.configured,true);
    }
    await writeFile(providerMode,JSON.stringify({provider:'success',response:'normal'}));
    await rename(keyPath,keyPath+'.audit-backup');
    try{credentialState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(credentialState.connection.configured,false);const rejected=await request('/api/verwaltung/email',{cookie,method:'POST',body:{...credentials,version:credentialState.settings.version}});assert.equal(rejected.status,503);assert.match((await rejected.json()).error,/Schlüssel/);assert.equal(await readFile(secretPath,'utf8'),preserved);await assert.rejects(stat(keyPath));}finally{await rename(keyPath+'.audit-backup',keyPath);}
    credentialState=await (await request('/api/verwaltung/email',{cookie})).json();assert.equal(credentialState.connection.configured,true);assert.equal(credentialState.settings.test_mode,true);
    const auditSecrets=await (await request('/api/verwaltung/protokoll',{cookie})).text();assert.ok(!auditSecrets.includes(uiSecret));assert.ok(!auditSecrets.includes(uiTenant));
    assert.equal((await request('/api/verwaltung/pds')).status,401);
    const pdsState=await (await request('/api/verwaltung/pds',{cookie})).json();assert.equal(pdsState.mode,'simulator');
    const pdsToken=randomBytes(32).toString('hex');const pdsBody={action:'save',baseUrl:'https://pds.example.invalid/pds/rest/api',token:pdsToken,version:pdsState.settings.version};
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',origin:'https://evil.example.invalid',body:pdsBody})).status,403);
    const pdsSave=await request('/api/verwaltung/pds',{cookie,method:'POST',body:pdsBody});assert.equal(pdsSave.status,200,await pdsSave.clone().text());
    const pdsAfter=await (await request('/api/verwaltung/pds',{cookie})).json();assert.equal(pdsAfter.configured,true);assert.equal(pdsAfter.mode,'simulator');assert.equal(pdsAfter.settings.checks.length,4);assert.ok(!JSON.stringify(pdsAfter).includes(pdsToken));
    const pdsKey=join(settingsDirectory,'.local/pds-secrets/master.key'),pdsFile=join(settingsDirectory,'.env.pds.'+pdsAfter.settings.config_id+'.local'),pdsBytes=await readFile(pdsFile);await rename(pdsKey,pdsKey+'.audit-backup');
    try{const rejected=await request('/api/verwaltung/pds',{cookie,method:'POST',body:{...pdsBody,version:pdsAfter.settings.version}});assert.equal(rejected.status,503);assert.match((await rejected.json()).error,/Schlüssel/);assert.deepEqual(await readFile(pdsFile),pdsBytes);await assert.rejects(stat(pdsKey));}finally{await rename(pdsKey+'.audit-backup',pdsKey);}
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',body:pdsBody})).status,409);
    await checkSourceIsolation(pool);
    let pdsVersion=pdsAfter.settings.version;
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',body:{action:'source',mode:'pds-readonly',confirm:true,version:pdsVersion}})).status,409,'calendar preflight required');
    const calendarPreflight=await request('/api/verwaltung/pds',{cookie,method:'POST',body:{action:'calendar-test'}});assert.equal(calendarPreflight.status,200);assert.equal((await calendarPreflight.json()).ok,true);
    const beforeSource=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',body:{action:'source',mode:'pds-readonly',confirm:true,version:pdsVersion}})).status,200);
    assert.equal((await request('/api/pds-simulator?resource=objects&q=abc')).status,401,'real search is never public');
    const liveCalendar=await request('/api/ressourcenkalender?from=2026-11-02&to=2026-11-08',{cookie});assert.equal(liveCalendar.status,200,await liveCalendar.clone().text());const liveData=await liveCalendar.json();assert.equal(liveData.source.mode,'pds-readonly');assert.equal(liveData.permissions.write,false);assert.deepEqual(liveData.resources,[],'empty actual API response must not be filled from simulator');
    for(const path of ['/api/ressourcenkalender','/api/ressourcenkalender/termine','/api/ressourcenkalender/mobilausgabe','/api/pds-simulator/orders','/api/pds-simulator/persons','/api/pds-simulator/person-links','/api/pds-simulator/uploads','/api/bereitschaft'])assert.equal((await request(path,{cookie,method:'POST',body:{}})).status,409,`live writes blocked: ${path}`);
    const realProfile=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();assert.notEqual(realProfile.owner,beforeSource.owner);assert.equal(realProfile.selection,null);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie,method:'POST',body:{owner:beforeSource.owner,expectedVersion:realProfile.version,selection:['old-sim-id']}})).status,409);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie,method:'POST',body:{owner:realProfile.owner,expectedVersion:realProfile.version,selection:['real-resource']}})).status,200);
    await writeFile(providerMode,JSON.stringify({provider:'success',response:'normal',pds:'disconnect'}));const noFallback=await request('/api/ressourcenkalender?from=2026-11-02&to=2026-11-08',{cookie});assert.ok(noFallback.status>=400);await writeFile(providerMode,JSON.stringify({provider:'success',response:'normal'}));
    let sourceState=await (await request('/api/verwaltung/pds',{cookie})).json();pdsVersion=sourceState.settings.version;
    // PDS-Benutzer werden nur noch in der Benutzerverwaltung zugeordnet; die frühere Bearbeiterzuordnung im PDS-Panel gibt es nicht mehr.
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',body:{action:'mapping',userId:'local-service-user',pdsUserUUID:'11111111-1111-4111-8111-111111111111',expected:null,version:pdsVersion}})).status,400);
    assert.equal((await request('/api/verwaltung/pds',{cookie,method:'POST',body:{action:'source',mode:'simulator',version:pdsVersion}})).status,200);
    const restoredSource=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();assert.equal(restoredSource.owner,beforeSource.owner);assert.deepEqual(restoredSource.selection,beforeSource.selection);

    const overview=await (await request('/api/verwaltung',{cookie})).json();assert.ok(overview.users.length);assert.ok(!JSON.stringify(overview).includes('token_hash'));
    await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id) SELECT 'export-test','user.updated','export-entry-'||n FROM generate_series(1,135) n");
    const auditExport=await request('/api/verwaltung/protokoll',{cookie});
    assert.equal(auditExport.status,200);assert.match(auditExport.headers.get('content-type'),/text\/markdown/);assert.match(auditExport.headers.get('content-disposition'),/attachment; filename="heyelli-verwaltungsprotokoll-/);assert.equal(auditExport.headers.get('cache-control'),'no-store');assert.equal(auditExport.headers.get('x-content-type-options'),'nosniff');assert.equal(auditExport.headers.get('x-frame-options'),'DENY');assert.equal(auditExport.headers.get('referrer-policy'),'no-referrer');assert.match(auditExport.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const pageOne=await (await request('/api/verwaltung/protokoll?format=json&actor=export-test',{cookie})).json();assert.equal(pageOne.entries.length,50);assert.ok(pageOne.nextCursor);
    await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id) VALUES('export-test','user.updated','later-entry')");
    const seen=new Set(pageOne.entries.map(e=>e.id));let next=pageOne.nextCursor;
    while(next){const page=await (await request('/api/verwaltung/protokoll?'+new URLSearchParams({format:'json',actor:'export-test',cursor:next,snapshot:pageOne.snapshot}),{cookie})).json();assert.ok(page.entries.length<=50);for(const e of page.entries){assert.ok(!seen.has(e.id));assert.notEqual(e.targetId,'later-entry');seen.add(e.id);}next=page.nextCursor;}assert.equal(seen.size,135);
    const markdown=await auditExport.text();assert.equal((markdown.match(/export\\-entry\\-/g)||[]).length,135,'export includes entries beyond the latest 30');assert.ok(!markdown.includes('token_hash'));
    await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id,created_at,changes) VALUES('filter-test','employee.linked','filter-target','2025-12-31T23:30:00Z',$1::jsonb),('filter-test','employee.linked','filter-target','2026-01-01T23:30:00Z',$1::jsonb)",[JSON.stringify([{field:'resourceId',label:'Mitarbeiterzuordnung',before:'Alter Mitarbeiter',after:'Neuer Mitarbeiter'}])]);
    const filterQuery=new URLSearchParams({actor:'filter-test',action:'employee.linked',from:'2026-01-01',to:'2026-01-01',search:'Alter Mitarbeiter'});
    const filteredEvents=await (await request('/api/verwaltung/protokoll?format=json&'+filterQuery,{cookie})).json();
    assert.equal(filteredEvents.entries.length,1,'Berlin date filters include the complete day');assert.equal(filteredEvents.entries[0].createdAt,'2025-12-31T23:30:00.000Z');
    const filteredExport=await (await request('/api/verwaltung/protokoll?'+filterQuery,{cookie})).text();assert.equal((filteredExport.match(/### /g)||[]).length,1);assert.ok(filteredExport.includes('Alter Mitarbeiter'));assert.ok(filteredExport.includes('Neuer Mitarbeiter'));assert.ok(!filteredExport.includes('2026-01-01T23:30:00'));
    assert.equal((await (await request('/api/verwaltung/protokoll?format=json&actor=unknown',{cookie})).json()).entries.length,0);
    assert.equal((await request('/api/verwaltung/protokoll?from=2026-02-30',{cookie})).status,400);assert.equal((await request('/api/verwaltung/protokoll?from=2026-02-02&to=2026-02-01',{cookie})).status,400);
    const system=await (await request('/api/verwaltung/einstellungen',{cookie})).json();assert.ok(system.version);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie,method:'POST',origin:'https://evil.example.invalid',body:system})).status,403);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie,method:'POST',body:{...system,defaultAppearance:'invalid'}})).status,400);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie,method:'POST',body:{...system,defaultAppearance:'system'}})).status,200);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie,method:'POST',body:system})).status,409);
    const detailedAudit=await (await request('/api/verwaltung',{cookie})).json();
    const settingsAudit=detailedAudit.events.find(entry=>entry.action==='settings.updated');
    assert.ok(settingsAudit.changes.some(change=>change.field==='defaultAppearance'&&change.after==='system'));
    const detailedMarkdown=await (await request('/api/verwaltung/protokoll',{cookie})).text();assert.ok(detailedMarkdown.includes('Standarddarstellung:'));assert.ok(detailedMarkdown.includes('System'));
    const colors=await (await request('/api/ressourcenkalender/farben',{cookie})).json();
    assert.ok(colors.version);
    const rules=colors.rules.map(rule=>rule.typ==='FREIER'?{...rule,farbe:'#112233'}:rule);
    assert.equal((await request('/api/ressourcenkalender/farben',{cookie,method:'POST',body:{rules,colorLayouts:colors.colorLayouts,expectedVersion:colors.version}})).status,200);
    assert.equal((await request('/api/ressourcenkalender/farben',{cookie,method:'POST',body:{rules,colorLayouts:colors.colorLayouts,expectedVersion:colors.version}})).status,409);
    const initialSettings=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie,method:'POST',body:{owner:initialSettings.owner,expectedVersion:initialSettings.version,selection:[],showTechnicianBadges:false,limitWorkingHours:true,showTentative:false}})).status,200);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie,method:'POST',body:{owner:initialSettings.owner,expectedVersion:initialSettings.version,selection:null}})).status,409);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie,method:'POST',body:{owner:'another-user',expectedVersion:2,selection:null}})).status,409);
    const nav=await (await request('/api/benutzerkonto/navigation',{cookie})).json();assert.equal(nav.view,'grid');
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',origin:'https://evil.example.invalid',body:{}})).status,403);
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{owner:'another-user',view:'list',version:nav.version}})).status,409);
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{...nav,view:'invalid'}})).status,400);
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{...nav,padding:'x'.repeat(2100)}})).status,413);
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{...nav,view:'list'}})).status,200);
    assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{...nav,view:'grid'}})).status,409);
    const initialAppearance=await (await request('/api/einstellungen',{cookie})).json();
    assert.equal((await request('/api/einstellungen',{cookie,method:'POST',origin:'https://evil.example.invalid',body:{}})).status,403);
    assert.equal((await request('/api/einstellungen',{cookie,method:'POST',body:{owner:'another-user',appearance:'light',expectedVersion:1}})).status,409);
    assert.equal((await request('/api/einstellungen',{cookie,method:'POST',body:{owner:initialAppearance.owner,appearance:'light',expectedVersion:initialAppearance.version,importIfUnset:true}})).status,200);
    await stop();await start();
    const restoredWishes=await (await request('/api/bereitschaft/wuensche?year=2028',{cookie})).json();assert.ok(restoredWishes.exclusions.some(item=>item.id===savedWishes.blockId));assert.equal(restoredWishes.swaps.find(item=>item.id===savedWishes.swapId).status,'complete');
    assert.deepEqual((await (await request('/api/bereitschaft/feiertage',{cookie})).json()).holidays,personalHolidays);
    assert.deepEqual((await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json()).selection,['fictional-http-resource']);
    assert.equal((await (await request('/api/einstellungen',{cookie})).json()).appearance,'light');
    assert.equal((await (await request('/api/verwaltung/einstellungen',{cookie})).json()).defaultAppearance,'system');
    const colorAudit=(await (await request('/api/verwaltung',{cookie})).json()).events.find(entry=>entry.action==='calendar.colors.updated');
    assert.ok(colorAudit);assert.ok(colorAudit.createdAt);assert.ok(colorAudit.actorId);assert.ok(colorAudit.changes.some(change=>change.after==='#112233'&&change.before!==change.after));
    const colorExport=await (await request('/api/verwaltung/protokoll',{cookie})).text();assert.ok(colorExport.includes('Kalenderfarben geändert'));assert.ok(colorExport.includes('112233'));
    const restoredColors=await (await request('/api/ressourcenkalender/farben',{cookie})).json();assert.equal(restoredColors.rules.find(rule=>rule.typ==='FREIER').farbe,'#112233');
    const restoredSettings=await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json();
    assert.deepEqual(restoredSettings.selection,[]);assert.equal(restoredSettings.showTentative,false);assert.equal(restoredSettings.limitWorkingHours,true);assert.equal(restoredSettings.showTechnicianBadges,false);
    const beforeCopy=await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json();const copyEmpty=await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:beforeCopy.owner,expectedVersion:beforeCopy.version,source:'resource-plan'}});assert.equal(copyEmpty.status,200);assert.deepEqual((await copyEmpty.json()).selection,[]);assert.deepEqual((await (await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).json()).selection,[]);
    assert.equal((await request('/api/verwaltung',{cookie})).status,200,'session survives application restart');
    const local=overview.users.find(user=>user.id==='local-service-user');
    assert.equal((await request('/api/verwaltung/benutzer',{cookie,method:'POST',body:{...local,role:'reader'}})).status,200);
    assert.equal((await request('/api/verwaltung',{cookie})).status,401,'role change revokes existing cookie');
    ({cookie,body}=await login());assert.equal(body.user.role,'reader','client role is ignored');
    const settingsForReader=await (await request('/einstellungen',{cookie})).text();assert.ok(settingsForReader.includes('Kein App-Zugriff'));assert.ok(!settingsForReader.includes('admin-user-assignments'));
    const accountForReader=await request('/benutzerkonto',{cookie});assert.equal(accountForReader.status,200);assert.ok((await accountForReader.text()).includes('Benutzerkonto'));

    assert.equal((await request('/api/verwaltung',{cookie})).status,403);assert.equal((await request('/api/verwaltung/email',{cookie})).status,403);assert.equal((await request('/api/verwaltung/pds',{cookie})).status,403);assert.equal((await request('/api/verwaltung/email/anleitung',{cookie})).status,403);assert.equal((await request('/api/verwaltung/microsoft-anmeldung',{cookie})).status,403);assert.equal((await request('/api/verwaltung/microsoft-anmeldung/anleitung',{cookie})).status,403);assert.equal((await request('/api/verwaltung/pds/anleitung',{cookie})).status,403);
    assert.equal((await request('/api/verwaltung/protokoll',{cookie})).status,403);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie})).status,403);
    assert.equal((await request('/api/verwaltung/einstellungen',{cookie,method:'POST',body:system})).status,403);
    assert.equal((await request('/api/einstellungen',{cookie})).status,200);
    assert.equal((await request('/api/ressourcenkalender/ressourcenauswahl',{cookie})).status,200);
    assert.equal((await request('/api/verwaltung/geheimnisablage',{cookie})).status,403);
    const readerNav=await (await request('/api/benutzerkonto/navigation',{cookie})).json();assert.equal(readerNav.view,'list');assert.equal((await request('/api/benutzerkonto/navigation',{cookie,method:'POST',body:{...readerNav,view:'grid'}})).status,200);
    const readerHolidays=await (await request('/api/bereitschaft/feiertage',{cookie})).json();assert.deepEqual(readerHolidays.holidays,personalHolidays);assert.equal((await request('/api/bereitschaft/feiertage',{method:'POST',cookie,body:{owner:readerHolidays.owner,expectedVersion:readerHolidays.version,holidays:personalHolidays}})).status,200);
    const readerDutyPreference=await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json();assert.deepEqual(readerDutyPreference.selection,[]);assert.equal((await request('/api/bereitschaft/ressourcenauswahl',{method:'POST',cookie,body:{owner:readerDutyPreference.owner,expectedVersion:readerDutyPreference.version,selection:[]}})).status,200);
    assert.equal((await request('/api/verwaltung/benutzer',{cookie,method:'POST',body:local})).status,403);
    assert.equal((await request('/api/verwaltung/sitzungen',{cookie,method:'DELETE',body:{id:overview.sessions[0].id}})).status,403);
    for(const path of ['/api/ressourcenkalender','/api/ressourcenkalender/termine','/api/ressourcenkalender/farben','/api/pds-simulator/orders','/api/pds-simulator/persons','/api/pds-simulator/person-links','/api/pds-simulator/uploads'])assert.equal((await request(path,{cookie,method:'POST',body:{}})).status,403,`reader cannot write ${path}`);
    assert.equal((await request('/api/simulator-session',{cookie,method:'DELETE'})).status,200);
    assert.equal((await (await request('/api/simulator-session',{cookie})).json()).authenticated,false);
    ({cookie,body}=await login());assert.deepEqual((await (await request('/api/bereitschaft/feiertage',{cookie})).json()).holidays,personalHolidays);assert.deepEqual((await (await request('/api/bereitschaft/ressourcenauswahl',{cookie})).json()).selection,[]);await request('/api/simulator-session',{cookie,method:'DELETE'});
    // Fill only the isolated simulator's account budget; spoofed forwarded IPs
    // and client usernames must not bypass it. No development login is touched.
    await pool.query('DELETE FROM platform.login_limits');
    const limiter=(await import('../src/platform/store/repository.ts')).platformRepository(pool);
    await Promise.all(Array.from({length:30},()=>limiter.allowLogin({source:null,account:'service',channel:'password'})));
    const blocked=await fetch(base+'/api/simulator-session',{method:'POST',headers:{origin:base,'Content-Type':'application/json','x-forwarded-for':'192.0.2.77','x-real-ip':'192.0.2.88'},body:JSON.stringify({username:' SERVICE ',password})});
    assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'900');
    assert.equal((await pool.query("SELECT attempts FROM platform.login_limits WHERE scope='login:v2:global'")).rows[0].attempts,30);
    await pool.query("UPDATE platform.login_limits SET window_start=now()-interval '16 minutes'");
    ({cookie}=await login());await request('/api/simulator-session',{cookie,method:'DELETE'});
    // Deliberately omit the proxy in the isolated copy: handlers must enforce
    // access independently. This fixture never changes the workspace proxy.
    await stop();
    await writeFile(join(directory,'src/proxy.ts'),"import {NextResponse} from 'next/server'; export function proxy(){return NextResponse.next();} export const config={matcher:['/:path*']};");
    await start();
    const standaloneRole=randomUUID();await pool.query("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,'Fiktive direkte Endpunktrolle','dispatcher','[\"/servicehub\",\"/planboard\"]','[\"/servicehub\"]')",[standaloneRole]);
    await pool.query("UPDATE platform.app_roles SET apps='[\"/servicehub\",\"/planboard\"]',write_apps='[\"/servicehub\"]' WHERE id=$1",[standaloneRole]);
    await pool.query("UPDATE platform.users SET role='dispatcher',app_role_id=$1 WHERE id='local-service-user'",[standaloneRole]);
    await pool.query('DELETE FROM platform.login_limits');({cookie}=await login());
    for(const path of ['/api/service','/api/ressourcenkalender?from=2026-11-16&to=2026-11-23','/api/verwaltung','/api/einstellungen'])assert.equal((await request(path)).status,401,'handler session guard: '+path);
    assert.equal((await request('/api/service',{cookie})).status,200);
    assert.equal((await (await request('/api/service',{cookie})).json()).canPlan,true);
    assert.equal((await request('/api/ressourcenkalender?from=2026-11-16&to=2026-11-23',{cookie})).status,200);
    assert.equal((await request('/api/ressourcenkalender',{cookie,method:'POST',body:{}})).status,403);
    assert.equal((await request('/api/pds/rest/api/termin/update',{cookie,method:'POST',body:{}})).status,403);
    assert.equal((await request('/api/assistent/status',{cookie})).status,403);
    assert.equal((await request('/api/verwaltung',{cookie})).status,403);
    assert.equal((await request('/api/einstellungen',{cookie})).status,200,'shared personal settings do not require the account app');
    assert.equal((await request('/api/service/planung',{cookie,method:'POST',body:{}})).status,400,'permitted write reaches field validation');
    const excessive=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(9000)));c.enqueue(new TextEncoder().encode('x'.repeat(9000)));c.close();}});
    const large=await fetch(base+'/api/pds/rest/api/service/create',{method:'POST',headers:{cookie,origin:base,'Content-Type':'application/json'},body:excessive,duplex:'half'});assert.equal(large.status,413,'streamed input rejected before JSON parsing');
  }finally{await stop();await rm(directory,{recursive:true,force:true});}
}
