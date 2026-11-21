import 'server-only';
import {platformDatabase} from '@/platform/store';
import {appRoleRepository} from './repository';
export function appRoleStore(){return appRoleRepository(platformDatabase());}
export {requiredApps,writeAppsForRequest} from './model';

export async function appPermission(user:{id:string}|null|undefined,app:string,permission:'read'|'write'='write'){return !!user&&await appRoleStore().can(user.id,app,permission);}
