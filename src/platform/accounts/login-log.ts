// Kurze Logzeilen für abgelehnte Anmeldungen, damit Fehler diagnostizierbar sind.
// Es erscheinen nur feste Gründe, der Anmeldemodus und der HTTP-Status. Nie Benutzername, Passwort, IP-Adresse oder Fehlertext.
export const LOGIN_REASONS=[
  "Modus gesperrt","nicht konfiguriert","falsches Passwort oder unbekannter Benutzer","Benutzer nicht freigeschaltet",
  "PDS-Zuordnung fehlt","Anmeldequelle oder Datenbank nicht erreichbar","Anmeldequelle (Header) fehlt oder ungültig",
  "Verzeichnisdienst-Konfiguration unvollständig","ungültige Eingabe","unzulässiger Ursprung","zu viele Versuche","durch Microsoft ersetzt","unbekannter Fehler",
] as const;
export type LoginReason=typeof LOGIN_REASONS[number];

// Ordnet einen Fehler einem festen Grund zu. Auswertung nur anhand der eigenen, festen Meldungen des Programms.
export function loginFailureReason(error:unknown):LoginReason{
  const message=error instanceof Error?error.message:"";
  const code=typeof (error as {code?:unknown})?.code==="string"?(error as {code:string}).code:"";
  if(/über Microsoft/i.test(message))return "durch Microsoft ersetzt";
  if(/gesperrt/i.test(message))return "Modus gesperrt";
  if(/nicht konfiguriert/i.test(message))return "nicht konfiguriert";
  if(/nicht freigeschaltet/i.test(message))return "Benutzer nicht freigeschaltet";
  if(/Anmeldequelle fehlt|Header für die Anmeldequelle/i.test(message))return "Anmeldequelle (Header) fehlt oder ungültig";
  if(/zuordnung/i.test(message))return "PDS-Zuordnung fehlt";
  if(/Demobenutzer fehlen/i.test(message))return "Verzeichnisdienst-Konfiguration unvollständig";
  if(/anmeldung fehlgeschlagen/i.test(message))return "falsches Passwort oder unbekannter Benutzer";
  if(/^(E[A-Z]{3,}|57P|08|53)/.test(code)||/timeout|connect|verbindung/i.test(message))return "Anmeldequelle oder Datenbank nicht erreichbar";
  return "unbekannter Fehler";
}
export function loginRejectedLine(reason:LoginReason|string,mode:string,status:number){
  const safeMode=/^[a-z-]{1,30}$/.test(mode)?mode:"unbekannt";
  const safeReason=(LOGIN_REASONS as readonly string[]).includes(reason)?reason:"unbekannter Fehler";
  return `Anmeldung abgelehnt: ${safeReason} (Modus ${safeMode}, HTTP ${Number.isInteger(status)?status:0})`;
}
export function logLoginRejected(reason:LoginReason|string,mode:string,status:number,log:(line:string)=>void=console.warn){log(loginRejectedLine(reason,mode,status));}
