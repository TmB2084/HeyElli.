import 'server-only';
import {platformDatabase} from '../../../platform/store';
import {microsoftAuthRepository} from './repository.ts';
export function microsoftAuthStore(){return microsoftAuthRepository(platformDatabase());}

export {MicrosoftAuthError} from './errors.ts';
