import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReportSummary,reportingChannels} from '../reporting.ts';
const example={channel:'Telefon',reporter:'Max Mustermann',contact:'01934567',reportedAt:'2026-11-01T20:40',problem:'Störung BMA MG 1',externalOrderNumber:'EX0123567'};
test('formats the requested report with German date, telephone and external reference',()=>{
 assert.equal(formatReportSummary(example),'Serviceauftrag telefonisch gemeldet und beauftragt\nvon Max Mustermann, Tel: 01934567 am 01.11.2026, 20:40\nStörung/Auftragsbeschreibung:\nStörung BMA MG 1\nIhre Auftragsnummer: EX0123567');
});
test('email and on-site reporting use correct wording without empty optional fields',()=>{
 const email=formatReportSummary({...example,channel:'E-Mail',contact:'',externalOrderNumber:''});
 assert.ok(email.startsWith('Serviceauftrag per E-Mail gemeldet und beauftragt\n'));
 assert.ok(!email.includes('Tel:'));assert.ok(!email.includes('Ihre Auftragsnummer:'));
 assert.ok(formatReportSummary({...example,channel:'an Techniker vor Ort'}).startsWith('Serviceauftrag mündlich an Techniker vor Ort gemeldet und beauftragt\n'));
 assert.equal(reportingChannels.length,3);
});
