import 'server-only';
import {platformDatabase} from '@/platform/store';
import {copilotRepository} from './repository';
export function copilotStore(){return copilotRepository(platformDatabase());}
export {copilotMessage} from './transport';
export {agentInstructions,protocolVersion} from './protocol';
