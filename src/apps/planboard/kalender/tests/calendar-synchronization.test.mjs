import test from 'node:test';
import assert from 'node:assert/strict';
import {CalendarSynchronization,CalendarReadError} from '../synchronization.ts';
const a={id:'a',title:'A',resourceIds:['r1']},b={id:'b',title:'B',resourceIds:['r2']};
const data=(events=[a,b])=>({events,resources:[{id:'r1'},{id:'r2'}],colors:[],colorSource:'simulation'});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function ready(){const sync=new CalendarSynchronization();await sync.load(async()=>data());return sync;}
test('background refresh stays nonblocking; abort immediately clears both indicators',async()=>{
 const sync=await ready(),gate=deferred(),abort=new AbortController(),refresh=sync.load(()=>gate.promise,{signal:abort.signal});
 assert.equal(sync.getSnapshot().loading,false);assert.equal(sync.getSnapshot().refreshing,true);assert.equal(sync.getSnapshot().data.events.length,2);
 abort.abort();assert.equal(sync.getSnapshot().loading,false);assert.equal(sync.getSnapshot().refreshing,false);
 gate.resolve(data([{...a,title:'stale'}]));await refresh;assert.equal(sync.getSnapshot().data.events[0].title,'A');
 const initial=new CalendarSynchronization(),first=deferred(),initialRead=initial.load(()=>first.promise);assert.equal(initial.getSnapshot().loading,true);initial.cancelRead();assert.equal(initial.getSnapshot().loading,false);first.resolve(data());await initialRead;
});
test('an older aborted response cannot stop a newer request or replace its result',async()=>{
 const sync=await ready(),older=deferred(),newer=deferred(),oldRead=sync.load(()=>older.promise),newRead=sync.load(()=>newer.promise);
 older.resolve(data([{...a,title:'old'}]));await oldRead;assert.equal(sync.getSnapshot().refreshing,true);
 newer.resolve(data([{...a,title:'new'}]));await newRead;assert.equal(sync.getSnapshot().data.events[0].title,'new');assert.equal(sync.getSnapshot().refreshing,false);
});
test('refresh errors keep existing data; authentication loss clears data and invalidates pending writes',async()=>{
 const sync=await ready();await sync.load(async()=>{throw new Error('Unavailable');});assert.equal(sync.getSnapshot().data.events.length,2);assert.equal(sync.getSnapshot().loading,false);
 const ticket=sync.begin('a');await sync.load(async()=>{throw new CalendarReadError('Anmelden',401);});assert.equal(sync.getSnapshot().data,null);assert.equal(sync.valid(ticket),false);sync.apply([{...a,title:'old account'}],ticket.epoch);assert.equal(sync.getSnapshot().data,null);
});
test('only the edited appointment is protected; other appointments continue to refresh',async()=>{
 const sync=await ready();sync.protect('a');await sync.load(async()=>data([{...a,title:'external A'},{...b,title:'external B'}]));
 assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='a').title,'A');assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='b').title,'external B');
 sync.unprotect('a');await sync.load(async()=>data([{...a,title:'external A'},b]));assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='a').title,'external A');
});
test('different appointments can save concurrently; rollback touches only the failing appointment',async()=>{
 const sync=await ready(),one=sync.begin('a'),two=sync.begin('b');assert.ok(one&&two);assert.equal(sync.begin('a'),null);
 sync.apply([{...a,title:'optimistic A'}],one.epoch);sync.apply([{...b,title:'saved B'}],two.epoch);sync.finish(two);
 sync.apply([a],one.epoch);sync.finish(one);
 assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='b').title,'saved B');assert.equal(sync.getSnapshot().pendingIds.size,0);
});
test('late reads cannot overwrite completed writes or resurrect deleted appointments',async()=>{
 const sync=await ready(),gate=deferred(),read=sync.load(()=>gate.promise),ticket=sync.begin('a');sync.apply([{...a,title:'saved A'}],ticket.epoch);sync.finish(ticket);
 const removed=sync.begin('b');sync.remove(removed);sync.finish(removed);gate.resolve(data());await read;
 assert.deepEqual(sync.getSnapshot().data.events.map(event=>event.id),['a']);assert.equal(sync.getSnapshot().data.events[0].title,'saved A');
});
test('period changes retain pending local edits and all resource copies until save completes',async()=>{
 const sync=await ready(),ticket=sync.begin('a');sync.apply([{...a,title:'moving',resourceIds:['r1','r2']}],ticket.epoch);
 await sync.load(async()=>({...data(),events:[],resources:[]}),{replace:true});assert.equal(sync.getSnapshot().data.events[0].title,'moving');assert.equal(sync.getSnapshot().data.resources.length,2);sync.finish(ticket);
 await sync.load(async()=>({...data(),events:[],resources:[]}));assert.equal(sync.getSnapshot().data.events.length,0);
});
test('timeout clears refresh indicators and preserves displayed data',async()=>{
 const sync=await ready();await sync.load(signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))),{timeoutMs:5});
 assert.equal(sync.getSnapshot().loading,false);assert.equal(sync.getSnapshot().refreshing,false);assert.ok(sync.getSnapshot().data);assert.match(sync.getSnapshot().error,/lange/);
});
test('a delayed refresh preserves concurrent success and isolated rollback together',async()=>{
 const sync=await ready(),gate=deferred(),read=sync.load(()=>gate.promise),one=sync.begin('a'),two=sync.begin('b');
 sync.apply([{...a,title:'draft A'}],one.epoch);sync.apply([{...b,title:'saved B'}],two.epoch);
 sync.finish(two);sync.apply([a],one.epoch);sync.finish(one);gate.resolve(data());await read;
 assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='a').title,'A');assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='b').title,'saved B');assert.equal(sync.getSnapshot().pendingIds.size,0);assert.equal(sync.getSnapshot().loading,false);
});
test('aborting a superseded external signal cannot clear the active refresh indicator',async()=>{
 const sync=await ready(),old=deferred(),latest=deferred(),abort=new AbortController(),first=sync.load(()=>old.promise,{signal:abort.signal}),second=sync.load(()=>latest.promise);
 abort.abort();assert.equal(sync.getSnapshot().refreshing,true);assert.equal(sync.getSnapshot().loading,false);
 old.resolve(data());await first;assert.equal(sync.getSnapshot().refreshing,true);latest.resolve(data([{...a,title:'latest A'},b]));await second;assert.equal(sync.getSnapshot().refreshing,false);assert.equal(sync.getSnapshot().data.events[0].title,'latest A');
});
test('cancelling a read does not release a pending write or accept its late stale data',async()=>{
 const sync=await ready(),ticket=sync.begin('a'),gate=deferred(),read=sync.load(()=>gate.promise);sync.apply([{...a,title:'saving A'}],ticket.epoch);sync.cancelRead();
 assert.equal(sync.getSnapshot().pendingIds.has('a'),true);assert.equal(sync.getSnapshot().pendingIds.has('b'),false);gate.resolve(data());await read;assert.equal(sync.getSnapshot().data.events.find(event=>event.id==='a').title,'saving A');sync.finish(ticket);assert.equal(sync.getSnapshot().pendingIds.size,0);
});
