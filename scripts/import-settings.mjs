import nextEnv from '@next/env';
import {Pool} from 'pg';
import {resolve} from 'node:path';
import {databaseConfig} from '../src/platform/store/setup.ts';
import {postgresSettings} from '../src/apps/planboard/kalender/setup.ts';
if(process.env.NODE_ENV==='production'||process.env.APP_ENV==='test')throw new Error('Dieses Skript ist ausschließlich für lokale Entwicklung vorgesehen.');
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const pool=new Pool(databaseConfig(process.env));
try {
 const result=await postgresSettings(pool,resolve('.local/heyelli')).importLegacy();
 console.log(`Einstellungen übernommen: ${result.importedUsers} zusätzliche Benutzerprofile. Bestehende PostgreSQL-Werte und Originaldateien bleiben erhalten.`);
}catch{console.error('Übernahme abgebrochen. Datenbankmigration und bestehende Einstellungsdateien prüfen. Originaldateien wurden nicht verändert.');process.exitCode=1;}
finally{await pool.end();}
