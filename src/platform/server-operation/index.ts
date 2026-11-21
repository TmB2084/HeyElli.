// Serverbetrieb im Container und Schutz für Testinstanzen.
// Ohne die hier gelesenen Umgebungsvariablen verhält sich die Anwendung wie bisher.

// Ausdrückliche Freigabe für den Betrieb als Produktions-Build (next start) im Container. Ohne diese Variable bleibt
// der Datenbankbetrieb im Produktionsmodus gesperrt (bisheriges Verhalten).
export function serverOperation(env:NodeJS.ProcessEnv=process.env){return env.NODE_ENV==="production"&&env.HEYELLI_SERVER_BETRIEB==="1";}

// Hostname der Datenbank (Standard wie bisher: 127.0.0.1). Im Container ist es der Dienstname, z. B. "db".
export function postgresHost(env:NodeJS.ProcessEnv=process.env){
  const host=(env.POSTGRES_HOST??"").trim();
  if(!host)return "127.0.0.1";
  if(!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i.test(host))throw new Error("Ungültiger Datenbankhost.");
  return host;
}

// Basisadresse des Ollama-Dienstes (Standard wie bisher: http://127.0.0.1:11434). Nur http(s) ohne Pfad und Zugangsdaten.
export function ollamaBaseUrl(env:NodeJS.ProcessEnv=process.env){
  const raw=(env.OLLAMA_BASE_URL??"").trim();
  if(!raw)return "http://127.0.0.1:11434";
  let url:URL;try{url=new URL(raw);}catch{throw new Error("Ungültige OLLAMA_BASE_URL.");}
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||(url.pathname!=="/"&&url.pathname!=="")||url.search||url.hash)throw new Error("Ungültige OLLAMA_BASE_URL.");
  return url.origin;
}

// Elli (lokaler Assistent) gibt es in der Entwicklung und im Serverbetrieb nur mit HEYELLI_ELLI_AKTIV=1.
export function elliAvailable(env:NodeJS.ProcessEnv=process.env){return env.NODE_ENV==="development"||(serverOperation(env)&&env.HEYELLI_ELLI_AKTIV==="1");}

// ---------------------------------------------------------------- Schutz für Testinstanzen
// HEYELLI_INSTANZ_HINWEIS (z. B. TESTINSTANZ): Hinweisbalken auf jeder Seite.
export function instanceNotice(env:NodeJS.ProcessEnv=process.env){return (env.HEYELLI_INSTANZ_HINWEIS??"").trim().slice(0,40);}

export type MailPlan={mode:"normal"}|{mode:"redirect";address:string}|{mode:"off"};
// HEYELLI_MAIL_MODUS: leer/normal = wie bisher, umleiten = alle Mails nur an HEYELLI_MAIL_UMLEITUNG, aus = kein Versand (simuliert).
// Unbekannte Werte und eine fehlende oder ungültige Umleitungsadresse schalten den Versand ab (sicherer Ausfall).
export function mailPlan(env:NodeJS.ProcessEnv=process.env):MailPlan{
  const mode=(env.HEYELLI_MAIL_MODUS??"").trim().toLowerCase();
  if(mode===""||mode==="normal")return {mode:"normal"};
  if(mode==="umleiten"){const address=(env.HEYELLI_MAIL_UMLEITUNG??"").trim();return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(address)?{mode:"redirect",address}:{mode:"off"};}
  return {mode:"off"};
}
type OutgoingMail={sender:string;recipient:string;subject:string;body:string};
// Liefert die zu sendende Mail (bei Umleitung mit geänderter Adresse und Hinweis) oder null, wenn nicht gesendet werden darf.
export function mailForDelivery<T extends OutgoingMail>(mail:T,env:NodeJS.ProcessEnv=process.env):T|null{
  const plan=mailPlan(env);
  if(plan.mode==="off")return null;
  if(plan.mode==="redirect")return {...mail,recipient:plan.address,subject:`[TEST für ${mail.recipient}] ${mail.subject}`.slice(0,255),body:`[Testinstanz: Diese Mail wäre an ${mail.recipient} gegangen und wurde umgeleitet.]\n\n${mail.body}`};
  return mail;
}

// HEYELLI_EXTERN_SCHREIBEN=aus: keine schreibenden Zugriffe auf Microsoft Graph (SharePoint u. a.) und kein Copilot
// (copilot/transport.ts, local-assistant/provider-policy.ts: Elli bleibt bei Ollama). Lesen und Anmeldung bleiben.
export function externalWritesBlocked(env:NodeJS.ProcessEnv=process.env){return (env.HEYELLI_EXTERN_SCHREIBEN??"").trim().toLowerCase()==="aus";}
export function guardExternalWrites(transport:typeof fetch,env:NodeJS.ProcessEnv=process.env):typeof fetch{
  if(!externalWritesBlocked(env))return transport;
  return (async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
    const url=String(input instanceof Request?input.url:input);
    if(!["GET","HEAD","OPTIONS"].includes(method)&&!/^https:\/\/login\.microsoftonline\.com\//.test(url))throw new Error("Externe Schreibzugriffe sind in dieser Instanz abgeschaltet.");
    return transport(input,init);
  }) as typeof fetch;
}

// Verzeichnis für verschlüsselte Einstellungen (.env.*.local) und Master-Schlüssel (.local/*-secrets).
// Standard wie bisher: das Arbeitsverzeichnis. Im Container zeigt HEYELLI_SETTINGS_DIR auf ein Volume (nur im Serverbetrieb).
export function settingsDirectory(env:NodeJS.ProcessEnv=process.env,cwd:()=>string=()=>process.cwd()){
  const dir=(env.HEYELLI_SETTINGS_DIR??"").trim();
  if(!dir||!serverOperation(env))return cwd();
  if(!dir.startsWith("/")||dir.includes("..")||dir.includes("\0"))throw new Error("Ungültiges HEYELLI_SETTINGS_DIR.");
  return dir;
}
