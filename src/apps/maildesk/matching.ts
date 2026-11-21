import type {MailCategory,MailMatch,MatchContext} from './model.ts';
// Automatische Kundenzuordnung. Reihenfolge: Kostenträger im Betreff → Auftragsnummer → Kundennummer → Kostenträger im Text →
// gemeinsamer Kostenträger mit zweitem Hinweis → bekannter Absender. Adresse oder Kundenname im Text ergeben nur einen Vorschlag, der bestätigt werden muss.
const fold=(value:string)=>value.toLocaleLowerCase('de').replace(/\s+/g,' ').trim();
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function contains(text:string,needle:string){if(!needle)return false;return new RegExp('(^|[^\\p{L}\\p{N}])'+escape(needle)+'($|[^\\p{L}\\p{N}])','u').test(text);}
export function streetOf(address:string){return fold(address.split(',')[0]??'');}
export type MatchInput={subject:string;body:string;from:string};
export type MatchResult={assignment:MailMatch|null;suggestion:MailMatch|null};
export function matchMail(mail:MatchInput,context:MatchContext):MatchResult{
 const result=matchCustomer(mail,context);
 // Fehlt das Objekt, wird es innerhalb des gefundenen Kunden über die Adresse im Text ergänzt.
 for(const key of ['assignment','suggestion'] as const){const found=result[key];if(found&&!found.objectId){const text=fold(mail.subject+' \n '+mail.body),own=context.objects.filter(item=>item.customerId===found.customerId&&streetOf(item.address).length>=6&&/\d/.test(streetOf(item.address))&&contains(text,streetOf(item.address)));if(own.length===1)result[key]={...found,objectId:own[0].id};}}
 return result;
}
function matchCustomer(mail:MatchInput,context:MatchContext):MatchResult{
 const subject=fold(mail.subject),body=fold(mail.body),all=subject+' \n '+body,from=fold(mail.from);
 const objects=new Map(context.objects.map(item=>[item.id,item])),customers=new Map(context.customers.map(item=>[item.id,item]));
 const known=(customerId:string)=>customers.has(customerId);
 function byCost(text:string){
  const hits=context.costs.filter(cost=>cost.number.length>=3&&contains(text,fold(cost.number)));
  for(const hit of hits){const owners=[...new Set(hit.objectIds.map(id=>objects.get(id)?.customerId).filter((id):id is string=>!!id&&known(id)))];
   if(owners.length===1){const own=hit.objectIds.filter(id=>objects.get(id)?.customerId===owners[0]);return {customerId:owners[0],objectId:own.length===1?own[0]:undefined,number:hit.number,unique:true};}
   if(owners.length>1)return {customerId:owners[0],objectId:undefined,number:hit.number,unique:false};}
  return null;
 }
 const subjectCost=byCost(subject);
 if(subjectCost?.unique)return {assignment:{kind:'cost-subject',customerId:subjectCost.customerId,objectId:subjectCost.objectId,score:100,reason:`Kostenträger ${subjectCost.number} im Betreff`,evidence:subjectCost.number},suggestion:null};
 const order=context.orders.find(item=>item.number.length>=3&&contains(all,fold(item.number))&&known(item.customerId));
 if(order)return {assignment:{kind:'order',customerId:order.customerId,objectId:order.objectId||undefined,orderNumber:order.number,score:98,reason:`Auftragsnummer ${order.number}`,evidence:order.number},suggestion:null};
 const numbered=context.customers.find(item=>item.number.length>=4&&contains(all,fold(item.number)));
 if(numbered)return {assignment:{kind:'customer-number',customerId:numbered.id,score:95,reason:`Kundennummer ${numbered.number}`,evidence:numbered.number},suggestion:null};
 const bodyCost=byCost(body);
 if(bodyCost?.unique)return {assignment:{kind:'cost-body',customerId:bodyCost.customerId,objectId:bodyCost.objectId,score:90,reason:`Kostenträger ${bodyCost.number} im Text`,evidence:bodyCost.number},suggestion:null};
 const ambiguous=subjectCost??bodyCost;
 if(ambiguous){
  // Gemeinsamer Kostenträger (z. B. Rahmenvertrag): ein zweiter Hinweis aus Adresse, Kundenname oder Absender entscheidet.
  const candidates=new Set(context.costs.find(cost=>cost.number===ambiguous.number)?.objectIds.map(id=>objects.get(id)?.customerId).filter((id):id is string=>!!id));
  const byPlace=context.objects.filter(item=>candidates.has(item.customerId)&&streetOf(item.address).length>=6&&/\d/.test(streetOf(item.address))&&contains(all,streetOf(item.address)));
  const byName=context.customers.filter(item=>candidates.has(item.id)&&item.name.length>=6&&contains(all,fold(item.name)));
  const bySender=context.senders.filter(item=>candidates.has(item.customerId)&&fold(item.address)===from);
  // Adresse und Kundenname wiegen schwerer als ein gelernter Absender; der Absender entscheidet nur ohne andere Hinweise.
  const strong=new Set([...byPlace.map(item=>item.customerId),...byName.map(item=>item.id)]),owners=strong.size?strong:new Set(bySender.map(item=>item.customerId));
  if(owners.size===1){const customerId=[...owners][0],place=byPlace.filter(item=>item.customerId===customerId),hint=place.length?`Adresse „${place[0].address.split(',')[0]}“`:byName.length?'Kundenname':'Absender';
   return {assignment:{kind:subjectCost?'cost-subject':'cost-body',customerId,objectId:place.length===1?place[0].id:undefined,score:92,reason:`Kostenträger ${ambiguous.number} ${subjectCost?'im Betreff':'im Text'} + ${hint}`,evidence:ambiguous.number},suggestion:null};}
 }
 const sender=context.senders.find(item=>fold(item.address)===from&&known(item.customerId));
 if(sender)return {assignment:{kind:'sender',customerId:sender.customerId,score:85,reason:'Absender bekannt'},suggestion:null};
 if(ambiguous)return {assignment:null,suggestion:{kind:'cost-body',customerId:ambiguous.customerId,score:70,reason:`Kostenträger ${ambiguous.number} gehört zu mehreren Kunden`,evidence:ambiguous.number}};
 const place=context.objects.map(item=>({item,street:streetOf(item.address)})).filter(({street,item})=>street.length>=6&&/\d/.test(street)&&known(item.customerId)&&contains(all,street));
 if(place.length){const owners=new Set(place.map(entry=>entry.item.customerId)),first=place[0];
  return {assignment:null,suggestion:{kind:'address',customerId:first.item.customerId,objectId:place.length===1?first.item.id:undefined,score:owners.size===1?82:60,reason:`Adresse „${first.item.address.split(',')[0]}“ im Text passt zu ${first.item.name}`,evidence:first.item.address.split(',')[0]}};}
 const named=context.customers.filter(item=>item.name.length>=6&&contains(all,fold(item.name)));
 if(named.length===1)return {assignment:null,suggestion:{kind:'name',customerId:named[0].id,score:60,reason:`Kundenname „${named[0].name}“ im Text`,evidence:named[0].name}};
 return {assignment:null,suggestion:null};
}
// Grobe Einordnung für Kennzeichen und Filter (Einsatzmöglichkeiten); keine fachliche Entscheidung.
export function categorize(mail:MatchInput&{attachments:number}):MailCategory{
 const text=fold(mail.subject+' '+mail.body);
 if(mail.attachments>0&&/(arbeitsnachweis|rücklauf|servicebericht|prüfbericht|wartungsbericht|unterschrieben)/u.test(text))return 'return';
 if(/termin/u.test(text)&&/(bestätig|passt|verschieb|absag|verleg|neuen termin)/u.test(text))return 'appointment';
 if(/angebot/u.test(text))return 'quote';
 if(/(rechnung|lieferschein|bestellung|auftragsbestätigung|gutschrift)/u.test(text))return 'supplier';
 if(/(störung|defekt|ausgefallen|fällt|wasser|alarm|löst .*aus|kein warmwasser|undicht)/u.test(text))return 'fault';
 return 'other';
}
export function urgent(text:string){return /(dringend|sofort|heute noch|notfall|schnellstmöglich|umgehend)/iu.test(text);}
