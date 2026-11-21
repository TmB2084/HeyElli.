import type {HistoryActor} from './history-outbox';
import 'server-only';
import {localStore} from './order-store';
import {planExisting} from './existing-planning';
export function planExistingLocal(input:unknown,actor:HistoryActor){const store=localStore();try{return planExisting(store,input,actor);}finally{store.close();}}
