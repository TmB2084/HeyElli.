import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const project='heyelli-chat-test-'+randomBytes(5).toString('hex');
const env={...process.env,HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex')};
const args=['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project];
function compose(command,capture=false) {
 const result=spawnSync('docker',[...args,...command],{env,encoding:'utf8',stdio:capture?'pipe':'inherit'});
 if(result.error||result.status!==0)throw new Error('Isolierte Testdatenbank konnte nicht betrieben werden.');
 return result.stdout;
}
let status=1;
try {
 compose(['up','-d','--wait']);
 const port=compose(['port','db','5432'],true).trim().split(':').at(-1);
 const url=new URL(`postgresql://heyelli_test@127.0.0.1:${port}/heyelli_test`);url.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;
 const result=spawnSync(process.execPath,['--test','tests/assistant-chat-postgres.test.mjs'],{env:{...env,HEYELLI_TEST_DATABASE_URL:url.href,HEYELLI_TEST_COMPOSE_PROJECT:project},stdio:'inherit'});
 status=result.status??1;
} catch {console.error('PostgreSQL-Testlauf fehlgeschlagen; Docker-Verfügbarkeit prüfen.');}
finally {
 try {compose(['down','-v','--remove-orphans']);}catch{console.error('Temporäre Testumgebung konnte nicht vollständig entfernt werden.');status=1;}
}
process.exitCode=status;
