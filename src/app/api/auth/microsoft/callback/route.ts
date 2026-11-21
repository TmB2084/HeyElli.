import {appRoleStore} from '@/platform/app-access';
import {appLandingPath} from '@/platform/app-access/landing';
import {cookies} from 'next/headers';
import {microsoftAuthStore,MicrosoftAuthError} from '@/system/anmeldung/microsoft';
import {platformStore} from '@/platform/store';
import {setSession} from '@/platform/session';
export async function GET(request:Request){const jar=await cookies(),url=new URL(request.url);if(request.headers.get('host'))url.host=request.headers.get('host')!;let target='/anmeldung?status=microsoft-failed';
 try{if(url.searchParams.has('error'))throw Error();const result=await microsoftAuthStore().finish(url.searchParams.get('state')??'',jar.get('heyelli-ms-flow')?.value??'',url.searchParams.get('code')??'',url.origin);
 if(result.purpose==='test')target='/einstellungen?microsoft_auth=test-ok';else if(result.purpose==='link')target='/benutzerkonto?bereich=account&seite=account%3Alogin&microsoft=verknuepft';else{const identity=await platformStore().authenticateMicrosoft(result.id,result.upn,result.revision);await setSession(identity);const apps=await appRoleStore().allowed(identity.id);target=appLandingPath(apps,apps.includes('/')?'/servicehub':'/');}
 }catch(error){/* Only a fixed local reason; never provider errors, codes, tokens, or claims. */if(error instanceof MicrosoftAuthError)target+='&reason='+error.reason;else if(error instanceof Error)target+=/nicht verknüpft/.test(error.message)?'&reason=not-linked':/PDS-Zuordnung/.test(error.message)?'&reason=pds':/bereits mit einem anderen/.test(error.message)?'&reason=linked-elsewhere':/nicht freigeschaltet/.test(error.message)?'&reason=disabled':'';}
 jar.set('heyelli-ms-flow','',{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',path:'/api/auth/microsoft',maxAge:0});
 return new Response(null,{status:303,headers:{Location:target,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
