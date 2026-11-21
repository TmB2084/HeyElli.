import 'server-only';
import {platformDatabase} from '../../store';
import {pdsConnectionRepository} from './repository';
export function pdsConnectionStore(){return pdsConnectionRepository(platformDatabase());}

import {sourceSnapshot} from './source';
export async function pdsSource(){return sourceSnapshot(platformDatabase());}
export async function requireSimulatorWrites(){const source=await pdsSource();if(source.mode!=='simulator')throw new (await import('../../store/model')).PlatformError('Echter PDS-Betrieb ist nur lesend freigegeben. Schreibfunktionen sind gesperrt.',409);}
export {calendarSourcePool,sourceConfiguration} from './source';
