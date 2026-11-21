import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from "@/system/einstellungen";
import {employeeDirectory} from '@/apps/dutyboard/wishes-server';
import {PlatformError} from '@/platform/store';
// heyelli-Konten verwalten: anlegen/ändern, Startpasswort, PDS-Benutzer der aktiven Quelle, Microsoft-Verknüpfung lösen.
async function directory(){try{return await employeeDirectory();}catch{throw new PlatformError('PDS-Benutzer der aktiven Quelle sind derzeit nicht abrufbar.',503);}}
async function scopedGET() {
  try {const {store}=await adminRequest(),taken=new Map((await store.takenPdsUsers()).map(row=>[row.id,row.userId]));return Response.json({directory:(await directory()).map(person=>({id:person.id,name:person.name,number:person.number,group:person.group,assignedTo:taken.get(person.id)??null}))},{headers:adminHeaders});}
  catch(error) {return adminFailure(error);}
}
async function scopedPOST(request:Request) {
  try {
    const {user,store}=await adminRequest(request),input=await adminBody(request);
    if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Angaben fehlen.');
    const body=input as Record<string,unknown>,action=body.action??'save',userId=typeof body.userId==='string'?body.userId:'';
    if(action==='save'){const {action:_,...account}=body;void _;return Response.json(await store.saveUser(user.id,account),{headers:adminHeaders});}
    // Ein Schritt statt mehrerer: Konto anlegen bzw. ändern inkl. PDS-Benutzer und (beim Anlegen) Startpasswort.
    // PDS-Benutzer wird vorab gegen die aktive Quelle geprüft, damit kein halb eingerichtetes Konto entsteht.
    if(action==='create'||action==='update'){
      const {action:_,pdsUserUUID:requested,initialPassword:wantPassword,...account}=body;void _;
      const pdsUserUUID=requested===undefined?undefined:requested===null||requested===''?null:requested;
      let people:Awaited<ReturnType<typeof directory>>|null=null;
      if(pdsUserUUID!==undefined&&pdsUserUUID!==null){people=await directory();if(typeof pdsUserUUID!=='string'||!people.some(person=>person.id===pdsUserUUID))throw new PlatformError('Bitte einen PDS-Benutzer der aktiven Quelle auswählen.');if(await store.pdsUserTaken(pdsUserUUID,typeof account.id==='string'?account.id:undefined))throw new PlatformError('Dieser PDS-Benutzer ist bereits einem anderen Konto zugeordnet.',409);}
      if(action==='create'&&(account.version!==0||account.id))throw new PlatformError('Ungültiger Versionsstand.');
      if(action==='create'&&wantPassword===true&&(typeof account.username!=='string'||!account.username.trim()))throw new PlatformError('Für ein Startpasswort ist ein Benutzername nötig.');
      const saved=await store.saveUser(user.id,account) as {id:string};
      if(pdsUserUUID!==undefined&&(action==='create'?pdsUserUUID!==null:true)){
        const describe=(id:string|null)=>id===null?null:`${people?.find(person=>person.id===id)?.name??'Unbekannter PDS-Benutzer'} (${id})`;
        await store.setPdsUser(user.id,saved.id,pdsUserUUID,describe);
      }
      const password=action==='create'&&wantPassword===true?(await store.resetPassword(user.id,saved.id)).initialPassword:null;
      return Response.json({user:saved,initialPassword:password},{headers:adminHeaders});
    }
    if(!userId)throw new PlatformError('Konto fehlt.');
    if(action==='reset-password')return Response.json(await store.resetPassword(user.id,userId),{headers:adminHeaders});
    if(action==='unlink-microsoft'){await store.unlinkMicrosoft(user.id,userId);return Response.json({ok:true},{headers:adminHeaders});}
    if(action==='pds-user'){
      const pdsUserUUID=body.pdsUserUUID===null?null:body.pdsUserUUID,people=await directory();
      if(pdsUserUUID!==null&&!people.some(person=>person.id===pdsUserUUID))throw new PlatformError('Bitte einen PDS-Benutzer der aktiven Quelle auswählen.');
      const describe=(id:string|null)=>id===null?null:`${people.find(person=>person.id===id)?.name??'Unbekannter PDS-Benutzer'} (${id})`;
      return Response.json(await store.setPdsUser(user.id,userId,pdsUserUUID,describe),{headers:adminHeaders});
    }
    throw new PlatformError('Unbekannte Aktion.');
  }
  catch(error) {return adminFailure(error);}
}
export const GET=withRouteAccess('/api/verwaltung/benutzer','GET',scopedGET);
export const POST=withRouteAccess('/api/verwaltung/benutzer','POST',scopedPOST);
