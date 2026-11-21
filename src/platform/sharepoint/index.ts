import 'server-only';
import {platformDatabase} from '../store';
import {sharepointRepository} from './repository';
import {documentRepository} from './documents';
export const sharepointStore=()=>sharepointRepository(platformDatabase());
export const sharepointDocuments=()=>documentRepository(platformDatabase());
