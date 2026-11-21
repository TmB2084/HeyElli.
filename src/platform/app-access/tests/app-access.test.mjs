import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appForPath,requiredApps,writeAppsForRequest} from '../model.ts';
test('app routes, legacy links and business APIs have explicit access scopes',()=>{
 assert.equal(appForPath('/werkzeuge/casedesk'),'/casedesk');assert.deepEqual(requiredApps('/werkzeuge/casedesk'),['/casedesk']);assert.deepEqual(requiredApps('/api/benutzerkonto/werkzeuge'),[]);
 assert.equal(appForPath('/servicehub/orders'),'/servicehub');assert.deepEqual(requiredApps('/ressourcenkalender'),['/planboard']);
 assert.deepEqual(requiredApps('/api/%72essourcenkalender'),['/planboard']);assert.deepEqual(requiredApps('/api/benutzerkonto/'),['/benutzerkonto']);
 assert.deepEqual(requiredApps('/api/verwaltung/rollen'),['/einstellungen']);assert.deepEqual(requiredApps('/api/ressourcenkalender/mobilausgabe'),['/planboard']);
 assert.deepEqual(requiredApps('/api/benutzerkonto/navigation'),[]);assert.deepEqual(requiredApps('/api/benutzerkonto'),['/benutzerkonto']);
 assert.ok(requiredApps('/api/pds/rest/api/termine').includes('/planboard'));assert.deepEqual(requiredApps('/api/assistent/aktionen'),['/']);
});

test('source writes require the matching app while POST queries and personal preferences remain reads',()=>{
 assert.deepEqual(writeAppsForRequest('/api/ressourcenkalender','PATCH'),['/planboard']);
 assert.deepEqual(writeAppsForRequest('/api/pds/rest/api/termin/update','POST'),['/planboard']);
 assert.deepEqual(writeAppsForRequest('/api/pds/rest/api/termin/listplanung','POST'),[]);
 assert.deepEqual(writeAppsForRequest('/api/pds-simulator/orders','POST'),['/casedesk']);
 assert.deepEqual(writeAppsForRequest('/api/bereitschaft/wuensche','POST'),[]);
 assert.deepEqual(writeAppsForRequest('/api/ressourcenkalender/ressourcenauswahl','PUT'),[]);
});
