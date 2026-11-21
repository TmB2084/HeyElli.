import {Pool,type PoolClient} from 'pg';
import {ResourceError,resourceLimits} from './model.ts';
type Callback=(err:Error|undefined,client:PoolClient|undefined,done:(release?:unknown)=>void)=>void;
export class BoundedPool extends Pool {
 connect():Promise<PoolClient>;
 connect(callback:Callback):void;
 connect(callback?:Callback):Promise<PoolClient>|void{
  if(this.waitingCount>=resourceLimits.poolWaiting){const error=new ResourceError('Datenbank ist ausgelastet. Bitte kurz warten.',503);if(callback){queueMicrotask(()=>callback(error,undefined,()=>{}));return;}return Promise.reject(error);}
  if(callback)return super.connect(callback);return super.connect();
 }
}
