import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdsViewContracts,pdsViewsMarkdown} from '../pds-view-guide-data.ts';
import {readReturnLinks} from '../../../platform/pds/api/return-links.ts';
import {readWorkingTime} from '../../../platform/pds/api/working-time.ts';
import {enrichVacationApprovals} from '../../../platform/pds/api/vacation-view.ts';
import {readLegacyColorRules} from '../../../apps/planboard/kalender/colors.ts';
test('documented fictitious view examples work with the actual four read adapters',async()=>{
 const get=id=>pdsViewContracts.find(view=>view.id===id).example;
 const rows=get('returns'),links=await readReturnLinks({request:async(_method,path)=>path==='/datenansichten/list'?[{uuid:'fictional-view',name:'approved',columns:Object.keys(rows[0]).map(name=>({name}))}]:rows},'approved');assert.equal(links[0].serviceauftragebeneUUID,rows[0].serviceauftragebeneUUID);
 const work=get('working-time'),api={request:async(_method,path)=>path==='/datenansichten/list'?[{name:'approved'}]:path==='/datenansichten/listdaten'?work:path==='/administration/listfeiertagsgruppen'?[{uuid:work[0].feiertagsgruppeUUID,aktiveFeiertage:[]}]:[]};const result=await readWorkingTime(api,'approved',[{id:work[0].mitarbeiterUUID,name:'Fiktiv'}],'2026-11-16','2026-11-16');assert.equal(result.resources[0].days[0].targetMinutes,480);assert.deepEqual(result.resources[0].days[0].intervals,[{start:420,end:900}]);
 const vacation=get('vacation'),events=[{id:vacation[0].terminUUID,type:'URLAUB'}];await enrichVacationApprovals({request:async(_method,path)=>path==='/datenansichten/list'?[{name:'approved'}]:vacation},'approved',events);assert.equal(events[0].vacationApproval,'GENEHMIGT');assert.deepEqual(readLegacyColorRules(get('colors')),[{typ:'FREIER',farbe:'#d71f3b'}]);
 const markdown=pdsViewsMarkdown();assert.match(markdown,/keine behaupteten PDS-Tabellen/);assert.match(markdown,/nicht direkt kompatibel/);assert.match(markdown,/kein administrativ konfigurierbares/);for(const view of pdsViewContracts){assert.ok(markdown.includes(view.option));assert.ok(markdown.includes(JSON.stringify(view.example,null,2)));}
});
