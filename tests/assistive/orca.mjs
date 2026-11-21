import {chromium} from '/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer,connect} from 'node:net';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
const fixture=JSON.parse(await readFile('/fixture.json','utf8')),remote=new URL(fixture.base),sockets=new Set(),checks=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const proxy=createServer(client=>{const upstream=connect(Number(remote.port),remote.hostname);sockets.add(client);sockets.add(upstream);client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy());client.pipe(upstream);upstream.pipe(client);});
proxy.listen(0,'127.0.0.1');await once(proxy,'listening');fixture.base='http://127.0.0.1:'+proxy.address().port;
let browser,currentCase='Start';
async function speechCheck(name,pattern,action){
 currentCase=name;const patterns=Array.isArray(pattern)?pattern:[pattern],matched=lines=>patterns.every(p=>lines.some(line=>p.test(line)));const offset=(await readFile('/tmp/a09-orca.log','utf8')).length;await action();let lines=[];
 for(let attempt=0;attempt<32;attempt++){await pause(250);lines=(await readFile('/tmp/a09-orca.log','utf8')).slice(offset).split('\n').filter(line=>line.includes('SPEECH OUTPUT:'));if(matched(lines))break;}
 checks.push({case:name,passed:matched(lines),speech:lines.filter(line=>patterns.some(p=>p.test(line))).map(line=>line.slice(line.indexOf('SPEECH OUTPUT:'))).slice(0,3)});
}
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:false,args:['--force-renderer-accessibility','--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(fixture.base)?route.continue():route.abort());
 const login=await context.request.post(fixture.base+'/api/simulator-session',{headers:{origin:fixture.base},data:{username:fixture.username??'service',password:fixture.password}});if(!login.ok())throw Error('Isolierte Anmeldung fehlgeschlagen');
 const page=await context.newPage();await page.goto(fixture.base+'/planboard');await page.getByRole('button',{name:'Neuer Termin',exact:true}).waitFor();await pause(2500);await page.bringToFront();
 execFileSync('xdotool',['search','--onlyvisible','--class','chromium','windowactivate','--sync']);
 await speechCheck('Dialogtitel und Pflichtfeld',[/Neuen Termin.*dialog/i,/Titel.*entry.*required/i],async()=>{await page.getByRole('button',{name:'Neuer Termin',exact:true}).click();await page.getByRole('dialog',{name:'Neuen Termin anlegen',exact:true}).waitFor();});
 await speechCheck('PIM-Schalter mit Funktionsname',[/PIM.Synchronisation/i,/SPEECH OUTPUT.*\bon\b/i],async()=>{const pim=page.getByRole('switch',{name:'PIM-Synchronisation',exact:true});await pim.focus();execFileSync('xdotool',['key','space']);await page.waitForFunction(()=>document.querySelector('input[aria-label="PIM-Synchronisation"]')?.checked);if(!await pim.isChecked())throw Error('PIM-Schalter nicht umgeschaltet');execFileSync('xdotool',['key','KP_Enter']);});
 await speechCheck('Abbruch: DOM-Fokus und Orca-Ortsabfrage',/Neuer Termin/i,async()=>{await page.getByRole('button',{name:'Abbrechen',exact:true}).focus();execFileSync('xdotool',['key','Return']);await page.getByRole('dialog',{name:'Neuen Termin anlegen',exact:true}).waitFor({state:'hidden'});await pause(100);if(!await page.getByRole('button',{name:'Neuer Termin',exact:true}).evaluate(el=>el===document.activeElement))throw Error('Fokusrueckkehr fehlt');execFileSync('xdotool',['key','KP_Enter']);});
 await page.goto(fixture.base+'/benutzerkonto?bereich=account&seite=account%3Aprofile');const profile=page.getByRole('heading',{name:'Profil',exact:true});await profile.waitFor();await speechCheck('Profilueberschrift',/Profil/i,()=>profile.focus());
 await page.locator('.platform-account > summary').click();await page.getByRole('button',{name:'Abmelden',exact:true}).click();await page.getByRole('button',{name:'Anmelden',exact:true}).waitFor();
 await speechCheck('Anmeldeformular nach Abmeldung erreichbar',/Anmelden/i,()=>page.getByRole('button',{name:'Anmelden',exact:true}).focus());
 await speechCheck('Fehlermeldung nach ungueltiger Anmeldung',/Anmeldung fehlgeschlagen/i,async()=>{await page.getByLabel('Passwort',{exact:true}).fill('fiktive-ungueltige-A09-Pruefeingabe');await page.getByRole('button',{name:'Anmelden',exact:true}).click();});
 await writeFile('/output/results.json',JSON.stringify({status:checks.every(check=>check.passed)?'passed':'failed',reader:execFileSync('orca',['--version'],{encoding:'utf8'}).trim(),browser:browser.version(),method:'Orca/AT-SPI: echte Speech-Outputs pro Pruefphase; Bedienung ueber Playwright und X11; Audioausgang isoliert auf ALSA-null',checks},null,2)+'\n');
 if(checks.some(check=>!check.passed))throw Error('Nicht alle Orca-Ansagen nachgewiesen');console.log('Orca-Pruefung erfolgreich.');
}catch{console.error('Screenreader-Pruefphase fehlgeschlagen: '+currentCase);await writeFile('/output/results.json',JSON.stringify({status:'failed',stage:currentCase,checks},null,2)+'\n');process.exitCode=1;}
finally{await browser?.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>proxy.close(resolve));}
