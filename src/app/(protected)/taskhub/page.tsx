import type {Metadata} from 'next';
import {Suspense} from 'react';
import {TasksWorkspace} from '@/apps/taskhub';
export const metadata:Metadata={title:'TaskHub | HeyElli'};
export default function TasksPage(){return <Suspense fallback={<main className="login-page"><p role="status">Sitzung wird geprüft …</p></main>}><TasksWorkspace/></Suspense>;}
