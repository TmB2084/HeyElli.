import type {PoolConfig} from "pg";
import {postgresHost,serverOperation} from "../server-operation/index.ts";
export function databaseConfig(env:NodeJS.ProcessEnv):PoolConfig {
  // Separate production infrastructure has deliberately not been configured yet.
  // Der Betrieb als Produktions-Build im Container braucht die ausdrückliche Freigabe HEYELLI_SERVER_BETRIEB=1.
  if (env.NODE_ENV==="production" && !serverOperation(env)) throw new Error("Für diese Umgebung ist noch kein Datenbankbetrieb freigegeben.");
  if (env.APP_ENV==="test") {
    const url=new URL(env.HEYELLI_TEST_DATABASE_URL??"http://invalid");
    if(url.protocol!=="postgresql:" || url.hostname!=="127.0.0.1" || url.pathname!=="/heyelli_test" || url.username!=="heyelli_test") throw new Error("Getrennte Testdatenbank erforderlich.");
    return {connectionString:url.href,max:5,connectionTimeoutMillis:3000,idleTimeoutMillis:30000,statement_timeout:10000,lock_timeout:1500,idle_in_transaction_session_timeout:15000};
  }
  if (env.APP_ENV && env.APP_ENV!=="development" && !(serverOperation(env) && env.APP_ENV==="server")) throw new Error("Unbekannte Anwendungsumgebung.");
  if (!env.POSTGRES_PASSWORD || !env.POSTGRES_DB || !env.POSTGRES_USER) throw new Error("Lokale PostgreSQL-Konfiguration fehlt.");
  const port=Number(env.POSTGRES_PORT??5432);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Ungültiger lokaler Datenbankport.");
  return {host:postgresHost(env),port,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB,max:10,connectionTimeoutMillis:3000,idleTimeoutMillis:30000,statement_timeout:10000,lock_timeout:1500,idle_in_transaction_session_timeout:15000};
}
