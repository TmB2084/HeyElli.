// Fester Administrator „admin“: legt das Konto an bzw. vergibt mit --neu ein neues Startpasswort.
// Das Startpasswort wird zufällig erzeugt, nur gehasht gespeichert und genau einmal hier ausgegeben; bei der ersten Anmeldung muss es geändert werden.
// Lokal: npm run auth:admin [-- --neu]. Server (IT): heyelli-compose.sh <test|prod> exec app node scripts/bootstrap-admin.mjs [--neu]
import nextEnv from '@next/env';
import {Pool} from 'pg';
import {databaseConfig} from '../src/platform/store/setup.ts';
import {hashPassword,generateInitialPassword} from '../src/platform/accounts/password.ts';
if(process.env.APP_ENV==='test')throw new Error('Nicht in isolierten Testumgebungen verwenden.');
nextEnv.loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production',{info(){},error(){}});
const args=process.argv.slice(2),renew=args.includes('--neu');
if(args.some(arg=>arg!=='--neu'))throw new Error('Aufruf: node scripts/bootstrap-admin.mjs [--neu]');
const id='heyelli-admin',username='admin',initialPassword=generateInitialPassword(),passwordHash=await hashPassword(initialPassword);
const pool=new Pool(databaseConfig(process.env)),client=await pool.connect();
try {
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(741963282)');
 const taken=(await client.query('SELECT id FROM platform.users WHERE username=$1 AND id<>$2',[username,id])).rows[0];
 if(taken)throw new Error(`Der Benutzername „${username}“ gehört bereits einem anderen Konto.`);
 const current=(await client.query('SELECT password_hash IS NOT NULL AS has_password FROM platform.users WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(current?.has_password&&!renew)throw new Error('Der Administrator „admin“ hat bereits ein Passwort. Neues Startpasswort nur mit --neu.');
 await client.query(`INSERT INTO platform.users(id,display_name,role,enabled,username,password_hash,password_must_change,password_changed_at) VALUES($1,'Administrator','admin',true,$2,$3,true,now())
  ON CONFLICT(id) DO UPDATE SET role='admin',enabled=true,app_role_id=NULL,username=excluded.username,password_hash=excluded.password_hash,password_must_change=true,password_changed_at=now(),version=platform.users.version+1,updated_at=now()`,[id,username,passwordHash]);
 await client.query('UPDATE platform.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
 await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES('local-operator','admin.bootstrapped',$1,$2::jsonb)",[id,JSON.stringify([{field:'password',label:'Passwort',before:null,after:'Startpasswort (Änderung erforderlich)'}])]);
 await client.query('COMMIT');
 console.log('Administrator eingerichtet. Diese Zugangsdaten werden nicht noch einmal angezeigt:');
 console.log(`  Benutzername: ${username}`);
 console.log(`  Startpasswort: ${initialPassword}`);
 console.log('Bei der ersten Anmeldung muss das Passwort geändert werden.');
} catch(error) {await client.query('ROLLBACK');console.error(error instanceof Error&&!/password|hash/i.test(error.message)?error.message:'Administrator konnte nicht eingerichtet werden. Datenbankverbindung prüfen.');process.exitCode=1;}
finally{client.release();await pool.end();}
