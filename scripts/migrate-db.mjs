// Wendet die SQL-Migrationen aus database/migrations/ an (für den Containerbetrieb, ohne Docker und psql).
// Gleiche Regeln wie "node scripts/database.mjs migrate": fortlaufend nummerierte Dateien, Prüfsumme je Datei in
// public.schema_migrations, bereits angewendete Migrationen dürfen sich nicht ändern, alles in einer Transaktion
// mit Advisory-Lock. Verbindung über POSTGRES_HOST/PORT/USER/PASSWORD/DB (siehe src/platform/server-operation).
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

export function migrationFiles(directory){
  return readdirSync(directory).filter(file=>/^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
}
export function checksum(content){return createHash('sha256').update(content).digest('hex');}
export async function migrate(client,directory){
  const applied=[];
  await client.query('BEGIN');
  try{
    await client.query('SELECT pg_advisory_xact_lock(741963281)');
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for(const file of migrationFiles(directory)){
      const content=readFileSync(new URL(file,directory),'utf8'),sum=checksum(content);
      const row=(await client.query('SELECT checksum FROM public.schema_migrations WHERE name=$1',[file])).rows[0];
      if(row){if(row.checksum!==sum)throw new Error(`Bereits ausgeführte Migration verändert: ${file}`);continue;}
      await client.query(content);
      await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1,$2)',[file,sum]);
      applied.push(file);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  return applied;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const env=process.env;
  for(const name of ['POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_DB'])if(!env[name]){console.error(`Migration: ${name} fehlt.`);process.exit(1);}
  const client=new pg.Client({host:env.POSTGRES_HOST||'127.0.0.1',port:Number(env.POSTGRES_PORT||5432),user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB,connectionTimeoutMillis:10000});
  try{
    await client.connect();
    const applied=await migrate(client,new URL('../database/migrations/',import.meta.url));
    console.log(applied.length?`Migrationen angewendet: ${applied.join(', ')}`:'Keine neuen Migrationen.');
  }catch(error){console.error('Migration fehlgeschlagen:',error.message);process.exitCode=1;}
  finally{await client.end().catch(()=>{});}
}
