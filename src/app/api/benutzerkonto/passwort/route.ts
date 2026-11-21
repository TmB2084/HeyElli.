import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin,session,sessionToken} from '@/platform/session';
import {platformStore,PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
// Eigenes heyelli-Passwort ändern (auch bei Pflichtänderung nach Startpasswort). Weitere Sitzungen des Kontos enden.
async function scopedPOST(request:Request){
 try{
  if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
  const user=await session();if(!user)throw new PlatformError('Bitte zuerst anmelden.',401);
  if(user.mode!=='local')throw new PlatformError('Mit Microsoft angemeldete Konten verwenden kein heyelli-Passwort.',409);
  let input:{currentPassword?:unknown;newPassword?:unknown};try{input=await request.json();}catch{throw new PlatformError('Ungültige Eingabe.');}
  await platformStore().changePassword(user.id,await sessionToken(),input?.currentPassword,input?.newPassword);
  return Response.json({ok:true},{headers});
 }catch(error){
  const status=error instanceof PlatformError?error.status:503;
  return Response.json({error:error instanceof PlatformError?error.message:'Passwort kann derzeit nicht geändert werden.'},{status,headers});
 }
}
export const POST=withRouteAccess('/api/benutzerkonto/passwort','POST',scopedPOST);
