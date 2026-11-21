import 'server-only';
import {pdsApi} from '@/platform/pds/connection/api';
import {berlinWall} from '@/apps/planboard/kalender/domain';
export async function actionContext(question:string){
 const api=await pdsApi();try{
  const requested=question.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1],german=question.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);const anchor=requested??(german?`${german[3]}-${german[2].padStart(2,'0')}-${german[1].padStart(2,'0')}`:berlinWall(new Date().toISOString()).slice(0,10));
  const ms=Date.parse(anchor+'T12:00:00Z');if(!Number.isFinite(ms))return {resources:[],events:[]};const from=new Date(ms-7*86400000).toISOString().slice(0,10),to=new Date(ms+7*86400000).toISOString().slice(0,10),data=await api.calendar.list(from,to);
  const tokens=question.toLowerCase().match(/[\p{L}\d-]{3,}/gu)??[];
  const resources=data.resources.filter(r=>tokens.some(t=>r.name.toLowerCase().includes(t)||r.number.toLowerCase()===t));
  const events=data.events.filter(e=>['FREIER','SERVICEAUFTRAGEBENE'].includes(e.type)&&tokens.some(t=>[e.title,e.link?.number??'',e.id,...data.resources.filter(r=>e.resourceIds.includes(r.id)).map(r=>r.name)].some(v=>v.toLowerCase().includes(t))));
  return {from,to,scope:'Nur passende freie Termine und Serviceeinsätze im Zeitraum; weitere IDs nicht erraten.',resources:resources.slice(0,20).map(r=>({id:r.id,name:r.name})),events:events.slice(0,20).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,type:e.type,mainId:e.mainTechnicianId,resourceIds:e.resourceIds,order:e.link?.number}))};
 }finally{api.close();}
}
