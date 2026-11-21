import {join} from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
// Only the disposable browser app uses this local authorization redirect; production code is untouched.
export async function installMicrosoftBrowserAuthorization(directory,modeFile){
 const repository=join(directory,'src/system/anmeldung/microsoft/repository.ts');let source=await readFile(repository,'utf8');const original='url:authorization(config,flow),';if(!source.includes(original))throw Error('Authorization fixture could not be installed');source=source.replace(original,"url:(()=>{const url=new URL('/test-microsoft-authorize',config.redirectUri);url.search=new URL(authorization(config,flow)).search;return url.href;})(),");await writeFile(repository,source);
 const route=join(directory,'src/app/test-microsoft-authorize');await mkdir(route,{recursive:true});await writeFile(join(route,'route.ts'),`import {readFile,writeFile} from 'node:fs/promises';
export async function GET(request:Request){const url=new URL(request.url),file=${JSON.stringify(modeFile)},state=JSON.parse(await readFile(file,'utf8'));await writeFile(file,JSON.stringify({...state,msNonce:url.searchParams.get('nonce')}));const target=new URL('/api/auth/microsoft/callback',url.origin);target.search=new URLSearchParams({state:url.searchParams.get('state')??'',code:'fictional-browser-code'}).toString();return Response.redirect(target);}`);
}
