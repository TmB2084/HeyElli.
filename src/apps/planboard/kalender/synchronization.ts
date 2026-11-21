import type {CalendarData,CalendarEvent} from "./model.ts";
export type MutationTicket={id:string;epoch:number};
type Snapshot={data:CalendarData|null;loading:boolean;refreshing:boolean;error:string;pendingIds:ReadonlySet<string>};
export class CalendarReadError extends Error {status:number;constructor(message:string,status:number){super(message);this.status=status;}}
// Local coordination, not a lock in PDS. The API still checks expected versions.
export class CalendarSynchronization {
 private snapshot:Snapshot={data:null,loading:false,refreshing:false,error:"",pendingIds:new Set()};
 private listeners=new Set<()=>void>();
 private request=0;private epoch=0;private revision=0;
 private changes=new Map<string,number>();private localEvents=new Map<string,CalendarEvent|null>();private localResources=new Map<string,CalendarData["resources"][number]>();private protectedIds=new Set<string>();private controller:AbortController|null=null;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.snapshot;
 private publish(patch:Partial<Snapshot>){this.snapshot={...this.snapshot,...patch};for(const listener of this.listeners)listener();}
 private touch(ids:string[]){for(const id of ids)this.changes.set(id,++this.revision);}
 currentEpoch(){return this.epoch;}
 valid(ticket:MutationTicket){return ticket.epoch===this.epoch;}
 protect(id:string){this.protectedIds.add(id);const event=this.snapshot.data?.events.find(event=>event.id===id);if(event)this.remember(event);}
 private remember(event:CalendarEvent){this.localEvents.set(event.id,event);for(const resource of this.snapshot.data?.resources??[])if(event.resourceIds.includes(resource.id))this.localResources.set(resource.id,resource);}
 unprotect(id:string){this.protectedIds.delete(id);}
 cancelRead(){this.request++;this.controller?.abort();this.controller=null;this.publish({loading:false,refreshing:false});}
 reset(){this.cancelRead();this.epoch++;this.changes.clear();this.localEvents.clear();this.localResources.clear();this.protectedIds.clear();this.publish({data:null,error:"",pendingIds:new Set()});}
 begin(id:string):MutationTicket|null {
  if(this.snapshot.pendingIds.has(id))return null;
  const event=this.snapshot.data?.events.find(event=>event.id===id);if(event)this.remember(event);this.touch([id]);this.publish({pendingIds:new Set([...this.snapshot.pendingIds,id])});return {id,epoch:this.epoch};
 }
 finish(ticket:MutationTicket){if(!this.valid(ticket))return;this.touch([ticket.id]);const ids=new Set(this.snapshot.pendingIds);ids.delete(ticket.id);this.publish({pendingIds:ids});}
 apply(events:CalendarEvent[],epoch=this.epoch){
  if(epoch!==this.epoch)return;for(const event of events)this.remember(event);this.touch(events.map(event=>event.id));
  const current=this.snapshot.data;if(!current)return;
  const ids=new Set(events.map(event=>event.id));this.publish({data:{...current,events:[...current.events.filter(event=>!ids.has(event.id)),...events]}});
 }
 remove(ticket:MutationTicket){if(!this.valid(ticket))return;this.localEvents.set(ticket.id,null);this.touch([ticket.id]);const current=this.snapshot.data;if(current)this.publish({data:{...current,events:current.events.filter(event=>event.id!==ticket.id)}});}
 async load(fetcher:(signal:AbortSignal)=>Promise<CalendarData>,options:{signal?:AbortSignal;replace?:boolean;timeoutMs?:number}={}) {
  this.controller?.abort();const controller=new AbortController();this.controller=controller;
  const request=++this.request,epoch=this.epoch,revision=this.revision;
  if(options.replace)this.publish({data:null});
  this.publish({loading:!this.snapshot.data,refreshing:!!this.snapshot.data,error:""});
  const abort=()=>{controller.abort();if(request===this.request)this.publish({loading:false,refreshing:false});};
  options.signal?.addEventListener("abort",abort,{once:true});if(options.signal?.aborted)abort();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;abort();},options.timeoutMs??15000);
  try {
   if(controller.signal.aborted)return;
   const incoming=await fetcher(controller.signal);
   if(controller.signal.aborted||request!==this.request||epoch!==this.epoch)return;
   const current=this.snapshot.data;
   const preserve=new Set([...this.protectedIds,...this.snapshot.pendingIds,...[...this.changes].filter(([,value])=>value>revision).map(([id])=>id)]);
   const retained=[...preserve].map(id=>this.localEvents.has(id)?this.localEvents.get(id):current?.events.find(event=>event.id===id)).filter((event):event is CalendarEvent=>!!event);
   const events=[...incoming.events.filter(event=>!preserve.has(event.id)),...retained];
   const resourceIds=new Set(events.filter(event=>preserve.has(event.id)).flatMap(event=>event.resourceIds));
   const known=new Set(incoming.resources.map(resource=>resource.id));
   const candidates=new Map([...[...this.localResources],...(current?.resources.map(resource=>[resource.id,resource] as const)??[])]);
   const resources=[...incoming.resources,...[...candidates.values()].filter(resource=>resourceIds.has(resource.id)&&!known.has(resource.id))];
   this.publish({data:{...incoming,events,resources}});
   return incoming.events.filter(event=>!preserve.has(event.id));
  } catch(error) {
   if(request!==this.request||epoch!==this.epoch)return;
   if(error instanceof CalendarReadError&&(error.status===401||error.status===403)) {this.reset();this.publish({error:error.message});return;}
   if(!controller.signal.aborted)this.publish({error:error instanceof Error?error.message:"Kalender konnte nicht aktualisiert werden."});
  } finally {
   clearTimeout(timer);options.signal?.removeEventListener("abort",abort);
   if(request===this.request&&epoch===this.epoch){this.controller=null;this.publish({loading:false,refreshing:false,...(timedOut?{error:"Die Kalenderaktualisierung dauert zu lange. Bitte erneut laden."}:{})});}
  }
 }
}
