import 'server-only';
import {platformDatabase} from '../store';
import {mailRepository} from './repository';
export function mailStore(){return mailRepository(platformDatabase());}

export {microsoft365Configuration,testMicrosoft365} from './microsoft365';

export {saveMicrosoft365Configuration,validateMicrosoft365Configuration} from './configuration';
