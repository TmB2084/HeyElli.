import type {Metadata} from "next";
import {Notice} from "@/platform/shell";
import {Suspense} from "react";
import {session,permitted} from "@/platform/session";
import {AdminPanel} from "@/system/einstellungen/ui";
export const metadata:Metadata={title:"Einstellungen | HeyElli"};
async function ProtectedAdministration() {
  let user:Awaited<ReturnType<typeof session>>=null,unavailable=false;
  try {user=await session();} catch {unavailable=true;}
  if(unavailable) return <main><h1>Einstellungen nicht erreichbar</h1><Notice tone="error">Bitte die lokale PostgreSQL-Verbindung prüfen lassen.</Notice></main>;
  if(!permitted(user,"admin")) return <main><h1>Einstellungen</h1><Notice tone="error">Für diesen Bereich sind Administratorrechte erforderlich. Bitte oben rechts mit einem freigeschalteten Administratorkonto anmelden und die Seite neu laden.</Notice></main>;
  return <AdminPanel accountName={user?.displayName?.trim()||"Mein Konto"}/>;
}
export default function AdministrationPage() { return <Suspense fallback={<main><p>Einstellungen werden geladen …</p></main>}><ProtectedAdministration/></Suspense>; }
