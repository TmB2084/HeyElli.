import {cookies} from 'next/headers';
import {loginAttempt,sameOrigin,session} from '@/platform/session';
import {adminRequest,adminFailure} from '@/system/einstellungen';
import {platformStore,PlatformError} from '@/platform/store';
import {microsoftAuthStore} from '@/system/anmeldung/microsoft';
export async function POST(request:Request){try{if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);if(!await platformStore().allowLogin(loginAttempt(request,'microsoft','microsoft-login')))throw new PlatformError('Zu viele Anmeldeversuche. Bitte später erneut versuchen.',429);// test: Administrator prüft die Einrichtung (verknüpft dabei sein Konto); link: angemeldetes Konto selbst verknüpfen; sonst Anmeldung.
 const requested=new URL(request.url).searchParams.get('purpose'),purpose=requested==='test'?'test':requested==='link'?'link':'login';
 let actor:string|undefined;if(purpose==='test')actor=(await adminRequest(request)).user.id;else if(purpose==='link'){const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);actor=user.id;}const host=request.headers.get('host'),url=new URL(request.url);if(host)url.host=host;
 const result=await microsoftAuthStore().begin(purpose,url.origin,actor);
 (await cookies()).set('heyelli-ms-flow',result.cookie,{httpOnly:true,secure:result.secure,sameSite:'lax',path:'/api/auth/microsoft',maxAge:600});return new Response(null,{status:303,headers:{Location:result.url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(error){return adminFailure(error);}}
