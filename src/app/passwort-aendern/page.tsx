import {redirect} from 'next/navigation';
import {session} from '@/platform/session';
import {RequiredPasswordChange} from './required';
import {LockScreen} from '@/system/anmeldung/anmeldung/lock-screen';
// Pflichtänderung nach Startpasswort: eigene Seite ohne Menüleiste; alle anderen Seiten und APIs bleiben bis dahin gesperrt.
export default async function PasswordChangePage(){
 const user=await session();if(!user)redirect('/anmeldung');if(!user.mustChangePassword)redirect('/');
 return <LockScreen title="Passwort ändern"><RequiredPasswordChange/></LockScreen>;
}
