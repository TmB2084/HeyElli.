import {withRouteAccess} from '@/platform/app-access/route-access';
import {permitted} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
import {session,sameOrigin} from "@/platform/session";
import {colorSettingsStore} from "@/apps/planboard/kalender/server";
import {colorRuleIdentity,checkColorRules,checkColorLayouts,CalendarError} from "@/apps/planboard/kalender/domain";
const headers={"Cache-Control":"no-store"};
async function scopedGET(){
 const user=await session();
 if(!permitted(user,"read"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
 const api=await pdsApi();try{const [catalogs,categories]=await Promise.all([api.calendar.statusCatalogs(),api.calendar.categories()]);return Response.json({...await colorSettingsStore().readWithCatalogs(catalogs),catalogs,categories},{headers});}catch{return Response.json({error:"Statuskatalog oder Farbkonfiguration konnte nicht geladen werden."},{status:502,headers});}finally{api.close();}
}
async function scopedPOST(request:Request){
 const user=await session();
 if(!permitted(user,"admin"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
 try{const reader=request.body?.getReader();if(!reader)throw new CalendarError("Farbregeln fehlen.");const chunks:Uint8Array[]=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>512000){await reader.cancel();throw new CalendarError("Farbkonfiguration zu groß.",413);}chunks.push(value);}const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));const api=await pdsApi();try{
 const [catalogs,categories]=await Promise.all([api.calendar.statusCatalogs(),api.calendar.categories()]);const store=colorSettingsStore(),current=await store.readWithCatalogs(catalogs),rules=checkColorRules(body.rules);
 for(const rule of rules)if((rule.orderStatusName||!rule.orderType&&rule.orderStatus&&rule.orderStatus!=="*")&&!current.rules.some(old=>colorRuleIdentity(old)===colorRuleIdentity(rule)))throw new CalendarError("Neue Statusfarben benötigen Vorgangsart und Status-UUID.");
 for(const rule of rules)if(rule.orderType&&rule.orderStatus!=="*"&&!catalogs.some(catalog=>catalog.type===rule.orderType&&catalog.statuses.some(status=>status.id===rule.orderStatus))&&!current.rules.some(old=>colorRuleIdentity(old)===colorRuleIdentity(rule)))throw new CalendarError("Status-UUID gehört nicht zur gewählten Vorgangsart. Bitte neu laden.");
 for(const rule of rules)if(rule.category&&!categories.some(category=>category.id===rule.category)&&!current.rules.some(old=>colorRuleIdentity(old)===colorRuleIdentity(rule)))throw new CalendarError("Kategorie-UUID ist nicht in der PDS-Liste vorhanden. Bitte neu laden.");
 return Response.json(await store.write(rules,body.expectedVersion,checkColorLayouts(body.colorLayouts),user!.id),{headers});}finally{api.close();}}
 catch(error){return Response.json({error:error instanceof CalendarError?error.message:"Farbkonfiguration konnte nicht gespeichert werden."},{status:error instanceof CalendarError?error.status:400,headers});}
}

export const GET=withRouteAccess('/api/ressourcenkalender/farben','GET',scopedGET);

export const POST=withRouteAccess('/api/ressourcenkalender/farben','POST',scopedPOST);
