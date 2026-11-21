import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SimulatedPdsApi} from '../api.ts';
import {openOrderStore} from '../order-store.ts';
// Simulator folgt dem dokumentierten PdsAPIObjektDetailsRESTModel: dbid, fachbereichUUID, standort.strasse/ort,
// und GET /mitarbeiter/listfachbereiche (PdsAPIFachbereichRESTModel). Grundlage der SharePoint-Ordnerstruktur.
test('technische Einheiten liefern Fachbereich (Gewerk) und dbid wie die PDS-OpenAPI',async()=>{
 const api=new SimulatedPdsApi(openOrderStore(join(mkdtempSync(join(tmpdir(),'pds-objects-')),'t.sqlite')),'objects-test');
 const trades=await api.request('GET','/mitarbeiter/listfachbereiche');
 assert.ok(Array.isArray(trades)&&trades.length>0);for(const trade of trades){assert.equal(typeof trade.uuid,'string');assert.equal(typeof trade.dbid,'number');assert.equal(typeof trade.bezeichnung,'string');}
 const unit=await api.request('POST','/objekt/details',{uuid:'sim-unit-4'});
 assert.equal(unit.typ,'TECHNISCHE_EINHEIT');assert.equal(typeof unit.dbid,'number');assert.ok(unit.fachbereichUUID);
 assert.equal(trades.find(trade=>trade.uuid===unit.fachbereichUUID)?.bezeichnung,'Elektro');
 const parent=await api.request('POST','/objekt/details',{uuid:unit.parentUUID});
 assert.equal(parent.typ,'OBJEKT');assert.equal(parent.standort.strasse,'Testallee 3');assert.equal(parent.standort.ort,'Musterstadt');assert.equal(typeof parent.dbid,'number');
});
