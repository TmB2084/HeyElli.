// Expected failures prove that the browser gate detects the intended regression.
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(process.env.HEYELLI_BROWSER_ARTIFACTS??'.local/verification/browser'),results=[];
for(const [mutation,id]of [['navigation','E04 '],['rights','E02 ']]){
 const artifacts=join(root,'mutation-'+mutation);await rm(artifacts,{recursive:true,force:true});
 const run=spawnSync(process.execPath,['scripts/test-browser.mjs','--mutation='+mutation],{env:{...process.env,HEYELLI_BROWSER_ARTIFACTS:artifacts},stdio:'inherit',timeout:600000});
 let report;try{report=JSON.parse(await readFile(join(artifacts,'results.json'),'utf8'));}catch{throw Error('Prüfstörung lieferte keinen Browsernachweis: '+mutation);}
 const detected=run.status!==0&&report.cases.length===1&&report.cases[0].id.startsWith(id)&&report.cases[0].status==='failed';
 results.push({mutation,case:id.trim(),detected});if(!detected)throw Error('Prüfstörung wurde nicht gezielt erkannt: '+mutation);
}
await mkdir(root,{recursive:true});await writeFile(join(root,'mutations.json'),JSON.stringify({status:'passed',results},null,2)+'\n');
console.log('Navigations- und Rechtefehler gezielt erkannt.');
