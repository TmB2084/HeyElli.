import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {serviceFileTitle} from '../../../../platform/shell/terms.ts';
import {featureCatalog} from '../feature-catalog.ts';
import {retrieveHelp} from '../help-search.ts';
test('file captions distinguish technical units and BMACloud facts have real sources and searchable paths',async()=>{
 assert.equal(serviceFileTitle('object','TECHNISCHE_EINHEIT'),'Technische Einheit');assert.equal(serviceFileTitle('object','OBJEKT'),'Objektakte');assert.equal(serviceFileTitle('customer'),'Kundenakte');
 const records=featureCatalog.filter(f=>f.title.startsWith('BMACloud'));assert.equal(records.length,2);for(const entry of records)for(const file of entry.sourceFiles)await access(file);
 const usage=retrieveHelp('Wie öffne ich eine BMACloud Anlage?');assert.ok(usage.some(s=>s.title==='BMACloud-Anlage öffnen'));assert.match(usage.map(s=>s.text).join(' '),/Wartungskostenträger/);assert.match(usage.map(s=>s.text).join(' '),/führender Nullen/);
 assert.ok(retrieveHelp('Wie richte ich BMACloud ein?').some(s=>s.route.includes('bmacloud')));
 assert.doesNotMatch(JSON.stringify(featureCatalog),/Elli-Rückmeldungen|Anwendungen → E-Mail|Simulator|Testbetrieb/);
 assert.ok(!((await readFile('README.md','utf8')).includes('Einstellungen → Elli-Rückmeldungen')));
});
