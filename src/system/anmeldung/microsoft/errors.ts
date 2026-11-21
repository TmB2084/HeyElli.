import {PlatformError} from '../../../platform/store/model.ts';
export class MicrosoftAuthError extends PlatformError{
 readonly reason:'credentials'|'connection'|'response';
 constructor(message:string,status:number,reason:'credentials'|'connection'|'response'){super(message,status);this.reason=reason;}
}
