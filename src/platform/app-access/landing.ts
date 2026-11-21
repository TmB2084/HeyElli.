import {returnPath} from '../../system/anmeldung/anmeldung/return-path.ts';
import {requiredApps} from './model.ts';
/** Choose a permitted entry without granting access or trusting a supplied return URL. */
export function appLandingPath(allowed:string[],preferred:unknown='/'){
 const target=returnPath(preferred),path=new URL(target,'https://heyelli.invalid').pathname,required=requiredApps(path);
 if(path==='/start'||required.length===1&&allowed.includes(required[0]))return target;
 return allowed.includes('/')?'/':'/start';
}
