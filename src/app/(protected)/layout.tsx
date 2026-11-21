import {Suspense,type ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {session} from '@/platform/session';
import {PlatformBar} from '@/platform/shell';
import {SessionBoundary} from '@/platform/shell/session-boundary';
async function ProtectedContent({children}:{children:ReactNode}){const user=await session();if(!user)redirect('/anmeldung');if(user.mustChangePassword)redirect('/passwort-aendern');return <SessionBoundary><PlatformBar/><div id="platform-content" tabIndex={-1}>{children}</div></SessionBoundary>;}
export default function ProtectedLayout({children}:{children:ReactNode}){return <Suspense fallback={<main className="login-page"><p>Sitzung wird geprüft …</p></main>}><ProtectedContent>{children}</ProtectedContent></Suspense>;}
