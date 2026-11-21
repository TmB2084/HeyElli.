import {appendFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const [mode,directory]=process.argv.slice(2);
await appendFile(join(directory,'starts'),mode+'\n');
process.on('SIGTERM',()=>{if(mode==='hang')return;setTimeout(()=>void writeFile(join(directory,mode+'.stopped'),'yes').then(()=>process.exit(0)),25);});
if(mode==='duplicate')process.exit(75);
if(mode==='crash')setTimeout(()=>process.exit(1),30);
console.log('ready');setInterval(()=>{},1000);
