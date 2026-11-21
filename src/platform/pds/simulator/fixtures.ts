import type { PdsObject, PdsUnit, PdsEmployee, PdsServiceOrder } from "./model";

// Hand-authored synthetic records. No production values or exported identifiers.
export const objects: readonly PdsObject[] = [
  { id: "sim-object-1", number: "SIM-OBJ-100", name: "Beispielhaus Nord", customerNumber: "SIM-K-100", street: "Musterweg 12", postalCode: "00000", city: "Demostadt" },
  { id: "sim-object-2", number: "SIM-OBJ-200", name: "Beispielhaus Süd", customerNumber: "SIM-K-100", street: "Beispielstraße 8", postalCode: "00000", city: "Demostadt" },
  { id: "sim-object-3", number: "SIM-OBJ-300", name: "Musterwerk West", customerNumber: "SIM-K-200", street: "Testallee 3", postalCode: "00000", city: "Musterstadt" },
  { id: "sim-object-4", number: "SIM-OBJ-400", name: "Demohaus ohne technische Einheit", customerNumber: "SIM-K-300", street: "Fiktivweg 4", postalCode: "00000", city: "Musterstadt" },
];
export const units: readonly PdsUnit[] = [
  { id: "sim-unit-1", objectId: "sim-object-1", number: "SIM-TE-101", name: "Heizungsanlage", trade: "Heizung", manufacturer: "DemoTherm", type: "DT-100", location: "Keller" },
  { id: "sim-unit-2", objectId: "sim-object-1", number: "SIM-TE-102", name: "Lüftungsanlage", trade: "Lüftung", manufacturer: "MusterLuft", type: "ML-200", location: "Dachgeschoss" },
  { id: "sim-unit-3", objectId: "sim-object-2", number: "SIM-TE-201", name: "Hebeanlage", trade: "Sanitär", manufacturer: "DemoPump", type: "DP-10", location: "Untergeschoss" },
  { id: "sim-unit-4", objectId: "sim-object-3", number: "SIM-TE-301", name: "Brandmeldeanlage", trade: "Elektro", manufacturer: "MusterSignal", type: "MS-300", location: "Zentrale EG" },
  { id: "sim-unit-5", objectId: "sim-object-3", number: "SIM-TE-302", name: "Sicherheitsbeleuchtung", trade: "Elektro", manufacturer: "DemoLicht", type: "DL-20", location: "Treppenhaus" },
];
export const employees: readonly PdsEmployee[] = [
  { id: "sim-employee-1", personnelNumber: "SIM-P-101", firstName: "Alex", lastName: "Beispiel", department: "Kundendienst", specialty: "Heizung / Sanitär", siteManager: false, plannable: true },
  { id: "sim-employee-2", personnelNumber: "SIM-P-102", firstName: "Kim", lastName: "Muster", department: "Service", specialty: "Elektro / Brandmeldetechnik", siteManager: true, plannable: true },
  { id: "sim-employee-3", personnelNumber: "SIM-P-103", firstName: "Robin", lastName: "Demo", department: "Kundendienst", specialty: "Lüftung", siteManager: false, plannable: true },
  { id: "sim-employee-4", personnelNumber: "SIM-P-104", firstName: "Sam", lastName: "Test", department: "Verwaltung", specialty: "Disposition", siteManager: true, plannable: false },
];
export const orders: readonly PdsServiceOrder[] = [
  { id: "sim-order-1", number: "SIM-SA-10001", objectId: "sim-object-1", unitId: "sim-unit-1", description: "Heizung meldet Druckverlust", status: "Offen", technicianId: null, plannedFrom: null, externalNumber: "SIM-EXT-101" },
  { id: "sim-order-2", number: "SIM-SA-10002", objectId: "sim-object-3", unitId: "sim-unit-4", description: "Störanzeige an der Brandmeldezentrale", status: "Ausgegeben", technicianId: "sim-employee-2", plannedFrom: "2026-11-04T09:00:00+01:00", externalNumber: null },
];

// Fictional customer contact database; business phone numbers only.
export const persons = [
  {id:"sim-person-1",customerNumber:"SIM-K-100",name:"Andrea Beispiel",function:"Objektverwaltung",phones:[{label:"Geschäftliches Festnetz",number:"+49 30 00000001"}]},
  {id:"sim-person-2",customerNumber:"SIM-K-100",name:"Toni Muster",function:"Haustechnik",phones:[{label:"Geschäftliches Festnetz",number:"+49 30 00000002"},{label:"Geschäftliches Mobiltelefon",number:"+49 170 0000002"}]},
  {id:"sim-person-3",customerNumber:"SIM-K-200",name:"Charlie Demo",function:"Empfang",phones:[]},
  {id:"sim-person-4",customerNumber:"SIM-K-300",name:"Jules Test",function:"Ansprechpartner",phones:[{label:"Geschäftliches Festnetz",number:"+49 30 00000004"}]},
];
