import {createRequire} from 'node:module';
import {prepareDevelopmentCache} from '../../scripts/dev-cache.mjs';
const [mode,path]=process.argv.slice(2);let lease;
if(mode==='starter')lease=await prepareDevelopmentCache(path);
else{
 const require=createRequire(import.meta.url),bindings=await require('next/dist/build/swc').loadBindings();
 if(bindings.isWasm)throw Error('Native test locks required');
 const lock=require('next/dist/build/lockfile').Lockfile.tryAcquire(path,false,JSON.stringify({pid:process.pid,appUrl:'http://127.0.0.1:1'}));
 if(!lock)throw Error('Test lock unavailable');lease={release:()=>lock.unlockSync()};
}
process.on('SIGTERM',()=>{lease.release();process.exit(0);});
console.log('ready');setInterval(()=>{},1000);
