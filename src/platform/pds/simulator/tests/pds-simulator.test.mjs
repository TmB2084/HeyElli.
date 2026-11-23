import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, simulatedPds, InvalidSearch } from '../repository.ts';
import { objects, units, employees, orders } from '../fixtures.ts';
const search = params => simulatedPds.search(parseSearch(new URLSearchParams(params)));

test('searches number, address and multiple terms without umlaut/case sensitivity', () => {
  assert.equal(search({resource:'objects',q:'sud beispielstrasse'}).items[0].id, 'sim-object-2');
  assert.equal(search({resource:'objects',q:'SIM-OBJ-300'}).total, 1);
  assert.equal(search({resource:'objects',q:'no-match'}).total, 0);
});
test('units and existing orders are scoped to their object', () => {
  assert.equal(search({resource:'units',objectId:'sim-object-1'}).total, 2);
  assert.equal(search({resource:'units',objectId:'sim-object-2',q:'Heizung'}).total, 0);
  assert.equal(search({resource:'units',objectId:'sim-object-4'}).total, 0);
  assert.equal(search({resource:'orders',objectId:'sim-object-1'}).items[0].id, 'sim-order-1');
});
test('only explicitly plannable employees are returned', () => {
  assert.equal(search({resource:'employees'}).total, 3);
  assert.equal(search({resource:'employees',q:'SIM-P-104'}).total, 0);
  assert.equal(search({resource:'employees',q:'Elektro'}).items[0].id, 'sim-employee-2');
});
test('validates resource, scope, query length and pagination', () => {
  for (const params of [{resource:'secret'},{resource:'units'},{resource:'orders',objectId:'missing'},{resource:'objects',q:'x'.repeat(101)},{resource:'objects',limit:'51'},{resource:'objects',limit:'0'},{resource:'objects',offset:'-1'}]) {
    assert.throws(() => search(params), InvalidSearch);
  }
  const page = search({resource:'objects',offset:'1',limit:'1'});
  assert.equal(page.items.length, 1); assert.equal(page.total, 4);
});
test('PDS lookups accept a provider object ID outside the simulator catalog',()=>{
 const params=new URLSearchParams({resource:'units',objectId:'40000000-0000-4000-8000-000000000100'});
 assert.equal(parseSearch(params,'pds').objectId,params.get('objectId'));
 assert.throws(()=>parseSearch(params),InvalidSearch);
 params.set('objectId','../unzulässig');
 assert.throws(()=>parseSearch(params,'pds'),InvalidSearch);
});
test('synthetic references remain internally consistent', () => {
  assert.ok(units.every(unit => objects.some(object => object.id === unit.objectId)));
  assert.ok(orders.every(order => units.some(unit => unit.id === order.unitId && unit.objectId === order.objectId)));
  assert.ok(orders.every(order => !order.technicianId || employees.some(employee => employee.id === order.technicianId)));
});


test('contact lookup follows the object customer and returns business phone alternatives',()=>{
 const first=search({resource:'persons',objectId:'sim-object-1'});
 assert.equal(first.total,2);
 assert.equal(first.items.find(item=>item.id==='sim-person-2').phones.length,2);
 assert.equal(search({resource:'persons',objectId:'sim-object-3',q:'Andrea'}).total,0);
 assert.throws(()=>search({resource:'persons'}),InvalidSearch);
});


test('customer preselection resolves the object customer and normal search includes replacements',()=>{
 const preset=search({resource:'customers',objectId:'sim-object-1'});
 assert.equal(preset.total,1);assert.equal(preset.items[0].id,'SIM-K-100');
 assert.equal(search({resource:'customers',objectId:'sim-object-3'}).items[0].id,'SIM-K-200');
 assert.equal(search({resource:'customers',q:'SIM-K-200'}).items[0].id,'SIM-K-200');
});
