import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {writeFile} from 'node:fs/promises';
let muted=false;
const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}});
const prompts=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
try{
 const tenant=(await prompts.question('Microsoft-365 Tenant-ID: ')).trim(),client=(await prompts.question('Microsoft-365 Client-ID: ')).trim();
 process.stdout.write('Client-Secret-Wert (Eingabe verborgen): ');muted=true;const secret=await prompts.question('');muted=false;process.stdout.write('\n');
 const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(!guid.test(tenant)||!guid.test(client)||!secret||/[\r\n]/.test(secret))throw Error('invalid');
 const quote=["'",'"','`'].find(mark=>!secret.includes(mark));if(!quote)throw Error('invalid');
 await writeFile('.env.microsoft365.local',`M365_TENANT_ID=${JSON.stringify(tenant)}\nM365_CLIENT_ID=${JSON.stringify(client)}\nM365_CLIENT_SECRET=${quote}${secret}${quote}\n`,{flag:'wx',mode:0o600});
 console.log('Microsoft-365-Daten lokal gespeichert. In HeyElli Absender eintragen, Verbindung prüfen und gewünschten Betriebsmodus bestätigen.');
}catch(error){muted=false;console.error(error?.code==='EEXIST'?'Lokale Microsoft-365-Konfiguration existiert bereits und wurde nicht überschrieben.':'Einrichtung abgebrochen oder Angaben ungültig.');process.exitCode=1;}finally{prompts.close();}
