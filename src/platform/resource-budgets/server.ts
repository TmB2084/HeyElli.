import 'server-only';
import {platformDatabase} from '../store';
import {resourceBudgets} from './repository';
export const requestBudgets=()=>resourceBudgets(platformDatabase());
