import {randomBytes} from 'node:crypto';
import {browserHeaders,browserOrigin} from '@/platform/http-safety/headers';
import {apiPolicy} from '@/platform/app-access/access-policy';
import {appLandingPath} from '@/platform/app-access/landing';
import {NextResponse,type NextRequest} from 'next/server';
import {appRoleStore,requiredApps,writeAppsForRequest} from '@/platform/app-access';
import {requestSession} from '@/platform/session';
async function access(request:NextRequest,forwarded:Headers){
 const path=request.nextUrl.pathname;
 // Only the sign-in endpoints and framework assets are public. No business API exception.
 if(path==='/anmeldung'||path==='/api/simulator-session'||path==='/api/auth/microsoft/start'||path==='/api/auth/microsoft/callback'||path==='/icon.svg'||path==='/favicon.ico'||path.startsWith('/_next/static/')||path==='/_next/image'||path==='/_next/webpack-hmr')return NextResponse.next({request:{headers:forwarded}});
 let identity:Awaited<ReturnType<typeof requestSession>>=null;let authenticated=false;try{identity=await requestSession(request);authenticated=!!identity;}catch{return NextResponse.json({error:'Anmeldung kann vorübergehend nicht geprüft werden. Eingaben bleiben erhalten; bitte kurz warten.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'5'}});}
 if(authenticated){if(path.startsWith('/api/')&&!apiPolicy(path))return NextResponse.json({error:'Für diesen Endpunkt fehlt eine Zugriffszuordnung.'},{status:403,headers:{'Cache-Control':'no-store'}});const required=requiredApps(path);if(required.length){try{const access=await appRoleStore().rights(identity!.id),allowed=access.apps;const writes=writeAppsForRequest(path,request.method);if(writes.length&&!writes.some(app=>access.writeApps.includes(app)&&allowed.includes(app)))return NextResponse.json({error:'Deine Rolle erlaubt in dieser App nur das Lesen.'},{status:403,headers:{'Cache-Control':'no-store'}});if(!required.some(app=>allowed.includes(app))){if(path.startsWith('/api/'))return NextResponse.json({error:'Deine Rolle erlaubt diese App nicht.'},{status:403,headers:{'Cache-Control':'no-store'}});const denied=NextResponse.redirect(new URL(path==='/'?appLandingPath(allowed):'/kein-zugriff',request.url),303);denied.headers.set('Cache-Control','no-store');return denied;}}catch{return NextResponse.json({error:'App-Zugriff kann derzeit nicht geprüft werden.'},{status:503,headers:{'Cache-Control':'no-store'}});}}if(path==='/verwaltung'){const target=request.nextUrl.clone();target.pathname='/einstellungen';const response=NextResponse.redirect(target,307);response.headers.set('Cache-Control','no-store');return response;}const response=NextResponse.next({request:{headers:forwarded}});response.headers.set('Cache-Control','no-store');return response;}
 if(path.startsWith('/api/'))return NextResponse.json({error:'Bitte zuerst anmelden.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const url=request.nextUrl.clone();url.pathname='/anmeldung';url.search='';url.searchParams.set('next',path+request.nextUrl.search);
 const response=NextResponse.redirect(url,303);response.headers.set('Cache-Control','no-store');return response;
}
export async function proxy(request:NextRequest){
 const nonce=randomBytes(24).toString('base64'),forwarded=new Headers(request.headers);
 // Never trust a caller's nonce/CSP. Next extracts this server-generated nonce.
 const headers=browserHeaders(process.env.NODE_ENV!=='production',nonce,request.nextUrl.pathname==='/werkzeuge/casedesk');
 forwarded.set('x-nonce',nonce);forwarded.set('Content-Security-Policy',headers.find(h=>h.key==='Content-Security-Policy')!.value);
 const response=await access(request,forwarded);
 for(const header of headers){
  // Download handlers may add an even more restrictive sandbox policy.
  if(header.key!=='Content-Security-Policy'||!request.nextUrl.pathname.startsWith('/api/'))response.headers.set(header.key,header.value);
 }
 response.headers.set('Reporting-Endpoints',`heyelli-csp="${browserOrigin(request)}/api/sicherheit/csp"`);
 return response;
}
// Streaming upload handlers enforce their own session/app/origin/body budgets.
// Exclude only documented upload routes from Next's proxy body-clone buffer.
export const config={matcher:['/((?!api/service/dokumente(?:/|$)|api/pds-simulator/uploads(?:/|$)|api/pds/rest/api/(?:dokument/uploaddokument|katalog/updateAbbildung|mitarbeiter/uploaddokument|ruecklauf/uploadauftragsdokument|service/uploaddokument)(?:/|$)).*)']};
