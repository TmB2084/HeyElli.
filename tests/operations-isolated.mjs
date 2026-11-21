import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {checkOperations} from './operations-postgres.mjs';
const pool=new Pool({connectionString:process.env.HEYELLI_TEST_DATABASE_URL});
try{for(const file of (await readdir('database/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pool.query(await readFile('database/migrations/'+file,'utf8'));for(const file of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+file,'utf8'));await checkOperations(pool);console.log('A07 isolierte Ausfall- und Wiederherstellungsprüfung bestanden.');}finally{await pool.end();}
