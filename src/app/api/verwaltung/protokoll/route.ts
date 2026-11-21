import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders} from '@/system/einstellungen';
import {auditFilters} from '@/platform/store/audit-query';
import {auditMarkdown} from '@/system/einstellungen/audit-format';
async function scopedGET(request:Request){
 try{
  const {user,store}=await adminRequest(),params=new URL(request.url).searchParams,filters=auditFilters(params);
  const first=await store.auditPage(user.id,filters,{cursor:params.get('cursor')??undefined,snapshot:params.get('snapshot')??undefined,facets:params.get('format')==='json'});
  if(params.get('format')==='json')return Response.json(first,{headers:adminHeaders});
  const encoder=new TextEncoder();let page:typeof first|null=first,started=false,cancelled=false;
  const body=new ReadableStream<Uint8Array>({async pull(controller){
   try{
    if(cancelled||request.signal.aborted){controller.close();return;}
    if(!started){started=true;controller.enqueue(encoder.encode(`# HeyElli – Verwaltungsprotokoll\n\nExportiert: ${new Date().toISOString()} (UTC)\n\n`));return;}
    if(!page){controller.close();return;}
    const current=page;page=null;
    controller.enqueue(encoder.encode(current.entries.length?current.entries.map(auditMarkdown).join('\n'):'Keine Verwaltungsänderungen vorhanden.\n'));
    if(current.nextCursor&&!cancelled&&!request.signal.aborted)page=await store.auditPage(user.id,filters,{cursor:current.nextCursor,snapshot:first.snapshot});
   }catch(error){controller.error(error);}
  },cancel(){cancelled=true;page=null;}});
  return new Response(body,{headers:{...adminHeaders,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="heyelli-verwaltungsprotokoll-${new Date().toISOString().slice(0,10)}.md"`}});
 }catch(error){return adminFailure(error);}
}
export const GET=withRouteAccess('/api/verwaltung/protokoll','GET',scopedGET);
