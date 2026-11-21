import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outlookLink} from '../outlook-link.ts';
test('Outlook handoff preserves encoded fields and normalizes newlines',()=>{const link=outlookLink('demo@example.invalid','Grüße & Rückfrage?','Hallo\nZeile 2 & cc=other@example.invalid');const url=new URL(link);assert.equal(decodeURIComponent(url.pathname),'demo@example.invalid');assert.equal(url.searchParams.get('subject'),'Grüße & Rückfrage?');assert.equal(url.searchParams.get('body'),'Hallo\r\nZeile 2 & cc=other@example.invalid');assert.equal(url.searchParams.has('cc'),false);assert.equal([...url.searchParams].length,2);});
test('header injection and invalid recipient are rejected',()=>{assert.throws(()=>outlookLink('demo@example.invalid\r\nBcc:x@y.invalid','Test','Body'));assert.throws(()=>outlookLink('demo@example.invalid','Test\nBcc:x@y.invalid','Body'));assert.throws(()=>outlookLink('invalid','Test','Body'));});
