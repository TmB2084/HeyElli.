import {AsyncLocalStorage} from 'node:async_hooks';
import {ResourceError} from './model.ts';
const context=new AsyncLocalStorage<{signal:AbortSignal;calls:number}>();
export function withRequestBudget<T>(kind:string,signal:AbortSignal|undefined,work:()=>T):T{
 const timeout=AbortSignal.timeout(kind==='export'?300000:kind==='heavy'?60000:30000);
 return context.run({signal:signal?AbortSignal.any([signal,timeout]):timeout,calls:0},work);
}
export function upstreamSignal(signal?:AbortSignal){const current=context.getStore();if(!current)return signal;
 if(current.signal.aborted||++current.calls>80)throw new ResourceError('Abfragebudget erreicht. Eingaben bleiben erhalten; bitte den Umfang begrenzen.',503);
 return signal?AbortSignal.any([signal,current.signal]):current.signal;
}
