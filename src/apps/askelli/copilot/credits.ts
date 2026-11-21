// Match the service notice itself, not any discussion mentioning credits.
// Never expose the original reply, links, identifiers or credentials.
export function missingCopilotCredits(value:unknown):boolean{
 if(typeof value!=='string'||value.length>200000)return false;
 let text=value;
 try{const parsed=JSON.parse(value);text=parsed?.error?.message??parsed?.answer??parsed?.message??value;}catch{/* Plain service messages are expected here. */}
 if(typeof text!=='string')return false;
 text=text.trim().replace(/^[*_#>\s]+/,'').replace(/\s+/g,' ');
 return /^you need credits to continue(?:[.!:*\s]|$)/i.test(text);
}
export const missingCreditsMessage='Microsoft meldet fehlende Copilot Credits. Bitte die Microsoft-Administration bitten, das verfügbare Kontingent, die Zuweisung und den Abrechnungsplan der Agenten-Umgebung im Power Platform Admin Center zu prüfen. Es wurde keine HeyElli-Aktion ausgeführt.';
