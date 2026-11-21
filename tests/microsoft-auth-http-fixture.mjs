import {join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
export async function installMicrosoftAuthFixture(directory,modeFile){
 const repository=join(directory,'src/system/anmeldung/microsoft/repository.ts');
 await writeFile(join(directory,'src/system/anmeldung/microsoft/fixture-transport.ts'),`import {readFile} from 'node:fs/promises';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const keys=generateKeyPair('RS256');
export async function fixtureAuthFetch(url:string|URL|Request,options?:RequestInit){
 const state=JSON.parse(await readFile(${JSON.stringify(modeFile)},'utf8')),tenant='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222',base='https://login.microsoftonline.com/'+tenant,path=new URL(String(url)).pathname;
 if(state.auth==='disconnect')throw new TypeError('Controlled authentication disconnect');
 if(path.endsWith('/.well-known/openid-configuration')&&state.auth==='reject-metadata')return Response.json({error:'invalid_tenant',error_description:'PROVIDER-DETAIL-MUST-NOT-LEAK'},{status:400});
 if(path.endsWith('/.well-known/openid-configuration'))return Response.json({issuer:base+'/v2.0',authorization_endpoint:base+'/oauth2/v2.0/authorize',token_endpoint:base+'/oauth2/v2.0/token',id_token_signing_alg_values_supported:['RS256']});
 const pair=await keys;
 if(path.endsWith('/keys'))return Response.json({keys:[{...await exportJWK(pair.publicKey),kid:'fixture',alg:'RS256',use:'sig'}]});
 if(path.endsWith('/token')){if(state.auth==='reject')return Response.json({error:'invalid_client',error_description:'PROVIDER-DETAIL-MUST-NOT-LEAK'},{status:401});const body=new URLSearchParams(options?.body as string);if(!body.get('code_verifier'))throw Error('Missing PKCE');const now=Math.floor(Date.now()/1000),token=await new SignJWT({tid:tenant,oid:state.msOid??'33333333-3333-4333-8333-333333333333',nonce:state.msNonce,ver:'2.0'}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer(base+'/v2.0').setAudience(client).setSubject('fictional').setIssuedAt(now).setNotBefore(now-1).setExpirationTime(now+300).sign(pair.privateKey);return Response.json({id_token:token});}
 throw Error('Unexpected fixture request');
}`);
 await writeFile(repository,"import {fixtureAuthFetch} from './fixture-transport.ts';\n"+(await readFile(repository,'utf8')).replace('transport:typeof fetch=fetch','transport:typeof fetch=fixtureAuthFetch as typeof fetch'));
}
