import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,safeLink,libraryKey} from '../configuration.ts';
import {validateFile,scopeKey} from '../documents.ts';
import {graph} from '../transport.ts';
import {fakeSharePoint} from '../../../../tests/sharepoint-fixture.mjs';
export const sampleConfig={tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',secret:'fictitious-sharepoint-secret',siteId:'fictional.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444',driveId:'drive-test',rootId:'root'};
test('SharePoint config, file type/size and tenant destinations are bounded',()=>{
 assert.deepEqual(validateConfig(sampleConfig),sampleConfig);for(const patch of [{siteId:'http://localhost'},{siteId:sampleConfig.siteId.replace('sharepoint.com','sharepoint.com.evil')},{driveId:'../outside'},{rootId:'foo/bar'},{secret:''},{tenantId:'not-a-tenant'}])assert.throws(()=>validateConfig({...sampleConfig,...patch}));
 assert.equal(safeLink('https://evil.example.invalid',sampleConfig),undefined);assert.equal(safeLink('https://user:password@fictional.sharepoint.com',sampleConfig),undefined);
 assert.notEqual(libraryKey(sampleConfig),libraryKey({...sampleConfig,rootId:'different'}));assert.notEqual(scopeKey('simulator','object','1'),scopeKey('pds:source','object','1'));
 for(const [name,bytes]of [['file.exe',Buffer.from('MZ')],['../file.pdf',Buffer.from('%PDF-1.7')],['file.pdf',Buffer.from('fake')],['file.txt',Buffer.alloc(8388609)]])assert.throws(()=>validateFile(name,bytes));validateFile('Fiktiv.pdf',Buffer.from('%PDF-1.7'));validateFile('Fiktiv.txt',Buffer.from('Fiktive Unterlage'));
});
test('Graph upload uses bounded ranges, fixed destinations and no token on signed URLs',async()=>{
 const fake=fakeSharePoint(),api=graph(sampleConfig,fake.transport);await api.test();const folder=await api.folder('a'.repeat(64),true),bytes=Buffer.alloc(3*1024*1024);bytes.write('%PDF-1.7');const item=await api.upload(folder.id,'test.pdf',bytes);assert.equal(item.size,bytes.length);assert.equal(fake.state.chunks,3);assert.deepEqual(await api.verifiedContent(item.id),new Uint8Array(bytes));fake.state.malicious=true;await assert.rejects(api.upload(folder.id,'other.pdf',bytes),e=>e.status===502);assert.equal(fake.state.uploads,1);
});
