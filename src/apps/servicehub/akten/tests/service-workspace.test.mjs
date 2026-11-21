import {pdsWebLink} from '../pds-link.ts';
import {customerObjectGroups,objectRoots} from '../customer-hierarchy.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOverview,readFile,readList} from '../reader.ts';
import {belongsToObject,matchesOrder,berlinDay} from '../model.ts';
const entries={
 '/service/liststoerungen':[{uuid:'incident-1',serviceAuftrag:{uuid:'order-1',vorgangsNummer:'SA-1',personUUID:'customer-1',vorgangStatus:{bezeichnung:'Eigener Status'}},serviceAuftragEbene:{uuid:'incident-1',objektUUID:'unit-1',hauptmonteurUUID:'employee-1',startZeitpunkt:'2026-11-09T23:30:00Z',auszufuehrendeArbeiten:'Beispielprüfung'}},{uuid:'incident-2',serviceAuftrag:{uuid:'order-1',vorgangsNummer:'SA-1',personUUID:'customer-1'},serviceAuftragEbene:{uuid:'incident-2',objektUUID:'object-1'}}],
 '/person/listkunden':[{uuid:'customer-1',name:'Beispielkunde',kundenRolle:{kundennummer:'100'}}],
 '/objekt/listobjekte':[{uuid:'object-1',bezeichnung:'Beispielobjekt',personUUID:'customer-1',typ:'OBJEKT',standort:{strasse:'Beispielweg 1',plz:'00000',ort:'Beispielstadt'}},{uuid:'unit-1',bezeichnung:'Beispielanlage',parentUUID:'object-1',typ:'TECHNISCHE_EINHEIT'}],
 '/mitarbeiter/listmitarbeiter':[{uuid:'employee-1',vorname:'Demo',nachname:'Person'}]
};
const api={async request(method,path){assert.equal(method,'POST');assert.ok(entries[path],path);return {totalHitCount:entries[path].length,resultList:entries[path]};}};
test('groups multiple incidents into one order without losing independent planning states',async()=>{
 const overview=await readOverview(api);assert.equal(overview.orders.length,1);const order=overview.orders[0];assert.equal(order.incidents.length,2);assert.equal(order.incidents[0].technician,'Demo Person');assert.equal(order.status,'Eigener Status');assert.equal(matchesOrder(order,'unplanned','2026-11-10'),true);assert.equal(matchesOrder(order,'unassigned','2026-11-10'),true);assert.equal(matchesOrder(order,'today','2026-11-10'),true);assert.equal(matchesOrder(order,'today','2026-11-09'),false);assert.equal(berlinDay('invalid'),'');assert.equal(belongsToObject(order,'object-1',overview.objects),true);assert.equal(belongsToObject(order,'other',overview.objects),false);assert.equal(overview.objects[0].address,'Beispielweg 1, 00000 Beispielstadt');
});
test('paginates completely and rejects broken lists instead of displaying partial counts',async()=>{
 let calls=0;assert.equal((await readList({async request(){calls++;return calls===1?{totalHitCount:2,resultList:[{uuid:'one'}]}:{totalHitCount:2,resultList:[{uuid:'two'}]};}},'/service/liststoerungen')).length,2);assert.equal(calls,2);
 await assert.rejects(readList({async request(){return {totalHitCount:2,resultList:[]};}},'/service/liststoerungen'),/unvollständige/);
 await assert.rejects(readOverview({async request(){throw Error('API unavailable');}}),/API unavailable/);
});
test('projects customer files without returning unrelated financial or identity fields',async()=>{
 const result=await readFile({async request(){return {uuid:'customer-1',name:'Demo',steuernummer:'do-not-return',ansprechpartner:[{person:{uuid:'person-1',name:'Kontakt'},ekommunikationswege:[{typ:'MOBIL',kategorie:'GESCHAEFTLICH',value:'0000'},{typ:'MOBIL',kategorie:'PRIVAT',value:'private'}]}]};}},'customer','customer-1');assert.deepEqual(result.contacts,[{name:'Kontakt',phones:['0000']}]);assert.equal('steuernummer' in result,false);
 await assert.rejects(readFile({async request(){return {uuid:'other'};}},'object','missing'),/nicht mehr verfügbar/);
});
test('simulator supplies customer references for the overview and customer/object files',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {openOrderStore}=await import('../../../../platform/pds/simulator/order-store.ts');const {SimulatedPdsApi}=await import('../../../../platform/pds/simulator/api.ts');const directory=mkdtempSync(join(tmpdir(),'service-workspace-test-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{const transport=new SimulatedPdsApi(store);const result=await readOverview(transport);assert.ok(result.orders.length>0);for(const order of result.orders){assert.ok(result.customers.some(customer=>customer.id===order.customerId));assert.ok((await readFile(transport,'order',order.id)).incidents.length>0);}const customer=result.customers[0];assert.equal((await readFile(transport,'customer',customer.id)).customerId,customer.id);const object=result.objects[0];assert.equal((await readFile(transport,'object',object.id)).objectId,object.id);}finally{store.close();rmSync(directory,{recursive:true});}
});
test('contract metadata is readable without granting real PDS writes',async()=>{
 const {ReadonlyPdsTransport}=await import('../../../../platform/pds/connection/readonly.ts');const paths=[];const transport=new ReadonlyPdsTransport({async request(method,path){paths.push(path);return [];}});assert.deepEqual(await transport.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:'object'}),[]);await assert.rejects(transport.request('POST','/wartungsvertrag/create',{}),/gesperrt/);assert.deepEqual(paths,['/wartungsvertrag/listvertraegebyobjekt']);
});
test('today includes ongoing multi-day service visits and excludes their midnight end day',()=>{
 const order={incidents:[{start:'2026-11-08T08:00:00+01:00',end:'2026-11-10T00:00:00+01:00'}]};assert.equal(matchesOrder(order,'today','2026-11-09'),true);assert.equal(matchesOrder(order,'today','2026-11-10'),false);
});
test('compact preview keeps date, technician and inherited address tied to the same incident',async()=>{
 const {orderPreview}=await import('../model.ts');const objects=[{id:'site',address:'Beispielweg 1',parentId:'',name:'Objekt'},{id:'unit',address:'',parentId:'site',name:'Anlage'}];const order={title:'Gesamter Meldetext',incidents:[{id:'planned',objectId:'unit',start:'2026-11-09T08:00:00Z',technician:'Demo',work:'Serviceauftrag telefonisch gemeldet. Störung/Auftragsbeschreibung: Heizung ausgefallen Ihre Auftragsnummer: EX123'},{id:'unplanned',objectId:'site',start:'',technician:'',work:'Noch nicht geplant'}]};const planned=orderPreview(order,objects,'today','2026-11-09');assert.equal(planned.incident.id,'planned');assert.equal(planned.address,'Beispielweg 1');assert.equal(planned.description,'Heizung ausgefallen');assert.equal(planned.objectName,'Anlage');const unplanned=orderPreview(order,objects,'unplanned','2026-11-09');assert.equal(unplanned.incident.id,'unplanned');assert.equal(unplanned.incident.technician,'');assert.equal(order.incidents[0].work.includes('Ihre Auftragsnummer'),true);
 const broken=orderPreview({incidents:[{objectId:'loop',work:'x'.repeat(120)}]},[{id:'loop',parentId:'loop',address:'',name:'Zyklus'}],'all','2026-11-09');assert.equal(broken.address,'');assert.ok(broken.description.length<=100);
});

test('customer hierarchy inherits technical units, preserves parents during search and keeps unknown assignments visible',()=>{
 const customers=[{id:'a',name:'Kunde Nord',number:'100'},{id:'b',name:'Kunde Süd',number:'200'}];
 const objects=[{id:'site',parentId:'',customerId:'a',name:'Gebäude',address:'Testweg 1',type:'OBJEKT'},{id:'unit',parentId:'site',customerId:'',name:'Heizung',address:'',type:'TECHNISCHE_EINHEIT'},{id:'direct',parentId:'',customerId:'b',name:'BMA',address:'',type:'TECHNISCHE_EINHEIT'},{id:'orphan',parentId:'missing',customerId:'',name:'Unbekannte Anlage',address:'',type:'TECHNISCHE_EINHEIT'}];
 const groups=customerObjectGroups(customers,objects);assert.deepEqual(groups.map(group=>[group.customer?.id,group.objects.map(item=>item.id)]),[['a',['site','unit']],['b',['direct']],[undefined,['orphan']]]);
 const found=customerObjectGroups(customers,objects,'Heizung');assert.equal(found.length,1);assert.equal(found[0].customer.id,'a');assert.deepEqual(found[0].objects.map(item=>item.id),['site','unit']);
 assert.deepEqual(customerObjectGroups(customers,objects,'Testweg Heizung')[0].objects.map(item=>item.id),['site','unit']);
 assert.deepEqual(customerObjectGroups(customers,objects,'200')[0].objects.map(item=>item.id),['direct']);
 assert.deepEqual(objectRoots(groups[0].objects).map(item=>item.id),['site']);
 assert.deepEqual(customerObjectGroups(customers,objects,'nicht vorhanden'),[]);
});
test('cyclic object references have one stable root and do not hang grouping',()=>{
 const objects=[{id:'a',parentId:'b',customerId:'x',name:'A',address:''},{id:'b',parentId:'a',customerId:'',name:'B',address:''}];
 assert.deepEqual(objectRoots(objects).map(item=>item.id),['a']);assert.equal(customerObjectGroups([{id:'x',name:'Kunde',number:''}],objects)[0].objects.length,2);
});

test('PDS web links are projected from all file types without creating addresses or accepting unsafe schemes',async()=>{
 const link='https://pds.example.invalid/app?record=abc%2Fdef&view=detail';
 for(const kind of ['customer','object','order']){const api={async request(method,path){if(path==='/mitarbeiter/listmitarbeiter')return {totalHitCount:0,resultList:[]};if(path==='/wartungsvertrag/listvertraegebyobjekt')return [];return {uuid:'record',name:'Fiktiv',bezeichnung:'Fiktiv',webLink:link};}};assert.equal((await readFile(api,kind,'record')).webLink,link);}
 assert.equal(pdsWebLink('http://pds.example.invalid/record'), 'http://pds.example.invalid/record');
 for(const value of [undefined,null,'','/relative','//pds.example.invalid','javascript:alert(1)','data:text/html,x','file:///etc/passwd','https://user:secret@pds.example.invalid','https://pds.example.invalid/\npath','https:\\evil.invalid'])assert.equal(pdsWebLink(value),undefined);
 for(const value of [undefined,'javascript:alert(1)'])assert.equal((await readFile({async request(){return {uuid:'record',name:'Fiktiv',webLink:value};}},'customer','record')).webLink,undefined);
});

test('resolves unit cost references and keeps maintenance and billing carriers separate',async()=>{
 const make=(failure=false,missing=false)=>({async request(method,path){
  if(path==='/objekt/details')return {uuid:'unit',kstKtrUUID:'carrier'};
  if(path==='/administration/listkostenstelle'){if(failure)throw Error('403');return {totalHitCount:0,resultList:[]};}
  if(path==='/administration/listkostentraeger')return {totalHitCount:missing?0:1,resultList:missing?[]:[{uuid:'carrier',nummer:'100',bezeichnung:'Technik',internal:'private'}]};
  if(path==='/wartungsvertrag/listvertraegebyobjekt')return [{uuid:'contract',wartung:{bezeichnung:'Vertrag',kstKtr:{uuid:'maintenance',nummer:'200',bezeichnung:'Wartung',internal:'private'}},rechnung:{kstKtr:{uuid:'billing',nummer:'300',bezeichnung:'Rechnung'}}}];
  throw Error(path);
 }});
 const file=await readFile(make(),'object','unit');assert.deepEqual(file.costCarrier,{number:'100',name:'Technik'});assert.equal(file.costCarrierError,undefined);
 assert.deepEqual(file.contracts[0].maintenanceCostCarrier,{number:'200',name:'Wartung'});assert.deepEqual(file.contracts[0].billingCostCarrier,{number:'300',name:'Rechnung'});assert.ok(!JSON.stringify(file).includes('private'));
 for(const api of [make(true),make(false,true)]){const failed=await readFile(api,'object','unit');assert.ok(failed.costCarrierError);assert.equal(failed.costCarrier,undefined);assert.equal(failed.contracts.length,1);}
 const empty=await readFile({async request(method,path){if(path==='/objekt/details')return {uuid:'unit'};assert.equal(path,'/wartungsvertrag/listvertraegebyobjekt');return [{uuid:'empty',wartung:{kstKtr:null}}];}},'object','unit');assert.equal(empty.costCarrier,undefined);assert.equal(empty.costCarrierError,undefined);assert.equal(empty.contracts[0].maintenanceCostCarrier,undefined);assert.equal(empty.contracts[0].billingCostCarrier,undefined);
});

test('simulator exposes synthetic cost references through documented read endpoints',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {openOrderStore}=await import('../../../../platform/pds/simulator/order-store.ts');const {SimulatedPdsApi}=await import('../../../../platform/pds/simulator/api.ts');
 const directory=mkdtempSync(join(tmpdir(),'service-cost-test-')),store=openOrderStore(join(directory,'test.sqlite'));
 try{const api=new SimulatedPdsApi(store);const unit=await readFile(api,'object','sim-unit-1');assert.deepEqual(unit.costCarrier,{number:'SIM-KTR-100',name:'Beispielanlagen – Betrieb'});const site=await readFile(api,'object','sim-object-1');assert.equal(site.costCarrier.number,'SIM-KST-100');
 const contracts=(await Promise.all(['sim-object-1','sim-object-2','sim-object-3'].map(id=>readFile(api,'object',id)))).flatMap(file=>file.contracts);assert.ok(contracts.length);for(const contract of contracts){assert.equal(contract.maintenanceCostCarrier.number,'SIM-KTR-200');assert.equal(contract.billingCostCarrier.number,'SIM-KTR-300');}
 const {ReadonlyPdsTransport}=await import('../../../../platform/pds/connection/readonly.ts');const readOnly=new ReadonlyPdsTransport(api);assert.equal((await readOnly.request('POST','/administration/listkostentraeger',{entriesPerPage:500})).totalHitCount,3);
 }finally{store.close();rmSync(directory,{recursive:true});}
});

test('service list byte budget rejects oversized cumulative data without returning partial results',async()=>{let page=0;const text='x'.repeat(700000);await assert.rejects(readList({async request(){page++;return {totalHitCount:30,resultList:Array.from({length:10},(_,n)=>({uuid:String(page*10+n),text}))};}},'/service/liststoerungen'),e=>e.status===413);assert.equal(page,3);});

test('personal hiding keeps descendants hidden without orphaning or changing source records',async()=>{
 const {visibleServiceEntries}=await import('../visibility-model.ts');
 const customers=[{id:'c',name:'Kunde',number:'1'},{id:'d',name:'Anderer Kunde',number:'2'}],objects=[{id:'o',parentId:'',customerId:'c'},{id:'u',parentId:'o',customerId:''},{id:'v',parentId:'u',customerId:''},{id:'x',parentId:'',customerId:'d'}];
 assert.deepEqual(visibleServiceEntries(customers,objects,[{kind:'customer',id:'c'}]).objects.map(row=>row.id),['x']);
 assert.deepEqual(visibleServiceEntries(customers,objects,[{kind:'object',id:'u'}]).objects.map(row=>row.id),['o','x']);
 assert.deepEqual(visibleServiceEntries(customers,objects,[{kind:'object',id:'o'}]).objects.map(row=>row.id),['x']);
 assert.equal(visibleServiceEntries(customers,objects,[]).objects.length,4);assert.equal(objects.length,4);
 assert.equal(visibleServiceEntries(customers,[{id:'a',parentId:'b'},{id:'b',parentId:'a'}],[{kind:'object',id:'b'}]).objects.length,0);
});

test('cost search reads direct object references plus distinct maintenance and billing values in bounded batches',async()=>{
 const {readCostCatalog,readObjectCosts}=await import('../cost-search-reader.ts');let active=0,peak=0;
 const api={async request(method,path,body){assert.equal(method,'POST');if(path.startsWith('/administration/'))return {totalHitCount:1,resultList:[{uuid:'ref',nummer:'007',bezeichnung:'Anlagenbetrieb'}]};
 if(path==='/objekt/detailsbatch')return body.uuids.map(uuid=>({uuid,kstKtrUUID:'ref'}));
 assert.equal(path,'/wartungsvertrag/listvertraegebyobjekt');active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return [{wartung:{kstKtr:{nummer:'W-42',bezeichnung:'Wartungsanlage'}},rechnung:{kstKtr:{nummer:'R-09',bezeichnung:'Rechnungskunde'}}}];}};
 assert.deepEqual(await readCostCatalog(api),[{id:'ref',number:'007',name:'Anlagenbetrieb'}]);const rows=await readObjectCosts(api,['o','u','v','w']);assert.equal(rows.length,4);assert.equal(rows[0].reference,'ref');assert.match(rows[0].contractText,/W-42 Wartungsanlage R-09 Rechnungskunde/);assert.deepEqual(rows[0].costs,[{kind:'maintenance',number:'W-42',name:'Wartungsanlage'},{kind:'billing',number:'R-09',name:'Rechnungskunde'}]);assert.ok(peak<=3);
 await assert.rejects(readObjectCosts(api,Array.from({length:13},(_,n)=>String(n))),e=>e.status===400);
 await assert.rejects(readObjectCosts({async request(){return [{uuid:'foreign'}];}},['o']),/Unvollständige/);
 await assert.rejects(readObjectCosts({async request(method,path){if(path==='/objekt/detailsbatch')return [{uuid:'o'}];throw Error('denied');}},['o']),/denied/);
});
test('cost carrier search preserves customer and parent hierarchy without inheriting cost assignments',()=>{
 const customers=[{id:'c',name:'Nord',number:'100'}],objects=[{id:'o',parentId:'',customerId:'c',name:'Gebäude',address:'Beispielweg',costSearch:'S-01 Betrieb'},{id:'u',parentId:'o',customerId:'',name:'Anlage',address:'',costSearch:'W-42 Wartungsanlage R-09 Rechnungskunde'}];
 assert.deepEqual(customerObjectGroups(customers,objects,'w-42 nord')[0].objects.map(row=>row.id),['o','u']);assert.equal(customerObjectGroups(customers,objects,'Rechnungskunde')[0].customer.id,'c');assert.equal(customerObjectGroups(customers,objects,'unbekannterkostentraeger').length,0);assert.equal(objects[0].costSearch,'S-01 Betrieb');
});

test('cost hits show only matching numbers or names, with separate contract roles and no inherited assignments',async()=>{
 const {matchingCosts,costKindLabel}=await import('../cost-matches.ts');
 const costs=[{kind:'own',number:'001',name:'Anlagenbetrieb'},{kind:'maintenance',number:'007',name:'West Anlage'},{kind:'billing',number:'007',name:'West Anlage'}];
 assert.deepEqual(matchingCosts(costs,'Kunde Nord 007'),costs.slice(1));assert.deepEqual(matchingCosts(costs,'anlagenbetrieb'),costs.slice(0,1));assert.deepEqual(matchingCosts(costs,'Nord'),[]);assert.deepEqual(matchingCosts(costs,''),[]);assert.deepEqual(matchingCosts([], '007'),[]);assert.equal(costKindLabel(costs[1].kind),'Wartung');assert.equal(costKindLabel(costs[2].kind),'Rechnung');assert.deepEqual(matchingCosts([{kind:'maintenance',number:'8',name:'Vertrag Wartung'},{kind:'billing',number:'9',name:'Vertrag Rechnung'}],'Vertrag Rechnung'),[{kind:'billing',number:'9',name:'Vertrag Rechnung'}]);
});

test('calendar links identify the exact service incident and German date without inventing a calendar UUID',async()=>{const {incidentCalendarHref}=await import('../model.ts');const base={id:'incident / 1',start:'2026-11-09T23:30:00Z',technicianId:'employee+1'};const url=new URL(incidentCalendarHref('order & 1',base),'https://example.invalid');assert.equal(url.pathname,'/planboard');assert.equal(url.searchParams.get('datum'),'2026-11-10');assert.equal(url.searchParams.get('einsatz'),base.id);assert.equal(url.searchParams.get('auftrag'),'order & 1');assert.equal(url.searchParams.get('mitarbeiter'),base.technicianId);assert.equal(incidentCalendarHref('order',{...base,start:''}),null);assert.equal(incidentCalendarHref('order',{...base,start:'invalid'}),null);});
