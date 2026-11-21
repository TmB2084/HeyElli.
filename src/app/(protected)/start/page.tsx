import {Suspense} from 'react';
import type {Metadata} from 'next';
import {StartPage} from '@/system/start';
export const metadata:Metadata={title:'HeyElli'};
export default function Start(){return <Suspense fallback={<main><p role="status">Startseite wird geladen …</p></main>}><StartPage/></Suspense>;}
