import {openOrderStore} from '../../src/platform/pds/simulator/order-store.ts';
import {createCipheriv,randomBytes} from 'node:crypto';
import {state as emptyIncidentState} from '../fixtures/incident-state.mjs';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,authenticate,sql,resetBrowserBudget} from './fixtures.mjs';
const artifacts=process.env.HEYELLI_BROWSER_ARTIFACTS;
test.beforeEach(resetBrowserBudget);
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){await mkdir(artifacts,{recursive:true});await page.screenshot({timeout:5000,path:join(artifacts,`${info.project.name}-${info.title.split(' ')[0]}.png`),mask:[page.locator('input[type=password]')]}).catch(()=>{});}});
// Zugeklappte Aktenzeilen (Einsatzmappe, Rücklauf, Material) öffnen; sie bleiben danach in der Sitzung offen.
async function openRow(page,label){const summary=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:label})}).locator(':scope > summary').first();await expect(summary).toBeVisible();if(!await summary.evaluate(node=>node.parentElement.open))await summary.click();}
async function enter(page,path){await page.goto(fixture.base+path);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);}
async function calendar(page,writable=true){await enter(page,'/planboard');await page.getByRole('button',{name:'Tag',exact:true}).click();await expect(page.getByRole('button',{name:/^Browser Alpha/}).first()).toBeVisible();const create=page.getByRole('button',{name:'Neuer Termin',exact:true});if(writable)await expect(create).toBeEnabled();else await expect(create).toBeDisabled();}
async function axe(page,id){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();await writeFile(join(artifacts,id+'.axe.json'),JSON.stringify({violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}));expect(result.violations.map(v=>v.id)).toEqual([]);}

test('E01 Anmeldung Abmeldung und geschützte Zurücknavigation',async({page})=>{
 await page.goto(fixture.base+'/servicehub');await expect(page).toHaveURL(/\/anmeldung/);await page.getByLabel('Benutzername',{exact:true}).fill(fixture.username);await page.getByLabel('Passwort',{exact:true}).fill(fixture.password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await expect(page).toHaveURL(/\/servicehub$/);await expect(page.getByRole('navigation',{name:'Serviceansichten',exact:true})).toBeVisible();
 await enter(page,'/benutzerkonto');await page.locator('.platform-account:visible > summary').click();await page.getByRole('button',{name:'Abmelden',exact:true}).click();await expect(page).toHaveURL(/\/anmeldung/);await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();await page.goBack();await expect(page).toHaveURL(/\/anmeldung/);await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();await page.reload();await expect(page).toHaveURL(/\/anmeldung/);expect(await page.getByRole('navigation',{name:'Serviceansichten',exact:true}).count()).toBe(0);
});
test('E02 Gemischte App-Rechte und direkter Schreibschutz',async({page,context})=>{
 await authenticate(context,fixture.mixed);await calendar(page,false);await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeDisabled();const response=await context.request.post(fixture.base+'/api/ressourcenkalender/termine',{headers:{origin:fixture.base},data:{}});expect(response.status()).toBe(403);expect((await (await context.request.get(fixture.base+'/api/service')).json()).canPlan).toBe(true);
});
test('E03 Sitzungsablauf und Widerruf sperren direkte Links',async({page,context})=>{
 await authenticate(context);
 await enter(page,'/servicehub');
 await sql("UPDATE platform.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[fixture.admin]);
 await page.reload();
 await expect(page).toHaveURL(/\/anmeldung/);

 await authenticate(context);
 await enter(page,'/servicehub');
 await sql('UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1',[fixture.admin]);
 // The live session boundary may redirect before the direct navigation finishes.
 try{
  await page.goto(fixture.base+'/planboard',{waitUntil:'domcontentloaded'});
 }catch(error){
  if(!(error instanceof Error)||!/ERR_ABORTED|interrupted by another navigation/.test(error.message))throw error;
 }
 await expect(page).toHaveURL(/\/anmeldung/);
 expect((await context.request.get(fixture.base+'/api/ressourcenkalender')).status()).toBe(401);
});

test('E04 App-Wechsel und Vor-Zurück ohne 404',async({page,context})=>{
 await authenticate(context);
 await test.step('Service und PlanBoard oeffnen',async()=>{await enter(page,'/servicehub');await page.getByRole('link',{name:'PlanBoard öffnen',exact:true}).click();await expect(page).toHaveURL(/\/planboard$/);await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeVisible();});
 await test.step('Browser zurueck zu Service',async()=>{await page.goBack();await expect(page).toHaveURL(/\/servicehub$/);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);});
 await test.step('Browser vor zu PlanBoard',async()=>{await page.goForward();await expect(page).toHaveURL(/\/planboard$/);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);});
 await test.step('PlanBoard neu laden',async()=>{await page.reload();await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeVisible();});
});
test('E05 Kalender Einfachklick Doppelklick und Fokus ohne Sprung',async({page,context})=>{
 await authenticate(context);await calendar(page);const bar=page.getByRole('button',{name:/^Browser Alpha/}).first();const box=await bar.boundingBox();await bar.click();const menu=page.getByRole('menu',{name:/Aktionen für Browser Alpha/});await expect(menu).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(bar).toBeFocused();const after=await bar.boundingBox();expect(Math.abs(box.x-after.x)).toBeLessThan(2);expect(Math.abs(box.y-after.y)).toBeLessThan(2);await bar.dblclick();await expect(page.getByRole('dialog',{name:'Termin bearbeiten',exact:true})).toBeVisible();await page.getByRole('button',{name:'Dialog schließen',exact:true}).click();await expect(bar).toBeVisible();
});
test('E06 Offline Speicherung ohne Duplikat',async({page,context,browserName})=>{
 await authenticate(context);await calendar(page);await page.getByRole('button',{name:/^Browser Beta/}).first().dblclick();const input=page.getByRole('textbox',{name:'Titel *',exact:true}),title='Browser Beta '+browserName;await input.fill(title);let disconnected=false;
 await page.route('**/api/ressourcenkalender',async route=>{if(route.request().method()!=='POST'||disconnected)return route.continue();disconnected=true;await context.setOffline(true);await route.abort('internetdisconnected');});
 await test.step('Verbindung faellt waehrend des Speicherns aus',async()=>{await page.getByRole('button',{name:'Änderung speichern',exact:true}).click();await expect(page.getByRole('region',{name:'Verbindung unterbrochen',exact:true})).toBeVisible();});
 await test.step('Wiederverbindung speichert den gesicherten Stand',async()=>{await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('.platform-bar:visible')).toHaveCount(1);await expect.poll(async()=>{const data=await (await context.request.get(fixture.base+'/api/ressourcenkalender?from='+fixture.day+'&to='+new Date(Date.parse(fixture.day+'T12:00:00Z')+86400000).toISOString().slice(0,10))).json();return data.events?.filter(e=>e.title===title).length;},{timeout:25000}).toBe(1);});

});
test('E07 Mobile Einstellungen behalten internen Verlauf',async({page,context})=>{
 await authenticate(context);await page.setViewportSize({width:390,height:844});await enter(page,'/benutzerkonto?bereich=account&seite=account%3Aprofile');await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();await page.getByRole('button',{name:'In Benutzerkonto zurück',exact:true}).click();await page.getByRole('navigation',{name:'Benutzerkonto – Navigation',exact:true}).getByRole('button',{name:'Benutzerkonto',exact:true}).click();await page.getByRole('button',{name:/Profil/}).click();await expect(page).toHaveURL(/benutzerkonto/);await page.setViewportSize({width:1280,height:900});await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('E08 Integrationsfehler zeigen keine Geheimnisse und aktivieren nichts',async({page,context})=>{
 await authenticate(context);await page.route('**/api/verwaltung/copilot',async route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktive Verbindung vorübergehend unterbrochen.'})}));await enter(page,'/einstellungen?bereich=copilot&seite=copilot%3Aconnection');await expect(page.getByRole('alert').filter({hasText:/nicht erreichbar/})).toBeVisible();expect((await sql("SELECT enabled FROM platform.copilot_settings WHERE id='central'")).rows[0].enabled).toBe(false);
});
test('K01 Sammelausgabe nichtmodal Escape Tab und Fokus',async({page,context})=>{
 await authenticate(context);await calendar(page);
 const trigger=page.getByRole('button',{name:'Mobil ausgeben ⌄',exact:true});
 const panel=page.getByRole('dialog',{name:'Serviceaufträge mobil ausgeben',exact:true});
 await test.step('Oeffnen und Escape geben den Fokus zurueck',async()=>{
  await expect(trigger).toBeEnabled();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(panel.getByRole('button',{name:'Alle Serviceaufträge heute ausgeben',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
 });
 await test.step('Bestaetigung fokussiert Zurueck und Escape schliesst',async()=>{
  await trigger.press('Enter');await panel.getByRole('button',{name:'Alle Serviceaufträge ausgeben',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Zurück',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
 });
 await test.step('Tab verlaesst das Menue vorwaerts ohne Fokusfalle',async()=>{
  await trigger.press('Enter');await expect(panel.getByRole('button').first()).toBeFocused();
  await panel.getByRole('button').last().focus();await page.keyboard.press('Tab');
  await expect(panel).toBeHidden();await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeFocused();
 });
 await test.step('Umschalt Tab verlaesst das Menue zum Ausloeser',async()=>{
  await trigger.focus();await trigger.press('Enter');await expect(panel.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
 });
});
test('K02 Kontext-Untermenü Escape und Rückkehr',async({page,context})=>{
 await authenticate(context);await calendar(page);const bar=page.getByRole('button',{name:/^Browser Alpha/}).first();await bar.press('Enter');const menu=page.getByRole('menu',{name:/Aktionen für Browser Alpha/});await expect(menu).toBeVisible();await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitem',{name:/Umbenennen/})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('textbox',{name:'Neuer Titel',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(menu.getByRole('menuitem',{name:/Umbenennen/})).toBeFocused();await page.keyboard.press('End');await page.keyboard.press('Enter');const deletion=page.getByRole('dialog',{name:'Termin löschen',exact:true});await expect(deletion.getByRole('button',{name:'Abbrechen',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(menu.getByRole('menuitem',{name:/^Löschen/})).toBeFocused();await page.keyboard.press('Escape');await expect(bar).toBeFocused();
});
test('A01 Accessibility Hell Dunkel und schmale Kontoseiten',async({page,context,browserName})=>{
 await authenticate(context);for(const theme of ['light','dark']){await enter(page,'/benutzerkonto?bereich=account&seite=account%3Aprofile');await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();await axe(page,browserName+'-profile-'+theme);}await page.setViewportSize({width:320,height:800});await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('A02 Accessibility Kalenderdialog reduzierte Bewegung und Fokusfalle',async({page,context,browserName})=>{
 await authenticate(context);await page.emulateMedia({reducedMotion:'reduce'});await calendar(page);await page.getByRole('button',{name:'Neuer Termin',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Neuen Termin anlegen',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('switch',{name:'PIM-Synchronisation',exact:true})).toHaveAccessibleDescription('Erfordert eine eingerichtete PDS-Synchronisation.');await axe(page,browserName+'-calendar-dialog');for(let n=0;n<12;n++){await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeFocused();
});

 test('E09 Verlorene Antwort nach Speichern erhaelt parallele Aenderungen',async({page,context,browserName})=>{
 await authenticate(context);await calendar(page);const data=await (await context.request.get(fixture.base+'/api/ressourcenkalender?from='+fixture.day+'&to='+new Date(Date.parse(fixture.day+'T12:00:00Z')+86400000).toISOString().slice(0,10))).json(),original=data.events.find(e=>e.title.startsWith('Browser Alpha'));
 await page.getByRole('button',{name:/^Browser Alpha/}).first().dblclick();const title='Browser Alpha '+browserName,notes='Fiktive parallele Notiz '+browserName;await page.getByRole('textbox',{name:'Titel *',exact:true}).fill(title);
 await test.step('Unabhaengige Gegenstelle aendert Notiz',async()=>{const remote=await context.request.post(fixture.base+'/api/ressourcenkalender',{headers:{origin:fixture.base},data:{operationId:crypto.randomUUID(),id:original.id,start:original.start,end:original.end,resourceIds:original.resourceIds,notes,expected:{start:original.start,end:original.end,resourceIds:original.resourceIds,notes:original.notes??''}}});expect(remote.ok()).toBe(true);});
 let lost=false;const operations=new Set();await page.route('**/api/ressourcenkalender',async route=>{if(route.request().method()!=='POST')return route.continue();operations.add(route.request().postDataJSON().operationId);if(lost)return route.continue();const response=await route.fetch();expect(response.ok()).toBe(true);lost=true;await route.abort('connectionreset');});
 await test.step('Server speichert, Antwort geht verloren',async()=>{await page.getByRole('button',{name:'Änderung speichern',exact:true}).click();await expect.poll(()=>lost).toBe(true);});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(async()=>{const current=await (await context.request.get(fixture.base+'/api/ressourcenkalender?from='+fixture.day+'&to='+new Date(Date.parse(fixture.day+'T12:00:00Z')+86400000).toISOString().slice(0,10))).json();return current.events?.filter(e=>e.id===original.id&&e.title===title&&e.notes===notes).length;},{timeout:25000}).toBe(1);expect(operations.size).toBe(1);await expect(page.locator('.calendar-save-spinner')).toHaveCount(0,{timeout:25000});
 });

test('K03 Dropdown Pfeiltasten Escape und Tab',async({page,context})=>{
 await authenticate(context);await enter(page,'/servicehub');const summary=page.locator('.platform-account:visible > summary');await expect(summary).toContainText('Lokaler Servicebenutzer');await summary.focus();await page.keyboard.press('ArrowUp');await expect(page.getByRole('button',{name:'Abmelden',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(summary).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.getByRole('link',{name:'Benutzerkonto',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(summary).toBeFocused();
});

test('K04 Ruhender Mauszeiger ersetzt keine Tastaturauswahl im App-Menue',async({page,context})=>{
 await authenticate(context);await enter(page,'/servicehub');await page.getByRole('button',{name:'HeyElli – Apps und Navigation öffnen',exact:true}).click();const search=page.getByRole('combobox',{name:'Apps und Bereiche suchen',exact:true});await search.fill('Ressourcen');const options=page.getByRole('option');await expect(options.first()).toContainText('PlanBoard');const next=options.nth(1);await next.hover();await search.focus();await search.fill('PlanBoard');await expect(search).toHaveAttribute('aria-activedescendant',await options.first().getAttribute('id'));await search.press('Enter');await expect(page).toHaveURL(/\/planboard$/);
});

test('E10 Betriebsstatus nur fuer Administratoren und ohne abgeschnittene Aktionen',async({page,context,browser})=>{
 const anonymous=await browser.newContext(),mixed=await browser.newContext();
 try{
  expect((await anonymous.request.get(fixture.base+'/api/verwaltung/betriebsstatus')).status()).toBe(401);
  await authenticate(mixed,fixture.mixed);expect((await mixed.request.get(fixture.base+'/api/verwaltung/betriebsstatus')).status()).toBe(403);
  await authenticate(context);const result=await context.request.get(fixture.base+'/api/verwaltung/betriebsstatus',{headers:{'X-HeyElli-Request-ID':'untrusted-value'}});expect(result.status()).toBe(200);expect(result.headers()['x-heyelli-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect((await context.request.post(fixture.base+'/api/verwaltung/betriebsstatus',{headers:{origin:'https://untrusted.invalid'},data:{id:'11111111-1111-4111-8111-111111111111'}})).status()).toBe(403);
  await enter(page,'/einstellungen?bereich=system&seite=system%3Aoperations');await expect(page.getByRole('alert').filter({hasText:'Kein aktuelles Lebenszeichen. Überwachungsdienst und Datenbank prüfen lassen.'})).toBeVisible();
  const alarmId='11111111-1111-4111-8111-111111111111',snapshot={database:true,web:true,workerAge:1,workerHealthy:true,queueAge:0,unknown:1,failed:0,uncertain:0,requests:20,failures:0,slow:0,meanMs:10,freeBytes:1024**3,freeRatio:.2,secrets:true};
  await sql("INSERT INTO platform.operation_monitor VALUES('local',now(),$1::jsonb)",[JSON.stringify(snapshot)]);
  await sql("INSERT INTO platform.operation_alarms(code,active,incident_id,first_seen,last_seen) VALUES('mailUnknown',true,$1,now(),now())",[alarmId]);
  try{for(const width of [1280,390]){await page.setViewportSize({width,height:900});await enter(page,'/einstellungen?bereich=system&seite=system%3Aoperations');await expect(page.getByText('Unklarer Versandstatus',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Vorgehen bei unklarem Ergebnis',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
   await page.getByRole('button',{name:'Bestätigen',exact:true}).click();await expect(page.getByRole('button',{name:'Bestätigt',exact:true})).toBeDisabled();
   expect((await sql('SELECT active FROM platform.operation_alarms WHERE incident_id=$1',[alarmId])).rows[0].active).toBe(true);
  }finally{await sql('DELETE FROM platform.audit_events WHERE target_id=$1',[alarmId]);await sql('DELETE FROM platform.operation_alarms WHERE incident_id=$1',[alarmId]);await sql("DELETE FROM platform.operation_monitor WHERE id='local'");}
 }finally{await anonymous.close();await mixed.close();}
});

test('E11 Sicherheit separat mit alten Links und interner Navigation',async({page,context})=>{
 await authenticate(context);
 await enter(page,'/einstellungen?bereich=system&seite=system%3Asecurity');await expect(page).toHaveURL(/bereich=security/);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await enter(page,'/einstellungen?bereich=system');
  const general=page.getByRole('navigation',{name:'Allgemein – Unterbereiche',exact:true});await expect(general.getByRole('button')).toHaveCount(2);await expect(general.getByRole('button',{name:'Darstellung',exact:true})).toBeVisible();await expect(general.getByRole('button',{name:'Info',exact:true})).toBeVisible();
  await enter(page,'/einstellungen?bereich=security');const areas=page.getByRole('navigation',{name:'Sicherheit – Unterbereiche',exact:true});
  for(const label of ['Sitzungsdauer','Geschützte Zugangsdaten','Browser-Schutz','Daten & Aufbewahrung','Betriebsstatus'])await expect(areas.getByRole('button',{name:label,exact:true})).toBeVisible();
  await areas.getByRole('button',{name:'Sitzungsdauer',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Sitzungsdauer (Minuten)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'In Einstellungen zurück',exact:true}).click();await expect(areas).toBeVisible();await page.getByRole('button',{name:'In Einstellungen vorwärts',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Sitzungsdauer (Minuten)',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }
 await page.setViewportSize({width:1280,height:900});await page.getByRole('combobox',{name:'Einstellungen suchen',exact:true}).fill('Zugangsdaten');await expect(page.getByRole('navigation',{name:'Einstellungen – Navigation',exact:true}).getByRole('option',{name:/^Sicherheit/})).toBeVisible();
 await enter(page,'/einstellungen?bereich=system&seite=system%3Adata');await expect(page).toHaveURL(/bereich=security&seite=security%3Adata/);
});

test('E12 SharePoint bleibt gesperrt bis Freigabe und wiederholt Upload ohne Duplikat',async({page,context,browser,browserName})=>{
 test.setTimeout(120000);await authenticate(context);
 const readerId='sharepoint-reader-'+crypto.randomUUID(),readerContext=await browser.newContext();
 await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Dokumentleser','reader',true)",[readerId]);
 const config={tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',secret:'fictitious-sharepoint-secret',siteId:'fictional.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444',driveId:'drive-test',rootId:'root'};
 const fileName='Fiktiver Bericht '+browserName+'.txt';let currentVersion;
 async function change(input){currentVersion=(await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json()).version;return context.request.post(fixture.base+'/api/verwaltung/sharepoint',{headers:{origin:fixture.base},data:{...input,version:currentVersion}});}
 try{
  await test.step('Einrichtung und Secret bleiben geschuetzt',async()=>{
   expect((await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json()).enabled).toBe(false);
   await enter(page,'/einstellungen?bereich=sharepoint&seite=sharepoint%3Aconnection');for(const [label,key]of [['Tenant-ID','tenantId'],['Client-ID','clientId'],['Site-ID','siteId'],['Bibliotheks-ID','driveId'],['Stammordner-ID','rootId'],['Client-Secret','secret']])await page.getByLabel(label,{exact:true}).fill(config[key]);
   await page.getByRole('button',{name:'Zugang geschützt speichern',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Zugang geschützt gespeichert.'})).toBeVisible();await expect(page.getByLabel('Client-Secret',{exact:true})).toHaveValue('');await page.reload();await expect(page.getByLabel('Tenant-ID',{exact:true})).toHaveValue(config.tenantId);await expect(page.getByLabel('Client-Secret',{exact:true})).toHaveValue('');for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
   const state=await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json();expect(JSON.stringify(state)).not.toContain(config.secret);expect(state.enabled).toBe(false);
   expect((await change({action:'save',...config,secret:'invalid-sharepoint'})).ok()).toBe(true);await enter(page,'/einstellungen?bereich=sharepoint&seite=sharepoint%3Arelease');await page.getByRole('button',{name:'Verbindung prüfen',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Microsoft-Anmeldung abgelehnt'})).toBeVisible();expect((await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json()).enabled).toBe(false);
  });
  await test.step('Test aktiviert nichts, Freigabe erfordert Bestaetigung',async()=>{
   expect((await change({action:'save',...config})).ok()).toBe(true);await enter(page,'/einstellungen?bereich=sharepoint&seite=sharepoint%3Arelease');await page.getByRole('button',{name:'Verbindung prüfen',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Website und Ordner erfolgreich gelesen.'})).toBeVisible();expect((await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json()).enabled).toBe(false);
   await page.getByRole('switch',{name:'SharePoint freigeben',exact:true}).click();const dialog=page.getByRole('alertdialog',{name:'SharePoint freigeben?',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'SharePoint freigeben',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.getByRole('switch',{name:'SharePoint freigeben',exact:true})).toBeChecked();
  });
  const overview=await (await context.request.get(fixture.base+'/api/service')).json(),customer=overview.customers[0],documentPath='/api/service/dokumente?'+new URLSearchParams({kind:'customer',id:customer.id});
  await test.step('Service-Leserecht erlaubt keinen Upload oder Einrichtungszugriff',async()=>{
   await authenticate(readerContext,readerId);expect((await readerContext.request.get(fixture.base+documentPath)).status()).toBe(200);expect((await readerContext.request.get(fixture.base+'/api/verwaltung/sharepoint')).status()).toBe(403);
   expect((await readerContext.request.post(fixture.base+documentPath,{headers:{origin:fixture.base,'Content-Type':'application/octet-stream','X-File-Name':'Fiktiv.txt','Idempotency-Key':crypto.randomUUID()},data:'Fiktiv'})).status()).toBe(403);
  });
  await test.step('Verlorene Uploadantwort behaelt Datei und legt keine zweite an',async()=>{
   await enter(page,'/servicehub?'+new URLSearchParams({ansicht:'files',akte:'customer',id:customer.id}));const documents=page.getByRole('region',{name:'SharePoint-Dokumente',exact:true});await documents.getByLabel('Datei auswählen · bis 8 MiB',{exact:true}).setInputFiles({name:fileName,mimeType:'text/plain',buffer:Buffer.alloc(3*1024*1024,65)});let lost=false;
   await page.route('**/api/service/dokumente?*',async route=>{if(route.request().method()!=='POST'||lost)return route.continue();lost=true;if(browserName==='webkit')return route.continue({headers:{...route.request().headers(),'X-Fixture-Lose-Response':'yes'}});const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('internetdisconnected');});
   await documents.getByRole('button',{name:'Hochladen',exact:true}).click();await expect(documents.getByRole('alert')).toBeVisible();await expect(documents.getByRole('button',{name:'Hochladen',exact:true})).toBeEnabled();await documents.getByRole('button',{name:'Hochladen',exact:true}).click();await expect(documents.getByRole('link',{name:fileName+' ↗',exact:true})).toBeVisible();expect((await sql('SELECT count(*)::int n FROM platform.sharepoint_uploads WHERE display_name=$1',[fileName])).rows[0].n).toBe(1);
   for(const width of [1280,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  });
 }finally{
  await change({action:'mode',enabled:false});await sql("DELETE FROM platform.audit_events WHERE action='sharepoint.document.uploaded' AND target_id IN (SELECT id::text FROM platform.sharepoint_uploads WHERE display_name=$1)",[fileName]);await sql('DELETE FROM platform.sharepoint_uploads WHERE display_name=$1',[fileName]);await readerContext.close();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[readerId]);await sql('DELETE FROM platform.users WHERE id=$1',[readerId]);
 }
});

test('E13 Service Aktenauswahl Fokus und schmale Ansicht in beiden Themes',async({page,context,browserName})=>{
 await authenticate(context);const data=await (await context.request.get(fixture.base+'/api/service')).json();
 const unit=data.objects.find(item=>item.type==='TECHNISCHE_EINHEIT'&&!data.objects.some(child=>child.parentId===item.id));expect(unit).toBeTruthy();
 await enter(page,'/servicehub?ansicht=files&akte=object&id='+encodeURIComponent(unit.id));
 const file=page.getByRole('complementary',{name:'Akte',exact:true});
 await expect(file.getByRole('heading',{name:unit.name,exact:true})).toBeVisible();
 await expect(file.getByText('Keine untergeordneten Einheiten hinterlegt.',{exact:true})).toHaveCount(0);
 const selection=page.getByRole('region',{name:'Serviceübersicht',exact:true}).getByRole('button',{name:new RegExp(unit.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});
 await expect(selection).toHaveAttribute('aria-pressed','true');
 await expect(selection).toHaveAttribute('data-slot','button');
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);
  await expect(file.getByRole('group',{name:'Aktennavigation',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const masterBox=await page.getByRole('region',{name:'Serviceübersicht',exact:true}).boundingBox(),fileBox=await file.boundingBox();expect(fileBox.width).toBeGreaterThan(masterBox.width);
  await page.screenshot({path:join(artifacts,`${browserName}-service-${theme}.png`),mask:[page.locator('input[type=password]')]});
  await axe(page,browserName+'-service-'+theme);
 }
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('region',{name:'Serviceübersicht',exact:true})).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:join(artifacts,`${browserName}-service-mobile.png`),mask:[page.locator('input[type=password]')]});
 await file.getByRole('heading',{name:unit.name,exact:true}).press('Escape');await expect(file).toHaveCount(0);
 await expect(selection).toBeFocused();
 const trigger=page.getByRole('button',{name:'Suche öffnen',exact:true});
 await trigger.click();
 const search=page.getByRole('combobox',{name:'Suche',exact:true});
 await expect(search).toBeVisible();
 await expect(search).toHaveAttribute('data-slot','input');
 await search.focus();
 await expect(search).toBeFocused();
 await page.getByRole('button',{name:'Cockpit',exact:true}).click();
 await expect(page.getByRole('region',{name:'Aufträge',exact:true}).getByRole('link',{name:/Ohne Termin/})).toBeVisible();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:join(artifacts,`${browserName}-service-cockpit.png`),mask:[page.locator('input[type=password]')]});
});

test('E14 Persönliches Ausblenden bleibt nach erneutem Öffnen erhalten und ist wiederherstellbar',async({page,context,browser})=>{
 await authenticate(context);const endpoint=fixture.base+'/api/service/sichtbarkeit',overview=await (await context.request.get(fixture.base+'/api/service')).json();
 const unit=overview.objects.find(item=>item.type==='TECHNISCHE_EINHEIT'&&item.parentId),parent=overview.objects.find(item=>item.id===unit.parentId),customer=overview.customers.find(item=>item.id===parent.customerId);expect(customer).toBeTruthy();
 const other=await browser.newContext(),reopened=await browser.newContext();
 try{
  expect((await other.request.get(endpoint)).status()).toBe(401);await authenticate(other,fixture.mixed);const preferences=await (await context.request.get(endpoint)).json();
  expect((await other.request.post(endpoint,{headers:{origin:fixture.base},data:{...preferences,owner:fixture.admin,kind:'object',id:unit.id,hidden:true}})).status()).toBe(409);
  expect((await context.request.post(endpoint,{headers:{origin:'https://untrusted.invalid'},data:{...preferences,kind:'object',id:unit.id,hidden:true}})).status()).toBe(403);
  await enter(page,'/servicehub?ansicht=files&akte=object&id='+encodeURIComponent(unit.id));await page.getByRole('button',{name:'Ausblenden',exact:true}).click();await expect(page.getByRole('button',{name:'Wieder einblenden',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Wieder einblenden',exact:true})).toBeVisible();
  await authenticate(reopened);const second=await reopened.newPage();await second.goto(fixture.base+'/servicehub?ansicht=files');await expect(second.getByRole('button',{name:/Ausgeblendete Einträge · 1/})).toBeVisible();
  const others=await (await other.request.get(endpoint)).json();expect(others.hidden).toEqual([]);
  await page.getByRole('button',{name:/Ausgeblendete Einträge · 1/}).click();await expect(page.getByRole('button',{name:unit.name+' wieder einblenden',exact:true})).toBeVisible();
  await page.getByRole('button',{name:unit.name+' wieder einblenden',exact:true}).click();await expect(page.getByText('Keine ausgeblendeten Einträge.',{exact:true})).toBeVisible();
  // Separate writes from two tabs must not replace each other's selections.
  const save=async(ctx,kind,id,hidden)=>{const own=await (await ctx.request.get(endpoint)).json();return ctx.request.post(endpoint,{headers:{origin:fixture.base},data:{owner:own.owner,source:own.source,kind,id,hidden}});};
  const results=await Promise.all([save(context,'object',unit.id,true),save(reopened,'customer',customer.id,true)]);expect(results.map(row=>row.status())).toEqual([200,200]);
  await enter(page,'/servicehub?ansicht=files');await expect(page.getByRole('button',{name:/Ausgeblendete Einträge · 2/})).toBeVisible();
  await expect(page.getByRole('region',{name:'Serviceübersicht',exact:true}).getByText(customer.name,{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/Ausgeblendete Einträge · 2/}).click();await page.getByRole('button',{name:customer.name+' wieder einblenden',exact:true}).click();
  await page.getByRole('button',{name:/Ausgeblendete Einträge · 1/}).click();await expect(page.getByRole('region',{name:'Serviceübersicht',exact:true}).getByRole('button',{name:new RegExp(unit.name)})).toHaveCount(0);
  await page.getByRole('button',{name:/Ausgeblendete Einträge · 1/}).click();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:unit.name+' wieder einblenden',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await expect(page.getByText('Keine ausgeblendeten Einträge.',{exact:true})).toBeVisible();
  await enter(page,'/servicehub?ansicht=files&akte=object&id='+encodeURIComponent(parent.id));
  let lost=false;await page.route('**/api/service/sichtbarkeit',async route=>{if(route.request().method()!=='POST'||lost)return route.continue();lost=true;await route.fetch();await route.abort('internetdisconnected');});
  await page.getByRole('button',{name:'Ausblenden',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Änderung konnte nicht bestätigt'})).toBeVisible();await expect(page.getByRole('button',{name:'Ausblenden',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Ausblenden',exact:true}).click();await expect(page.getByRole('button',{name:'Wieder einblenden',exact:true})).toBeVisible();expect((await (await context.request.get(endpoint)).json()).hidden).toEqual([{kind:'object',id:parent.id}]);
  await page.getByRole('button',{name:'Wieder einblenden',exact:true}).click();
 }finally{await sql('DELETE FROM platform.service_hidden_entries WHERE user_id=ANY($1::text[])',[[fixture.admin,fixture.mixed]]);await other.close();await reopened.close();}
});

test('E15 Aktennavigation hält vier Symbole stabil und zeigt Auftragsbezüge',async({page,context,browserName})=>{
 await authenticate(context);const data=await (await context.request.get(fixture.base+'/api/service')).json(),unit=data.objects.find(row=>row.type==='TECHNISCHE_EINHEIT'&&row.parentId),parent=data.objects.find(row=>row.id===unit.parentId),customer=data.customers.find(row=>row.id===parent.customerId);
 await page.route('**/api/service?*',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('id')!==unit.id)return route.continue();const response=await route.fetch(),value=await response.json();if(url.searchParams.get('part')==='base')value.webLink='https://pds.example.invalid/records/toolbar';else if(value.extras)value.extras.contracts=[...(value.extras.contracts??[]),{id:'fictional-toolbar-contract',name:'Fiktiver Vertrag',description:'',bma:{links:[{aid:17,number:'FIKTIV-17',name:'Fiktive Anlage',url:'https://bma.example.invalid/portal.php?action=anlagen_add&aid=17'}]}}];await route.fulfill({response,json:value});});
 await enter(page,'/servicehub?ansicht=files&akte=object&id='+encodeURIComponent(unit.id));
 const file=page.getByRole('complementary',{name:'Akte',exact:true}),bar=file.getByRole('group',{name:'Aktenaktionen',exact:true}),navigation=bar.getByRole('group',{name:'Aktennavigation',exact:true});
 const customerButton=navigation.getByRole('button',{name:'Kundenakte '+customer.name+' öffnen',exact:true}),objectButton=navigation.getByRole('button',{name:/^Objekt:/}),unitButton=navigation.getByRole('button',{name:/^Einheit:/});
 const orderButton=navigation.getByRole('button',{name:'Auftrag',exact:true});
 const pds=bar.getByRole('link',{name:'In PDS öffnen',exact:true}),cloud=bar.getByRole('link',{name:/In BMACloud öffnen.*Fiktive Anlage/});
 await expect(cloud).toBeVisible();await expect(pds).toHaveAttribute('href','https://pds.example.invalid/records/toolbar');await expect(cloud).toHaveAttribute('href','https://bma.example.invalid/portal.php?action=anlagen_add&aid=17');await expect(bar.getByRole('button',{name:'PDS-Link kopieren',exact:true})).toBeVisible();
 await expect(bar.getByRole('button',{name:'Zur Übersicht',exact:true})).toHaveCount(0);
 await expect(navigation.getByRole('button')).toHaveText(['','','','']);
 await expect(orderButton).toBeDisabled();
 expect((await navigation.boundingBox()).x).toBeLessThan((await pds.boundingBox()).x);
 const segmentPositions=()=>Promise.all([customerButton,objectButton,unitButton,orderButton].map(async button=>{const {x,width}=await button.boundingBox();return {x,width};}));
 const positions=await segmentPositions();
 for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);await page.screenshot({path:join(artifacts,`${browserName}-service-toolbar-${theme}.png`),mask:[page.locator('input[type=password]')]});}

 await objectButton.press('ArrowDown');
 const objectMenu=navigation.getByRole('listbox',{name:'Objekt',exact:true});
 await expect(objectMenu.getByRole('option')).toHaveCount(2);
 await expect(objectMenu.getByRole('option',{name:parent.name,exact:true})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(objectButton).toBeFocused();
 await expect(file.getByRole('heading',{name:unit.name,exact:true})).toBeVisible();
 await objectButton.press('ArrowDown');
 await page.keyboard.press('Enter');
 await expect(file.getByRole('heading',{name:parent.name,exact:true})).toBeVisible();
 await expect(navigation).toHaveAttribute('data-section','object');
 expect(await segmentPositions()).toEqual(positions);

 await customerButton.click();
 await expect(customerButton).toHaveAttribute('aria-current','page');
 expect(await segmentPositions()).toEqual(positions);
 await unitButton.click();
 const unitMenu=navigation.getByRole('listbox',{name:'Einheit',exact:true});
 await expect(unitMenu.getByRole('option')).toHaveCount(3);
 await unitMenu.getByRole('option',{name:'Hebeanlage · Beispielhaus Süd',exact:true}).click();
 await expect(file.getByRole('heading',{name:'Hebeanlage',exact:true})).toBeVisible();
 await expect(navigation).toHaveAttribute('data-section','unit');
 expect(await segmentPositions()).toEqual(positions);

 await page.goBack();
 await expect(customerButton).toHaveAttribute('aria-current','page');
 await page.setViewportSize({width:390,height:844});
 await expect(navigation).toBeVisible();
 await expect(bar.getByRole('button',{name:'Ausblenden',exact:true})).toBeVisible();
 await unitButton.click();
 await expect(unitMenu).toBeVisible();
 expect((await unitMenu.boundingBox()).x+(await unitMenu.boundingBox()).width).toBeLessThanOrEqual(390);
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:join(artifacts,`${browserName}-service-toolbar-mobile.png`),mask:[page.locator('input[type=password]')]});
 await customerButton.press('Escape');
 const hidden=page.getByRole('button',{name:'Ausgeblendete Einträge',exact:true});
 await expect(page.getByRole('region',{name:'Serviceübersicht'}).getByRole('button',{name:'Kundenakte '+customer.name+' öffnen',exact:true})).toBeFocused();
 await expect(hidden.locator('xpath=ancestor::header').getByRole('group',{name:'Kunden filtern'})).toBeVisible();
 await expect(hidden).toHaveText('');

 await enter(page,'/servicehub?ansicht=orders&akte=order&id=sim-order-1');
 await expect(navigation.getByRole('button')).toHaveText(['','','','']);
 await expect(orderButton).toHaveAttribute('aria-current','page');
 await expect(navigation).toHaveAttribute('data-section','order');
 await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeFocused();
 await objectButton.press('ArrowDown');
 const linkedObject=objectMenu.getByRole('option',{name:'Beispielhaus Nord Passend zum Auftrag',exact:true});
 await expect(linkedObject).toBeFocused();
 await expect(objectMenu).toHaveAttribute('data-slot','popover-content');
 await expect(objectMenu.getByRole('option',{name:'Beispielhaus Süd',exact:true})).toBeVisible();
 await page.keyboard.press('Enter');
 await expect(file.getByRole('heading',{name:'Beispielhaus Nord',exact:true})).toBeVisible();
 await expect(orderButton).not.toHaveAttribute('aria-current','page');
 await orderButton.click();
 await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeVisible();
 await unitButton.click();
 const linkedUnit=unitMenu.getByRole('option',{name:'Heizungsanlage · Beispielhaus Nord Passend zum Auftrag',exact:true});
 await expect(linkedUnit).toBeVisible();
 await expect(unitMenu).toHaveAttribute('data-slot','popover-content');
 await expect(unitMenu.getByText('Passend zum Auftrag',{exact:true})).toHaveCount(1);
 await expect(unitMenu.getByText('Passend zum Auftrag',{exact:true})).toHaveAttribute('data-option-detail','true');
 await expect(unitMenu.getByRole('separator')).toBeVisible();
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);
  await page.mouse.move(0,0);
  await page.screenshot({path:join(artifacts,`${browserName}-service-unit-menu-${theme}.png`)});
 }
 await linkedUnit.click();
 await expect(file.getByRole('heading',{name:unit.name,exact:true})).toBeVisible();
 await expect(orderButton).not.toHaveAttribute('aria-current','page');
 await page.reload();
 await orderButton.click();
 await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeVisible();
 await expect(orderButton).toHaveAttribute('aria-current','page');

 await enter(page,'/servicehub?ansicht=files&akte=object&id=sim-object-4');
 await expect(unitButton).toBeDisabled();
 await objectButton.click();
 await expect(objectMenu.getByRole('option',{name:'Demohaus ohne technische Einheit',exact:true})).toBeVisible();
});

test('E16 Kostenträgersuche findet Objekt Einheit und Vertragswerte ohne Akte vorher zu öffnen',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=files');
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const search=page.getByRole('combobox',{name:'Suche',exact:true});
 const heading=page.getByRole('navigation',{name:'Serviceansichten',exact:true}).getByRole('button',{name:'Alle Aufträge',exact:true});
 const heating=overview.getByRole('button',{name:/Heizungsanlage/});
 const northernSite=overview.getByRole('button').filter({has:page.getByText('Beispielhaus Nord',{exact:true})});
 const emptyOrders=overview.getByText('Keine passenden Aufträge.',{exact:true});
 const costError=page.getByRole('alert').filter({hasText:'Kostenträger konnten nicht vollständig'});
 async function searchFor(term){
  await search.fill(term);
  await expect.poll(()=>new URL(page.url()).searchParams.get('q')).toBe(term);
 }

 await test.step('Objekt und Einheit nach eigenen Kostendaten finden',async()=>{
  await page.getByRole('button',{name:'Suche öffnen',exact:true}).click();
  await searchFor('SIM-KTR-100');
  await expect(heating.getByText('SIM-KTR-100',{exact:true})).toBeVisible();
  await expect(heating.getByText('Beispielanlagen – Betrieb',{exact:false})).toBeVisible();
  await expect(northernSite).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Kostenträger werden durchsucht'})).toHaveCount(0);
  await expect(overview.getByText('Keine passenden Kunden oder technischen Einheiten.',{exact:true})).toHaveCount(0);
  await expect(overview.getByText('Wartung',{exact:true})).toHaveCount(0);
  await searchFor('SIM-KST-100');
  await expect(northernSite).toBeVisible();
 });
 await test.step('Wartungs- und Rechnungskostenträger unterscheiden',async()=>{
  await searchFor('SIM-KTR-200');
  await expect(overview.getByText('Wartung',{exact:true}).first()).toBeVisible();
  await expect(overview.getByText('Rechnung',{exact:true})).toHaveCount(0);
  await searchFor('Beispielvertrag Rechnung');
  await expect(overview.getByText('Rechnung',{exact:true}).first()).toBeVisible();
  await expect(overview.getByText('Wartung',{exact:true})).toHaveCount(0);
  await page.screenshot({path:join(artifacts,`cost-hits-${browserName}.png`),mask:[page.locator('input[type=password]')]});
 });
 await test.step('Kostenbasierte Suche in der schmalen Auftragsliste',async()=>{
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await heading.click();
  await expect(heading).toHaveAttribute('aria-current','page');
  await searchFor('SIM-KTR-300');
  await expect(overview.getByRole('button',{name:/SIM-SA-1000/}).first()).toBeVisible();
  await searchFor('unbekannterkostentraeger');
  await expect(emptyOrders).toBeVisible();
 });
 await test.step('Fehlenden Kostenkatalog anzeigen und danach nachladen',async()=>{
  await page.route(url=>url.pathname==='/api/service'&&url.searchParams.get('part')==='cost-catalog',
   route=>route.abort('internetdisconnected'));
  await page.reload();
  await expect(costError).toBeVisible();
  await expect(emptyOrders).toHaveCount(0);
  await expect(search).toBeEnabled();
  await page.unrouteAll({behavior:'wait'});
  await costError.getByRole('button',{name:'Erneut versuchen',exact:true}).click();
  await expect(emptyOrders).toBeVisible();
  await expect(costError).toHaveCount(0);
 });
});

test('E17 Wartungen zeigen echte Fälligkeit und nur gesperrte Auftragserzeugung',async({page,context,browser,browserName})=>{
 await authenticate(context);const before=await (await context.request.get(fixture.base+'/api/service')).json();let writes=0;
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(route.request().method()==='POST'&&(url.pathname.startsWith('/api/service')||url.pathname.startsWith('/api/pds/')))writes++;await route.continue();});
 await enter(page,'/servicehub?ansicht=maintenance');
 const panel=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const details=page.getByRole('complementary',{name:'Wartungsakte',exact:true});
 const categories=panel.getByRole('group',{name:'Wartungskategorien',exact:true});
 const row=title=>panel.getByRole('button').filter({has:page.getByText(title,{exact:true})});
 const heater=row('Wartung Heizungsanlage'),building=row('Wartung Gebäude Nord');
 const action=details.getByRole('button',{name:'Auftrag erzeugen',exact:true});
 const hint=panel.getByRole('status').filter({hasText:'Wartungen werden geladen'});
 await expect(hint).toHaveCount(0);
 await expect(panel.getByText('Fällige Wartungen',{exact:true})).toBeVisible();
 await expect(page.getByText('Wartung auswählen',{exact:true})).toBeVisible();
 await expect(heater).toContainText('Überfällig');
 const separator=await building.locator('..').evaluate(element=>{
  const {content,blockSize}=getComputedStyle(element,'::before');return {content,blockSize};
 });
 expect(separator).toEqual({content:'""',blockSize:'1px'});
 await heater.click();
 await expect(heater).toHaveAttribute('aria-pressed','true');
 const heading=details.getByRole('heading',{name:'Wartung Heizungsanlage',exact:true});
 await expect(heading).toBeVisible();
 await expect(details.getByText('TE-Nummer',{exact:true})).toBeVisible();
 await expect(details.getByText('SIM-TE-101',{exact:true})).toBeVisible();
 await expect(details.getByText('Anlage prüfen und Wartung dokumentieren.',{exact:true})).toBeVisible();
 await heater.press('Enter');
 await expect(heading).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(heater).toBeFocused();
 await page.keyboard.press('ArrowDown');
 await expect(building).toBeFocused();
 await expect(details.getByText('Keine technische Einheit zugeordnet',{exact:true})).toBeVisible();
 await page.keyboard.press('ArrowUp');
 await expect(heater).toBeFocused();

 await action.click();
 const preview=page.getByRole('dialog',{name:'Auftrag vorbereiten',exact:true});
 await expect(preview).toBeVisible();
 await expect(preview.getByRole('button',{name:'Auftrag erzeugen',exact:true})).toBeDisabled();
 await expect(preview.getByRole('status').filter({hasText:'Vorschau: Es wird kein Auftrag angelegt und keine Fälligkeit verändert.'})).toBeVisible();
 await preview.locator('form').evaluate(form=>form.requestSubmit());
 expect(writes).toBe(0);
 await page.keyboard.press('Escape');
 await expect(preview).toBeHidden();
 await expect(action).toBeFocused();

 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>element.dataset.theme=value,theme);
  await axe(page,`maintenance-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`maintenance-${browserName}-${theme}.png`)});
 }
 const filterToggle=panel.getByRole('button',{name:'Wartungsfilter',exact:true});
 await expect(filterToggle).toHaveAttribute('aria-pressed','true');
 await filterToggle.click();
 await expect(panel.getByText('Filter pausiert',{exact:false})).toBeVisible();
 await expect(row('Abgeschlossene Wartung Hebeanlage')).toContainText('Vertrag nicht aktiv');
 await filterToggle.click();
 await expect(row('Abgeschlossene Wartung Hebeanlage')).toHaveCount(0);

 const filterOptions=panel.getByRole('button',{name:'Filteroptionen',exact:true});
 const due=panel.getByRole('button',{name:/^Fälligkeit: /});
 await filterOptions.click();
 await expect(due).toHaveAttribute('data-slot','button');
 await due.press('ArrowDown');
 await expect(panel.getByRole('option',{name:'Fällig bis heute',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(due).toBeFocused();
 await due.click();
 await panel.getByRole('option',{name:'Bevorstehend',exact:true}).click();
 await expect(row('Wartung Lüftungsanlage')).toBeVisible();
 await expect(heater).toHaveCount(0);
 await categories.getByRole('button',{name:'Prüfen',exact:true}).click();
 await row('Wartung Sicherheitsbeleuchtung').click();
 await expect(action).toBeDisabled();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await details.getByRole('button',{name:/Zurück zu Wartungen/}).click();
 await expect(row('Wartung Sicherheitsbeleuchtung')).toBeFocused();
 await categories.getByRole('button',{name:'Fällig',exact:true}).click();
 const search=page.getByRole('combobox',{name:'Suche',exact:true});
 await page.getByRole('button',{name:'Suche öffnen',exact:true}).click();
 await search.fill('Musterwerk');
 const suggestion=page.getByRole('listbox',{name:'Suchvorschläge',exact:true}).getByRole('option',{name:/Wartung Brandmeldeanlage/});
 await expect(suggestion).toBeVisible();
 await search.press('ArrowDown');
 await search.press('Enter');
 await expect(details.getByRole('heading',{name:'Wartung Brandmeldeanlage',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(row('Wartung Brandmeldeanlage')).toBeFocused();

 await page.route('**/api/service?*',async route=>new URL(route.request().url()).searchParams.get('part')==='maintenance'?route.abort('internetdisconnected'):route.continue());
 await page.reload();
 await expect(panel.getByRole('alert').filter({hasText:'Wartungen konnten nicht vollständig'})).toBeVisible();
 await expect(search).toHaveValue('Musterwerk');
 await expect(panel.getByText('Keine passenden Wartungen.',{exact:true})).toHaveCount(0);
 await page.unroute('**/api/service?*');
 await panel.getByRole('button',{name:'Erneut laden',exact:true}).click();
 await expect(row('Wartung Brandmeldeanlage')).toBeVisible();
 expect((await (await context.request.get(fixture.base+'/api/service')).json()).orders.length).toBe(before.orders.length);expect(writes).toBe(0);
 const reader=await browser.newContext(),original=(await sql('SELECT r.id,r.write_apps FROM platform.app_roles r JOIN platform.users u ON u.app_role_id=r.id WHERE u.id=$1',[fixture.mixed])).rows[0];
 try{expect((await reader.request.get(fixture.base+'/api/service?part=maintenance&id=sim-unit-1&revision='+before.costRevision)).status()).toBe(401);await sql("UPDATE platform.app_roles SET write_apps='[]'::jsonb WHERE id=$1",[original.id]);await authenticate(reader,fixture.mixed);const readPage=await reader.newPage();await readPage.goto(fixture.base+'/servicehub?ansicht=maintenance');await readPage.getByRole('button',{name:/Wartung Heizungsanlage/}).click();await expect(readPage.getByRole('button',{name:'Auftrag erzeugen',exact:true})).toBeDisabled();}
 finally{await sql('UPDATE platform.app_roles SET write_apps=$1::jsonb WHERE id=$2',[JSON.stringify(original.write_apps),original.id]);await reader.close();}
});

test('E18 Einsatzmappe speichert Verweise und erhaelt Auswahl bei Ausfall ohne Dateikopien',async({page,context,browser,browserName})=>{
 test.setTimeout(90000);await authenticate(context);
 const order='sim-order-1',api='/api/service/einsatzmappe',fileUrl='/servicehub?ansicht=orders&akte=order&id='+order;
 let revision,scope,key;
 await test.step('Aktuelle Akte und PDS-Auswahl laden',async()=>{
  await enter(page,fileUrl);const pack=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Einsatzmappe'})}).first();await expect(pack).toBeVisible();await openRow(page,'Einsatzmappe');await expect(pack).toHaveJSProperty('open',true);await pack.getByRole('button',{name:'Dokumente auswählen',exact:true}).click();await expect(pack.getByRole('switch',{name:/Einsatzhinweise Heizung/})).toBeEnabled();
  const core=await (await context.request.get(fixture.base+'/api/service?kind=order&id='+order+'&part=base')).json();revision=core.sourceRevision;
  const selection=await (await context.request.get(fixture.base+api+'?'+new URLSearchParams({order,revision,section:'selection'}))).json();scope=selection.scope;
  const catalog=await (await context.request.get(fixture.base+api+'?'+new URLSearchParams({order,revision,section:'pds'}))).json();key=catalog.items[0].key;
  if(selection.selection.find(item=>item.key===key)?.selected)await pack.getByRole('switch',{name:/Einsatzhinweise Heizung/}).click();await expect(pack.getByRole('switch',{name:/Einsatzhinweise Heizung/})).not.toBeChecked();
  await pack.getByRole('switch',{name:/Einsatzhinweise Heizung/}).click();await expect(pack.getByRole('switch',{name:/Einsatzhinweise Heizung/})).toBeChecked();await page.reload();await expect(pack).toHaveJSProperty('open',true);await expect(page.getByText('1 ausgewählt',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Einsatzhinweise Heizung.txt ↗',exact:true})).toBeVisible();
  const rows=(await sql('SELECT reference FROM platform.dispatch_pack_refs WHERE scope_key=$1 AND selected',[scope])).rows;expect(rows.length).toBe(1);expect(Object.keys(rows[0].reference).sort()).toEqual(['id','library','provider','target']);
 });
 await test.step('Download prueft Aktenzuordnung und Schreibrechte',async()=>{
  const url=fixture.base+api+'/dokument?'+new URLSearchParams({order,revision,key});const download=await context.request.get(url);expect(download.status()).toBe(200);expect(await download.text()).toMatch(/fiktiv/i);expect((await context.request.get(fixture.base+api+'/dokument?'+new URLSearchParams({order:'sim-order-2',revision,key}))).status()).toBe(404);
  const id='dispatch-reader-'+crypto.randomUUID(),reader=await browser.newContext();try{await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Mappenleser','reader',true)",[id]);await authenticate(reader,id);expect((await reader.request.post(fixture.base+api+'?'+new URLSearchParams({order,revision}),{headers:{origin:fixture.base},data:{scope,key,target:'pds',selected:false,version:1}})).status()).toBe(403);const tab=await reader.newPage();await tab.bringToFront();await tab.goto(fixture.base+fileUrl);await openRow(tab,'Einsatzmappe');await tab.getByRole('button',{name:'Verfügbare Dokumente',exact:true}).click();await expect(tab.getByRole('switch',{name:/Einsatzhinweise Heizung/})).toBeDisabled();}finally{await reader.close();await page.bringToFront();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[id]);await sql('DELETE FROM platform.users WHERE id=$1',[id]);}
 });
 await test.step('Quellenausfall bewahrt Auswahl und schmale Darstellung',async()=>{
  await page.route('**/api/service/einsatzmappe?*',route=>new URL(route.request().url()).searchParams.get('section')==='pds'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Quellenausfall'})}):route.continue());await page.reload();await expect(page.getByText('1 ausgewählt',{exact:true})).toBeVisible();await expect(page.getByText('Dokumentverweis derzeit nicht prüfbar',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Einsatzhinweise Heizung.txt ↗',exact:true})).toHaveCount(0);await page.unrouteAll({behavior:'wait'});await page.getByRole('button',{name:'Mappe erneut laden',exact:true}).click();await expect(page.getByRole('link',{name:'Einsatzhinweise Heizung.txt ↗',exact:true})).toBeVisible();
  for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}await page.screenshot({path:join(artifacts,'dispatch-'+browserName+'.png'),fullPage:true});
 });
});

test('E19 Einsatzmappe verknuepft SharePoint und bewahrt parallele Dokumentauswahl',async({page,context,browserName})=>{
 test.setTimeout(90000);await authenticate(context);
 const config={tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',secret:'fictitious-sharepoint-secret',siteId:'fictional.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444',driveId:'drive-test',rootId:'root'};
 async function configure(input){const state=await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json();const response=await context.request.post(fixture.base+'/api/verwaltung/sharepoint',{headers:{origin:fixture.base},data:{...input,version:state.version}});expect(response.ok()).toBe(true);return response.json();}
 const order='sim-order-1',name='Einsatzmappe '+browserName+'.txt';let cleanupScope,cleanupKey;
 try{
  await configure({action:'save',...config});await configure({action:'test'});await configure({action:'mode',enabled:true,confirm:true});
  const upload=await context.request.post(fixture.base+'/api/service/dokumente?kind=order&id='+order,{headers:{origin:fixture.base,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'Idempotency-Key':crypto.randomUUID()},data:'Fiktiver Einsatzbericht'});expect(upload.ok()).toBe(true);
  const core=await (await context.request.get(fixture.base+'/api/service?kind=order&id='+order+'&part=base')).json(),path='/api/service/einsatzmappe?'+new URLSearchParams({order,revision:core.sourceRevision}),selection=await (await context.request.get(fixture.base+path+'&section=selection')).json(),catalog=await (await context.request.get(fixture.base+path+'&section=sharepoint&target=order')).json(),document=catalog.items.find(row=>row.name===name);expect(document).toBeTruthy();cleanupScope=selection.scope;cleanupKey=document.key;
  const before=(await sql('SELECT count(*)::integer n FROM platform.sharepoint_uploads')).rows[0].n;
  const change=()=>context.request.post(fixture.base+path,{headers:{origin:fixture.base},data:{scope:selection.scope,key:document.key,target:'order',selected:true,version:0}});
  const results=await Promise.all([change(),change()]);expect(results.every(response=>response.ok())).toBe(true);expect((await results[0].json()).version).toBe(1);expect((await results[1].json()).version).toBe(1);expect((await sql('SELECT count(*)::integer n FROM platform.sharepoint_uploads')).rows[0].n).toBe(before);
  await enter(page,'/servicehub?ansicht=orders&akte=order&id='+order);await page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Einsatzmappe'})}).first().locator(':scope > summary').click();await expect(page.getByRole('link',{name:name+' ↗',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:name+' ↗',exact:true})).toHaveAttribute('href',/^https:\/\/fictional.sharepoint.com\//);
  const denied=await context.request.get(fixture.base+path+'&section=sharepoint&target=object:unrelated');expect(denied.status()).toBe(403);
  await configure({action:'mode',enabled:false});await page.reload();const unavailableSharePoint=page.getByRole('listitem').filter({has:page.locator('small',{hasText:/^SharePoint/})}).filter({has:page.getByText('Dokumentverweis derzeit nicht prüfbar',{exact:true})});await expect(unavailableSharePoint).toHaveCount(1);await expect(unavailableSharePoint.getByText('Dokumentverweis derzeit nicht prüfbar',{exact:true})).toBeVisible();expect((await sql('SELECT selected FROM platform.dispatch_pack_refs WHERE scope_key=$1 AND ref_key=$2',[selection.scope,document.key])).rows[0].selected).toBe(true);
 }finally{await configure({action:'mode',enabled:false});if(cleanupScope&&cleanupKey)await sql('DELETE FROM platform.dispatch_pack_refs WHERE scope_key=$1 AND ref_key=$2',[cleanupScope,cleanupKey]);}
});

test('E20 Terminbestaetigung prueft Daten und reiht nach Antwortverlust nur einmal im Testbetrieb ein',async({page,context,browser,browserName})=>{
 test.setTimeout(120000);await authenticate(context);const endpoint=fixture.base+'/api/service/terminbestaetigung',orderId='sim-order-2',incidentId=orderId+'-incident',recipient='confirmation-'+browserName+'@example.invalid';
 const initial=(await sql("SELECT enabled,test_mode,version FROM platform.mail_settings WHERE id='central'")).rows[0];let message,settings;
 const post=data=>context.request.post(endpoint,{headers:{origin:fixture.base},data});
 async function plan(hour){const core=await (await context.request.get(fixture.base+'/api/service?kind=order&id='+orderId+'&part=base')).json(),incident=core.incidents.find(row=>row.id===incidentId),day=incident.start.slice(0,10),calendar=await (await context.request.get(fixture.base+'/api/ressourcenkalender?'+new URLSearchParams({from:day,to:day}))).json(),event=calendar.events.find(row=>row.id==='sim-service-termin-'+incidentId);expect(event).toBeTruthy();const start=new Date(fixture.day+'T'+hour+':00:00+01:00').toISOString(),end=new Date(Date.parse(start)+90*60000).toISOString();const result=await context.request.post(fixture.base+'/api/ressourcenkalender',{headers:{origin:fixture.base},data:{id:event.id,start,end,resourceIds:event.resourceIds,expected:event,acceptPlanningWarnings:true,continuationChoice:'single'}});expect(result.ok()).toBe(true);return core.sourceRevision;}
 try{
  const sourceRevision=await test.step('Isolierten Serviceeinsatz vollstaendig terminieren',()=>plan('09'));
  await test.step('Graph bleibt ausgeblendet; Nachricht wird nicht ungefragt versendet',async()=>{
   await sql("UPDATE platform.mail_settings SET enabled=false,test_mode=true,version=version+1 WHERE id='central'");await enter(page,'/servicehub?ansicht=orders&akte=order&id='+orderId);await page.getByRole('button',{name:'Terminbestätigung',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Terminbestätigung',exact:true});await expect(dialog.getByLabel('Nachricht',{exact:true})).toHaveValue(/Haupttechniker: Kim Muster/);await expect(dialog.getByLabel('Nachricht',{exact:true})).toHaveValue(/Testallee 3/);await expect(dialog.getByRole('button',{name:'Für Graph-Test vorbereiten',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'In Outlook öffnen',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Dialog schließen',exact:true}).click();
  });
  await test.step('Veraltete Daten und fehlende Rechte werden abgewiesen',async()=>{
   await sql("UPDATE platform.mail_settings SET enabled=true,test_mode=true,version=version+1 WHERE id='central'");let result=await post({action:'preview',orderId,incidentId,sourceRevision});expect(result.ok()).toBe(true);({message,settings}=await result.json());await plan('10');result=await post({action:'confirm',...message,requestId:crypto.randomUUID(),recipient,channel:'graph',mailVersion:settings.version,confirm:true});expect(result.status()).toBe(409);
   const id='confirmation-reader-'+crypto.randomUUID(),reader=await browser.newContext();try{await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Leser','reader',true)",[id]);await authenticate(reader,id);expect((await reader.request.post(endpoint,{headers:{origin:fixture.base},data:{action:'preview',orderId,incidentId,sourceRevision}})).status()).toBe(403);}finally{await reader.close();await page.bringToFront();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[id]);await sql('DELETE FROM platform.users WHERE id=$1',[id]);}
   expect((await context.request.post(endpoint,{headers:{origin:'https://unrelated.example.invalid'},data:{action:'preview',orderId,incidentId,sourceRevision}})).status()).toBe(403);
  });
  await test.step('Abbruch erhaelt Empfaenger, Wiederholung erzeugt nur eine Nachricht',async()=>{
   await page.reload();await page.getByRole('button',{name:'Terminbestätigung',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Terminbestätigung',exact:true});await dialog.getByLabel('Empfänger',{exact:true}).fill(recipient);let lose=true;
   await page.route('**/api/service/terminbestaetigung',async route=>{const data=route.request().postDataJSON();if(data.action!=='confirm'||!lose)return route.continue();lose=false;const response=await route.fetch();expect(response.ok()).toBe(true);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Antwortverlust. Bitte erneut bestätigen.'})});});
   async function confirm(){await dialog.getByRole('button',{name:'Für Graph-Test vorbereiten',exact:true}).click();await page.getByRole('alertdialog',{name:'In Testwarteschlange aufnehmen?',exact:true}).getByRole('button',{name:'Test bestätigen',exact:true}).click();}
   await confirm();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('Empfänger',{exact:true})).toHaveValue(recipient);await expect(dialog.getByRole('button',{name:'Für Graph-Test vorbereiten',exact:true})).toBeEnabled();await confirm();await expect(dialog.getByRole('status').filter({hasText:'bereits für den MS365-Graph Testbetrieb'})).toBeVisible();expect((await sql('SELECT count(*)::int n FROM platform.mail_queue WHERE recipient=$1',[recipient])).rows[0].n).toBe(1);expect((await sql('SELECT bool_and(test_mode) ok FROM platform.mail_queue WHERE recipient=$1',[recipient])).rows[0].ok).toBe(true);
   for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await expect(dialog.getByRole('button',{name:'Schließen',exact:true})).toBeVisible();}await page.screenshot({path:join(artifacts,'confirmation-'+browserName+'.png')});await dialog.getByRole('button',{name:'Schließen',exact:true}).click();await expect(page.getByRole('button',{name:'Terminbestätigung',exact:true})).toBeFocused();
  });
  await test.step('Outlook ist nur eine ausdrueckliche Vorbereitung ohne Queue',async()=>{
   const current=await post({action:'preview',orderId,incidentId,sourceRevision}),value=await current.json(),input={action:'confirm',...value.message,requestId:crypto.randomUUID(),recipient,channel:'outlook',mailVersion:value.settings.version,confirm:true};const response=await post(input);expect(response.ok()).toBe(true);const result=await response.json();expect(result.url).toMatch(/^mailto:/);expect(result.queueId).toBe(null);expect((await sql('SELECT count(*)::int n FROM platform.mail_queue WHERE recipient=$1',[recipient])).rows[0].n).toBe(1);
  });
 }finally{
  await sql('DELETE FROM platform.service_confirmations WHERE queue_id IN (SELECT id FROM platform.mail_queue WHERE recipient=$1)',[recipient]);await sql('DELETE FROM platform.mail_log WHERE mail_id IN (SELECT id FROM platform.mail_queue WHERE recipient=$1)',[recipient]);await sql('DELETE FROM platform.mail_queue WHERE recipient=$1',[recipient]);await sql("UPDATE platform.mail_settings SET enabled=$1,test_mode=$2,version=$3 WHERE id='central'",[initial.enabled,initial.test_mode,initial.version]);
 }
});

test('E21 Anlagenchronik trennt Termine Faelligkeiten und Berichte und bleibt bei Ausfall bedienbar',async({page,context,browser,browserName})=>{
 test.setTimeout(90000);await authenticate(context);const id='sim-unit-4',url='/servicehub?ansicht=files&akte=object&id='+id;await enter(page,url);const chronicle=page.getByRole('region',{name:'Chronologische Anlagenereignisse',exact:true});
 await test.step('Chronik zeigt echte Einheitszuordnung und Datumsarten',async()=>{
  await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toBeVisible();await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toBeVisible();await expect(chronicle.getByText('SIM-SA-10002',{exact:true})).toBeVisible();await expect(chronicle.getByText('Ohne Datum',{exact:true}).first()).toBeVisible();await expect(chronicle.getByText('Fälligkeit',{exact:true})).toBeVisible();await expect(chronicle.getByText('Dokumentdatum',{exact:true}).first()).toBeVisible();expect(await chronicle.getByText('SIM-SA-10001',{exact:true}).count()).toBe(0);
  const dates=await chronicle.locator('time').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime')||''));const valid=dates.filter(Boolean).map(value=>Date.parse(value.length===10?value+'T12:00:00Z':value));expect(valid).toEqual([...valid].sort((a,b)=>b-a));expect(dates.at(-1)).toBe('');
  await chronicle.getByRole('button',{name:'Berichte & Unterlagen',exact:true}).click();await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toBeVisible();await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toHaveCount(0);await chronicle.getByRole('button',{name:'Wartungen',exact:true}).focus();await page.keyboard.press('Enter');await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toBeVisible();await chronicle.getByRole('button',{name:'Alle',exact:true}).click();
 });
 let revision;await test.step('Leser und direkte API bleiben geschuetzt',async()=>{
  const core=await (await context.request.get(fixture.base+'/api/service?kind=object&id='+id+'&part=base')).json();revision=core.sourceRevision;const path='/api/service/chronik?'+new URLSearchParams({id,revision,part:'reports',orders:JSON.stringify(['sim-order-1'])});expect((await context.request.get(fixture.base+path)).status()).toBe(403);expect((await context.request.get(fixture.base+'/api/service/chronik?'+new URLSearchParams({id:'sim-object-3',revision,part:'services'}))).status()).toBe(400);expect((await context.request.get(fixture.base+'/api/service/chronik?'+new URLSearchParams({id,revision:'f'.repeat(64),part:'services'}))).status()).toBe(409);
  const readerId='chronicle-reader-'+crypto.randomUUID(),reader=await browser.newContext();try{await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Chronikleser','reader',true)",[readerId]);await authenticate(reader,readerId);expect((await reader.request.get(fixture.base+'/api/service/chronik?'+new URLSearchParams({id,revision,part:'services'}))).status()).toBe(200);expect((await reader.request.post(fixture.base+'/api/service/chronik',{headers:{origin:fixture.base},data:{}})).status()).toBe(405);}finally{await reader.close();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[readerId]);await sql('DELETE FROM platform.users WHERE id=$1',[readerId]);}
  const anonymous=await browser.newContext();try{expect((await anonymous.request.get(fixture.base+'/api/service/chronik?'+new URLSearchParams({id,revision,part:'services'}))).status()).toBe(401);}finally{await anonymous.close();}
 });
 await test.step('Quellenausfall laesst die anderen Bereiche und Navigation frei',async()=>{
  let failed=true;await page.route('**/api/service/chronik?*',route=>new URL(route.request().url()).searchParams.get('part')==='maintenance'&&failed?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Verbindungsabbruch'})}):route.continue());await page.reload();await expect(chronicle.getByRole('alert').filter({hasText:'Chronik unvollständig'})).toBeVisible();await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toBeVisible();await expect(chronicle.getByRole('button',{name:'Erneut laden',exact:true})).toBeEnabled();failed=false;await chronicle.getByRole('button',{name:'Erneut laden',exact:true}).click();await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toBeVisible();await expect(chronicle.getByRole('alert')).toHaveCount(0);
  for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(chronicle.getByRole('button',{name:'Berichte & Unterlagen',exact:true})).toBeVisible();}await page.screenshot({path:join(artifacts,'chronicle-'+browserName+'-'+theme+'.png'),fullPage:true});}
  await chronicle.getByRole('button',{name:'Auftragsakte öffnen ›',exact:true}).click();await expect(page).toHaveURL(/akte=order&id=sim-order-2/);await page.goBack();await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toBeVisible();
 });
});

test('E22 Anlagenchronik verlinkt SharePoint-Originale und wahrt die Integrationsfreigabe',async({page,context,browserName})=>{
 test.setTimeout(90000);await authenticate(context);const name='Fiktiver Anlagenbericht '+browserName+'.txt',id='sim-unit-4';
 const config={tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',secret:'fictitious-sharepoint-secret',siteId:'fictional.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444',driveId:'drive-test',rootId:'root'};
 async function configure(input){const state=await (await context.request.get(fixture.base+'/api/verwaltung/sharepoint')).json();const response=await context.request.post(fixture.base+'/api/verwaltung/sharepoint',{headers:{origin:fixture.base},data:{...input,version:state.version}});expect(response.ok()).toBe(true);}
 try{await configure({action:'save',...config});await configure({action:'test'});await configure({action:'mode',enabled:true,confirm:true});const upload=await context.request.post(fixture.base+'/api/service/dokumente?kind=object&id='+id,{headers:{origin:fixture.base,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'Idempotency-Key':crypto.randomUUID()},data:'Fiktiver Anlagenbericht für die isolierte Prüfung'});expect(upload.ok()).toBe(true);const count=(await sql('SELECT count(*)::int n FROM platform.sharepoint_uploads WHERE display_name=$1',[name])).rows[0].n;
  await enter(page,'/servicehub?ansicht=files&akte=object&id='+id);const chronicle=page.getByRole('region',{name:'Chronologische Anlagenereignisse',exact:true});await expect(chronicle.getByText(name,{exact:true})).toBeVisible();const report=chronicle.getByRole('article').filter({hasText:name});await expect(report.getByText('Geändert',{exact:true})).toBeVisible();await expect(report.getByRole('link',{name:'Unterlage öffnen ↗',exact:true})).toHaveAttribute('href',/^https:\/\/fictional.sharepoint.com\//);expect((await sql('SELECT count(*)::int n FROM platform.sharepoint_uploads WHERE display_name=$1',[name])).rows[0].n).toBe(count);
  await configure({action:'mode',enabled:false});await page.reload();await expect(chronicle.getByText('SharePoint ist noch nicht freigegeben.',{exact:true})).toBeVisible();await expect(chronicle.getByText(name,{exact:true})).toHaveCount(0);await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toBeVisible();
 }finally{await configure({action:'mode',enabled:false});}
});

test('E23 Materialliste zeigt PDS-Mengen Hierarchie und Langtexte ohne Preise oder Schreibwirkung',async({page,context,browser,browserName})=>{
 test.setTimeout(90000);await authenticate(context);const order='sim-order-2',url='/servicehub?ansicht=orders&akte=order&id='+order;await enter(page,url);await openRow(page,'Material & Leistungen');const list=page.getByRole('region',{name:'Material- und Leistungsliste',exact:true});
 await test.step('Material und Leistungen behalten Mengen und Positionstypen',async()=>{
  await expect(list.getByText('FIKTIV-BMA-200',{exact:true})).toBeVisible();const child=list.getByRole('row').filter({hasText:'FIKTIV-KABEL'});await expect(child.getByText('0,5 m',{exact:true})).toBeVisible();await expect(child.getByText('Gesamt: 1 m',{exact:true})).toBeVisible();await expect(child.getByText('Unterposition · Ebene 1',{exact:true})).toBeVisible();await expect(list.getByRole('row').filter({hasText:'FIKTIV-ERSATZ'}).getByText('0 Stück',{exact:true})).toBeVisible();await expect(list.getByText('Artikel · Alternative',{exact:true})).toBeVisible();await expect(list.getByText('Artikel · Bedarf ohne Gesamtbetrag',{exact:true})).toBeVisible();
  const core=await (await context.request.get(fixture.base+'/api/service?kind=order&id='+order+'&part=base')).json(),response=await context.request.get(fixture.base+'/api/service/einsatzmappe?'+new URLSearchParams({order,revision:core.sourceRevision,section:'positions'})),data=await response.json();expect(data.count).toBe(5);expect(JSON.stringify(data)).not.toMatch(/ekPreis|vkPreis|lieferantUUID|preisStrategien/);
  const readerId='material-reader-'+crypto.randomUUID(),reader=await browser.newContext();try{await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Materialleser','reader',true)",[readerId]);await authenticate(reader,readerId);expect((await reader.request.get(fixture.base+'/api/service/einsatzmappe?'+new URLSearchParams({order,revision:core.sourceRevision,section:'positions'}))).status()).toBe(200);}finally{await reader.close();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[readerId]);await sql('DELETE FROM platform.users WHERE id=$1',[readerId]);}
  const anonymous=await browser.newContext();try{expect((await anonymous.request.get(fixture.base+'/api/service/einsatzmappe?'+new URLSearchParams({order,revision:core.sourceRevision,section:'positions'}))).status()).toBe(401);}finally{await anonymous.close();}
 });
 await test.step('Beschreibung per Tastatur und schmale Ansicht ohne abgeschnittene Werte',async()=>{
  await enter(page,'/servicehub?ansicht=orders&akte=order&id=sim-order-1');await expect(list.getByText('FIKTIV-HZ-100',{exact:true})).toBeVisible();const row=list.getByRole('row').filter({hasText:'FIKTIV-HZ-100'}),details=row.locator('summary',{hasText:'Beschreibung & Details'});await details.focus();await page.keyboard.press('Enter');await expect(row.getByText('FIKTIV-B-100',{exact:true})).toBeVisible();await expect(row.getByText('FIKTIV-H-100',{exact:true})).toBeVisible();await expect(list.getByRole('row').filter({hasText:'FIKTIV-SERVICE-HZ'}).getByText('1,25 h',{exact:true})).toBeVisible();
  for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(row.getByText('FIKTIV-H-100',{exact:true})).toBeVisible();}await page.screenshot({path:join(artifacts,'materials-'+browserName+'-'+theme+'.png'),fullPage:true});}
 });
 await test.step('Fehler behaelt letzten Stand und blockiert weder Akte noch Wiederholung',async()=>{
  let fail=true;await page.route('**/api/service/einsatzmappe?*',route=>new URL(route.request().url()).searchParams.get('section')==='positions'&&fail?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Verbindungsabbruch'})}):route.continue());await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(list.getByRole('alert').filter({hasText:'Fiktiver Verbindungsabbruch'})).toBeVisible();await expect(list.getByText('FIKTIV-HZ-100',{exact:true})).toBeVisible();await expect(list.getByRole('button',{name:'Positionen erneut laden',exact:true})).toBeEnabled();fail=false;await list.getByRole('button',{name:'Positionen erneut laden',exact:true}).click();await expect(list.getByRole('alert')).toHaveCount(0);await expect(list.getByText('FIKTIV-HZ-100',{exact:true})).toBeVisible();await page.getByRole('navigation',{name:'Serviceansichten',exact:true}).getByRole('button',{name:'Alle Aufträge',exact:true}).click();await expect(page.getByRole('complementary',{name:'Akte',exact:true})).toHaveCount(0);
 });
});

test('E24 Ruecklaufkontrolle zeigt gepruefte Ausfuehrung und wahrt Auftragszuordnung',async({page,context,browser,browserName})=>{
 test.setTimeout(90000);await authenticate(context);const order='sim-order-2';await enter(page,'/servicehub?ansicht=orders&akte=order&id='+order);await openRow(page,'Rücklauf & Abschlusskontrolle');const control=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Rücklauf & Abschlusskontrolle'})});await expect(control.getByRole('button',{name:/^SIM-RL-10002/})).toBeVisible();await expect(control.getByLabel('Rücklauf-UUID',{exact:true})).toHaveCount(0);const evidence=page.getByRole('region',{name:'Rücklaufnachweise',exact:true});await expect(evidence.getByText('04.11.2026',{exact:true})).toBeVisible();await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();await evidence.locator('summary',{hasText:'Rücklaufpositionen'}).focus();await page.keyboard.press('Enter');await expect(evidence.getByText('1,5 h',{exact:true})).toBeVisible();await expect(evidence.getByRole('link',{name:'Fiktiver Wartungsbericht BMA.txt ↓',exact:true})).toBeVisible();
 const core=await (await context.request.get(fixture.base+'/api/service?kind=order&id='+order+'&part=base')).json(),params=new URLSearchParams({order,revision:core.sourceRevision,section:'return',target:'sim-return-2'}),response=await context.request.get(fixture.base+'/api/service/einsatzmappe?'+params),data=await response.json();expect(response.status()).toBe(200);expect(data.entries).toHaveLength(1);expect(JSON.stringify(data)).not.toMatch(/ekPreis|vkPreis|einzelPreis|lieferantUUID/);const file='/api/service/einsatzmappe/dokument?'+new URLSearchParams({order,revision:core.sourceRevision,returnId:data.id,key:data.documents.items[0].key});expect((await context.request.get(fixture.base+file)).status()).toBe(200);
 const foreign=new URLSearchParams({order:'sim-order-1',revision:core.sourceRevision,section:'return',target:'sim-return-2'});expect((await context.request.get(fixture.base+'/api/service/einsatzmappe?'+foreign)).status()).toBe(404);const foreignFile=new URL(fixture.base+file);foreignFile.searchParams.set('order','sim-order-1');expect((await context.request.get(foreignFile.href)).status()).toBe(404);
 const readerId='return-reader-'+crypto.randomUUID(),reader=await browser.newContext(),anonymous=await browser.newContext();try{await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Rücklaufleser','reader',true)",[readerId]);await authenticate(reader,readerId);expect((await reader.request.get(fixture.base+'/api/service/einsatzmappe?'+params)).status()).toBe(200);const autoParams=new URLSearchParams({order,revision:core.sourceRevision,section:'return-index'});expect((await reader.request.get(fixture.base+'/api/service/einsatzmappe?'+autoParams)).status()).toBe(200);expect((await anonymous.request.get(fixture.base+'/api/service/einsatzmappe?'+autoParams)).status()).toBe(401);expect((await anonymous.request.get(fixture.base+'/api/service/einsatzmappe?'+params)).status()).toBe(401);expect((await anonymous.request.get(fixture.base+file)).status()).toBe(401);}finally{await reader.close();await anonymous.close();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[readerId]);await sql('DELETE FROM platform.users WHERE id=$1',[readerId]);}
 const checkedAgain=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/service/einsatzmappe'&&url.searchParams.get('section')==='return'&&response.status()===200;});await control.getByRole('button',{name:/^SIM-RL-10002/}).click();await checkedAgain;await expect(evidence.getByText('04.11.2026',{exact:true})).toBeVisible();await expect(evidence).toHaveAttribute('aria-busy','false');
 let failed=true;await page.route('**/api/service/einsatzmappe?*',route=>new URL(route.request().url()).searchParams.get('section')==='return'&&failed?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Verbindungsabbruch'})}):route.continue());await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(evidence.getByRole('alert').filter({hasText:'Fiktiver Verbindungsabbruch'})).toBeVisible();await expect(evidence.getByText('04.11.2026',{exact:true})).toBeVisible();failed=false;await evidence.getByRole('button',{name:'Erneut prüfen',exact:true}).click();await expect(evidence.getByRole('alert')).toHaveCount(0);
 for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(evidence.getByText('1,5 h',{exact:true})).toBeVisible();}await page.screenshot({path:join(artifacts,'returns-'+browserName+'-'+theme+'.png'),fullPage:true});}
 const index=control.getByRole('region',{name:'Automatische Rücklaufzuordnung',exact:true});let failIndex=true;await page.route('**/api/service/einsatzmappe?*',route=>new URL(route.request().url()).searchParams.get('section')==='return-index'&&failIndex?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktive Ansichtsunterbrechung'})}):route.continue());await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(index.getByRole('alert').filter({hasText:'Fiktive Ansichtsunterbrechung'})).toBeVisible();await expect(evidence.getByText('04.11.2026',{exact:true})).toBeVisible();failIndex=false;await index.getByRole('button',{name:'Zuordnung erneut prüfen',exact:true}).click();await expect(index.getByRole('alert')).toHaveCount(0);
 await page.route('**/api/service/einsatzmappe?*',route=>new URL(route.request().url()).searchParams.get('section')==='return-index'?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:false,items:[],errors:[],notice:'Automatische Rücklaufzuordnung bitte in der PDS-Anbindung einrichten.'})}):route.continue());await page.reload();await expect(control.getByText('Automatische Rücklaufzuordnung bitte in der PDS-Anbindung einrichten.',{exact:true})).toBeVisible();await expect(evidence).toHaveCount(0);await expect(control.getByLabel('Rücklauf-UUID',{exact:true})).toHaveCount(0);await page.getByRole('navigation',{name:'Serviceansichten',exact:true}).getByRole('button',{name:'Alle Aufträge',exact:true}).click();await expect(page.getByRole('complementary',{name:'Akte',exact:true})).toHaveCount(0);
});

test('E25 Ruecklaufansichten melden echte serverseitige Datenfehler und ordnen ohne UUID richtig zu',async({page,context,browserName})=>{
 test.setTimeout(120000);await authenticate(context);
 const order='sim-order-2',url='/servicehub?ansicht=orders&akte=order&id=',control=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Rücklauf & Abschlusskontrolle'})}),index=page.getByRole('region',{name:'Automatische Rücklaufzuordnung',exact:true}),evidence=page.getByRole('region',{name:'Rücklaufnachweise',exact:true});
 async function mode(value){await sql("UPDATE public.browser_return_fault SET mode=$1 WHERE id='central'",[value]);}
 try{
  await test.step('Automatisch nur am zugehoerigen Auftrag, Dubletten ohne doppelte Anzeige',async()=>{
   await mode('normal');await enter(page,url+order);await openRow(page,'Rücklauf & Abschlusskontrolle');await expect(control.getByRole('button',{name:/^SIM-RL-10002/})).toHaveCount(1);await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();await expect(control.getByRole('textbox')).toHaveCount(0);
   await enter(page,url+'sim-order-1');await expect(index.getByText('Keine Rückläufe in der freigegebenen Zuordnungsansicht gefunden.',{exact:true})).toBeVisible();await expect(control.getByRole('button',{name:/^SIM-RL/})).toHaveCount(0);await expect(evidence).toHaveCount(0);
   await mode('duplicates');await enter(page,url+order);await expect(control.getByRole('button',{name:/^SIM-RL-10002/})).toHaveCount(1);await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();
  });
  await test.step('Veralteter Ansichtsbezug liefert keine fremden Arbeiten',async()=>{
   await mode('stale');await enter(page,url+'sim-order-1');await expect(index.getByRole('alert')).toContainText('Die Zuordnung ist unvollständig');await expect(evidence).toHaveCount(0);await expect(control.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toHaveCount(0);await expect(control.getByRole('button',{name:/^SIM-RL/})).toHaveCount(0);
  });
  for(const [fault,message]of [['missing','Die konfigurierte Rücklaufansicht ist nicht eindeutig verfügbar. PDS-Freigabe und Ansichtsname prüfen.'],['columns','Die Rücklaufansicht benötigt genau die Spalten ruecklaufUUID und serviceauftragebeneUUID.'],['malformed','Die Rücklaufansicht liefert keine gültige Datenseite.'],['unavailable','Die Rücklaufzuordnung konnte nicht vollständig gelesen werden. API-Rechte und Verbindung prüfen.']])await test.step('Ansichtsfehler '+fault+' sichtbar statt leerem Erfolg',async()=>{
   await mode(fault);await enter(page,url+order);await expect(index.getByRole('alert')).toContainText(message);await expect(index.getByRole('button',{name:'Zuordnung erneut prüfen',exact:true})).toBeEnabled();await expect(index).toHaveAttribute('aria-busy','false');await expect(index.getByText('Keine Rückläufe in der freigegebenen Zuordnungsansicht gefunden.',{exact:true})).toHaveCount(0);await expect(evidence).toHaveCount(0);await expect(page.getByText('PRIVATE-FIXTURE-DIAGNOSTIC',{exact:false})).toHaveCount(0);await expect(control.getByRole('textbox')).toHaveCount(0);
   if(fault==='columns')for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await index.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({path:join(artifacts,'return-view-errors-'+browserName+'-'+theme+'.png'),fullPage:true});}
   await mode('normal');await index.getByRole('button',{name:'Zuordnung erneut prüfen',exact:true}).click();await expect(index.getByRole('alert')).toHaveCount(0);await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();await expect(control.getByRole('button',{name:/^SIM-RL-10002/})).toHaveCount(1);
  });
  await test.step('Hintergrundfehler erhaelt letzten Stand und Erholung ohne Neuladen',async()=>{
   await mode('unavailable');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(index.getByRole('alert')).toContainText('Zuletzt geladene Zuordnung; aktuell nicht bestätigt.');await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();await mode('normal');await index.getByRole('button',{name:'Zuordnung erneut prüfen',exact:true}).click();await expect(index.getByRole('alert')).toHaveCount(0);await expect(evidence.getByText(/Fiktive Funktionsprüfung durchgeführt/)).toBeVisible();
   await mode('empty');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(index.getByText('Keine Rückläufe in der freigegebenen Zuordnungsansicht gefunden.',{exact:true})).toBeVisible();await expect(evidence).toHaveCount(0);await expect(index.getByRole('alert')).toHaveCount(0);
  });
 }finally{await mode('normal');}
});

test('E26 PDS Anleitung zeigt Ansichtsvertraege kompakt und exportiert dieselben Beispiele',async({page,context,browserName})=>{
 await authenticate(context);await enter(page,'/einstellungen?bereich=pds&seite=pds%3Areadiness');const guide=page.getByRole('region',{name:'PDS-Datenansichten',exact:true});await expect(guide.getByRole('heading',{name:'Datenansichten · Übersicht',exact:true})).toBeVisible();await expect(guide.getByText('Keine Ansicht ist pauschal für den Grundbetrieb vorgeschrieben.',{exact:false})).toBeVisible();
 for(const [id,field]of [['returns','ruecklaufUUID'],['working-time','mitarbeiterUUID'],['vacation','terminUUID'],['colors','farbe']]){const details=guide.locator('#pds-view-'+id),summary=details.locator(':scope > summary');await summary.focus();await page.keyboard.press('Enter');await expect(details.getByText(field,{exact:true})).toBeVisible();await details.locator('summary',{hasText:'Fiktives JSON-Beispiel'}).click();await expect(details.locator('pre')).toBeVisible();}
 const response=await context.request.get(fixture.base+'/api/verwaltung/pds/anleitung');expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('text/markdown');const markdown=await response.text();for(const text of ['Datenansichten · Übersicht','returnLinkView','workingTimeView','vacationApprovalView','colorView','serviceauftragebeneUUID','gueltigVon / gueltigBis','genehmigungsstatus','typ und farbe','```json','keine behaupteten PDS-Tabellen'])expect(markdown).toContain(text);
 for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});await guide.getByRole('heading',{name:'Datenansichten · Übersicht',exact:true}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(guide.locator('#pds-view-returns').getByText('serviceauftragebeneUUID',{exact:true})).toBeVisible();}await page.screenshot({path:join(artifacts,'pds-views-guide-'+browserName+'-'+theme+'.png'),fullPage:true});}
});

test('E27 Serviceauftrag betont Fokusfelder und erhaelt Beschreibung sowie Planungsdialog',async({page,context,browserName})=>{
 test.setTimeout(90000);await authenticate(context);const order='sim-order-1',long='Serviceauftrag telefonisch gemeldet. Störung/Auftragsbeschreibung: '+('Fiktive Prüfung der Heizungsanlage mit vollständiger Dokumentation. '.repeat(12))+'Ihre Auftragsnummer: FIKTIV-27';
 await page.route('**/api/service?*',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('id')!==order)return route.continue();const response=await route.fetch(),value=await response.json(),incidents=url.searchParams.get('part')==='base'?value.incidents:value.extras?.incidents;if(incidents?.[0])incidents[0].work=long;await route.fulfill({response,json:value});});
 await enter(page,'/servicehub?ansicht=orders&akte=order&id='+order);const file=page.getByRole('complementary',{name:'Akte',exact:true}),incident=file.getByRole('region',{name:'Einsatz 1 · Heizungsanlage',exact:true});await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeVisible();await expect(file.getByText(/Musterweg 12, 00000 Demostadt/).first()).toBeVisible();await expect(incident.locator('[data-focus="appointment"]').getByText('Nicht geplant',{exact:true})).toBeVisible();await expect(incident.locator('[data-focus="team"]').getByText('Nicht zugeordnet',{exact:true})).toBeVisible();
 await test.step('Auftragsbeschreibung mit Enter öffnen und schließen',async()=>{
  await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeFocused();
  const description=incident.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Auftragsbeschreibung'})});
  const summary=description.locator(':scope > summary');
  await expect(description.getByText(long,{exact:true})).not.toBeVisible();
  await summary.press('Enter');
  await expect(description.getByText(long,{exact:true})).toBeVisible();
  await summary.press('Enter');
  await expect(description.getByText(long,{exact:true})).not.toBeVisible();
 });
 const plan=file.getByRole('button',{name:'Einsatz planen',exact:true});await expect(plan).toHaveText('');await expect(plan.locator('svg')).toBeVisible();await plan.click();await expect(page.getByRole('dialog',{name:'Termin vergeben',exact:true})).toBeVisible();await page.getByRole('dialog',{name:'Termin vergeben',exact:true}).getByRole('button',{name:'Abbrechen',exact:true}).click();await expect(page.getByRole('dialog',{name:'Termin vergeben',exact:true})).toHaveCount(0);await expect(file.getByRole('button',{name:'Terminbestätigung',exact:true})).toBeDisabled();
 await file.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Einsatzmappe'})}).locator(':scope > summary').click();await expect(file.getByRole('button',{name:'Dokumente auswählen',exact:true})).toBeVisible();await openRow(page,'Material & Leistungen');await expect(file.getByRole('region',{name:'Material- und Leistungsliste',exact:true})).toBeVisible();
 for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});await incident.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(incident.locator('[data-focus="team"]')).toBeVisible();await axe(page,'order-focus-'+browserName+'-'+theme+'-'+width);}await incident.scrollIntoViewIfNeeded();await page.screenshot({path:join(artifacts,'order-focus-'+browserName+'-'+theme+'.png')});}
 await page.getByRole('navigation',{name:'Serviceansichten',exact:true}).getByRole('button',{name:'Alle Aufträge',exact:true}).click();await expect(file).toHaveCount(0);
});

test('E28 Kunden Objekt und Einheitenakten zeigen Fokusfelder und behalten Zuordnungen',async({page,context,browserName})=>{
 test.setTimeout(120000);await authenticate(context);const file=page.getByRole('complementary',{name:'Akte',exact:true});
 const customer=await (await context.request.get(fixture.base+'/api/service?kind=customer&id=SIM-K-100&part=base')).json();
 await enter(page,'/servicehub?ansicht=files&akte=customer&id=SIM-K-100');await expect(file.getByRole('heading',{name:customer.name,exact:true})).toBeVisible();const customerFocus=file.locator('dl[aria-label="Kundeninformationen"]');await expect(customerFocus.getByText('SIM-K-100',{exact:true})).toBeVisible();await expect(customerFocus.getByText(customer.address,{exact:true})).toBeVisible();const contacts=file.getByRole('region',{name:'Ansprechpartner',exact:true});await expect(contacts).toBeVisible();const phone=customer.contacts?.flatMap(contact=>contact.phones)[0];if(phone)await expect(contacts.getByRole('link',{name:phone,exact:true}).first()).toHaveAttribute('href','tel:'+phone.replace(/[^+\d]/g,''));
 const objectGroup=file.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Objekte & technische Einheiten'})}),objectSummary=objectGroup.locator(':scope > summary');
 await objectSummary.press('Enter');await expect(objectGroup).toHaveAttribute('open','');await expect(file.getByRole('button',{name:/Beispielhaus Nord.*Objekt/})).toBeVisible();
 const cases=[['customer','SIM-K-100','Kundeninformationen','SIM-K-100'],['object','sim-object-1','Objektinformationen','SIM-OBJ-100'],['object','sim-unit-4','Anlageninformationen','SIM-TE-301']];
 for(const [kind,id,label,number]of cases){await enter(page,'/servicehub?'+new URLSearchParams({ansicht:'files',akte:kind,id}));const focus=file.locator('dl[aria-label="'+label+'"]');await expect(focus.getByText(number,{exact:true})).toBeVisible();if(id==='sim-object-1'){await expect(focus.getByText('Musterweg 12, 00000 Demostadt',{exact:true})).toBeVisible();await expect(focus.getByText('SIM-KST-100',{exact:true})).toBeVisible();}
  if(id==='sim-unit-4'){await expect(focus.getByText('Testallee 3, 00000 Musterstadt',{exact:true})).toBeVisible();await expect(focus.getByText('Standort des übergeordneten Objekts · Zentrale EG',{exact:true})).toBeVisible();await expect(focus.getByText('MusterSignal',{exact:true})).toBeVisible();await expect(focus.getByText('MS-300',{exact:true})).toBeVisible();await expect(file.getByRole('region',{name:'Weitere Angaben',exact:true}).getByText('Elektro',{exact:true})).toBeVisible();const costs=file.getByRole('region',{name:'Kostenträger der technischen Einheit',exact:true});await expect(costs.getByText('SIM-KTR-100',{exact:true})).toBeVisible();const contracts=file.getByRole('region',{name:'Wartungsverträge',exact:true});await expect(contracts.getByText('Kostenträger Wartung',{exact:true}).first()).toBeVisible();await expect(contracts.getByText('Kostenträger Rechnung',{exact:true}).first()).toBeVisible();}
  for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);for(const width of [390,1280]){await page.setViewportSize({width,height:900});await focus.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(focus.getByText(number,{exact:true})).toBeVisible();await axe(page,'entity-focus-'+browserName+'-'+id+'-'+theme+'-'+width);}await page.screenshot({path:join(artifacts,'entity-focus-'+browserName+'-'+id+'-'+theme+'.png')});}
 }
 let failed=true;await page.route('**/api/service?*',route=>{const url=new URL(route.request().url());return url.searchParams.get('id')==='sim-unit-4'&&url.searchParams.get('part')==='extras'&&failed?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fiktiver Zusatzdatenabbruch'})}):route.continue();});await page.clock.setFixedTime(new Date(Date.now()+61000));await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(file.getByRole('alert').filter({hasText:'Fiktiver Zusatzdatenabbruch'})).toBeVisible();await expect(file.locator('dl[aria-label="Anlageninformationen"]').getByText('SIM-TE-301',{exact:true})).toBeVisible();await expect(file.getByRole('region',{name:'Kostenträger der technischen Einheit',exact:true}).getByText('SIM-KTR-100',{exact:true})).toBeVisible();failed=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(file.getByRole('alert').filter({hasText:'Fiktiver Zusatzdatenabbruch'})).toHaveCount(0);await file.getByRole('heading',{name:'Brandmeldeanlage',exact:true}).press('Escape');await expect(page.getByRole('region',{name:'Serviceübersicht'}).locator('[data-file-row="object:sim-unit-4"]')).toBeFocused();await expect(file).toBeVisible();
});

test('E29 Menüleisten-Werkzeug nutzt mobile App, erhält Eingaben und speichert persönliche Sichtbarkeit',async({page,context,browserName})=>{
 await authenticate(context);await enter(page,'/servicehub');
 await page.getByRole('link',{name:'PlanBoard öffnen',exact:true}).click();await expect(page).toHaveURL(/\/planboard$/);await page.goBack();await expect(page).toHaveURL(/\/servicehub$/);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);
 const parentRange=await page.evaluate(()=>sessionStorage.getItem('heyelli:history-range'));expect(JSON.parse(parentRange).maximum).toBeGreaterThan(JSON.parse(parentRange).minimum);
 const icon=page.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true});await icon.focus();await page.keyboard.press('Enter');
 const panel=page.getByRole('region',{name:'Werkzeug CaseDesk',exact:true});await expect(panel).toBeVisible();
 const mobile=page.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');
 await expect(mobile.getByRole('button',{name:/Objekt & technische Einheit/})).toBeVisible();
 expect(await mobile.locator('body').evaluate(()=>innerWidth)).toBeLessThan(701);
 const originalTheme=await page.locator('html').getAttribute('data-theme');for(const theme of ['light','dark']){await page.locator('html').evaluate((node,value)=>node.dataset.theme=value,theme);await expect(mobile.locator('html')).toHaveAttribute('data-theme',theme);}await page.locator('html').evaluate((node,value)=>{if(value)node.dataset.theme=value;else delete node.dataset.theme;},originalTheme);
 expect(await page.evaluate(()=>sessionStorage.getItem('heyelli:history-range'))).toBe(parentRange);
 await expect(mobile.locator('.platform-bar')).toHaveCount(0);await page.screenshot({path:join(artifacts,'tools-'+browserName+'-desktop.png')});
 await mobile.getByRole('button',{name:/Objekt & technische Einheit/}).click();
 await expect(mobile.getByRole('region',{name:'Objekt & technische Einheit',exact:true})).toBeVisible();
 const input=mobile.getByRole('combobox').first();await input.fill('Muster');
 await page.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();await expect(panel).toBeHidden();
 await icon.click();await expect(input).toHaveValue('Muster');
 await page.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();
 // SPA navigation keeps the same frame, not just a freshly restored screen.
 await page.getByRole('link',{name:'PlanBoard öffnen',exact:true}).click();await expect(page).toHaveURL(/\/planboard$/);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);
 await icon.click();await expect(input).toHaveValue('Muster');
 await mobile.getByRole('button',{name:/Objekt & technische Einheit/}).press('Escape');await expect(panel).toBeHidden();await expect(icon).toBeFocused();
 // Use the shell account link for a real route transition.
 await page.locator('.platform-account:visible > summary').click();await page.getByRole('link',{name:'Benutzerkonto',exact:true}).click();
 await page.getByRole('button',{name:'Werkzeuge',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'CaseDesk',exact:true});await expect(toggle).toBeChecked();await toggle.uncheck();await expect(toggle).toBeEnabled();await expect(icon).toHaveCount(0);
 page.once('dialog',dialog=>dialog.accept());await page.reload();await expect(toggle).not.toBeChecked();await expect(icon).toHaveCount(0);await toggle.check();await expect(toggle).toBeEnabled();await expect(icon).toBeVisible();
 await icon.click();await expect(panel).toBeVisible();await expect(mobile.getByRole('heading',{name:'Neuer Serviceauftrag',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(icon).toBeHidden();await expect(panel).toBeHidden();
 await page.setViewportSize({width:1280,height:900});await expect(icon).toBeVisible();await expect(panel).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 const appMenu=page.getByLabel('Benutzerkonto – App-Menü',{exact:true});await expect(appMenu.locator('svg')).toBeVisible();await expect(appMenu.getByText('Benutzerkonto',{exact:true})).toBeHidden();
 await appMenu.focus();await page.keyboard.press('Enter');await expect(page.getByRole('link',{name:'Hilfe',exact:true})).toBeVisible();
 const menu=page.locator('.platform-bar-left .platform-popover:visible'),size=await menu.boundingBox();expect(size.x).toBeGreaterThanOrEqual(0);expect(size.x+size.width).toBeLessThanOrEqual(391);await page.keyboard.press('Escape');await expect(appMenu).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await axe(page,'E29-tools-mobile');await page.screenshot({path:join(artifacts,'tools-'+browserName+'-mobile.png')});
 const frameResponse=await context.request.get(fixture.base+'/werkzeuge/casedesk');expect(frameResponse.headers()['x-frame-options']).toBe('SAMEORIGIN');
 const ordinary=await context.request.get(fixture.base+'/casedesk');expect(ordinary.headers()['x-frame-options']).toBe('DENY');
});

test('E30 Rollenfreigabe ist getrennt von App-Rechten und persönlichen Werkzeugeinstellungen',async({page,browser})=>{
 await sql("UPDATE platform.app_roles SET tools='[]'::jsonb WHERE id='dispatcher'");
 // Existing mixed role may use Service but has no CaseDesk tool grant.
 const user=await browser.newContext();await authenticate(user,fixture.mixed);const reader=await user.newPage();await reader.bringToFront();
 await enter(reader,'/benutzerkonto?bereich=tools');await expect(reader.getByText('Keine Werkzeuge freigegeben',{exact:true})).toBeVisible();await expect(reader.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true})).toHaveCount(0);
 const denied=await user.request.get(fixture.base+'/werkzeuge/casedesk');expect(denied.url()).toContain('/kein-zugriff');
 // Even personal preference manipulation cannot manufacture a grant.
 const state=await (await user.request.get(fixture.base+'/api/benutzerkonto/werkzeuge')).json();expect(state.tools).toEqual([]);
 const changed=await user.request.post(fixture.base+'/api/benutzerkonto/werkzeuge',{headers:{Origin:fixture.base},data:{owner:state.owner,hidden:[],version:state.version}});expect(changed.ok()).toBeTruthy();
 expect((await (await user.request.get(fixture.base+'/api/benutzerkonto/werkzeuge')).json()).tools).toEqual([]);
 const foreign=await user.request.post(fixture.base+'/api/benutzerkonto/werkzeuge',{headers:{Origin:fixture.base},data:{owner:fixture.admin,hidden:[],version:0}});expect(foreign.status()).toBe(409);
 const roleRow=(await sql('SELECT app_role_id FROM platform.users WHERE id=$1',[fixture.mixed])).rows[0];
 await sql("UPDATE platform.app_roles SET apps=apps || '[\"/casedesk\"]'::jsonb WHERE id=$1",[roleRow.app_role_id]);
 const noTool=await user.request.get(fixture.base+'/werkzeuge/casedesk');expect(await noTool.text()).toContain('Dieses Werkzeug ist für deine Rolle nicht freigegeben.');
 await sql("UPDATE platform.app_roles SET tools='[\"incident\"]'::jsonb WHERE id=$1",[roleRow.app_role_id]);
 await reader.goto(fixture.base+'/servicehub');await reader.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true}).click();
 await expect(reader.frameLocator('iframe').getByRole('heading',{name:'Neuer Serviceauftrag',exact:true})).toBeVisible();
 const deniedWrite=await user.request.post(fixture.base+'/api/pds-simulator/orders',{headers:{Origin:fixture.base},data:{}});expect(deniedWrite.status()).toBe(403);
 await sql("UPDATE platform.app_roles SET tools='[]'::jsonb,apps=apps-'\/casedesk' WHERE id=$1",[roleRow.app_role_id]);
 await user.close();
 await authenticate(page.context());await enter(page,'/einstellungen?bereich=users&seite=users:roles');
 await page.getByRole('button',{name:/Disposition/}).click();await expect(page.getByRole('switch',{name:'CaseDesk',exact:true})).toBeVisible();
 await page.getByRole('switch',{name:'CaseDesk',exact:true}).check();await expect(page.getByRole('status').filter({hasText:'Gespeichert. Betroffene Benutzer müssen sich neu anmelden.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('switch',{name:'CaseDesk',exact:true})).toBeChecked();
 await axe(page,'E30-tools-role');
});

test('E31 Kalender-Kontextmenü öffnet den richtigen Servicevorgang mit getrennten Leserechten',async({page,context,browser})=>{
 await authenticate(context);
 const order=await (await context.request.get(fixture.base+'/api/service?kind=order&id=sim-order-2&part=base')).json(),start=order.incidents.find(row=>row.id==='sim-order-2-incident')?.start;
 expect(start).toBeTruthy();const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(start));
 const path='/planboard?datum='+day;
 async function openService(target){await enter(target,path);await target.getByRole('button',{name:'Tag',exact:true}).click();const appointment=target.getByRole('button',{name:/^SIM-SA-10002/}).first();await expect(appointment).toBeVisible();await appointment.click({timeout:10000});return target.getByRole('menu',{name:/Aktionen für SIM-SA-10002/});}
 const menu=await openService(page),link=menu.getByRole('menuitem',{name:'Im Service öffnen',exact:true});
 await expect(link).toHaveAttribute('href','/servicehub?ansicht=orders&akte=order&id=sim-order-2');
 await expect(menu.getByRole('menuitem',{name:'Vollständig bearbeiten',exact:true})).toBeFocused();await page.keyboard.press('ArrowDown');await expect(link).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/servicehub\?ansicht=orders&akte=order&id=sim-order-2$/);await expect(page.getByText('SIM-SA-10002',{exact:true}).first()).toBeVisible();
 await calendar(page);await page.getByRole('button',{name:/^Browser Alpha/}).first().click();await expect(page.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toHaveCount(0);
 const reader=await browser.newContext();try{await authenticate(reader,fixture.mixed);const tab=await reader.newPage();await tab.bringToFront();const readMenu=await openService(tab);await expect(readMenu.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toBeVisible();await expect(readMenu.getByRole('menuitem',{name:/^Umbenennen/})).toBeDisabled();}finally{await reader.close();}
 const role='calendar-link-role-'+crypto.randomUUID(),owner='calendar-link-reader-'+crypto.randomUUID(),restricted=await browser.newContext();
 try{
  await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,$1,'reader','[\"/planboard\"]'::jsonb,'[]'::jsonb)",[role]);
  await sql("INSERT INTO platform.users(id,display_name,role,app_role_id,enabled) VALUES($1,'Fiktiver Kalenderleser','reader',$2,true)",[owner,role]);
  await authenticate(restricted,owner);const response=await restricted.request.get(fixture.base+'/api/ressourcenkalender?from='+day+'&to='+day);expect(response.ok()).toBe(true);expect((await response.json()).permissions.serviceRead).toBe(false);expect((await restricted.request.get(fixture.base+'/api/service?kind=order&id=sim-order-2&part=base')).status()).toBe(403);
  const tab=await restricted.newPage();await tab.bringToFront();const deniedMenu=await openService(tab);await expect(deniedMenu.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toHaveCount(0);
 }finally{await restricted.close();await sql('DELETE FROM platform.sessions WHERE user_id=$1',[owner]);await sql('DELETE FROM platform.users WHERE id=$1',[owner]);await sql('DELETE FROM platform.app_roles WHERE id=$1',[role]);}
});

test('E32 Gesperrte Entwurfsablage blockiert keine Aktualisierung und verbindet sich ohne Eingabeverlust neu',async({page,context,browserName})=>{
 await authenticate(context);const baseTitle='Schlüsselprüfung '+browserName+' '+crypto.randomUUID().slice(0,6);
 const created=await context.request.post(fixture.base+'/api/ressourcenkalender/termine',{headers:{Origin:fixture.base,'Idempotency-Key':crypto.randomUUID()},data:{title:baseTitle,start:fixture.day+'T12:00:00Z',end:fixture.day+'T13:00:00Z',resourceIds:['sim-employee-3'],type:'FREIER',options:{status:'FREI'},continuationChoice:'single',acceptPlanningWarnings:true}});expect(created.status()).toBe(201);const original=await created.json();
 await calendar(page);await page.getByRole('button',{name:new RegExp('^'+baseTitle)}).first().dblclick();const title=page.getByRole('textbox',{name:'Titel *',exact:true}),nextTitle=baseTitle+' wieder verbunden';await title.fill(nextTitle);
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('heyelli:calendar-draft:v2:')).length)).toBeGreaterThan(0);
 let reads=0,keys=0;
 await page.route('**/api/ressourcenkalender?*',async route=>{reads++;await route.continue();});
 await page.route('**/api/ressourcenkalender/entwuerfe?key=1',async route=>{keys++;await route.continue();});
 // Retire only the browser handle. The real isolated session remains valid;
 // recovery must validate its owner with the server before restoring writes.
 await page.evaluate(()=>window.dispatchEvent(new Event('heyelli:session-invalid')));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect.poll(()=>reads).toBeGreaterThan(0);await expect.poll(()=>keys).toBeGreaterThan(0);await expect(title).toHaveValue(nextTitle);
 let releaseWrite,writeStarted=false;const pendingWrite=new Promise(resolve=>{releaseWrite=resolve;});
 await page.route('**/api/ressourcenkalender',async route=>{if(route.request().method()==='POST'){writeStarted=true;await pendingWrite;}await route.continue();});
 try{
  await expect(page.getByRole('button',{name:'Änderung speichern',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Änderung speichern',exact:true}).click();await expect(page.getByRole('dialog',{name:'Termin bearbeiten',exact:true})).toBeHidden();
  await expect.poll(()=>writeStarted).toBe(true);releaseWrite();let saved;
  await expect.poll(async()=>{saved=await (await context.request.get(fixture.base+'/api/ressourcenkalender?from='+fixture.day+'&to='+fixture.day)).json();return saved.events?.filter(event=>event.id===original.id&&event.title===nextTitle).length??0;},{timeout:25000}).toBe(1);expect(saved.permissions.serviceRead).toBe(true);
 }finally{releaseWrite();}
});

test('E33 Offener Werkzeugauftrag markiert Eingaben und blockiert weder Kalender noch Appnavigation',async({page,context,browserName})=>{
 const actor='tool-guard:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Werkzeugprüfung','admin',true)",[actor]);
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('heyelli:incident-draft:v1:'))throw new DOMException('Fiktive volle Ablage','QuotaExceededError');return original.call(this,key,value);};});
 await authenticate(context,actor);await enter(page,'/servicehub');
 const icon=page.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true});await icon.click();
 const panel=page.getByRole('region',{name:'Werkzeug CaseDesk',exact:true});
 const mobile=page.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');
 await mobile.getByRole('button',{name:/Objekt & technische Einheit/}).click();
 const input=mobile.getByRole('combobox').first();await input.fill('Muster');
 await expect(icon).toHaveAttribute('aria-describedby','incident-tool-draft');
 await page.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();
 await page.getByRole('link',{name:'PlanBoard öffnen',exact:true}).click();await expect(page).toHaveURL(/\/planboard$/);
 await expect(page.getByRole('dialog',{name:'Eingaben verwerfen?',exact:true})).toHaveCount(0);
 await page.goBack();await expect(page).toHaveURL(/\/servicehub$/);await page.goForward();await expect(page).toHaveURL(/\/planboard$/);
 await page.getByRole('button',{name:'Neu laden',exact:true}).click();await expect(page.getByRole('button',{name:'Neu laden',exact:true})).toBeEnabled();
 await icon.press('Control+r');
 const warning=page.getByRole('alertdialog',{name:'Auftrag im Werkzeug noch offen',exact:true});await expect(warning).toBeVisible();await page.screenshot({path:join(artifacts,'tool-draft-reload-warning-'+browserName+'.png')});
 await page.getByRole('button',{name:'Zum angefangenen Auftrag',exact:true}).click();await expect(panel).toBeVisible();await expect(input).toHaveValue('Muster');
 // The same shortcut from inside the child must reach the parent warning.
 await input.press('Control+r');await expect(warning).toBeVisible();await page.keyboard.press('Escape');await expect(warning).toBeHidden();await expect(input).toHaveValue('Muster');
 // A browser-toolbar reload still uses the native safety prompt. Cancel retains the exact frame.
 const native=page.waitForEvent('dialog');await page.evaluate(()=>{setTimeout(()=>location.reload(),0);});const dialog=await native;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();
 await expect(input).toHaveValue('Muster');await expect(panel).toBeVisible();
 await mobile.getByRole('button',{name:'Auftrag verwerfen',exact:true}).click();
 await mobile.getByRole('alertdialog',{name:'Auftrag verwerfen?',exact:true}).getByRole('button',{name:'Auftrag verwerfen',exact:true}).click();
 await expect(icon).not.toHaveAttribute('aria-describedby','incident-tool-draft');
 await page.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();
 await page.goBack();await expect(page).toHaveURL(/\/servicehub$/);await page.goForward();await expect(page).toHaveURL(/\/planboard$/);
 await expect(panel).toBeHidden();await page.reload();await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeEnabled();
 await page.screenshot({path:join(artifacts,'tool-draft-guard-'+browserName+'.png')});
});

test('E34 Werkzeugaufträge überstehen Neuladen und alle geschlossenen Tabs getrennt und verschlüsselt',async({page,context,browserName})=>{
 const actor='tool-durable:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Auftragssicherung','admin',true)",[actor]);await authenticate(context,actor);
 async function open(p){await enter(p,'/servicehub');await p.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true}).click();const frame=p.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');await frame.getByRole('button',{name:/Objekt & technische Einheit/}).click();return frame.getByRole('combobox',{name:'Objekt',exact:true});}
 const input=await open(page),text='Gesicherte Suche '+browserName;await input.fill(text);
 await expect.poll(async()=>{const r=await context.request.get(fixture.base+'/api/benutzerkonto/auftragsentwuerfe');return (await r.json()).records.length;}).toBeGreaterThan(0);
 expect(await page.evaluate(text=>JSON.stringify(localStorage).includes(text),text)).toBe(false);
 await page.reload();const restored=await openAfterReload(page);await expect(restored).toHaveValue(text);
 async function openAfterReload(p){await p.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true}).click();const f=p.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');await f.getByRole('button',{name:/Objekt & technische Einheit/}).click();return f.getByRole('combobox',{name:'Objekt',exact:true});}
 const second=await context.newPage(),other=await open(second);await second.screenshot({path:join(artifacts,'tool-draft-second-'+browserName+'.png')});await expect(other).toHaveValue('');await other.fill('Zweiter unabhängiger Auftrag');
 await expect.poll(()=>second.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('heyelli:incident-draft:v1:')).length)).toBeGreaterThan(1);
 await second.close();await page.close();expect(context.pages()).toHaveLength(0);
 const reopened=await context.newPage(),resumed=await open(reopened);await expect(resumed).toHaveValue('Zweiter unabhängiger Auftrag');
 const chooser=reopened.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]').getByRole('button',{name:/^Angefangenen Auftrag fortsetzen: /});await expect(chooser).toBeVisible();await chooser.click();await reopened.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]').getByRole('option').last().click();
 const f=reopened.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');await f.getByRole('button',{name:/Objekt & technische Einheit/}).click();await expect(f.getByRole('combobox',{name:'Objekt',exact:true})).toHaveValue(text);
 await reopened.screenshot({path:join(artifacts,'tool-draft-restored-'+browserName+'.png')});await reopened.close();
});

function encryptDraft(key,name,text){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key.key,'hex'),nonce);cipher.setAAD(Buffer.from(name));const bytes=Buffer.concat([cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]);return JSON.stringify({v:3,keyId:key.keyId,nonce:nonce.toString('hex'),data:bytes.toString('hex')});}
async function seedIncidentDraft(context,state){const key=await (await context.request.get(fixture.base+'/api/benutzerkonto/auftragsentwuerfe?key=1')).json(),draftId=crypto.randomUUID(),name='heyelli:incident-draft:v1:'+key.owner+':'+draftId;const record={kind:'incident-tool',version:1,draftId,branchId:crypto.randomUUID(),sequence:1,updatedAt:new Date().toISOString(),state};const stored=await context.request.post(fixture.base+'/api/benutzerkonto/auftragsentwuerfe',{headers:{Origin:fixture.base},data:{key:name,envelope:encryptDraft(key,name,JSON.stringify(record))}});expect(stored.status()).toBe(200);}
async function openIncidentTool(page){try{await enter(page,'/servicehub');}catch(error){await page.screenshot({path:join(artifacts,'tool-reopen-navigation-'+page.context().browser().browserType().name()+'.png'),mask:[page.locator('input[type=password]')]});throw error;}await page.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true}).click();const frame=page.frameLocator('iframe[title="CaseDesk – mobile Ansicht"]');await expect(frame.getByRole('heading',{name:'Neuer Serviceauftrag',exact:true})).toBeVisible();return frame;}
const incidentPayload=(problem)=>({reporter:'Demo',personId:'sim-person-1',personScope:'customer',problem,reportedAt:'2026-11-01T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'',appointment:'',appointmentDuration:'60',companionTechnicianIds:[],mobileIssue:false,document:null});
const readyIncidentState=(problem,key)=>({...emptyIncidentState,object:{id:'sim-object-1',label:'Fiktives Objekt'},unit:{id:'sim-unit-1',label:'Fiktive Anlage'},person:{id:'sim-person-1',label:'Fiktive Person'},bauleiter:{id:'sim-employee-4',label:'Fiktive Projektleitung'},contact:'+49 30 00000001',completed:['Objekt ausgewählt','Meldung erfasst','Später planen'],fields:{...emptyIncidentState.fields,problem},dates:{reportedAt:{date:'01.11.2026',time:'10:00'}},queries:{},pending:{key,payload:incidentPayload(problem)},requestKey:key});
test('E35 Verlorene Auftragsantwort wird nach Schließen ohne Duplikat mit derselben Kennung geprüft',async({page,context,browserName})=>{
 const actor='tool-retry:'+crypto.randomUUID(),problem='Fiktive gesicherte Störung '+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Wiederholung','admin',true)",[actor]);await authenticate(context,actor);
 const key=crypto.randomUUID();await seedIncidentDraft(context,readyIncidentState(problem,key));const frame=await openIncidentTool(page);let number='',requests=0;
 await context.route('**/api/pds-simulator/orders',async route=>{requests++;expect(route.request().headers()['idempotency-key']).toBe(key);const response=await route.fetch();expect(response.status()).toBe(201);const result=await response.json();if(!number)number=result.number;else expect(result.number).toBe(number);if(requests===1)await route.abort('internetdisconnected');else await route.fulfill({response});});
 await frame.getByRole('button',{name:'Serviceauftrag speichern',exact:true}).click();await expect(frame.getByRole('button',{name:'Speicherergebnis prüfen',exact:true})).toBeEnabled();
 await expect(frame.getByRole('button',{name:/Objekt & technische Einheit/})).toBeDisabled();await expect.poll(()=>number).not.toBe('');
 await page.close();expect(context.pages()).toHaveLength(0);const reopened=await context.newPage(),resumed=await openIncidentTool(reopened);
 await expect(resumed.getByRole('button',{name:'Speicherergebnis prüfen',exact:true})).toBeVisible();await resumed.getByRole('button',{name:'Speicherergebnis prüfen',exact:true}).click();await expect(resumed.getByRole('heading',{name:'Auftrag '+number+' gespeichert',exact:true})).toBeVisible();expect(requests).toBe(2);
 const data=await (await context.request.get(fixture.base+'/api/service')).json();expect(data.orders.filter(order=>order.number===number)).toHaveLength(1);await expect(resumed.getByRole('link',{name:'Termin im PlanBoard öffnen ›',exact:true})).toHaveCount(0);await expect(resumed.getByRole('link',{name:'Serviceauftrag im Service öffnen ›',exact:true})).toHaveAttribute('href',/akte=order/);
 await reopened.screenshot({path:join(artifacts,'tool-draft-retry-'+browserName+'.png')});await reopened.close();
});

test('E36 Unbestätigter Dateiupload bleibt verschlüsselt nach Neuladen wiederholbar',async({page,context,browserName})=>{
 const actor='tool-file:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Dateisicherung','admin',true)",[actor]);await authenticate(context,actor);const state=readyIncidentState('Fiktiver Dateientwurf',crypto.randomUUID());await seedIncidentDraft(context,{...state,channel:'E-Mail',pending:null,requestKey:null,completed:['Objekt ausgewählt','','']});
 let uploads=0,id='';await context.route('**/api/pds-simulator/uploads',async route=>{uploads++;const current=route.request().headers()['x-upload-id'];if(!id)id=current;else expect(current).toBe(id);if(uploads===1)await route.abort('internetdisconnected');else await route.continue();});
 let frame=await openIncidentTool(page);await frame.getByRole('button',{name:/Meldung & Kontakt/}).click();await frame.locator('input[type=file]').setInputFiles({name:'fiktiver-bericht.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFiktiver unverlierbarer Prüfbericht\n%%EOF')});
 await expect(frame.getByRole('button',{name:'Upload erneut versuchen',exact:true})).toBeVisible();await page.reload();frame=await openIncidentTool(page);await frame.getByRole('button',{name:/Meldung & Kontakt/}).click();await expect(frame.getByRole('button',{name:'Upload erneut versuchen',exact:true})).toBeVisible();await frame.getByRole('button',{name:'Upload erneut versuchen',exact:true}).click();await expect(frame.getByRole('status').filter({hasText:'Hochgeladen: fiktiver-bericht.pdf'})).toBeVisible();expect(uploads).toBe(2);
 await page.screenshot({path:join(artifacts,'tool-draft-file-'+browserName+'.png')});await page.close();
});

test('E37 Vollständige Werkzeugerfassung stellt rohe Formularwerte wieder her und trennt Benutzer',async({page,context,browserName})=>{
 const actor='tool-workflow:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Erfassungsablauf','admin',true)",[actor]);await authenticate(context,actor);let frame=await openIncidentTool(page);
 await frame.getByRole('button',{name:/Objekt & technische Einheit/}).click();await frame.getByRole('combobox',{name:'Objekt',exact:true}).fill('Beispielhaus Nord');await frame.getByRole('option',{name:/Beispielhaus Nord/}).click();await frame.getByRole('button',{name:/SIM-TE-101/}).click();await expect(frame.getByText('Anlagenchronik',{exact:true})).toBeVisible();await expect(frame.getByRole('region',{name:'Chronologische Anlagenereignisse'})).toHaveCount(0);await frame.getByRole('region',{name:'Objekt & technische Einheit',exact:true}).getByRole('button',{name:'Weiter',exact:true}).click();
 await frame.getByRole('combobox',{name:'Wer meldet die Störung?',exact:true}).fill('Andrea');await frame.getByRole('option',{name:/Andrea Beispiel/}).click();const problem='Fiktive vollständige Erfassung '+crypto.randomUUID();await frame.getByRole('textbox',{name:'Was ist die Störung? *',exact:true}).fill(problem);await frame.getByRole('textbox',{name:'Externe Auftragsnummer (optional)',exact:true}).fill('SIM-EXTERN-37');await frame.getByRole('textbox',{name:'Gemeldet am – Datum',exact:true}).fill('31.02.2026');await frame.getByLabel('Gemeldet am – Uhrzeit',{exact:true}).fill('10:17');
 await expect.poll(async()=>((await (await context.request.get(fixture.base+'/api/benutzerkonto/auftragsentwuerfe')).json()).records??[]).length).toBeGreaterThan(0);const ownRecord=(await (await context.request.get(fixture.base+'/api/benutzerkonto/auftragsentwuerfe')).json()).records[0];
 await page.reload();frame=await openIncidentTool(page);await frame.getByRole('button',{name:/Meldung & Kontakt/}).click();await expect(frame.getByRole('textbox',{name:'Was ist die Störung? *',exact:true})).toHaveValue(problem);await expect(frame.getByRole('textbox',{name:'Gemeldet am – Datum',exact:true})).toHaveValue('31.02.2026');await expect(frame.getByLabel('Gemeldet am – Uhrzeit',{exact:true})).toHaveValue('10:17');await expect(frame.getByRole('textbox',{name:'Externe Auftragsnummer (optional)',exact:true})).toHaveValue('SIM-EXTERN-37');await frame.getByRole('textbox',{name:'Gemeldet am – Datum',exact:true}).fill('01.11.2026');
 await frame.getByRole('region',{name:'Meldung & Kontakt',exact:true}).getByRole('button',{name:'Weiter',exact:true}).click();await frame.getByRole('button',{name:'Schritt überspringen',exact:true}).click();
 const report=frame.getByRole('region',{name:'Vollständiger Meldungstext',exact:true});
 await expect(report).toContainText(problem);
 await expect(report).toContainText('Störung/Auftragsbeschreibung:');
 await expect(report).toContainText('Ihre Auftragsnummer: SIM-EXTERN-37');
 const previewText=await report.locator('p').textContent();
 await expect(frame.getByRole('button',{name:'Abschluss',exact:true})).toHaveAttribute('aria-expanded','true');
 expect(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const remark='Hinweis zur fiktiven Heizungsanlage';
 await test.step('PDS-Bemerkung wiederherstellen',async()=>{
  const field=frame.getByRole('textbox',{name:/^PDS-Bemerkung/});
  await field.fill(remark);
  await field.blur();
  await page.reload();frame=await openIncidentTool(page);
  await expect(frame.getByRole('textbox',{name:/^PDS-Bemerkung/})).toHaveValue(remark);
 });
 await test.step('Auftrag mit separater PDS-Bemerkung speichern',async()=>{
  await test.step('Projektleiter auswählen',async()=>{
   const supervisor=frame.getByRole('combobox',{name:/^Projektleiter/});
   await supervisor.click({timeout:8000});
   await supervisor.fill('Sam',{timeout:8000});
   await frame.getByRole('option',{name:/Sam Test/}).click({timeout:8000});
  });
  await frame.getByRole('button',{name:'Serviceauftrag speichern',exact:true}).click({timeout:8000});
  await expect(frame.getByRole('heading',{name:/^Auftrag SIM-API-SA-\d+ gespeichert$/})).toBeVisible();
 });
 const href=await frame.getByRole('link',{name:'Serviceauftrag im Service öffnen ›',exact:true}).getAttribute('href');
 const id=new URL(href,fixture.base).searchParams.get('id');
 const storedOrder=await (await context.request.get(fixture.base+'/api/service?'+new URLSearchParams({kind:'order',id,part:'base'}))).json();
 expect(storedOrder.incidents[0].work).toBe(previewText);
 const store=openOrderStore(fixture.simulatorDatabase);
 try{expect(store.apiEntity(storedOrder.incidents[0].id).data.bemerkung).toBe(remark);}
 finally{store.close();}
 await page.screenshot({path:join(artifacts,'tool-draft-workflow-'+browserName+'.png')});await page.close();const other='tool-other:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktives anderes Konto','admin',true)",[other]);await authenticate(context,other);expect((await (await context.request.get(fixture.base+'/api/benutzerkonto/auftragsentwuerfe')).json()).records).toEqual([]);const rejected=await context.request.post(fixture.base+'/api/benutzerkonto/auftragsentwuerfe',{headers:{Origin:fixture.base},data:ownRecord});expect(rejected.status()).toBe(403);const next=await context.newPage(),otherFrame=await openIncidentTool(next);await otherFrame.getByRole('button',{name:/Objekt & technische Einheit/}).click();await expect(otherFrame.getByRole('combobox',{name:'Objekt',exact:true})).toHaveValue('');await next.close();
});

test('E38 Serviceakte öffnet und fokussiert den richtigen Kalendertermin mit Leserecht',async({page,context,browser,browserName})=>{
 const planner='calendar-jump:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Kalendersprung','admin',true)",[planner]);await authenticate(context,planner);const prefs=await (await context.request.get(fixture.base+'/api/ressourcenkalender/ressourcenauswahl')).json();expect((await context.request.post(fixture.base+'/api/ressourcenkalender/ressourcenauswahl',{headers:{Origin:fixture.base},data:{owner:prefs.owner,expectedVersion:prefs.version,selection:['sim-employee-3'],showWeekends:false,limitWorkingHours:true}})).status()).toBe(200);const overview=await (await context.request.get(fixture.base+'/api/service')).json();expect(overview.canReadCalendar).toBe(true);const order=overview.orders.find(order=>order.number==='SIM-SA-10002'),incident=order.incidents.find(incident=>incident.start&&incident.technicianId);expect(incident).toBeTruthy();await enter(page,'/servicehub?'+new URLSearchParams({ansicht:'orders',akte:'order',id:order.id}));const link=page.getByRole('link',{name:'Im PlanBoard anzeigen',exact:true}).first();await expect(link).toBeVisible();await page.setViewportSize({width:390,height:844});await expect(link).toBeVisible();const bounds=await link.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);await page.setViewportSize({width:1280,height:900});const href=await link.getAttribute('href');expect(new URL(href,fixture.base).searchParams.get('einsatz')).toBe(incident.id);await link.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/planboard\?/);const target=page.locator('[data-jump-target=true]');await expect(target).toHaveAttribute('data-service-incident',incident.id);await expect(target).toHaveAttribute('data-service-order',order.id);await expect(target.locator('.calendar-bar-body')).toBeFocused();await expect(page.getByRole('button',{name:'Tag',exact:true})).toHaveAttribute('aria-pressed','true');await page.screenshot({path:join(artifacts,'service-calendar-jump-'+browserName+'.png')});const retained=await (await context.request.get(fixture.base+'/api/ressourcenkalender/ressourcenauswahl')).json();expect(retained.selection).toEqual(['sim-employee-3']);expect(retained.showWeekends).toBe(false);expect(retained.limitWorkingHours).toBe(true);
 const resourceSearch=page.getByRole('searchbox',{name:'Ressourcen',exact:true});await expect(resourceSearch).toHaveValue(incident.technician);await page.setViewportSize({width:390,height:844});const clear=page.getByRole('button',{name:'Ressourcenfilter entfernen',exact:true});await expect(clear).toBeVisible();const clearBounds=await clear.boundingBox();expect(clearBounds.x+clearBounds.width).toBeLessThanOrEqual(391);await page.screenshot({path:join(artifacts,'calendar-visible-link-filter-'+browserName+'.png')});await clear.press('Enter');await expect(resourceSearch).toHaveCount(0);await expect(page).not.toHaveURL(/mitarbeiter=|einsatz=|auftrag=/);await expect(page.locator('[data-track="sim-employee-3"]')).toBeVisible();await page.reload();await expect(resourceSearch).toHaveCount(0);await expect(page.locator('[data-track="sim-employee-3"]')).toBeVisible();
 await page.setViewportSize({width:1280,height:900});await page.goto(fixture.base+'/planboard?'+new URLSearchParams({datum:new URL(href,fixture.base).searchParams.get('datum'),mitarbeiter:incident.technicianId}));await expect(resourceSearch).toHaveValue(incident.technician);await resourceSearch.fill('Robin');await expect(page).not.toHaveURL(/mitarbeiter=/);await expect(resourceSearch).toHaveValue('Robin');await expect(page.locator('[data-track="sim-employee-3"]')).toBeVisible();await page.getByRole('button',{name:'Ressourcenfilter entfernen',exact:true}).click();await expect(resourceSearch).toHaveCount(0);await page.getByRole('button',{name:'Neu laden',exact:true}).click();await expect(page.getByRole('button',{name:'Neu laden',exact:true})).toBeEnabled();await expect(resourceSearch).toHaveCount(0);
 const role='service-only-'+crypto.randomUUID(),actor='service-only:'+crypto.randomUUID();await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,'Fiktive Service-Leserolle','reader','[\"/servicehub\"]','[]')",[role]);await sql("INSERT INTO platform.users(id,display_name,role,enabled,app_role_id) VALUES($1,'Fiktiver Service-Leser','reader',true,$2)",[actor,role]);const restricted=await browser.newContext();await authenticate(restricted,actor);const reader=await restricted.newPage();await enter(reader,'/servicehub?'+new URLSearchParams({ansicht:'orders',akte:'order',id:order.id}));await expect(reader.getByRole('heading',{name:order.number,exact:true})).toBeVisible();expect((await (await restricted.request.get(fixture.base+'/api/service')).json()).canReadCalendar).toBe(false);await expect(reader.getByRole('link',{name:'Im PlanBoard anzeigen',exact:true})).toHaveCount(0);expect((await restricted.request.get(fixture.base+'/api/ressourcenkalender?from=2026-11-04&to=2026-11-05')).status()).toBe(403);await restricted.close();
});

test('E39 Service-Link bleibt bei älterer Kalenderantwort erhalten und verweigert explizit fehlende Rechte',async({page,context,browser,browserName})=>{
 await authenticate(context);let denied=false;
 const order=await (await context.request.get(fixture.base+'/api/service?kind=order&id=sim-order-2&part=base')).json(),start=order.incidents.find(row=>row.id==='sim-order-2-incident')?.start;
 expect(start).toBeTruthy();const path='/planboard?datum='+new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(start));
 async function oldCalendar(route){const response=await route.fetch(),body=await response.json();if(body.permissions){if(denied)body.permissions.serviceRead=false;else delete body.permissions.serviceRead;}await route.fulfill({response,json:body});}
 await page.route('**/api/ressourcenkalender?*',oldCalendar);
 async function open(target){await enter(target,path);await target.getByRole('button',{name:'Tag',exact:true}).click();await expect(target.getByRole('button',{name:'Neuer Termin',exact:true})).toBeEnabled();await target.getByRole('button',{name:/^SIM-SA-10002(?: ·|,)/}).first().click();}
 await open(page);await expect(page.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toHaveAttribute('href','/servicehub?ansicht=orders&akte=order&id=sim-order-2');await page.screenshot({path:join(artifacts,'calendar-service-link-compatible-'+browserName+'.png')});
 denied=true;await page.getByRole('button',{name:'Neu laden',exact:true}).click();await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeEnabled();await page.getByRole('button',{name:/^SIM-SA-10002(?: ·|,)/}).first().click();await expect(page.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toHaveCount(0);
 const role='calendar-compat-'+crypto.randomUUID(),actor='calendar-compat:'+crypto.randomUUID();await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,$1,'reader','[\"/planboard\"]','[]')",[role]);await sql("INSERT INTO platform.users(id,display_name,role,app_role_id,enabled) VALUES($1,'Fiktiver Kalenderleser','reader',$2,true)",[actor,role]);const restricted=await browser.newContext();await authenticate(restricted,actor);const reader=await restricted.newPage();denied=false;await reader.route('**/api/ressourcenkalender?*',oldCalendar);await enter(reader,path);await reader.getByRole('button',{name:'Tag',exact:true}).click();await reader.getByRole('button',{name:/^SIM-SA-10002(?: ·|,)/}).first().click();await expect(reader.getByRole('menuitem',{name:'Im Service öffnen',exact:true})).toHaveCount(0);expect((await restricted.request.get(fixture.base+'/api/service')).status()).toBe(403);await restricted.close();
});

async function openNotes(page){await page.getByRole('button',{name:'Notizen als Werkzeug öffnen',exact:true}).click();const panel=page.getByRole('region',{name:'Werkzeug Notizen',exact:true});await expect(panel).toBeVisible();const input=panel.getByRole('textbox',{name:'Persönliche Notizen',exact:true});await expect(input).toBeEnabled();return {panel,input};}
test('E40 Notizen speichern persönlich, erhalten offene Eingaben und beachten Rollen sowie Sichtbarkeit',async({page,context,browser,browserName})=>{
 const actor='notes-ui:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive persönliche Notizen','admin',true)",[actor]);await authenticate(context,actor);await enter(page,'/servicehub');let {panel,input}=await openNotes(page);const original='Meine fiktiven Notizen '+browserName+'\nZweite Zeile';await input.fill(original);
 await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe(original);await page.getByRole('button',{name:'Notizen schließen',exact:true}).click();({panel,input}=await openNotes(page));await expect(input).toHaveValue(original);await input.press('Escape');await expect(panel).toBeHidden();await expect(page.getByRole('button',{name:'Notizen als Werkzeug öffnen',exact:true})).toBeFocused();
 await page.getByRole('link',{name:'PlanBoard öffnen',exact:true}).click();await expect(page).toHaveURL(/\/planboard$/);await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeEnabled();({panel,input}=await openNotes(page));await expect(input).toHaveValue(original);
 let blocked=true;await context.route('**/api/benutzerkonto/notizen',async route=>{if(route.request().method()==='POST'&&blocked)await route.abort('internetdisconnected');else await route.continue();});const pending='Noch nicht übertragene fiktive Notiz '+crypto.randomUUID();await input.fill(pending);await expect(input).toHaveValue(pending);await expect(panel.getByRole('alert')).toBeVisible();expect(await page.evaluate(text=>JSON.stringify(localStorage).includes(text),pending)).toBe(false);await page.close();expect(context.pages()).toHaveLength(0);blocked=false;
 const reopened=await context.newPage();await enter(reopened,'/servicehub');({panel,input}=await openNotes(reopened));await expect(input).toHaveValue(pending);await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe(pending);
 await enter(reopened,'/benutzerkonto?bereich=tools');const toggle=reopened.getByRole('switch',{name:'Notizen',exact:true});await toggle.uncheck();await expect(toggle).toBeEnabled();await expect(reopened.getByRole('button',{name:'Notizen als Werkzeug öffnen',exact:true})).toHaveCount(0);await reopened.reload();await expect(toggle).not.toBeChecked();await toggle.check();await expect(toggle).toBeEnabled();({panel,input}=await openNotes(reopened));await expect(input).toHaveValue(pending);await reopened.screenshot({path:join(artifacts,'personal-notes-'+browserName+'.png')});await axe(reopened,'personal-notes-'+browserName);await reopened.setViewportSize({width:390,height:844});await expect(panel).toBeHidden();await expect(reopened.getByRole('button',{name:'Notizen als Werkzeug öffnen',exact:true})).toBeHidden();await reopened.setViewportSize({width:1280,height:900});await expect(input).toHaveValue(pending);
 const denied=await browser.newContext();await authenticate(denied,fixture.mixed);expect((await denied.request.get(fixture.base+'/api/benutzerkonto/notizen')).status()).toBe(403);expect((await denied.request.post(fixture.base+'/api/benutzerkonto/notizen',{headers:{Origin:fixture.base},data:{owner:'wrong',body:'x',version:0}})).status()).toBe(403);await denied.close();
 const role='notes-only-'+crypto.randomUUID(),other='notes-other:'+crypto.randomUUID();await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps,tools) VALUES($1,$1,'reader','[\"/servicehub\"]','[]','[\"notes\"]')",[role]);await sql("INSERT INTO platform.users(id,display_name,role,enabled,app_role_id) VALUES($1,'Fiktive andere Notizen','reader',true,$2)",[other,role]);const own=await browser.newContext();await authenticate(own,other);const empty=await (await own.request.get(fixture.base+'/api/benutzerkonto/notizen')).json();expect(empty.note.body).toBe('');const foreign=(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).owner;expect((await own.request.post(fixture.base+'/api/benutzerkonto/notizen',{headers:{Origin:fixture.base},data:{owner:foreign,body:'Nicht übernehmen',version:0}})).status()).toBe(409);expect((await own.request.post(fixture.base+'/api/benutzerkonto/notizen',{headers:{Origin:fixture.base},data:{owner:empty.owner,body:'Nur dieses Konto',version:0}})).status()).toBe(200);expect((await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe(pending);await sql("UPDATE platform.app_roles SET tools='[]' WHERE id=$1",[role]);expect((await own.request.get(fixture.base+'/api/benutzerkonto/notizen')).status()).toBe(403);await own.close();await reopened.close();
});

test('E41 Parallele Notizen führen getrennte Änderungen zusammen und erhalten echte Konflikte',async({page,context,browserName})=>{
 const actor='notes-merge:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive parallele Notizen','admin',true)",[actor]);await authenticate(context,actor);const initial=await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json();await context.request.post(fixture.base+'/api/benutzerkonto/notizen',{headers:{Origin:fixture.base},data:{owner:initial.owner,body:'erste\nzweite',version:0}});await enter(page,'/servicehub');const first=await openNotes(page),second=await context.newPage();let frozen=await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json();await second.route('**/api/benutzerkonto/notizen',async route=>{if(route.request().method()==='GET')await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(frozen)});else await route.continue();});await enter(second,'/servicehub');let other=await openNotes(second);await first.input.fill('ERSTE\nzweite');await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe('ERSTE\nzweite');await other.input.fill('erste\nZWEITE');await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe('ERSTE\nZWEITE');await expect(other.input).toHaveValue('ERSTE\nZWEITE');
 frozen=await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json();await page.reload();await second.reload();const current=await openNotes(page);other=await openNotes(second);await current.input.fill('Andere Fassung');await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe('Andere Fassung');await other.input.fill('Meine Fassung');await expect(other.panel.getByRole('textbox',{name:'Gespeicherte Fassung',exact:true})).toHaveValue('Andere Fassung');await expect(other.input).toHaveValue('Meine Fassung');await second.screenshot({path:join(artifacts,'personal-notes-conflict-'+browserName+'.png')});await other.panel.getByRole('button',{name:'Beide Fassungen übernehmen',exact:true}).click();await expect.poll(async()=>(await (await context.request.get(fixture.base+'/api/benutzerkonto/notizen')).json()).note.body).toBe('Meine Fassung\n\n---\n\nAndere Fassung');await second.close();
});

test('E42 Serviceauftragsaktionen sind kompakte Symbole und Statuswechsel schützen Wiederholungen',async({page,context,browser,browserName})=>{
 test.setTimeout(120000);
 await authenticate(context);
 const statusKey='service-status:sim-order-2',initialStatus={uuid:'sim-status-ausgegeben',bezeichnung:'Ausgegeben'};
 function writeFixtureStatus(status){
  const store=openOrderStore(fixture.simulatorDatabase);
  try{store.apiPut(statusKey,'service-status',status);}finally{store.close();}
 }
 writeFixtureStatus(initialStatus);
 try {
 const overview=await (await context.request.get(fixture.base+'/api/service')).json(),order=overview.orders.find(item=>item.id==='sim-order-2');expect(order).toBeTruthy();
 await enter(page,'/servicehub?ansicht=orders&akte=order&id='+order.id);const file=page.getByRole('complementary',{name:'Akte',exact:true}),toolbar=file.getByRole('group',{name:'Aktenaktionen',exact:true});await expect(toolbar.getByRole('link',{name:'Im PlanBoard anzeigen',exact:true}).first()).toBeVisible();expect(await toolbar.getByRole('link',{name:'Im PlanBoard anzeigen',exact:true}).first().textContent()).toBe('');await expect(toolbar.getByRole('button',{name:'Terminbestätigung',exact:true}).first()).toHaveAttribute('title',/Terminbestätigung vorbereiten|Zuerst Termin und Haupttechniker zuordnen/);
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>{element.dataset.theme=value;},theme);
  await expect.poll(()=>toolbar.evaluate(element=>{
   const context=document.createElement('canvas').getContext('2d');
   const color=node=>{
    context.clearRect(0,0,1,1);
    context.fillStyle=getComputedStyle(node).backgroundColor;
    context.fillRect(0,0,1,1);
    return Array.from(context.getImageData(0,0,1,1).data);
   };
   const navigation=element.querySelector('[aria-label^="Kundenakte"]').parentElement;
   const [surface,fill]=[color(element),color(navigation)];
   return surface[3]>=210&&fill[3]>=180&&surface.slice(0,3).some((channel,index)=>Math.abs(channel-fill[index])>=12)&&getComputedStyle(navigation).boxShadow!=='none';
  })).toBe(true);
  await page.screenshot({path:join(artifacts,'toolbar-material-'+browserName+'-'+theme+'.png')});
 }
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await axe(page,'order-actions-'+browserName+'-'+width);}
 await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toHaveAttribute('aria-expanded','false');
 await toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/}).click();
 await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toHaveAttribute('aria-expanded','true');
 const statusMenu=toolbar.getByRole('menu',{name:'Auftragsstatus',exact:true});
 await expect(statusMenu).toHaveAttribute('data-slot','popover-content');
 await expect(statusMenu.getByRole('menuitem',{name:'Mobil ausgeben',exact:true})).toBeEnabled();
 await page.screenshot({path:join(artifacts,'order-status-menu-'+browserName+'.png')});
 await toolbar.getByRole('menuitem',{name:'Mobil ausgeben',exact:true}).click();
 const confirm=page.getByRole('alertdialog',{name:'Auftrag mobil ausgeben?',exact:true});
 await expect(confirm).toBeVisible();
 await expect(confirm).toContainText(order.incidents[0].technician);
 await confirm.getByRole('button',{name:'Abbrechen',exact:true}).click();let lost=false;const operations=new Set();await page.route('**/api/service/status?*',async route=>{if(route.request().method()!=='POST')return route.continue();operations.add(route.request().postDataJSON().operationId);if(lost)return route.continue();const response=await route.fetch();expect(response.ok()).toBe(true);lost=true;await route.abort('connectionreset');});
 await toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/}).click();
 await toolbar.getByRole('menuitem',{name:'Mobil ausgeben',exact:true}).click();
 await confirm.getByRole('button',{name:'Mobil ausgeben',exact:true}).click();
 await expect(confirm).toContainText('Verbindung wurde unterbrochen');
 await confirm.getByRole('button',{name:'Mobil ausgeben',exact:true}).click();
 await expect(confirm).toBeHidden();expect(operations.size).toBe(1);await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toContainText('Ausgegeben Mobil');
 const prepared=await (await context.request.get(fixture.base+'/api/service/status?id='+order.id)).json();expect((await context.request.post(fixture.base+'/api/service/status?id='+order.id,{headers:{Origin:fixture.base},data:{...prepared,operationId:crypto.randomUUID(),action:'cancel',expected:'0'.repeat(64)}})).status()).toBe(409);
 const reader='status-reader:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Statusleser','reader',true)",[reader]);const restricted=await browser.newContext();await authenticate(restricted,reader);expect((await restricted.request.post(fixture.base+'/api/service/status?id='+order.id,{headers:{Origin:fixture.base},data:{...prepared,operationId:crypto.randomUUID(),action:'cancel'}})).status()).toBe(403);await restricted.close();
 await toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/}).click();await toolbar.getByRole('menuitem',{name:'Stornieren',exact:true}).click();const cancel=page.getByRole('alertdialog',{name:'Auftragsstatus ändern?',exact:true});await expect(cancel).toContainText('Storniert');await cancel.getByRole('button',{name:'Status ändern',exact:true}).click();await expect(cancel).toBeHidden();await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toContainText('Storniert');
 writeFixtureStatus({uuid:'sim-status-serviceauftrag-8',bezeichnung:'Mobil abgeholt'});await page.reload();await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toContainText('Mobil abgeholt');await toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/}).click();await expect(toolbar.getByRole('menuitem',{name:'Stornieren',exact:true})).toHaveCount(0);await toolbar.getByRole('menuitem',{name:'Manuell stornieren',exact:true}).click();await expect(cancel).toContainText('Manuell storniert');await page.screenshot({path:join(artifacts,'order-manual-cancel-'+browserName+'.png')});await cancel.getByRole('button',{name:'Status ändern',exact:true}).click();await expect(cancel).toBeHidden();await expect(toolbar.getByRole('button',{name:/^Auftragsstatus ändern ·/})).toContainText('Manuell storniert');expect(Number((await sql("SELECT count(*) AS n FROM platform.audit_events WHERE actor_id=$1 AND target_id=$2 AND action='service.status.updated'",[fixture.admin,order.id])).rows[0].n)).toBeGreaterThanOrEqual(3);
 } finally {
  writeFixtureStatus(initialStatus);
 }
});

test('E43 CaseDesk Standardpositionen speichern automatisch und landen einmalig im neuen Auftrag',async({page,context,browser,browserName})=>{
 test.setTimeout(120000);
 await authenticate(context);const endpoint=fixture.base+'/api/verwaltung/stoerungsmeister',headers={Origin:fixture.base};let settings=await (await context.request.get(endpoint)).json();expect((await context.request.post(endpoint,{headers,data:{source:settings.source,version:settings.version,positions:[]}})).ok()).toBe(true);
 await enter(page,'/einstellungen?bereich=incident&seite=incident:positions');const panel=page.getByRole('region',{name:'Standardpositionen für Störungsaufträge',exact:true});
 await panel.getByRole('button',{name:'Position hinzufügen',exact:true}).click();
 await panel.getByRole('searchbox').fill('Anfahrt');
 await panel.getByRole('button',{name:/^SIM Anfahrt Service/}).click();
 await expect(panel.getByRole('status').last()).toHaveText('Gespeichert');
 await panel.getByRole('textbox',{name:'Positionsnummer · SIM Anfahrt Service',exact:true}).fill('1.010');
 await panel.getByRole('textbox',{name:'Menge · SIM Anfahrt Service',exact:true}).fill('2,5');
 await expect(panel.getByRole('status').last()).toHaveText('Gespeichert');
 await page.reload();
 await expect(panel.getByRole('textbox',{name:'Menge · SIM Anfahrt Service',exact:true})).toHaveValue('2.5');
 await expect(panel.getByRole('textbox',{name:'Positionsnummer · SIM Anfahrt Service',exact:true})).toHaveValue('1.010');
 let drop=true;const attempts=[];
 await page.route('**/api/verwaltung/stoerungsmeister',async route=>{if(route.request().method()!=='POST')return route.continue();attempts.push(route.request().postDataJSON());if(!drop)return route.continue();const response=await route.fetch();expect(response.ok()).toBe(true);drop=false;
 await route.abort('connectionreset');});
 await panel.getByRole('textbox',{name:'Menge · SIM Anfahrt Service',exact:true}).fill('3');
 await expect(panel.getByRole('button',{name:'Speicherung erneut versuchen',exact:true})).toBeVisible();
 await expect(panel.getByRole('textbox',{name:'Menge · SIM Anfahrt Service',exact:true})).toHaveValue('3');
 await panel.getByRole('button',{name:'Speicherung erneut versuchen',exact:true}).click();
 await expect(panel.getByRole('status').last()).toHaveText('Gespeichert');expect(attempts.length).toBe(2);expect(attempts[0]).toEqual(attempts[1]);
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await axe(page,'incident-defaults-'+browserName+'-'+width);}await page.screenshot({path:join(artifacts,'incident-defaults-'+browserName+'.png')});settings=await (await context.request.get(endpoint)).json();expect(settings.positions[0].quantity).toBe(3);
 const key=crypto.randomUUID(),problem='Fiktiver Standardpositionenauftrag '+key,input={personId:'sim-person-1',problem,reportedAt:'2026-11-16T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'',appointment:'',appointmentDuration:'',mobileIssue:false};const created=await context.request.post(fixture.base+'/api/pds-simulator/orders',{headers:{...headers,'Idempotency-Key':key},data:input});expect(created.status()).toBe(201);const receipt=await created.json();const changed=settings.positions.map(row=>({...row,quantity:8}));expect((await context.request.post(endpoint,{headers,data:{...settings,positions:changed}})).ok()).toBe(true);const repeated=await context.request.post(fixture.base+'/api/pds-simulator/orders',{headers:{...headers,'Idempotency-Key':key},data:input});expect((await repeated.json()).number).toBe(receipt.number);const overview=await (await context.request.get(fixture.base+'/api/service')).json(),orders=overview.orders.filter(row=>row.number===receipt.number);expect(orders.length).toBe(1);const core=await (await context.request.get(fixture.base+'/api/service?'+new URLSearchParams({kind:'order',id:orders[0].id,part:'base'}))).json(),materials=await (await context.request.get(fixture.base+'/api/service/einsatzmappe?'+new URLSearchParams({order:orders[0].id,revision:core.sourceRevision,section:'positions'}))).json();expect(materials.groups[0].rows.length).toBe(1);expect(materials.groups[0].rows[0]).toMatchObject({number:'1.010',name:'SIM Anfahrt Service',quantity:3});
 const reader='defaults-reader:'+crypto.randomUUID();
 await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Vorgabenleser','reader',true)",[reader]);const denied=await browser.newContext();
 await authenticate(denied,reader);expect((await denied.request.get(endpoint)).status()).toBe(403);expect((await denied.request.post(endpoint,{headers,data:{...settings,positions:[]}})).status()).toBe(403);
 await denied.close();const latest=await (await context.request.get(endpoint)).json();expect((await context.request.post(endpoint,{headers,data:{...latest,version:0,positions:[]}})).status()).toBe(409);expect((await context.request.post(endpoint,{headers,data:{...latest,source:'pds:other',positions:[]}})).status()).toBe(409);
});

test('E44 Abschlusslinks öffnen den gespeicherten Termin und Serviceauftrag in der Haupt-App',async({page,context,browser,browserName})=>{
 test.setTimeout(90000);const actor='completion-links:'+crypto.randomUUID();
 await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Abschlusslinks','admin',true)",[actor]);
 await authenticate(context,actor);const key=crypto.randomUUID(),problem='Fiktiver geplanter Abschluss '+key,state=readyIncidentState(problem,key);state.planning=true;state.technician={id:'sim-employee-1',label:'Alex Beispiel'};state.completed[2]='Techniker und Termin zugeordnet';state.pending.payload={...state.pending.payload,technicianId:'sim-employee-1',appointment:fixture.day+'T09:00'};
 await seedIncidentDraft(context,state);const frame=await openIncidentTool(page);
 await frame.getByRole('button',{name:'Serviceauftrag speichern',exact:true}).click();
 await expect(frame.getByRole('heading',{name:/^Auftrag SIM-API-SA-\d+ gespeichert$/})).toBeVisible();const next=frame.getByRole('link',{name:'Weiteren Auftrag aufnehmen ›',exact:true}),calendar=frame.getByRole('link',{name:'Termin im PlanBoard öffnen ›',exact:true}),service=frame.getByRole('link',{name:'Serviceauftrag im Service öffnen ›',exact:true});
 await expect(calendar).toBeVisible();
 await expect(service).toBeVisible();const href=await calendar.getAttribute('href'),url=new URL(href,fixture.base),serviceHref=await service.getAttribute('href');expect(url.searchParams.get('datum')).toBe(fixture.day);expect(url.searchParams.get('mitarbeiter')).toBe('sim-employee-1');expect(new URL(serviceHref,fixture.base).searchParams.get('id')).toBe(url.searchParams.get('auftrag'));expect((await calendar.boundingBox()).y).toBeGreaterThan((await next.boundingBox()).y);expect((await service.boundingBox()).y).toBeGreaterThan((await calendar.boundingBox()).y);
 await page.screenshot({path:join(artifacts,'incident-completion-links-'+browserName+'.png')});
 await calendar.click();
 await expect(page).toHaveURL(fixture.base+href);
 await expect(page.locator('[data-jump-target=true]')).toHaveAttribute('data-service-incident',url.searchParams.get('einsatz'));
 await expect(page.getByRole('region',{name:'Werkzeug CaseDesk',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'CaseDesk als Werkzeug öffnen',exact:true}).click();
 await frame.getByRole('link',{name:'Serviceauftrag im Service öffnen ›',exact:true}).click();
 await expect(page).toHaveURL(fixture.base+serviceHref);
 await expect(page.getByRole('complementary',{name:'Akte',exact:true}).getByRole('heading',{name:/SIM-API-SA-/})).toBeVisible();
 const restricted=await browser.newContext(),role='completion-only-'+crypto.randomUUID(),reader='completion-only:'+crypto.randomUUID();
 await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,'Fiktive Erfassungsrolle','dispatcher','[\"/casedesk\"]','[\"/casedesk\"]')",[role]);
 await sql("INSERT INTO platform.users(id,display_name,role,enabled,app_role_id) VALUES($1,'Fiktive eingeschränkte Erfassung','dispatcher',true,$2)",[reader,role]);
 await authenticate(restricted,reader);const result=await restricted.request.post(fixture.base+'/api/pds-simulator/orders',{headers:{Origin:fixture.base,'Idempotency-Key':crypto.randomUUID()},data:incidentPayload('Fiktiver Abschluss ohne Ziel-App-Rechte')});expect(result.status()).toBe(201);expect((await result.json()).links).toEqual({service:null,calendar:null});
 await restricted.close();
});

test('E45 Verfügbarkeit schlägt freie Techniker und durchgehende Zeiten vor und behält Eingaben bei Abbruch',async({page,context,browserName})=>{
 test.setTimeout(90000);const actor='availability:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Verfügbarkeitsprüfung','admin',true)",[actor]);await authenticate(context,actor);
 const day='2030-01-07',created=await context.request.post(fixture.base+'/api/ressourcenkalender/termine',{headers:{Origin:fixture.base,'Idempotency-Key':crypto.randomUUID()},data:{type:'FREIER',continuationChoice:'single',acceptPlanningWarnings:true,title:'Fiktive Belegung',start:day+'T09:00:00Z',end:day+'T10:00:00Z',resourceIds:['sim-employee-1']}});expect(created.status()).toBe(201);
 const query=new URLSearchParams({start:day+'T10:00',duration:'60',main:'sim-employee-1',team:'[]'}).toString(),response=await context.request.get(fixture.base+'/api/planung/verfuegbarkeit?'+query);expect(response.status()).toBe(200);const data=await response.json();expect(data.people[0].status).toBe('blocked');expect(data.alternatives.length).toBeGreaterThan(0);expect(data.slots[0].start).toBe(day+'T11:00');expect(JSON.stringify(data)).not.toContain('Fiktive Belegung');
 const state=readyIncidentState('Fiktive Verfügbarkeitsfrage',crypto.randomUUID());Object.assign(state,{activeStep:2,planning:true,technician:{id:'sim-employee-1',label:'Alex Beispiel'},pending:null,requestKey:null});state.dates.appointment={date:'07.01.2030',time:'10:00'};state.fields.appointmentDuration='60';await seedIncidentDraft(context,state);const frame=await openIncidentTool(page);await frame.getByRole('button',{name:/Techniker & Termin/}).click();const dialog=frame.getByRole('region',{name:'Techniker & Termin'}),availability=dialog.getByRole('region',{name:'Verfügbarkeit'});
 await expect(availability.getByText('Nicht durchgehend frei',{exact:true})).toBeVisible();await availability.getByRole('button',{name:/07\.01\.2030 · 11:00/}).click();await expect(dialog.getByRole('textbox',{name:'Einsatzbeginn – Datum',exact:true})).toHaveValue('07.01.2030');await expect(dialog.getByLabel('Einsatzbeginn – Uhrzeit',{exact:true})).toHaveValue('11:00');await expect(dialog.locator('input[name=appointmentDuration]')).toHaveValue('60');await expect(availability.getByText('Frei',{exact:true})).toBeVisible();
 await dialog.getByLabel('Einsatzbeginn – Uhrzeit',{exact:true}).fill('10:00');await expect(availability.getByText('Nicht durchgehend frei',{exact:true})).toBeVisible();const alternative=data.alternatives[0];await availability.getByRole('button',{name:new RegExp(alternative.name)}).click();await expect(availability.getByText('Frei',{exact:true})).toBeVisible();
 await page.route('**/api/planung/verfuegbarkeit?*',route=>route.abort('failed'));await availability.getByRole('button',{name:'Erneut prüfen'}).click();await expect(availability.getByText(/Verbindung unterbrochen/)).toBeVisible();await expect(dialog.getByLabel('Einsatzbeginn – Uhrzeit',{exact:true})).toHaveValue('10:00');await expect(dialog.locator('input[name=appointmentDuration]')).toHaveValue('60');await page.unroute('**/api/planung/verfuegbarkeit?*');await availability.getByRole('button',{name:'Erneut prüfen'}).click();await expect(availability.getByText('Frei',{exact:true})).toBeVisible();
 await availability.scrollIntoViewIfNeeded();expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);await page.screenshot({path:join(artifacts,'availability-'+browserName+'.png')});
 let seen;const started=new Promise(resolve=>{seen=resolve;});await page.route('**/api/planung/verfuegbarkeit?*',async route=>{if(new URL(route.request().url()).searchParams.get('duration')==='75'){seen();await new Promise(resolve=>setTimeout(resolve,800));}await route.continue().catch(()=>{});});await dialog.locator('input[name=appointmentDuration]').fill('75');await started;await dialog.locator('input[name=appointmentDuration]').fill('90');await expect(availability.getByText('Frei',{exact:true})).toBeVisible();await expect(dialog.locator('input[name=appointmentDuration]')).toHaveValue('90');await page.unroute('**/api/planung/verfuegbarkeit?*');
 const ownDay=browserName==='webkit'?'2030-01-09':'2030-01-08',planned=await context.request.post(fixture.base+'/api/pds-simulator/orders',{headers:{Origin:fixture.base,'Idempotency-Key':crypto.randomUUID()},data:{...incidentPayload('Fiktiver bestehender Einsatz'),technicianId:'sim-employee-1',appointment:ownDay+'T10:00'}});expect(planned.status()).toBe(201);const receipt=await planned.json(),incidentId=new URL(receipt.links.calendar,fixture.base).searchParams.get('einsatz'),ownQuery=new URLSearchParams({start:ownDay+'T10:00',duration:'60',main:'sim-employee-1',team:'[]'});expect((await (await context.request.get(fixture.base+'/api/planung/verfuegbarkeit?'+ownQuery)).json()).people[0].status).toBe('blocked');ownQuery.set('existingIncidentId',incidentId);expect((await (await context.request.get(fixture.base+'/api/planung/verfuegbarkeit?'+ownQuery)).json()).people[0].status).toBe('free');
 const role='availability-denied-'+crypto.randomUUID(),reader='availability-denied:'+crypto.randomUUID();await sql("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,'Fiktiv nur Kalender','reader','[\"/planboard\"]','[]')",[role]);await sql("INSERT INTO platform.users(id,display_name,role,enabled,app_role_id) VALUES($1,'Fiktive Sperrprüfung','reader',true,$2)",[reader,role]);const denied=await page.context().browser().newContext();await authenticate(denied,reader,'reader');expect((await denied.request.get(fixture.base+'/api/planung/verfuegbarkeit?'+query)).status()).toBe(403);await denied.clearCookies();expect((await denied.request.get(fixture.base+'/api/planung/verfuegbarkeit?'+query)).status()).toBe(401);await denied.close();
});

test('E46 Einstellungssuche indexiert Funktionen und bleibt mit Tastatur, mobil und im Benutzerkonto bedienbar',async({page,context,browserName})=>{
 test.setTimeout(120000);const actor='settings-search:'+crypto.randomUUID();await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Einstellungssuche','admin',true)",[actor]);await authenticate(context,actor);await enter(page,'/einstellungen?bereich=system');const search=page.getByRole('combobox',{name:'Einstellungen suchen',exact:true});
 await search.pressSequentially('Sitzung');await expect(search).toHaveValue('Sitzung');await expect(search).toBeFocused();const before=await search.getAttribute('aria-activedescendant');await search.press('ArrowDown');expect(await search.getAttribute('aria-activedescendant')).not.toBe(before);await search.press('ArrowUp');expect(await search.getAttribute('aria-activedescendant')).toBe(before);await search.fill('Sitzungsdauer');await expect(page.getByRole('option',{name:/^Sitzungsdauer/})).toHaveCount(1);await search.press('Enter');await expect(page.getByRole('heading',{name:'Sitzungsdauer',exact:true})).toBeVisible();await expect(page.getByRole('spinbutton',{name:'Sitzungsdauer (Minuten)',exact:true})).toBeVisible();await expect(search).toHaveValue('Sitzungsdauer');
 await search.fill('Statusfarbe');await search.press('Enter');await expect(page).toHaveURL(/resources%3Acolors%2Fpalette%3A2/);await expect(page.getByRole('heading',{name:'Statusfarbe',exact:true})).toBeVisible();await search.fill('Mitarbeiterzuordnung');await search.press('Enter');await expect(page).toHaveURL(/users%3Aaccounts/);
 await search.fill('Direct-Line-Secret');await search.press('Enter');await expect(page.getByRole('textbox',{name:'Bot-ID',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Bot-ID',exact:true}).fill('fiktive-ungespeicherte-eingabe');await search.fill('Sitzungsdauer');await search.press('Enter');const guard=page.getByRole('alertdialog',{name:'Eingaben verwerfen?',exact:true});await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Weiter bearbeiten',exact:true}).click();await expect(page.getByRole('textbox',{name:'Bot-ID',exact:true})).toHaveValue('fiktive-ungespeicherte-eingabe');await search.press('Enter');await guard.getByRole('button',{name:'Eingaben verwerfen',exact:true}).click();await expect(page.getByRole('heading',{name:'Sitzungsdauer',exact:true})).toBeVisible();
 await search.fill('Client Secret');await expect(page.getByRole('listbox',{name:'Gefundene Einstellungsfunktionen',exact:true})).toBeVisible();for(const theme of ['light','dark']){await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);const axe=await new AxeBuilder({page}).include('[data-settings-workspace]').analyze();await writeFile(join(artifacts,'settings-search-'+browserName+'-'+theme+'.axe.json'),JSON.stringify(axe.violations.map(item=>({id:item.id,impact:item.impact,count:item.nodes.length}))));expect(axe.violations).toEqual([]);await page.screenshot({path:join(artifacts,'settings-search-'+browserName+'-'+theme+'.png'),mask:[page.locator('input[type=password]')]});}await search.press('Escape');await expect(search).toHaveValue('');await expect(search).toBeFocused();await search.fill('FantasiemodulOhneTreffer');await expect(page.getByRole('status').filter({hasText:'Keine passenden Einstellungen gefunden.'})).toBeVisible();await page.getByRole('button',{name:'Suche löschen',exact:true}).click();await expect(search).toBeFocused();
 const personal=page.getByRole('combobox',{name:'Einstellungen suchen',exact:true}),workspace=page.locator('[data-settings-workspace]:visible');
 await test.step('Mobiler Direktlink und Zurueck zur Bereichsliste',async()=>{
  await page.setViewportSize({width:390,height:844});await enter(page,'/benutzerkonto?bereich=account&seite=account%3Aprofile');
  await expect(workspace).toHaveCount(1);await expect(workspace).toHaveAttribute('data-detail','true');
  const back=page.getByRole('button',{name:'In Benutzerkonto zurück',exact:true});await expect(back).toHaveAttribute('title','Zur Bereichsliste');await back.click();
  await expect(workspace).toHaveAttribute('data-detail','false');await expect(personal).toBeVisible();
 });
 await test.step('Mobile Suche oeffnet Anzeige und Desktop behaelt Auswahl',async()=>{
  await personal.fill('dunkel');await expect(page.getByRole('option',{name:/^Erscheinungsbild/})).toHaveCount(1);await personal.press('Enter');
  await expect(page.getByRole('heading',{name:'Anzeige',exact:true})).toBeFocused();await page.setViewportSize({width:1280,height:900});
  await expect(personal).toHaveValue('dunkel');await expect(page.getByRole('heading',{name:'Anzeige',exact:true})).toBeVisible();
 });
 await test.step('Persoenliche Suche oeffnet Geraet und Entwuerfe',async()=>{
  await personal.fill('lokale Kopien');await personal.press('Enter');await expect(page.getByRole('heading',{name:'Gerät & Entwürfe',exact:true})).toBeFocused();
 });
 await test.step('Persoenliche Suche enthaelt keine administrativen Zugangsdaten',async()=>{
  await personal.fill('Tenant-ID');await expect(page.getByRole('option')).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Keine passenden Einstellungen gefunden.'})).toBeVisible();
 });
 await test.step('Werkzeugsuche bleibt schmal und aendert keine Integrationsfreigabe',async()=>{
  await personal.fill('Notizen');await personal.press('Enter');await expect(page.getByRole('heading',{name:'Werkzeuge',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:join(artifacts,'account-search-'+browserName+'.png')});expect((await sql("SELECT enabled FROM platform.copilot_settings WHERE id='central'")).rows[0].enabled).toBe(false);
 });
});

test('E47 Schnelles Ersetzen der Service-Suche bleibt exakt und folgt Vor-Zurück sowie Direktlinks',async({page,context})=>{
 await authenticate(context);await enter(page,'/servicehub?ansicht=files&q=SIM-KTR-100');const search=page.getByRole('combobox',{name:'Suche',exact:true});await expect(search).toHaveValue('SIM-KTR-100');
 for(const term of ['SIM-KST-100','SIM-KTR-200','SIM-KTR-100','SIM-KST-200','SIM-KTR-200','SIM-KTR-100'])await search.fill(term);
 await expect(search).toHaveValue('SIM-KTR-100');await expect(page).toHaveURL(/q=SIM-KTR-100/);await expect(page.getByRole('region',{name:'Serviceübersicht',exact:true}).getByRole('button',{name:/Heizungsanlage/})).toBeVisible();
 await page.goto(fixture.base+'/servicehub?ansicht=files&q=SIM-KTR-200');await expect(search).toHaveValue('SIM-KTR-200');await page.goBack();await expect(search).toHaveValue('SIM-KTR-100');await page.goForward();await expect(search).toHaveValue('SIM-KTR-200');
 await search.fill('');await expect(search).toHaveValue('');await expect(page).not.toHaveURL(/q=SIM-KTR/);
});

test('E48 MailDesk ordnet Mails zu, verknüpft Aufträge, übergibt an den CaseDesk und bleibt schmal bedienbar',async({page,context,browserName})=>{
 test.setTimeout(120000);await authenticate(context);await enter(page,'/maildesk');
 const list=page.getByRole('region',{name:'Nachrichten',exact:true}),mail=page.getByRole('region',{name:'Mail',exact:true}),folders=page.getByRole('navigation',{name:'Postfachordner',exact:true});
 // Gemeinsamer Kostenträger im Betreff + Adresse im Text ordnet automatisch mit Objekt zu.
 await list.getByRole('button',{name:/Störung Heizung – KTR SIM-KTR-100/}).click();
 await expect(mail.getByText(/Automatisch zugeordnet über Kostenträger SIM-KTR-100 im Betreff \+ Adresse „Musterweg 12“/)).toBeVisible();
 await expect(mail.locator('mark').filter({hasText:'SIM-KTR-100'}).first()).toBeVisible();
 // Je Browser eine eigene Vorschlagsmail, damit beide Läufe unabhängig bleiben.
 const [subject,order]=browserName==='webkit'?['Angebot Speichertausch','SIM-SA-10001']:['Wasser in der Technikzentrale','SIM-SA-10002'];
 await folders.getByRole('button',{name:/Vorschlag prüfen/}).click();await list.getByRole('button',{name:new RegExp(subject)}).click();
 await expect(mail.getByText(/^Vorschlag: /)).toBeVisible();await mail.getByRole('button',{name:'Übernehmen',exact:true}).click();
 await expect(mail.getByRole('status').filter({hasText:'Vorschlag übernommen.'})).toBeVisible();
 const row=mail.getByRole('region',{name:'Beim Kunden',exact:true}).locator('div').filter({hasText:order}).filter({has:page.getByRole('button',{name:'Mail anhängen',exact:true})}).last();
 await row.getByRole('button',{name:'Mail anhängen',exact:true}).click();await expect(mail.getByText('verknüpft',{exact:true})).toBeVisible();
 await folders.getByRole('button',{name:/Auftrag angelegt/}).click();await expect(list.getByRole('status')).toHaveText(/^[12] Mails?$/);await list.getByRole('button',{name:new RegExp(subject)}).click();
 // Zuständigkeit und Archiv wirken für alle; Versionskonflikte werden serverseitig geprüft.
 await test.step('Zuständigkeit in der geöffneten Mail setzen',async()=>{
  const assignee=mail.getByRole('button',{name:/^Zuständig: /});
  await assignee.press('ArrowDown');
  await expect(assignee).toHaveAttribute('aria-expanded','true');
  const ownOption=mail.getByRole('option',{name:'Ich',exact:true});
  await expect(ownOption).toBeVisible();
  await ownOption.press('Enter');
  await expect(mail.getByRole('status').filter({hasText:'Zuständigkeit gesetzt.'})).toBeVisible();
 });
 const stale=await context.request.post(fixture.base+'/api/maildesk/aktion',{headers:{Origin:fixture.base},data:{id:browserName==='webkit'?'sim-mail-07':'sim-mail-03',action:'flag',version:0,value:true}});expect(stale.status()).toBe(409);
 for(const theme of ['light','dark']){await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await axe(page,browserName+'-maildesk-'+theme);await page.screenshot({path:join(artifacts,`${browserName}-maildesk-${theme}.png`)});}
 // Schmal: Liste oder Mail, Rückweg per „Zur Liste“.
 await page.setViewportSize({width:390,height:844});await expect(list).toBeHidden();await mail.getByRole('button',{name:'Zur Liste',exact:true}).click();await expect(list).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.setViewportSize({width:1280,height:900});
 // Übergabe an den CaseDesk: vorausgefüllt mit Objekt, Beschreibung und der Mail als Dokument.
 await enter(page,'/maildesk?id=sim-mail-01');await mail.getByRole('link',{name:'Serviceauftrag anlegen',exact:true}).click();
 await expect(page).toHaveURL(/\/casedesk\?ausMail=sim-mail-01/);await expect(page.getByText(/Aus MailDesk: „Störung Heizung – KTR SIM-KTR-100“/)).toBeVisible({timeout:30000});
});

test('E49 Konto in einem Schritt anlegen, Startpasswort einmalig zeigen, einmal speichern und beim Verlassen warnen',async({page,context,browserName})=>{
 test.setTimeout(90000);await authenticate(context);await enter(page,'/einstellungen?bereich=users&seite=users:create');
 const form=page.locator('form.admin-new-assignment'),suffix=browserName==='webkit'?'w':'c',username='testkonto.'+suffix+Date.now().toString(36);
 await form.getByLabel('Anzeigename',{exact:true}).fill('Testkonto '+suffix);await form.getByLabel('Benutzername',{exact:true}).fill(username);
 // Verlassen mit Eingaben warnt; „Weiter bearbeiten“ behält alles.
 await page.getByRole('link',{name:/^Allgemein/}).or(page.getByRole('button',{name:/^Allgemein/})).first().click();const guard=page.getByRole('alertdialog',{name:'Eingaben verwerfen?'}).or(page.getByRole('dialog',{name:'Eingaben verwerfen?'}));await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Weiter bearbeiten',exact:true}).click();await expect(form.getByLabel('Benutzername',{exact:true})).toHaveValue(username);
 const pds=form.getByLabel('PDS-Benutzer',{exact:true});await expect(pds.locator('option')).not.toHaveCount(1);
 // Belegte PDS-Benutzer sind gekennzeichnet und nicht wählbar; ein freier wird genommen, sonst ohne Zuordnung.
 const free=await pds.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));if(free.length)await pds.selectOption(free[0]);
 for(const label of await pds.locator('option[disabled]').allInnerTexts())expect(label).toContain('bereits zugeordnet');
 await form.getByRole('button',{name:'Konto anlegen',exact:true}).click();await expect(page.getByText(/Konto „Testkonto .*“ angelegt\./)).toBeVisible();
 const code=page.locator('.initial-password code');await expect(code).toHaveText(/^\S{10,}$/);await expect(page.getByRole('button',{name:'Kopieren',exact:true})).toBeVisible();
 // Konto öffnen: ein Formular, ein Speichern; Verwerfen setzt zurück.
 await enter(page,'/einstellungen?bereich=users&seite=users:accounts');await page.getByRole('link',{name:new RegExp('Testkonto '+suffix)}).or(page.getByRole('button',{name:new RegExp('Testkonto '+suffix)})).first().click();
 const name=page.getByLabel('Anzeigename',{exact:true}),save=page.getByRole('button',{name:'Änderungen speichern',exact:true});await expect(save).toBeDisabled();
 await name.fill('Testkonto '+suffix+' geändert');await page.getByLabel(/^Rolle für /).selectOption({index:0});await expect(save).toBeEnabled();await expect(page.getByText('Ungespeicherte Änderungen',{exact:true})).toBeVisible();
 await save.click();await expect(page.getByText('Alle Änderungen gespeichert',{exact:true})).toBeVisible();await expect(page.getByLabel('Anzeigename',{exact:true})).toHaveValue('Testkonto '+suffix+' geändert');
 await page.getByLabel('Anzeigename',{exact:true}).fill('Wird verworfen');await page.getByRole('button',{name:'Verwerfen',exact:true}).click();await expect(page.getByLabel('Anzeigename',{exact:true})).toHaveValue('Testkonto '+suffix+' geändert');
 // Neues Startpasswort bleibt sichtbar, obwohl das Konto danach neu geladen wird (neue Version).
 await page.getByRole('button',{name:'Startpasswort neu vergeben',exact:true}).click();const shown=page.locator('.initial-password code');await expect(shown).toHaveText(/^\S{10,}$/);await page.waitForTimeout(2500);await expect(shown).toBeVisible();
});

test('E50 MailDesk-Postfachquelle in den Einstellungen: Microsoft 365 erst nach erfolgreicher Prüfung',async({page,context})=>{
 await authenticate(context);await enter(page,'/einstellungen?bereich=maildesk');await expect(page).toHaveURL(/bereich=graph&seite=graph%3Amaildesk/);await expect(page.getByRole('heading',{name:/MailDesk-Postfach/}).first()).toBeVisible();
 const save=page.getByRole('button',{name:'Speichern',exact:true});await expect(page.getByRole('button',{name:/^Quelle: Beispielpostfach$/})).toBeVisible();await expect(save).toBeDisabled();
 await page.getByRole('button',{name:/^Quelle: /}).click();await page.getByRole('option',{name:'Microsoft 365 (geteiltes Postfach)',exact:true}).click();
 await page.getByLabel('Geteiltes Postfach',{exact:true}).fill('service@firma.example');
 await expect(page.getByText(/erst speichern, wenn „Verbindung prüfen“/)).toBeVisible();await expect(save).toBeDisabled();
 // Ohne Microsoft-365-Zugangsdaten schlägt die Prüfung verständlich fehl; Speichern bleibt gesperrt.
 await page.getByRole('button',{name:'Verbindung prüfen',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/Zugangsdaten fehlen|nicht erreichbar|verweigert|unterbrochen/})).toBeVisible();await expect(save).toBeDisabled();
 // Verlassen mit Eingaben fragt nach; Verwerfen stellt das Beispielpostfach wieder her.
 await page.getByRole('button',{name:'Verwerfen',exact:true}).click();await expect(page.getByRole('button',{name:/^Quelle: Beispielpostfach$/})).toBeVisible();
});

test('E51 SharePoint-Ablagestruktur zeigt die Ordnervorgabe und pflegt Ablagetypen mit einem Speichern',async({page,context})=>{
 await authenticate(context);
 // Hold the first Strict Mode load past the second load and a real user edit.
 await page.addInitScript(()=>{
  const fetch=window.fetch.bind(window);let release;const pending=new Promise(resolve=>{release=resolve;});
  const probe=window.__heyelliStorageProbe={requests:0,settled:false,release:()=>release()};
  window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href),method=init?.method??(input instanceof Request?input.method:'GET');
   if(url.pathname!=='/api/verwaltung/sharepoint/ablage'||method!=='GET'||++probe.requests!==1)return fetch(input,init);
   return(async()=>{try{const response=await fetch(input,init),body=await response.text();await pending;return new Response(body,{status:response.status,headers:response.headers});}finally{probe.settled=true;}})();
  };
 });
 await enter(page,'/einstellungen?bereich=sharepoint&seite=sharepoint%3Astorage');
 await expect(page.getByText('Objekte/Duisburg/hauptstraße_21/Brandmelde/Brandmeldeanlage_4711/Mails',{exact:true})).toBeVisible();
 await expect(page.getByText('Kunden/musterwerk_west_K-200/Mails',{exact:true})).toBeVisible();
 const save=page.getByRole('button',{name:'Speichern',exact:true}),first=page.getByLabel('Bezeichnung 1',{exact:true});await expect(first).toHaveValue('Mails');await expect(save).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>window.__heyelliStorageProbe.requests)).toBeGreaterThanOrEqual(2);
 await first.fill('E-Mails');await page.evaluate(()=>window.__heyelliStorageProbe.release());await page.waitForFunction(()=>window.__heyelliStorageProbe.settled);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(first).toHaveValue('E-Mails');
 await expect(save).toBeEnabled();await expect(page.getByText('Objekte/Duisburg/hauptstraße_21/Brandmelde/Brandmeldeanlage_4711/E-Mails',{exact:true})).toBeVisible();
 await save.click();await expect(page.getByRole('status').filter({hasText:'Ablagetypen gespeichert.'})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Bezeichnung 1',{exact:true})).toHaveValue('E-Mails');
 await page.getByLabel('Bezeichnung 1',{exact:true}).fill('Mails');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Ablagetypen gespeichert.'})).toBeVisible();
 // Ungültige Namen werden abgewiesen, ohne zu speichern.
 await page.getByLabel('Bezeichnung 2',{exact:true}).fill('Berichte/Alt');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:/Ablagetyp „Berichte\/Alt“/})).toBeVisible();
 await page.getByRole('button',{name:'Verwerfen',exact:true}).click();await expect(page.getByLabel('Bezeichnung 2',{exact:true})).toHaveValue('Berichte');
});

test('E52 AskElli nutzt gemeinsame Eingabe, Nachrichten und Quellen', async ({page, context}) => {
  await authenticate(context);
  const epoch = 'browser-ui-fixture';
  await page.route('**/api/assistent/status', route => route.fulfill({json: {provider: 'ollama', enabled: true}}));
  await page.route('**/api/assistent/begruessung', route => route.fulfill({json: {epoch, greeting: 'Hallo aus der Browserprüfung.'}}));
  await page.route('**/api/assistent/verlauf', route => route.fulfill({json: {
    owner: 'browser-ui-fixture', epoch, drafts: {}, pending: [], turns: [],
  }}));
  const questions = [];
  await page.route('**/api/assistent', route => {
    const {id, question} = route.request().postDataJSON();
    questions.push(question);
    return route.fulfill({json: {chat: {pending: [], turns: [{
      id, question, answer: 'Fiktive Antwort für die Browserprüfung.',
      sources: [{href: '/hilfe', title: 'HeyElli-Hilfe'}],
    }]}}});
  });

  await enter(page, '/');
  const chat = page.getByRole('region', {name: 'AskElli'});
  const question = chat.getByRole('textbox', {name: 'Wie kann ich dir helfen?'});
  const send = chat.getByRole('button', {name: 'Frage senden'});
  await expect(question).toBeEnabled();
  await expect(send).toBeDisabled();
  await expect(send).toHaveCSS('min-height', '32px');
  await question.fill('Erste Zeile');
  await question.press('End');
  await question.press('Shift+Enter');
  await page.keyboard.insertText('Zweite Zeile');
  await expect(question).toHaveValue('Erste Zeile\nZweite Zeile');
  expect(questions).toHaveLength(0);

  await question.press('Enter');
  const log = chat.getByRole('log', {name: 'Gespräch mit Elli'});
  await expect(log.getByText('Fiktive Antwort für die Browserprüfung.')).toBeVisible();
  expect(questions).toEqual(['Erste Zeile\nZweite Zeile']);
  await expect(log.getByRole('link', {name: /HeyElli-Hilfe/})).toHaveAttribute('href', '/hilfe');
  await expect(send).toBeDisabled();

  await page.setViewportSize({width: 320, height: 800});
  for (const theme of ['light', 'dark']) {
    await page.locator('html').evaluate((element, value) => { element.dataset.theme = value; }, theme);
    await question.focus();
    await expect(question).toBeFocused();
    await expect(chat.locator('[data-slot="input-group"]')).toHaveCSS('outline-width', '3px');
    await expect(question).toHaveCSS('font-size', '16px');
    await expect(send).toHaveCSS('min-height', '44px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});

test('E53 Service-Aufträge mit Pfeiltasten sichten und Fokus zurückgeben', async ({page, context, browserName}) => {
  await authenticate(context);
  await enter(page, '/servicehub?ansicht=orders');
  const overview = page.getByRole('region', {name:'Serviceübersicht', exact:true});
  const first = overview.locator('[data-order-row="sim-order-1"]');
  const second = overview.locator('[data-order-row="sim-order-2"]');
  const file = page.getByRole('complementary', {name:'Akte', exact:true});
  const secondHeading = file.getByRole('heading', {name:'SIM-SA-10002', exact:true});

  const firstHeading = file.getByRole('heading', {name:'SIM-SA-10001', exact:true});
  await first.click();
  await expect(firstHeading).toBeVisible();
  await expect(first).toBeFocused();
  const secondRow = overview.locator('li:has(> [data-order-row="sim-order-2"])');
  expect(await secondRow.evaluate(element => {
    const divider = getComputedStyle(element, '::before');
    return divider.content !== 'none' && divider.height === '1px' && parseFloat(getComputedStyle(element).paddingTop) >= 5;
  })).toBe(true);
  await overview.screenshot({path:join(artifacts, 'service-order-list-'+browserName+'.png')});
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(secondHeading).toBeVisible();
  await secondHeading.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(secondHeading).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();
  await expect(secondHeading).toBeVisible();
  const status = file.getByRole('button', {name:/^Auftragsstatus ändern/});
  await status.click();
  await expect(file.getByRole('menu', {name:'Auftragsstatus', exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(status).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(firstHeading).toBeVisible();
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(firstHeading).toBeFocused();
  await page.setViewportSize({width:390, height:844});
  await expect(overview).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(file).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(file).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(secondHeading).toBeFocused();
  await secondHeading.press('Escape');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-pressed', 'true');

  await enter(page, '/servicehub?ansicht=orders&akte=order&id=sim-order-2');
  await expect(secondHeading).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(firstHeading).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(first).toBeFocused();
  await page.setViewportSize({width:1280, height:900});
  await enter(page, '/servicehub?ansicht=orders&akte=order&id=sim-order-2');
  await expect(secondHeading).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(firstHeading).toBeVisible();
  await expect(first).toBeFocused();
});

test('E54 Service-Aufträge persönlich markieren und Filter pausieren', async ({page, context, browser, browserName}) => {
  const actor='personal-order-flags:'+crypto.randomUUID();
  await sql("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Auftragsmarkierungen','admin',true)",[actor]);
  await authenticate(context,actor);
  await enter(page, '/servicehub?ansicht=orders&akte=order&id=sim-order-1');
  const overview = page.getByRole('region', {name:'Serviceübersicht', exact:true});
  const marker = page.getByRole('button', {name:'Auftrag markieren', exact:true});
  await expect(marker).toBeEnabled();
  await expect(marker).toHaveAttribute('aria-pressed','false');
  await marker.click();
  await expect(marker).toHaveAttribute('aria-pressed','true');
  const first = overview.locator('[data-order-row="sim-order-1"]');
  const second = overview.locator('[data-order-row="sim-order-2"]');
  await expect(first).toHaveAccessibleName(/Markiert/);

  const options = overview.getByRole('button', {name:'Filteroptionen', exact:true});
  const toggle = overview.getByRole('button', {name:'Auftragsfilter', exact:true});
  const tools = overview.getByRole('group', {name:'Auftragsfilter-Werkzeuge', exact:true});
  const categories = overview.getByRole('group', {name:'Auftragskategorien', exact:true});
  const [left,right,header,categoriesBox] = await Promise.all([options.boundingBox(),toggle.boundingBox(),tools.boundingBox(),categories.boundingBox()]);
  expect(left.x).toBeLessThan(right.x);
  expect(Math.abs(left.y-right.y)).toBeLessThan(2);
  expect(header.y+header.height).toBeLessThan(categoriesBox.y);
  const all = categories.getByRole('button',{name:'Alle',exact:true});
  const unplanned = categories.getByRole('button',{name:'Ohne Termin',exact:true});
  await expect(categories.getByRole('button',{name:'Markiert',exact:true})).toHaveCount(0);
  await expect(all).toHaveAttribute('aria-pressed','true');
  await expect(all).toHaveText('Alle');
  await expect(unplanned).toHaveText('');
  await expect(unplanned.locator('svg')).toBeVisible();
  await expect(categories.locator('xpath=ancestor::header').getByRole('button',{name:'Filteroptionen',exact:true})).toBeVisible();
  await options.press('Enter');
  const panel = overview.getByRole('group', {name:'Filteroptionen', exact:true});
  await expect(panel).toHaveAttribute('data-slot','popover-content');
  await panel.getByRole('button',{name:'Markiert',exact:true}).click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(all).toHaveText('Alle');
  await expect(second).toHaveCount(0);
  const planningFilter=panel.getByRole('button',{name:/^Planung:/});
  await planningFilter.press('ArrowDown');
  await expect(panel.getByRole('option',{name:'Alle',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(planningFilter).toBeFocused();
  await expect(panel).toBeVisible();
  await planningFilter.click();
  await panel.getByRole('option',{name:'Ohne Termin',exact:true}).click();
  await expect(first).toBeVisible();
  await expect(unplanned).toHaveText('Ohne Termin');
  await expect(all).toHaveText('');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(second).toBeVisible();
  await expect(all).toHaveText('Alle');
  await expect(unplanned).toHaveText('');
  await toggle.click();
  await expect(second).toHaveCount(0);
  await page.reload();
  await expect(marker).toHaveAttribute('aria-pressed','true');
  await expect(second).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:join(artifacts,'order-filters-'+browserName+'.png')});

  const endpoint = fixture.base+'/api/service/markierungen';
  const own = await (await context.request.get(endpoint)).json();
  expect(own.flagged).toContain('sim-order-1');
  const other = await browser.newContext();
  try {
    expect((await other.request.get(endpoint)).status()).toBe(401);
    await authenticate(other,fixture.mixed);
    const their = await other.request.get(endpoint);
    expect(their.ok()).toBe(true);
    expect((await their.json()).flagged).not.toContain('sim-order-1');
    expect((await other.request.post(endpoint,{headers:{origin:fixture.base},data:{owner:own.owner,source:own.source,id:'sim-order-1',flagged:false}})).status()).toBe(409);
  } finally { await other.close(); }

  await marker.click();
  await expect(marker).toHaveAttribute('aria-pressed','false');
  await expect(first).toHaveCount(0);
  await expect(overview.getByText('Keine markierten Aufträge',{exact:true})).toBeVisible();
  await toggle.click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('complementary',{name:'Akte',exact:true}).getByRole('heading',{name:'SIM-SA-10001',exact:true}).press('Escape');
  await expect(options).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('E55 Auftragssuche in der Werkzeugleiste zeigt anklickbare Vorschläge',async({page,context,browserName})=>{
 await authenticate(context);await enter(page,'/servicehub?ansicht=orders&akte=order&id=sim-order-1');
 await page.setViewportSize({width:1280,height:900});
 const file=page.getByRole('complementary',{name:'Akte',exact:true}),toolbar=file.getByRole('group',{name:'Aktenaktionen',exact:true});
 const trigger=toolbar.getByRole('button',{name:'Suche öffnen',exact:true});
 const navigation=toolbar.getByRole('group',{name:'Aktennavigation',exact:true});
 const actions=toolbar.getByRole('button',{name:'Auftrag markieren',exact:true});
 const newOrder=toolbar.getByRole('link',{name:'Neuer Auftrag im CaseDesk',exact:true});
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const filter=overview.getByRole('group',{name:'Auftragsfilter-Werkzeuge',exact:true});
 const categories=overview.getByRole('group',{name:'Auftragskategorien',exact:true});
 await expect(newOrder).toHaveAttribute('href','/casedesk');
 const sideToggle=page.getByRole('button',{name:'Seitenleiste ausblenden',exact:true});
 const sidebar=page.getByRole('navigation',{name:'Serviceansichten',exact:true});
 const firstList=sidebar.getByRole('heading',{name:'Arbeitslisten',exact:true});
 const [toggleBox,headingBox]=await Promise.all([sideToggle.boundingBox(),firstList.boundingBox()]);
 expect(toggleBox.x).toBeGreaterThan(headingBox.x);
 expect(headingBox.y-toggleBox.y-toggleBox.height).toBeLessThan(20);
 await sideToggle.press('Enter');
 await expect(page.getByRole('button',{name:'Seitenleiste einblenden',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Seitenleiste einblenden',exact:true}).click();
 await expect(actions).toBeVisible();
 const [create,left,center,right,sidebarTool,filterCapsule]=await Promise.all(
  [newOrder,navigation,actions,trigger,sideToggle,filter].map(control=>control.boundingBox())
 );
 for(const control of [create,left,center,sidebarTool,filterCapsule]){
  expect(Math.abs(control.y-right.y)).toBeLessThan(2);
  expect(Math.abs(control.height-right.height)).toBeLessThan(2);
 }
 const listHeader=categories.locator('xpath=ancestor::header');
 const [firstRow,secondRow]=[0,1].map(index=>overview.locator("[data-order-row]").nth(index));
 const [header,first,second,secondItem]=await Promise.all(
  [listHeader,firstRow,secondRow,secondRow.locator('..')].map(element=>element.boundingBox())
 );
 expect(first.y-header.y-header.height).toBeCloseTo(second.y-secondItem.y,0);
 const otherActions=await toolbar.getByRole('group',{name:'Weitere Aktenaktionen',exact:true}).boundingBox();
 const gap=left.x-create.x-create.width;
 expect(gap).toBeGreaterThan(12);
 expect(otherActions.x-left.x-left.width).toBeCloseTo(gap,0);
 expect(right.x-otherActions.x-otherActions.width).toBeCloseTo(gap,0);
 expect(left.x+left.width).toBeLessThan(center.x);
 expect(center.x+center.width).toBeLessThan(right.x);
 expect(Math.abs(left.y-right.y)).toBeLessThan(2);
 await trigger.click();
 const search=toolbar.getByRole('combobox',{name:'Suche',exact:true});
 await expect(search).toBeFocused();
 await search.fill('SIM-SA-10002');
 const suggestions=toolbar.getByRole('listbox',{name:'Suchvorschläge',exact:true});
 await expect(suggestions).toHaveAttribute('data-slot','popover-content');
 const option=suggestions.getByRole('option',{name:/SIM-SA-10002/});
 await expect(option).toBeVisible();
 expect((await suggestions.boundingBox()).y).toBeGreaterThan((await search.boundingBox()).y);
 await search.press('ArrowDown');
 await expect(option).toHaveAttribute('aria-selected','true');
 await page.screenshot({path:join(artifacts,`${browserName}-order-search.png`)});
 await search.press('Enter');
 await expect(file.getByRole('heading',{name:'SIM-SA-10002',exact:true})).toBeFocused();
 await search.focus();
 await expect(suggestions).toBeVisible();
 await search.press('Escape');
 await expect(suggestions).toBeHidden();
 await expect(search).toBeFocused();
 await search.press('Escape');
 await expect(trigger).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 await file.getByRole('heading',{name:'SIM-SA-10002',exact:true}).press('Escape');
 const emptyToolbar=page.getByRole('group',{name:'Suchwerkzeuge',exact:true});
 await expect(emptyToolbar.getByRole('link',{name:'Neuer Auftrag im CaseDesk',exact:true})).toBeVisible();
 await emptyToolbar.getByRole('button',{name:'Suche öffnen',exact:true}).click();
 const mobileSearch=emptyToolbar.getByRole('combobox',{name:'Suche',exact:true});
 await mobileSearch.fill('SIM-SA-10001');
 const mobileSuggestions=emptyToolbar.getByRole('listbox',{name:'Suchvorschläge',exact:true});
 const mobileOption=mobileSuggestions.getByRole('option',{name:/SIM-SA-10001/});
 await expect(mobileOption).toBeVisible();
 const box=await mobileSuggestions.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
 await mobileOption.click();
 await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeVisible();
 await page.setViewportSize({width:320,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('E56 Kundenübersicht teilt Kopf und Suche mit der Auftragsansicht',async({page,context,browserName})=>{
 await authenticate(context);await enter(page,'/servicehub?ansicht=files');
 await page.setViewportSize({width:1280,height:900});
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const categories=overview.getByRole('group',{name:'Kunden filtern',exact:true});
 const hidden=overview.getByRole('button',{name:'Ausgeblendete Einträge',exact:true});
 const trigger=page.getByRole('button',{name:'Suche öffnen',exact:true});
 await expect(categories.getByRole('button',{name:'Alle',exact:true})).toHaveText('Alle');
 const open=categories.getByRole('button',{name:'Mit offenen Aufträgen',exact:true});
 await expect(open).toHaveText('');
 const [eye,loupe]=await Promise.all([hidden.boundingBox(),trigger.boundingBox()]);
 expect(eye.x+eye.width).toBeLessThan(loupe.x);
 expect(Math.abs(eye.y-loupe.y)).toBeLessThan(2);
 expect(Math.abs(eye.height-loupe.height)).toBeLessThan(2);
 await open.click();
 await expect(open).toHaveText('Mit offenen Aufträgen');
 await expect(overview.getByRole('button',{name:'Kundenakte Demohaus ohne technische Einheit öffnen',exact:true})).toHaveCount(0);
 await categories.getByRole('button',{name:'Alle',exact:true}).click();
 await expect(overview.getByRole('button',{name:'Kundenakte Demohaus ohne technische Einheit öffnen',exact:true})).toBeVisible();

 const customerName='Beispielhaus Nord, Beispielhaus Süd';
 const customer=overview.getByRole('button',{name:`Kundenakte ${customerName} öffnen`,exact:true});
 const children=overview.getByRole('button',{name:new RegExp(`Objekte und Einheiten (ein|auf)klappen · ${customerName}`)});
 const object=overview.getByRole('button',{name:/^Heizungsanlage/});
 await expect(children).toHaveAttribute('aria-expanded','false');
 await customer.click();
 const file=page.getByRole('complementary',{name:'Akte',exact:true});
 const customerHeading=file.getByRole('heading',{name:customerName,exact:true});
 await expect(customerHeading).toBeVisible();
 await expect(customer).toHaveAttribute('aria-pressed','true');
 await expect(children).toHaveAttribute('aria-expanded','false');
 await children.press('Enter');
 await expect(object).toBeVisible();
 await expect(customerHeading).toBeVisible();
 await children.click();
 await expect(object).toHaveCount(0);
 await expect(customerHeading).toBeVisible();

 const personal=file.getByRole('group',{name:'Persönlich',exact:true});
 const pin=personal.getByRole('button',{name:'Kunde anheften',exact:true});
 const eyeButton=personal.getByRole('button',{name:'Ausblenden',exact:true});
 await expect(pin).toHaveText('');
 const [pinBox,eyeBox]=await Promise.all([pin.boundingBox(),eyeButton.boundingBox()]);
 expect(pinBox.x+pinBox.width).toBeLessThanOrEqual(eyeBox.x+1);
 expect(Math.abs(pinBox.y-eyeBox.y)).toBeLessThan(2);
 await pin.click();
 await expect(pin).toHaveAttribute('aria-pressed','true');
 await pin.click();
 await expect(pin).toHaveAttribute('aria-pressed','false');
 await customerHeading.press('Escape');
 await expect(customer).toBeFocused();
 await expect(file).toBeVisible();
 await trigger.click();
 const search=page.getByRole('combobox',{name:'Suche',exact:true});
 await expect(search).toBeFocused();
 await search.fill('Heizungsanlage');
 const suggestions=page.getByRole('listbox',{name:'Suchvorschläge',exact:true});
 const option=suggestions.getByRole('option',{name:'Heizungsanlage Technische Einheit',exact:true});
 await expect(option).toBeVisible();
 expect((await suggestions.boundingBox()).y).toBeGreaterThan((await search.boundingBox()).y);
 await page.screenshot({path:join(artifacts,`${browserName}-customer-search.png`)});
 await search.press('ArrowDown');
 await expect(option).toHaveAttribute('aria-selected','true');
 await search.press('Enter');
 await expect(file.getByRole('heading',{name:'Heizungsanlage',exact:true})).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 await file.getByRole('heading',{name:'Heizungsanlage',exact:true}).press('Escape');
 await expect(object).toBeFocused();
 await expect(categories).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('E57 Kunden Objekt und Einheit unterstützen Tastatur und Hover in beiden Themes',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=files');
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const file=page.getByRole('complementary',{name:'Akte',exact:true});
 const customer=overview.locator('[data-file-row="customer:SIM-K-100"]');
 const secondCustomer=overview.locator('[data-file-row="customer:SIM-K-300"]');
 const disclosure=overview.getByRole('button',{name:/^Objekte und Einheiten .*Beispielhaus Nord/});
 const site=overview.locator('[data-file-row="object:sim-object-1"]');
 const unit=overview.locator('[data-file-row="object:sim-unit-1"]');
 await disclosure.press('Enter');
 await expect(site).toBeVisible();
 await customer.focus();
 await page.keyboard.press('ArrowDown');
 await expect(site).toBeFocused();
 await expect(file.getByRole('heading',{name:'Beispielhaus Nord',exact:true})).toBeVisible();
 await page.keyboard.press('ArrowDown');
 await expect(unit).toBeFocused();
 const unitHeading=file.getByRole('heading',{name:'Heizungsanlage',exact:true});
 await expect(unitHeading).toBeVisible();
 await page.keyboard.press('Enter');
 await expect(unitHeading).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(unit).toBeFocused();
 await expect(unit).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('ArrowUp');
 await expect(site).toBeFocused();
 await page.keyboard.press('ArrowUp');
 await expect(customer).toBeFocused();
 await expect(customer).toHaveAttribute('aria-pressed','true');
 await expect(site).toBeVisible();

 const customerLine=customer.locator('..');
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>element.dataset.theme=value,theme);
  const background=await customerLine.evaluate(element=>getComputedStyle(element).backgroundColor);
  await customer.hover();
  await expect(customerLine).toHaveCSS('background-color',background);
  await expect(customer).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(customer.locator('strong')).toHaveCSS('color','rgb(255, 255, 255)');
  await disclosure.hover();
  await expect(customerLine).toHaveCSS('background-color',background);
  await page.screenshot({path:join(artifacts,`${browserName}-customer-hover-${theme}.png`)});
 }

 await page.setViewportSize({width:390,height:844});
 await file.getByRole('heading',{name:'Beispielhaus Nord, Beispielhaus Süd',exact:true}).press('Escape');
 await expect(customer).toBeFocused();
 await expect(file).toHaveCount(0);
 await disclosure.press('Enter');
 await expect(site).toHaveCount(0);
 await customer.press('ArrowDown');
 await expect(secondCustomer).toBeFocused();
 await expect(secondCustomer).toHaveAttribute('aria-pressed','true');
 await expect(file).toHaveCount(0);
 await page.keyboard.press('Enter');
 const secondHeading=file.getByRole('heading',{name:'Demohaus ohne technische Einheit',exact:true});
 await expect(secondHeading).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(secondCustomer).toBeFocused();
});

test('E58 Kundenmarkierungen zählen Aufträge und Wartungen bis zur technischen Einheit',async({page,context,browserName})=>{
 await authenticate(context);
 // Earlier scenarios create fictional service orders. Read the counts for this
 // customer and its two known units from the same isolated test database.
 const response=await context.request.get(fixture.base+'/api/service');
 expect(response.ok()).toBe(true);
 const {orders:baseline}=await response.json();
 const open=baseline.filter(order=>order.customerId==='SIM-K-100'&&order.status==='Offen');
 const countOrdersFor=(...ids)=>open.filter(order=>order.incidents.some(incident=>ids.includes(incident.objectId))).length;
 expect(countOrdersFor('sim-unit-1')).toBeGreaterThan(0);
 await enter(page,'/servicehub?ansicht=files');
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const customer=overview.locator('[data-file-row="customer:SIM-K-100"]');
 const emptyCustomer=overview.locator('[data-file-row="customer:SIM-K-300"]');
 const site=overview.locator('[data-file-row="object:sim-object-1"]');
 const unit=overview.locator('[data-file-row="object:sim-unit-1"]');
 const futureUnit=overview.locator('[data-file-row="object:sim-unit-2"]');
 const orders=row=>row.locator('[data-work-badge="orders"]');
 const maintenance=row=>row.locator('[data-work-badge="maintenance"]');
 const expectSeparator=async row=>{
  const separator=await row.evaluate(element=>{
   const {content,blockSize}=getComputedStyle(element,'::before');
   return {content,blockSize};
  });
  expect(separator).toEqual({content:'""',blockSize:'1px'});
 };
 await expect(orders(customer)).toHaveText(String(open.length));
 await expect(maintenance(customer)).toHaveText('2');
 await expect(maintenance(customer)).toHaveAttribute('title','2 fällige Wartungen');
 await expect(emptyCustomer.locator('[data-work-badge]')).toHaveCount(0);
 await expectSeparator(overview.locator('p[aria-hidden="true"]').filter({hasText:/^D$/}));
 await overview.getByRole('button',{name:/^Objekte und Einheiten aufklappen · Beispielhaus Nord/}).click();
 await expect(orders(site)).toHaveText(String(countOrdersFor('sim-object-1','sim-unit-1','sim-unit-2')));
 await expect(maintenance(site)).toHaveText('2');
 await expect(orders(unit)).toHaveText(String(countOrdersFor('sim-unit-1')));
 await expect(maintenance(unit)).toHaveText('1');
 await expect(maintenance(futureUnit)).toHaveCount(0);
 await expectSeparator(site.locator('../../..'));
 await expectSeparator(overview.locator('[data-file-row="object:sim-object-2"]').locator('..'));
 await expectSeparator(unit.locator('..'));
 await expectSeparator(futureUnit.locator('..'));
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>element.dataset.theme=value,theme);
  await unit.click();
  await expect(unit).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await axe(page,`service-work-badges-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`${browserName}-customer-badges-${theme}.png`)});
 }
});

test('E59 Service-Cockpit verlinkt Auftrags- und Wartungskennzahlen mit ihren Arbeitslisten',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=cockpit');
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const orders=overview.getByRole('region',{name:'Aufträge',exact:true});
 const maintenance=overview.getByRole('region',{name:'Wartungen',exact:true});
 const due=maintenance.getByRole('link',{name:'Fällig bis heute 3',exact:true});
 const overdue=maintenance.getByRole('link',{name:'Überfällig 2',exact:true});
 const upcoming=maintenance.getByRole('link',{name:'Bevorstehend 1',exact:true});
 const unknown=maintenance.getByRole('link',{name:'Fälligkeit prüfen 1',exact:true});
 await expect(due).toBeVisible();
 await expect(overdue).toBeVisible();
 await expect(upcoming).toBeVisible();
 await expect(unknown).toBeVisible();
 const noDate=orders.getByRole('link',{name:/^Ohne Termin \d+$/});
 await expect(noDate).toHaveAttribute('data-slot','button');
 await expect(orders.locator('[data-slot="card"]')).toBeVisible();
 await expect(orders.getByRole('link',{name:/^Alle Aufträge \d+$/})).toHaveAttribute('href','/servicehub?ansicht=orders');
 await expect(orders.getByRole('link',{name:/^Heute geplant \d+$/})).toHaveAttribute('href','/servicehub?ansicht=orders&filter=today');
 await expect(orders.getByRole('link',{name:/^Ohne Haupttechniker \d+$/})).toHaveAttribute('href','/servicehub?ansicht=orders&filter=unassigned');
 const preview=overview.getByRole('region',{name:'Fällige Wartungen',exact:true});
 const heater=preview.getByRole('button',{name:/Wartung Heizungsanlage/});
 await expect(heater).toBeVisible();
 const separator=await preview.getByRole('listitem').nth(1).evaluate(element=>{
  const {content,blockSize}=getComputedStyle(element,'::before');
  return {content,blockSize};
 });
 expect(separator).toEqual({content:'""',blockSize:'1px'});
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>element.dataset.theme=value,theme);
  await axe(page,`service-cockpit-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`service-cockpit-${browserName}-${theme}.png`)});
 }
 const cockpit=page.getByRole('button',{name:'Cockpit',exact:true});
 await noDate.press('Enter');
 await expect(overview.getByRole('group',{name:'Auftragskategorien'}).getByRole('button',{name:'Ohne Termin',exact:true})).toHaveAttribute('aria-pressed','true');
 await cockpit.click();
 await overdue.click();
 const categories=overview.getByRole('group',{name:'Wartungskategorien'});
 await expect(categories.getByRole('button',{name:'Überfällig',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(overview.getByRole('button',{name:/Wartung Brandmeldeanlage/})).toHaveCount(0);
 await cockpit.click();
 await upcoming.click();
 await expect(categories.getByRole('button',{name:'Bevorstehend',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(overview.getByRole('button',{name:/Wartung Lüftungsanlage/})).toBeVisible();
 await cockpit.click();
 await unknown.click();
 await expect(categories.getByRole('button',{name:'Prüfen',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(overview.getByRole('button',{name:/Wartung Sicherheitsbeleuchtung/})).toBeVisible();
 await cockpit.click();
 await due.click();
 await expect(categories.getByRole('button',{name:'Fällig',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(overview.getByRole('button',{name:/Wartung Brandmeldeanlage/})).toBeVisible();

 await cockpit.click();
 await page.setViewportSize({width:390,height:844});
 await expect(due).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:join(artifacts,`service-cockpit-${browserName}-mobile.png`)});
 await heater.click();
 await expect(page.getByRole('complementary',{name:'Wartungsakte'}).getByRole('heading',{name:'Wartung Heizungsanlage',exact:true})).toBeVisible();

 await page.route('**/api/service?*',route=>new URL(route.request().url()).searchParams.get('part')==='maintenance'?route.abort('internetdisconnected'):route.continue());
 await enter(page,'/servicehub?ansicht=cockpit');
 await expect(maintenance.getByRole('alert')).toContainText('Wartungskennzahlen sind unvollständig');
 await expect(maintenance.getByRole('link',{name:'Fällig bis heute Anzahl nicht verfügbar',exact:true})).toBeVisible();
 await expect(noDate).toBeVisible();
 await page.unroute('**/api/service?*');
 await maintenance.getByRole('button',{name:'Erneut laden',exact:true}).click();
 await expect(due).toBeVisible();
});

test('E60 Cockpit-Werkzeugleiste durchsucht ServiceHub und öffnet die passende Akte',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=cockpit');
 const bar=page.getByRole('group',{name:'Cockpit-Werkzeugleiste',exact:true});
 const create=bar.getByRole('link',{name:'Neuer Auftrag im CaseDesk',exact:true});
 const toggle=bar.getByRole('button',{name:'Suche öffnen',exact:true});
 const search=bar.getByRole('combobox',{name:'Service durchsuchen',exact:true});
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const suggestions=bar.getByRole('listbox',{name:'Suchvorschläge',exact:true});
 await expect(create).toHaveAttribute('href','/casedesk');
 expect(await create.boundingBox()).not.toBeNull();
 expect((await toggle.boundingBox()).x).toBeGreaterThan((await create.boundingBox()).x);
 await toggle.click();
 await expect(search).toBeFocused();
 await search.fill('Beispielhaus');
 for(const section of ['Aufträge','Wartungen','Kunden','Objekte','Technische Einheiten']){
  await expect(overview.getByRole('heading',{name:new RegExp('^'+section+' \\d+$')})).toBeVisible();
 }
 await expect(suggestions.getByRole('option',{name:/Wartung/}).first()).toBeVisible();
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((element,value)=>element.dataset.theme=value,theme);
  await axe(page,`cockpit-search-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`cockpit-search-${browserName}-${theme}.png`)});
 }

 await search.fill('SIM-TE-101');
 await expect(suggestions.getByRole('option').first()).toContainText('Technische Einheit · SIM-TE-101');
 await search.press('Enter');
 const file=page.getByRole('complementary',{name:'Akte',exact:true});
 await expect(file.getByRole('heading',{name:'Heizungsanlage',exact:true})).toBeVisible();
 await page.goBack();
 await expect(search).toHaveValue('SIM-TE-101');
 await search.fill('SIM-SA-10001');
 await expect(suggestions.getByRole('option',{name:/SIM-SA-10001/})).toBeVisible();
 await search.press('ArrowDown');
 await search.press('Enter');
 await expect(file.getByRole('heading',{name:'SIM-SA-10001',exact:true})).toBeVisible();

 await page.goBack();
 await search.fill('Wartung Lüftungsanlage');
 await overview.getByRole('button',{name:/Wartung Lüftungsanlage/}).click();
 await expect(page.getByRole('complementary',{name:'Wartungsakte',exact:true})
  .getByRole('heading',{name:'Wartung Lüftungsanlage',exact:true})).toBeVisible();
 await expect(page).toHaveURL(/faelligkeit=all/);

 await page.goBack();
 await page.setViewportSize({width:390,height:844});
 await search.fill('SIM-K-100');
 await expect(suggestions.getByRole('option').first()).toContainText('Kunde · SIM-K-100');
 const box=await suggestions.boundingBox();
 expect(box.x).toBeGreaterThanOrEqual(0);
 expect(box.x+box.width).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await search.press('Escape');
 await expect(suggestions).toBeHidden();
 await search.press('Escape');
 await expect(toggle).toBeFocused();
 await toggle.click();
 await search.fill('kein-resultat-0851');
 await expect(overview.getByRole('status').filter({hasText:'Keine passenden Treffer.'})).toBeVisible();
 await bar.getByRole('button',{name:'Suche leeren',exact:true}).click();
 await expect(overview.getByRole('region',{name:'Aufträge',exact:true})).toBeVisible();
});

test('E61 ServiceHub vereinheitlicht Werkzeugknöpfe und Seitenleistenanzeige',async({page,context})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=cockpit');
 const sidebar=page.getByRole('navigation',{name:'Serviceansichten',exact:true});
 const search=page.getByRole('button',{name:'Suche öffnen',exact:true});
 const create=page.getByRole('link',{name:'Neuer Auftrag im CaseDesk',exact:true});
 const disclosure=page.getByRole('button',{name:'Seitenleiste ausblenden',exact:true});
 const appearance=element=>element.evaluate(node=>{
  const css=getComputedStyle(node);
  return ['width','height','borderRadius','borderColor','backgroundColor','boxShadow','color'].map(property=>css[property]).join('|');
 });
 const expectSameAppearance=async (reference,candidate)=>{
  await expect.poll(async()=>{
   const [left,right]=await Promise.all([appearance(reference),appearance(candidate)]);
   return left===right;
  }).toBe(true);
 };
 await expect(sidebar.getByRole('button',{name:'Alle Aufträge',exact:true}).locator('small')).toHaveText(/^\p{Nd}+$/u);
 await expect(sidebar.locator('button small').filter({hasText:/^0$/})).toHaveCount(0);
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((node,value)=>node.dataset.theme=value,theme);
  const foreground=await page.getByRole('main').evaluate(node=>getComputedStyle(node).color);
  await expect(disclosure.locator('svg')).toHaveCSS('color',foreground);
  const iconColors=await sidebar.locator('svg').evaluateAll(icons=>icons.map(icon=>getComputedStyle(icon).color));
  expect(new Set(iconColors).size).toBe(1);
  expect(iconColors[0]).not.toBe(foreground);
  const related=page.getByRole('navigation',{name:'Verwandte Apps',exact:true});
  const appIcons=await related.locator('svg').evaluateAll(icons=>icons.map(icon=>({
   color:getComputedStyle(icon).color,background:getComputedStyle(icon.parentElement).backgroundImage,
  })));
  expect(appIcons).toHaveLength(3);
  expect(appIcons.every(icon=>icon.color==='rgb(255, 255, 255)'&&icon.background.startsWith('linear-gradient'))).toBe(true);
  expect(new Set(appIcons.map(icon=>icon.background)).size).toBe(3);
  for(const label of ['Cockpit','Alle Aufträge','Fällige Wartungen','Alle Kunden …']){
   await sidebar.getByRole('button',{name:label,exact:true}).click();
   await expect(sidebar.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
   await expect(create).toHaveCSS('color',foreground);
   await page.mouse.move(0,0);
   await expectSameAppearance(create,search);
   await expectSameAppearance(create,disclosure);
  }
 }
 await sidebar.getByRole('button',{name:/^Beispielhaus Nord/}).last().click();
 await expect(page).toHaveURL(/ansicht=orders&kunde=SIM-K-100/);
 const orders=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 await expect(orders.getByRole('group',{name:'Auftragskategorien',exact:true})).toBeVisible();
 await expect(orders.getByRole('button',{name:/SIM-SA-10001/})).toBeVisible();
 await expect(orders.getByRole('button',{name:'Kundenakte',exact:true})).toHaveCount(0);
 await expect(orders.getByRole('button',{name:/anheften|lösen/})).toHaveCount(0);
 await sidebar.getByRole('button',{name:'Cockpit',exact:true}).click();
 const cockpit=page.getByRole('group',{name:'Cockpit-Werkzeugleiste',exact:true});
 await expect(cockpit).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.mouse.move(0,0);
 await expectSameAppearance(cockpit.getByRole('link',{name:'Neuer Auftrag im CaseDesk',exact:true}),
  cockpit.getByRole('button',{name:'Suche öffnen',exact:true}));
});

test('E62 ServiceHub zeigt leere Auftragslisten und ungewählte Akten passend zum Kontext',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/servicehub?ansicht=orders&markiert=1');
 const overview=page.getByRole('region',{name:'Serviceübersicht',exact:true});
 const pane=page.getByRole('complementary',{name:'Auftragssuche',exact:true});
 const listEmpty=overview.locator('[data-empty-state="list"]');
 const detailEmpty=pane.locator('[data-empty-state="detail"]');
 const showAll=listEmpty.getByRole('button',{name:'Alle Aufträge anzeigen',exact:true});
 await expect(listEmpty.getByText('Keine markierten Aufträge',{exact:true})).toBeVisible();
 await expect(overview.getByText('0 Aufträge',{exact:true})).toBeVisible();
 await expect(detailEmpty.getByText('Keine Auftragsakte geöffnet',{exact:true})).toBeVisible();
 await expect(showAll).toHaveAttribute('data-slot','button');
 const area=await pane.boundingBox(),state=await detailEmpty.boundingBox();
 expect(Math.abs(state.x+state.width/2-(area.x+area.width/2))).toBeLessThan(5);
 expect(state.y-area.y).toBeGreaterThan(area.height/4);
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((node,value)=>node.dataset.theme=value,theme);
  await axe(page,`service-empty-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`service-empty-${browserName}-${theme}.png`)});
 }
 await showAll.press('Enter');
 await expect(listEmpty).toHaveCount(0);
 await expect(overview.getByText('Alle Aufträge',{exact:true})).toBeFocused();
 await expect(overview.getByRole('button',{name:/SIM-SA-10001/})).toBeVisible();
 await expect(detailEmpty.getByText('Auftrag auswählen',{exact:true})).toBeVisible();

 await pane.getByRole('button',{name:'Suche öffnen',exact:true}).click();
 const search=pane.getByRole('combobox',{name:'Suche',exact:true});
 await search.fill('keine-fiktiven-treffer-562');
 await expect(listEmpty.getByText('Keine passenden Aufträge.',{exact:true})).toBeVisible();
 await listEmpty.getByRole('button',{name:'Suche und Filter zurücksetzen',exact:true}).click();
 await expect(listEmpty).toHaveCount(0);
 await expect(search).toHaveValue('');

 await page.getByRole('navigation',{name:'Serviceansichten',exact:true}).getByRole('button',{name:'Markiert',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await expect(listEmpty).toBeVisible();
 await expect(detailEmpty).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('E63 CaseDesk klappt vier Schritte an ihrer Position auf und prüft den vollständigen Meldungstext',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/casedesk');
 const names=['Objekt & technische Einheit','Meldung & Kontakt','Techniker & Termin','Abschluss'];
 const headers=names.map(name=>page.getByRole('button',{name,exact:true}));
 const sections=names.map(name=>page.getByRole('region',{name,exact:true}));
 await expect(headers[0]).toHaveAttribute('aria-expanded','true');
 await expect(headers[3]).toBeDisabled();
 const widthBefore=(await headers[1].boundingBox()).width;
 const object=sections[0].getByRole('combobox',{name:'Objekt',exact:true});
 await object.click();
 const field=object.locator('..');
 await expect(field).toHaveCSS('outline-style','solid');
 await expect(field).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');
 await expect(field).toHaveCSS('box-shadow','none');
 await expect(object).toHaveCSS('outline-style','none');
 await object.fill('Beispielhaus Nord');
 await page.route(url=>url.pathname==='/api/pds-simulator'&&url.searchParams.get('resource')==='units',route=>{
  const params=new URL(route.request().url()).searchParams;
  const offset=Number(params.get('offset')),limit=Number(params.get('limit'));
  const items=params.get('q')==='Einheit 500'
   ? [{id:'sim-unit-1',label:'SIM-TE-101 · Einheit 500'}]
   : Array.from({length:limit},(_,index)=>({id:`test-unit-${offset+index+1}`,label:`Einheit ${offset+index+1}`}));
  return route.fulfill({json:{items,total:params.get('q')?1:500}});
 });
 await sections[0].getByRole('option',{name:/Beispielhaus Nord/}).click();
 const removeObject=sections[0].getByRole('button',{name:/^SIM-OBJ-100.*entfernen$/});
 await removeObject.focus();
 await expect(removeObject.locator('../..')).toHaveCSS('outline-style','none');
 await expect(sections[0].getByRole('button',{name:/^Einheit \d+$/})).toHaveCount(8);
 const unitFilter=sections[0].getByRole('searchbox',{name:'Technische Einheiten filtern'});
 await unitFilter.fill('Einheit 500');
 await expect(sections[0].getByRole('button',{name:/SIM-TE-101/})).toBeVisible();
 await sections[0].getByRole('button',{name:/SIM-TE-101/}).click();
 await sections[0].getByRole('button',{name:'Weiter',exact:true}).click();
 await expect(headers[1]).toBeFocused();
 await expect(sections[0]).toBeHidden();
 await expect(sections[1]).toBeVisible();
 await expect.poll(async()=>(await headers[1].boundingBox()).width).toBeGreaterThan(widthBefore*4);
 const columns=await Promise.all(headers.map(button=>button.boundingBox()));
 for(let index=1;index<columns.length;index++)expect(columns[index].x).toBeGreaterThan(columns[index-1].x);
 expect(new Set(columns.map(box=>Math.round(box.y))).size).toBe(1);

 await sections[1].getByRole('combobox',{name:'Wer meldet die Störung?',exact:true}).fill('Andrea');
 await sections[1].getByRole('option',{name:/Andrea Beispiel/}).click();
 const problem='Fiktive Prüfung der Heizungsanlage.\n'+('Der Druck ist erneut abgefallen. '.repeat(18))+'Letzte Zeile der Meldung.';
 await sections[1].getByRole('textbox',{name:'Was ist die Störung? *',exact:true}).fill(problem);
 await sections[1].getByRole('textbox',{name:'Externe Auftragsnummer (optional)',exact:true}).fill('SIM-ACCORDION-4');
 await sections[1].getByRole('button',{name:'Weiter',exact:true}).click();
 await expect(headers[2]).toHaveAttribute('aria-expanded','true');
 await page.route(url=>url.pathname==='/api/pds-simulator'&&url.searchParams.get('resource')==='employees',route=>{
  const params=new URL(route.request().url()).searchParams;
  const offset=Number(params.get('offset')),limit=Number(params.get('limit'));
  const items=Array.from({length:limit},(_,index)=>({id:`test-employee-${offset+index+1}`,label:`Beispieltechniker ${offset+index+1}`}));
  return route.fulfill({json:{items,total:100}});
 });
 const technician=sections[2].getByRole('combobox',{name:'Haupttechniker · PDS-Mobilität'});
 await technician.fill('Beispieltechniker');
 await expect(page.getByRole('option')).toHaveCount(10);
 await expect(page.getByRole('option',{name:'Beispieltechniker 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Weitere Treffer'}).click();
 await expect(page.getByRole('option')).toHaveCount(10);
 await expect(page.getByRole('option',{name:'Beispieltechniker 11',exact:true})).toBeVisible();
 await technician.focus();
 await technician.press('Escape');
 await sections[2].getByRole('button',{name:'Schritt überspringen',exact:true}).click();
 for(const header of headers.slice(0,2))await expect(header.locator('..')).toHaveAttribute('data-complete','true');
 await expect(headers[2].locator('..')).toHaveAttribute('data-deferred','true');
 await expect(headers[2].locator('..')).not.toHaveAttribute('data-complete','true');
 const accordion=headers[0].locator('../..');
 const card=page.locator('[data-slot="card"]').filter({has:headers[0]}).first();
 await expect.poll(async()=>Math.abs((await card.boundingBox()).y+(await card.boundingBox()).height-(await accordion.boundingBox()).y-(await accordion.boundingBox()).height)).toBeLessThanOrEqual(1);
 await expect(headers[2].getByText('Später planen',{exact:true}).last()).toBeVisible();
 const remark=sections[3].getByRole('textbox',{name:/^PDS-Bemerkung/});
 await remark.click();
 await expect(remark).toHaveCSS('outline-style','solid');
 await expect(remark).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');
 await expect(remark).toHaveCSS('box-shadow','none');
 await remark.fill('Bemerkung zur fiktiven Anlage');
 const report=sections[3].getByRole('region',{name:'Vollständiger Meldungstext',exact:true}).locator('p');
 const text=await report.textContent();
 expect(text).toContain(problem);
 expect(text).not.toContain('Bemerkung zur fiktiven Anlage');
 expect(text).toContain('Ihre Auftragsnummer: SIM-ACCORDION-4');
 await expect(report).toHaveCSS('white-space','pre-wrap');
 await expect(sections[3].getByRole('button',{name:'Serviceauftrag speichern',exact:true})).toBeDisabled();
 await headers[1].click();
 await expect(sections[1].getByRole('textbox',{name:'Was ist die Störung? *',exact:true})).toHaveValue(problem);
 await headers[3].click();
 await expect(report).toBeVisible();
 await expect(remark).toHaveValue('Bemerkung zur fiktiven Anlage');
 await expect(sections[3].getByRole('combobox',{name:/Projektleiter/})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));
 for(const theme of ['light','dark']){
  await page.locator('html').evaluate((node,value)=>node.dataset.theme=value,theme);
  await expect(headers[3]).toHaveCSS('background-image','none');
  const backgrounds=await Promise.all(headers.map(header=>header.evaluate(node=>getComputedStyle(node).backgroundColor)));
  for(const index of [0,2,3]){
   const box=await headers[index].boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+18);
   expect(await headers[index].evaluate(node=>node.matches(':hover'))).toBe(true);
   await expect(headers[index]).toHaveCSS('background-color',backgrounds[index]);
   await expect(headers[index]).toHaveCSS('filter','none');
  }
  await axe(page,`casedesk-accordion-${browserName}-${theme}`);
  await page.screenshot({path:join(artifacts,`casedesk-accordion-${browserName}-${theme}.png`)});
 }
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const compact=await Promise.all(headers.map(button=>button.boundingBox()));
 for(let index=1;index<compact.length;index++)expect(compact[index].y).toBeGreaterThan(compact[index-1].y);
 await page.screenshot({path:join(artifacts,`casedesk-accordion-${browserName}-mobile.png`)});
 await page.close();
 const prefilled=await context.newPage();
 await enter(prefilled,'/casedesk?ausMail=sim-mail-01');
 await expect(prefilled.getByText(/Aus MailDesk: „Störung Heizung – KTR SIM-KTR-100“/)).toBeVisible();
 await expect(prefilled.getByRole('button',{name:'Objekt & technische Einheit',exact:true})).toHaveAttribute('aria-expanded','true');
 await prefilled.getByRole('region',{name:'Objekt & technische Einheit',exact:true}).getByRole('button',{name:'Weiter',exact:true}).click();
 await expect(prefilled.getByRole('region',{name:'Meldung & Kontakt',exact:true})
  .getByRole('textbox',{name:'Was ist die Störung? *',exact:true})).not.toHaveValue('');
 await prefilled.close();
});

test('E64 CaseDesk zeigt die Anlagenchronik ausschließlich zur ausgewählten technischen Einheit',async({page,context,browserName})=>{
 await authenticate(context);
 await enter(page,'/casedesk');
 const pane=page.getByRole('region',{name:'Objekt & technische Einheit',exact:true});
 const chronicle=pane.getByRole('region',{name:'Chronologische Anlagenereignisse',exact:true});
 const title=pane.getByText('Anlagenchronik',{exact:true});
 const requests=[];
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.pathname==='/api/service/chronik')requests.push(url.searchParams.get('id'));
 });
 const object=pane.getByRole('combobox',{name:'Objekt',exact:true});
 await object.fill('Musterwerk West');
 await pane.getByRole('option',{name:/Musterwerk West/}).click();
 await expect(chronicle).toHaveCount(0);
 await pane.getByRole('button',{name:/^SIM-TE-301/}).click();
 await expect(title).toBeVisible();
 await expect(chronicle).toHaveCount(0);
 expect(requests).toEqual([]);
 await title.press('Enter');
 await expect(chronicle.getByText('SIM-SA-10002',{exact:true})).toBeVisible();
 await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toBeVisible();
 await chronicle.getByRole('button',{name:'Berichte & Unterlagen',exact:true}).click();
 await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toBeVisible();
 await pane.getByRole('button',{name:/^SIM-TE-302/}).click();
 await expect(title).toBeVisible();
 await expect(chronicle).toHaveCount(0);
 expect(requests.length).toBeGreaterThan(0);
 expect(new Set(requests)).toEqual(new Set(['sim-unit-4']));
 await title.click();
 await expect(chronicle.getByText('Wartung Sicherheitsbeleuchtung',{exact:true})).toBeVisible();
 await expect(chronicle.getByText('Wartung Brandmeldeanlage',{exact:true})).toHaveCount(0);
 await page.locator('html').evaluate(node=>node.dataset.theme='light');
 await page.screenshot({path:join(artifacts,`casedesk-chronicle-${browserName}-light.png`),fullPage:true});
 await expect(chronicle.getByText('Fiktiver Wartungsbericht BMA.txt',{exact:true})).toHaveCount(0);
 await expect(chronicle.getByText('SIM-SA-10002',{exact:true})).toHaveCount(0);
 await pane.getByRole('button',{name:/^SIM-TE-302.*entfernen$/}).click();
 await expect(title).toHaveCount(0);
});
