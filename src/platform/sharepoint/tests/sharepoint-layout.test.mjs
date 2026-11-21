import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locationSegments,previewPath,remoteFileName,splitAddress,folderName,slugName,defaultStorageTypes,usesStorageTypes} from '../layout.ts';
test('Ordnerstruktur nach Vorgabe: Stadt, Straße mit Hausnummer, Gewerk, Einheit, Ablagetyp',()=>{
 assert.equal(previewPath({kind:'unit',city:'Duisburg',street:'Hauptstraße 21',trade:'Brandmelde',unitName:'BMZ Halle 2',unitId:'4711'},'Mails'),'Objekte/Duisburg/hauptstraße_21/Brandmelde/BMZ Halle 2_4711/Mails');
 assert.equal(previewPath({kind:'object',city:'Duisburg',street:'Hauptstraße 21'},'Berichte'),'Objekte/Duisburg/hauptstraße_21/Allgemein/Berichte');
 assert.equal(previewPath({kind:'customer',customerName:'Musterwerk West',customerNumber:'K-200'},'Mails'),'Kunden/musterwerk_west_K-200/Mails');
 assert.equal(previewPath({kind:'contract',customerName:'Musterwerk West',customerNumber:'K-200',contractName:'Wartung BMA'},'Mails'),'Kunden/musterwerk_west_K-200/Verträge/Wartung BMA');
 assert.equal(usesStorageTypes({kind:'contract',customerName:'',customerNumber:'',contractName:''}),false);
});
test('Ordnernamen sind für SharePoint gültig und haben verständliche Ersatzwerte',()=>{
 assert.equal(folderName(' a:b/c*d? ','x'),'a b c d');assert.equal(folderName('...','x'),'x');assert.equal(folderName('Ende.','x'),'Ende');
 assert.equal(slugName('Am  Markt 3a, Hinterhaus','x'),'am_markt_3a_hinterhaus');
 assert.deepEqual(locationSegments({kind:'unit',city:'',street:'',trade:'',unitName:'',unitId:''}),['Objekte','ohne_ort','ohne_adresse','ohne_gewerk','einheit']);
 for(const segment of locationSegments({kind:'unit',city:'Köln#1',street:'Weg %2',trade:'Brand|melde',unitName:'<A>',unitId:'1"2'}))assert.doesNotMatch(segment,/["*:<>?/\\|#%]/);
});
test('Adresse aus PDS wird in Straße und Ort getrennt',()=>{
 assert.deepEqual(splitAddress('Hauptstraße 21, 47051 Duisburg'),{street:'Hauptstraße 21',city:'Duisburg'});
 assert.deepEqual(splitAddress('Testallee 3, 00000 Musterstadt'),{street:'Testallee 3',city:'Musterstadt'});
 assert.deepEqual(splitAddress(''),{street:'',city:''});
});
test('Dateinamen sind lesbar, tragen die Auftragsnummer und werden bei Belegung durchnummeriert',()=>{
 assert.equal(remoteFileName('Arbeitsnachweis.pdf','SIM-SA-10002'),'SIM-SA-10002_Arbeitsnachweis.pdf');
 assert.equal(remoteFileName('SIM-SA-10002 Bericht.pdf','SIM-SA-10002'),'SIM-SA-10002 Bericht.pdf');
 assert.equal(remoteFileName('Foto.jpg','',2),'Foto (2).jpg');
 assert.equal(remoteFileName('ohne-endung'),'ohne-endung');
});
test('Standard-Ablagetypen sind eindeutig und sortiert',()=>{
 assert.deepEqual(defaultStorageTypes.map(type=>type.label),['Mails','Berichte','Rückläufe','Fotos','Verträge','Angebote','Sonstiges']);
 assert.equal(new Set(defaultStorageTypes.map(type=>type.key)).size,defaultStorageTypes.length);
});
