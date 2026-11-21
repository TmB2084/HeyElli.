import {copilotStore} from '@/apps/askelli/copilot';
import {Suspense} from 'react';
import {HelpWorkspace} from '@/apps/askelli/elli';
import {session,permitted} from '@/platform/session';
import {redirect} from 'next/navigation';

async function HelpContent(){
 const user=await session();if(!permitted(user,'read'))redirect('/anmeldung');
 let copilotActive=false;try{copilotActive=(await copilotStore().settings()).enabled===true;}catch{/* Local help is the safe default. */}
 return <HelpWorkspace canAdmin={permitted(user,'admin')} copilotActive={copilotActive}/>;
}
export default function Help(){
 return <Suspense fallback={<main><p role="status">Anleitung wird geladen …</p></main>}><HelpContent/></Suspense>;
}
