import type {Metadata} from 'next';
import {Suspense} from 'react';
import {MailDeskWorkspace} from '@/apps/maildesk';
export const metadata:Metadata={title:'MailDesk | HeyElli'};
export default function MailDeskPage(){return <Suspense fallback={<main className="login-page"><p role="status">Sitzung wird geprüft …</p></main>}><MailDeskWorkspace/></Suspense>;}
