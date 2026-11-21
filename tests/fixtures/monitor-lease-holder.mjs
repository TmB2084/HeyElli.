import {monitorLease,monitorAlreadyRunning} from '../../scripts/monitor-lease.mjs';
const lease=await monitorLease(process.argv[2]);if(!lease)process.exit(monitorAlreadyRunning);
process.on('SIGTERM',()=>{lease.release();process.exit(0);});console.log('ready');setInterval(()=>{},1000);
