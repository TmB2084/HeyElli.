export function fakeSharePoint(){
 const state={deny:false,invalidToken:false,loseFinal:false,malicious:false,uploads:0,chunks:0,sequence:0,files:new Map(),folders:new Map(),sessions:new Map(),calls:0};
 const root={id:'root',name:'Dokumente',size:0,folder:{},webUrl:'https://fictional.sharepoint.com/sites/heyelli/Documents'};
 const json=(value,status=200)=>Response.json(value,{status});
 const item=file=>({id:file.id,name:file.name,size:file.bytes.length,eTag:file.eTag,file:{},webUrl:'https://fictional.sharepoint.com/sites/heyelli/Documents/'+encodeURIComponent(file.name),lastModifiedDateTime:'2026-11-14T10:00:00Z'});
 const transport=async(raw,init={})=>{
  state.calls++;const url=new URL(String(raw)),headers=new Headers(init.headers),method=init.method??'GET';
  if(url.hostname==='login.microsoftonline.com'){const body=new URLSearchParams(String(init.body));return state.invalidToken||body.get('client_secret')==='invalid-sharepoint'?json({error:'fictitious secret must never leak'},401):json({access_token:'fictitious-sharepoint-access-token'});}
  if(url.hostname==='fictional.sharepoint.com'){
   if(headers.has('Authorization'))throw Error('Token must not be forwarded');
   if(url.pathname.startsWith('/download/')){const file=state.files.get(url.pathname.split('/').at(-1));return file?new Response(file.bytes):new Response(null,{status:404});}
   const session=state.sessions.get(url.pathname.split('/').at(-1));if(!session)throw Error('Unknown local session');const bytes=Buffer.from(init.body),match=headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);if(!match||Number(match[1])!==session.bytes.length)throw Error('Invalid range');state.chunks++;session.bytes=Buffer.concat([session.bytes,bytes]);if(session.bytes.length<Number(match[3]))return json({nextExpectedRanges:[session.bytes.length+'-']},202);
   if([...state.files.values()].some(file=>file.parent===session.parent&&file.name===session.name))return json({},409);
   const file={id:'file-'+(++state.sequence),parent:session.parent,name:session.name,bytes:session.bytes,eTag:'"etag-'+state.sequence+'"'};state.files.set(file.id,file);state.uploads++;if(state.loseFinal){state.loseFinal=false;throw Error('fictitious secret network interruption');}return json(item(file),201);
  }
  if(url.hostname!=='graph.microsoft.com')throw Error('Unapproved destination');if(state.deny)return json({error:'fictitious provider payload'},403);
  const path=decodeURIComponent(url.pathname.slice('/v1.0'.length));
  if(path.startsWith('/sites/')&&path.endsWith('/drives'))return json({value:[{id:'drive-test'}]});
  if(path.startsWith('/sites/'))return json({id:'fictional-site'});
  if(path==='/drives/drive-test/root')return json(root);
  // Verschachtelte Ordner: Kennung → {id,name,parent}; Stammordner = 'root'.
  const folderOut=folder=>({id:folder.id,name:folder.name,size:0,folder:{},webUrl:'https://fictional.sharepoint.com/sites/heyelli/Documents/'+encodeURIComponent(folder.name)});
  const childFolder=(parent,name)=>[...state.folders.values()].find(folder=>folder.parent===parent&&folder.name.toLowerCase()===name.toLowerCase());
  const createFolder=(parent,body)=>{const value=JSON.parse(body);if(childFolder(parent,value.name)||[...state.files.values()].some(file=>file.parent===parent&&file.name===value.name))return json({},409);const folder={id:'folder-'+(++state.sequence),name:value.name,parent};state.folders.set(folder.id,folder);return json(folderOut(folder),201);};
  if(path==='/drives/drive-test/root/children'&&method==='POST')return createFolder('root',init.body);
  if(path==='/drives/drive-test/root/children'){return json({value:[...state.folders.values()].filter(folder=>folder.parent==='root').map(folderOut)});}
  if(path.startsWith('/drives/drive-test/root:/')){const found=childFolder('root',path.split(':/')[1]);return found?json(folderOut(found)):json({},404);}
  const createIn=path.match(/^\/drives\/drive-test\/items\/([^/:]+)\/children$/);if(createIn&&method==='POST')return createFolder(createIn[1],init.body);
  const byId=path.match(/^\/drives\/drive-test\/items\/([^/:]+)$/);
  if(byId&&method==='PATCH'){const body=JSON.parse(init.body),file=state.files.get(byId[1]),folder=state.folders.get(byId[1]),target=file??folder;if(!target)return json({},404);const parent=body.parentReference?.id??target.parent,name=body.name??target.name;
   if([...state.files.values()].some(other=>other!==target&&other.parent===parent&&other.name===name)||childFolder(parent,name)&&childFolder(parent,name)!==target)return json({},409);target.parent=parent;target.name=name;if(file){file.eTag='"etag-'+(++state.sequence)+'"';state.moves=(state.moves??0)+1;return json(item(file));}return json(folderOut(folder));}
  if(byId){const folder=state.folders.get(byId[1]);return folder?json(folderOut(folder)):json({},404);}
  const children=path.match(/^\/drives\/drive-test\/items\/([^/]+)\/children$/);if(children)return json({value:[...[...state.folders.values()].filter(folder=>folder.parent===children[1]).map(folderOut),...[...state.files.values()].filter(file=>file.parent===children[1]).map(item)]});
  const content=path.match(/^\/drives\/drive-test\/items\/([^/]+)\/content$/);if(content)return new Response(null,{status:302,headers:{location:'https://fictional.sharepoint.com/download/'+content[1]+'?fictitious-signed-token=opaque'}});
  const filePath=path.match(/^\/drives\/drive-test\/items\/([^/:]+):\/(.+)$/);if(filePath){let name=filePath[2];if(name.endsWith(':/createUploadSession')){name=name.slice(0,-':/createUploadSession'.length);const id='session-'+(++state.sequence);state.sessions.set(id,{parent:filePath[1],name,bytes:Buffer.alloc(0)});return json({uploadUrl:state.malicious?'https://evil.example.invalid/leak':'https://fictional.sharepoint.com/upload/'+id});}const found=[...state.files.values()].find(file=>file.parent===filePath[1]&&file.name===name);if(found)return json(item(found));const folder=childFolder(filePath[1],name);return folder?json(folderOut(folder)):json({},404);}
  throw Error('Unknown fixture operation');
 };
 return {state,transport};
}
export async function installSharePointFixture(directory){
 const {readFile,writeFile}=await import('node:fs/promises'),{join}=await import('node:path');
 await writeFile(join(directory,'src/platform/sharepoint/test-provider.ts'),`import {fakeSharePoint} from './test-engine.mjs';\nconst global=globalThis as typeof globalThis & {sharePointFixture?:ReturnType<typeof fakeSharePoint>};\nexport const fixtureFetch=(global.sharePointFixture??=fakeSharePoint()).transport;\n`);
 await writeFile(join(directory,'src/platform/sharepoint/test-engine.mjs'),'export const fakeSharePoint='+fakeSharePoint.toString()+';\n');
 for(const name of ['repository.ts','documents.ts']){const path=join(directory,'src/platform/sharepoint',name),source=await readFile(path,'utf8');await writeFile(path,"import {fixtureFetch} from './test-provider';\n"+source.replace('transport:typeof fetch=fetch','transport:typeof fetch=fixtureFetch'));}
 const routePath=join(directory,'src/app/api/service/dokumente/route.ts'),route=await readFile(routePath,'utf8');
 const original="return Response.json(await sharepointDocuments().upload(user.id,found.scope,request.headers.get('Idempotency-Key')??'',name,bytes,request.signal,{location:found.location,typeKey:request.headers.get('X-Storage-Type')??''}),{headers:adminHeaders});";
 if(!route.includes(original))throw Error('Isolierte SharePoint-Pruefstoerung nicht einsetzbar.');
 await writeFile(routePath,route.replace(original,"const uploaded=await sharepointDocuments().upload(user.id,found.scope,request.headers.get('Idempotency-Key')??'',name,bytes,request.signal,{location:found.location,typeKey:request.headers.get('X-Storage-Type')??''});if(request.headers.get('X-Fixture-Lose-Response')==='yes')return Response.json({error:'Fiktive Verbindung nach Speicherung unterbrochen. Denselben Upload erneut versuchen.'},{status:503,headers:adminHeaders});return Response.json(uploaded,{headers:adminHeaders});"));
}
