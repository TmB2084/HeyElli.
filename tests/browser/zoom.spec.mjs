import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,authenticate,resetBrowserBudget} from './fixtures.mjs';

// Actual browser page zoom. No CSS zoom, transform, viewport-only or pinch emulation.
test.beforeEach(resetBrowserBudget);
test('Z01 Echter Browserzoom 200 und 400 Prozent in allen Apps',async()=>{
 test.setTimeout(150000);
 const directory=await mkdtemp(join(process.env.HEYELLI_BROWSER_TEMP_DIR,'zoom-')),extension=join(directory,'extension'),measurements=[];
 await mkdir(extension);await writeFile(join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'HeyElli isolated zoom check',version:'1.0',host_permissions:[fixture.base+'/*'],background:{service_worker:'worker.js'}}));await writeFile(join(extension,'worker.js'),'chrome.runtime.onInstalled.addListener(()=>{});');
 let context,page;
 try{
  context=await chromium.launchPersistentContext(join(directory,'profile'),{channel:'chromium',headless:true,viewport:{width:1280,height:900},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');page=await context.newPage();await authenticate(context);
  await page.goto(fixture.base+'/benutzerkonto?bereich=account&seite=account%3Aprofile');await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();const originalDpr=await page.evaluate(()=>devicePixelRatio);
  async function zoom(factor){await worker.evaluate(async({base,factor})=>{const tab=(await chrome.tabs.query({url:base+'/*'}))[0];if(!tab?.id)throw Error('Prueftab fehlt');await chrome.tabs.setZoomSettings(tab.id,{scope:'per-tab',mode:'automatic'});await chrome.tabs.setZoom(tab.id,factor);if(Math.abs(await chrome.tabs.getZoom(tab.id)-factor)>.001)throw Error('Browserzoom nicht gesetzt');},{base:fixture.base,factor});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(Math.round(1280/factor));expect(await page.evaluate(()=>devicePixelRatio)).toBeCloseTo(originalDpr*factor,2);}
  async function reachable(locator,label){await locator.scrollIntoViewIfNeeded();await locator.focus();const box=await locator.boundingBox(),size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));expect(box,label).not.toBeNull();expect(box.x,label).toBeGreaterThanOrEqual(-1);expect(box.y,label).toBeGreaterThanOrEqual(-1);expect(box.x+box.width,label).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height,label).toBeLessThanOrEqual(size.height+1);expect(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit));}),label).toBe(true);}
  const routes=[['Elli','/'],['Service','/servicehub'],['Stoerung','/casedesk'],['Ressourcen','/planboard'],['Bereitschaft','/dutyboard'],['Profil','/benutzerkonto?bereich=account&seite=account%3Aprofile'],['Anzeige','/benutzerkonto?bereich=appearance'],['Einstellungen','/einstellungen'],['Hilfe','/hilfe']];
  for(const factor of [2,4])for(const [app,path]of routes){await test.step(app+' bei '+factor*100+' Prozent',async()=>{
   await page.goto(fixture.base+path);await expect(page.locator('.platform-bar:visible')).toHaveCount(1);await zoom(factor);await expect(page.locator('main:visible')).toHaveCount(1);
   if(app==='Ressourcen')await expect(page.getByRole('button',{name:'Neuer Termin',exact:true})).toBeEnabled();
   const result=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const box=el.getBoundingClientRect(),css=getComputedStyle(el);return box.width>0&&box.height>0&&css.position!=='absolute'&&css.position!=='fixed'&&box.right>innerWidth+2&&!el.closest('.calendar-board')&&css.visibility!=='hidden'&&css.display!=='none';}).slice(0,12).map(el=>({tag:el.tagName,classes:el.className?.baseVal??String(el.className),width:Math.round(el.getBoundingClientRect().width)}))}));
   measurements.push({app,zoom:factor,...result});
   if(app==='Elli')await reachable(page.getByRole('textbox',{name:'Wie kann ich dir helfen?',exact:true}),'Elli-Eingabe');
   if(app==='Service'){await page.getByRole('button',{name:'Alle Aufträge',exact:true}).click();await page.getByRole('button',{name:'Suche öffnen',exact:true}).click();await reachable(page.getByRole('combobox',{name:'Suche',exact:true}),'Auftragssuche');}
   if(app==='Hilfe')await reachable(page.getByRole('searchbox',{name:'Bedienungsanleitung durchsuchen',exact:true}),'Hilfesuche');
   if(app==='Ressourcen'){const trigger=page.getByRole('button',{name:'Neuer Termin',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Neuen Termin anlegen',exact:true});await reachable(dialog.getByRole('textbox',{name:'Titel *',exact:true}),'Termintitel');await reachable(dialog.getByRole('button',{name:'Abbrechen',exact:true}),'Dialogabbruch');await dialog.getByRole('button',{name:'Abbrechen',exact:true}).click();await expect(trigger).toBeFocused();}

  });}
  await writeFile(join(process.env.HEYELLI_BROWSER_ARTIFACTS,'zoom.json'),JSON.stringify({browser:'Chromium',method:'chrome.tabs.setZoom; getZoom + innerWidth + devicePixelRatio verified',measurements},null,2)+'\n');
  expect(measurements.filter(m=>m.width>m.viewport+2).map(m=>({app:m.app,zoom:m.zoom,width:m.width,viewport:m.viewport}))).toEqual([]);
 }catch(error){await page?.screenshot({timeout:5000,path:join(process.env.HEYELLI_BROWSER_ARTIFACTS,'chromium-Z01.png'),mask:[page.locator('input[type=password]')]}).catch(()=>{});throw error;}
 finally{await context?.close();await rm(directory,{recursive:true,force:true});}
});
