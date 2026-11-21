import type {Metadata} from "next";
import {Notice} from "@/platform/shell";
import {Suspense} from 'react';
import {session,permitted} from '@/platform/session';
import {PersonalSettingsWorkspace} from '@/platform/shell';
export const metadata:Metadata={title:"Benutzerkonto | HeyElli"};
async function PersonalSettings(){
 let user:Awaited<ReturnType<typeof session>>;
 try{user=await session();}catch{return <main className="admin-page calendar-page administration-page personal-settings-page"><h1>Benutzerkonto</h1><Notice tone="error">Das Benutzerkonto ist derzeit nicht erreichbar.</Notice></main>;}
 if(!user||!permitted(user,'read'))return <main className="admin-page calendar-page administration-page personal-settings-page"><h1>Benutzerkonto</h1><Notice tone="error">Bitte mit einem freigeschalteten Benutzerkonto anmelden und die Seite neu laden.</Notice></main>;
 return <PersonalSettingsWorkspace/>;
}
export default function SettingsPage(){return <Suspense fallback={<main className="admin-page calendar-page administration-page personal-settings-page"><p>Benutzerkonto wird geladen …</p></main>}><PersonalSettings/></Suspense>;}
