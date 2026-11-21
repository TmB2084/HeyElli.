import {uploadStorage} from './upload-storage.ts';
import {serviceWorkflow,type ApiCall} from "../api/index.ts";
import {formatReportSummary} from "./reporting.ts";
import {validateDocument, documentName, MAX_DOCUMENT_BYTES, type OrderDocument} from "./document.ts";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { employees, objects, units, persons } from "./fixtures.ts";

export type CustomerPerson = {id:string;customerNumber:string;name:string;function:string;customerNumbers?:string[];phones:{label:string;number:string}[]};
export class InvalidOrder extends Error {}
export type PdsReceipt={uuid:string;number:string;stoerungUUID:string;documentUUID?:string};
export type OrderInput = {mobileIssue:boolean;bearbeiterUUID?:string;pdsReceipt?:PdsReceipt; reporter: string; reportSummary:string;pdsApiCalls:ApiCall[]; personId:string; personScope:string; document:OrderDocument | null; problem: string; location: string; bauleiterId: string; reportedAt: string; channel: string; contact: string; externalOrderNumber: string; objectId: string; unitId: string; technicianId: string; companionTechnicianIds: string[]; mobilityTechnicianId: string; appointment: string; appointmentDuration:string };
export function validateOrder(input: unknown, customerPersons: readonly CustomerPerson[] = persons): OrderInput {
  if (!input || typeof input !== "object") throw new InvalidOrder("Ungültiger Auftrag.");
  const raw = {...input} as Record<string, unknown>;
  raw.personScope ??= "customer";
  const mobileIssue=raw.mobileIssue??false;
  if(typeof mobileIssue!=="boolean")throw new InvalidOrder("Ungültige Auswahl zur mobilen Ausgabe.");
  if(raw.personScope!=="customer" && raw.personScope!=="all")throw new InvalidOrder("Ungültiger Personensuchbereich.");
  const object = objects.find(object => object.id === raw.objectId);
  const person = customerPersons.find(person => person.id === raw.personId && (raw.personScope === "all" || person.customerNumber === object?.customerNumber || person.customerNumbers?.includes(object?.customerNumber ?? "")));
  if (!object || !person) throw new InvalidOrder("Bitte ein Objekt und eine dazugehörige Kundenperson auswählen.");
  raw.reporter = person.name;
  raw.bauleiterId ??= "";
  raw.appointmentDuration ??= raw.technicianId ? "60" : "";
  raw.location = typeof raw.objectId === "string" ? objects.find(object => object.id === raw.objectId)?.street ?? "" : "";
  const result = {} as Record<Exclude<keyof OrderInput, "mobileIssue" | "companionTechnicianIds" | "mobilityTechnicianId" | "document" | "reportSummary" | "pdsApiCalls" | "pdsReceipt" | "bearbeiterUUID">, string>;
  for (const [key, max] of Object.entries({ reporter:160, personId:100, personScope:20, problem:4000, location:300, bauleiterId:100, reportedAt:16, channel:20, contact:200, externalOrderNumber:160, objectId:100, unitId:100, technicianId:100, appointment:16, appointmentDuration:4 })) {
    if (typeof raw[key] !== "string" || raw[key].length > max) throw new InvalidOrder("Ungültige oder zu lange Eingabe.");
    result[key as keyof typeof result] = raw[key].trim();
  }
  for (const key of ["reporter", "problem", "reportedAt", "channel"] as const) if (!result[key]) throw new InvalidOrder("Pflichtangaben fehlen.");
  if (!["Telefon", "E-Mail", "an Techniker vor Ort"].includes(result.channel)) throw new InvalidOrder("Ungültiger Meldeweg.");
  if (result.channel !== "E-Mail" && (!result.contact || !/^[+0-9() /.-]{3,50}$/.test(result.contact))) throw new InvalidOrder("Bitte eine Rückrufnummer angeben.");
  let document: OrderDocument | null = null;
  if (result.channel === "E-Mail") {
    try {document=validateDocument(raw.document);} catch(error) {throw new InvalidOrder(error instanceof Error ? error.message : "Ungültiges Dokument.");}
    result.contact = "";
  }
  if (result.objectId && !objects.some(o => o.id === result.objectId)) throw new InvalidOrder("Unbekanntes Objekt.");
  if (result.unitId && !units.some(u => u.id === result.unitId && u.objectId === result.objectId)) throw new InvalidOrder("Technische Einheit passt nicht zum Objekt.");
  if (Boolean(result.technicianId) !== Boolean(result.appointment)) throw new InvalidOrder("Techniker und Einsatztermin gemeinsam angeben.");
  if (result.technicianId && !employees.some(e => e.id === result.technicianId && e.plannable)) throw new InvalidOrder("Techniker ist nicht planbar.");
  if (!result.bauleiterId || !employees.some(employee => employee.id === result.bauleiterId && employee.siteManager)) throw new InvalidOrder("Bitte einen gültigen Projektleiter zuweisen.");
  const companions = raw.companionTechnicianIds ?? [];
  if (!Array.isArray(companions) || companions.length > 20 || companions.some(id => typeof id !== "string" || !employees.some(employee => employee.id === id && employee.plannable))) throw new InvalidOrder("Ungültige begleitende Techniker.");
  if (new Set(companions).size !== companions.length || companions.includes(result.technicianId)) throw new InvalidOrder("Techniker dürfen nur einmal zugeteilt werden.");
  if (companions.length && !result.technicianId) throw new InvalidOrder("Begleitende Techniker benötigen einen Haupttechniker und Einsatztermin.");
  berlinInstant(result.reportedAt);
  if (result.appointment) berlinInstant(result.appointment);
  if(result.technicianId && (!/^\d+$/.test(result.appointmentDuration)||Number(result.appointmentDuration)<15||Number(result.appointmentDuration)>1440||Number(result.appointmentDuration)%15!==0))throw new InvalidOrder("Bitte eine Einsatzdauer von 15 bis 1440 Minuten in 15-Minuten-Schritten angeben.");
  if(!result.technicianId)result.appointmentDuration="";
  if(mobileIssue&&!result.technicianId)throw new InvalidOrder("Für die mobile Ausgabe einen Haupttechniker und Termin zuordnen.");
  const pdsApiCalls=serviceWorkflow({customerUUID:object.customerNumber,objectUUID:result.unitId || result.objectId,description:formatReportSummary(result),externalNumber:result.externalOrderNumber,reportedAt:result.reportedAt,mobileIssue,technicianId:result.technicianId,companions:[...companions],start:result.appointment ? berlinInstant(result.appointment) : undefined,end:result.appointment ? new Date(Date.parse(berlinInstant(result.appointment))+Number(result.appointmentDuration)*60000).toISOString() : undefined},"SIM-Serviceauftrag");
  return {...result,mobileIssue,pdsApiCalls, reportSummary:formatReportSummary(result), document, companionTechnicianIds: [...companions].sort(), mobilityTechnicianId:result.technicianId};
}
// Require exactly one matching instant; reject missing or ambiguous DST wall times.
export function berlinInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new InvalidOrder("Ungültiges Datum.");
  const utc = Date.parse(value + "Z");
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone:"Europe/Berlin", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
  const matches = [1, 2].map(offset => new Date(utc - offset * 3600000)).filter(date => Number.isFinite(date.getTime()) && formatter.format(date).replace(" ", "T") === value);
  if (matches.length !== 1) throw new InvalidOrder("Datum/Uhrzeit ungültig oder beim Zeitwechsel mehrdeutig. Bitte anderen Zeitpunkt wählen.");
  return matches[0].toISOString();
}
export function openOrderStore(path: string) {
  mkdirSync(dirname(path), {recursive:true});
  const db = new DatabaseSync(path);
  const rollback=()=>{try{db.exec("ROLLBACK");}catch{/* SQLite may already roll back an exhausted-disk transaction. */}};
  db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
    const directory=resolve("database/migrations/pds-simulator");
    for(const name of readdirSync(directory).filter(name=>/^\d+_[a-z_]+\.sql$/.test(name)).sort()) {
      const migration=readFileSync(resolve(directory,name),"utf8");
      const checksum=createHash("sha256").update(migration).digest("hex");
      const applied=db.prepare("SELECT checksum FROM migrations WHERE name=?").get(name);
      if(applied && applied.checksum!==checksum) throw new Error("Angewendete Simulatormigration verändert.");
      if(!applied) {db.exec(migration);db.prepare("INSERT INTO migrations VALUES (?,?)").run(name,checksum);}
    }
    db.exec("COMMIT");
  } catch (error) { rollback(); db.close(); throw error; }
  const uploadData=uploadStorage(db,path);
  function allPersons():CustomerPerson[] {
    const rows=db.prepare("SELECT id, customer_number, name, phone, function, mobile FROM customer_persons ORDER BY name").all();
    const apiPersons=db.prepare("SELECT uuid,payload FROM pds_api_entities WHERE kind='person'").all().map(row=>{
      const data=JSON.parse(String(row.payload));
      const phones=db.prepare("SELECT payload FROM pds_api_entities WHERE kind='communication'").all().map(row=>JSON.parse(String(row.payload))).filter(phone=>phone.personUUID===row.uuid).map(phone=>({label:phone.typ==="MOBIL"?"Geschäftliches Mobiltelefon":"Geschäftliches Festnetz",number:phone.value}));
      return {id:String(row.uuid),customerNumber:String(data.customerUUID??""),name:String(data.name),function:String(data.functionUUID??""),phones};
    });
    return [...persons,...apiPersons,...rows.map(row=>({id:String(row.id),customerNumber:String(row.customer_number),name:String(row.name),function:String(row.function),phones:[...(row.phone ? [{label:"Geschäftliches Festnetz",number:String(row.phone)}] : []),...(row.mobile ? [{label:"Geschäftliches Mobiltelefon",number:String(row.mobile)}] : [])]}))].map(person=>{
      const assigned=db.prepare("SELECT customer_number FROM person_customer_assignment WHERE person_id=?").get(person.id);
      if(assigned)return {...person,customerNumber:String(assigned.customer_number),customerNumbers:[String(assigned.customer_number)]};
      return {...person,customerNumbers:[person.customerNumber,...db.prepare("SELECT customer_number FROM person_customer_links WHERE person_id=?").all(person.id).map(row=>String(row.customer_number))].filter((value,index,array)=>array.indexOf(value)===index)};
    });
  }
  function checkedCustomer(value:unknown):string {
    if(typeof value!=="string" || !objects.some(object=>object.customerNumber===value))throw new InvalidOrder("Bitte einen gültigen Kunden auswählen.");
    return value;
  }

  return {
    close: () => db.close(),
    receiveUpload:uploadData.receive,
    allPersons,
    apiTransaction<T>(execute:()=>T):T {db.exec("BEGIN IMMEDIATE");try{const result=execute();db.exec("COMMIT");return result;}catch(error){rollback();throw error;}},
    apiEntities(kind:string) {return db.prepare("SELECT uuid,payload FROM pds_api_entities WHERE kind=? ORDER BY sequence").all(kind).map(row=>({uuid:String(row.uuid),data:JSON.parse(String(row.payload)) as Record<string,unknown>}));},
    historyEnqueue(id:string,payload:string) {db.prepare("INSERT INTO service_history_outbox(id,payload) VALUES(?,?)").run(id,payload);},
    historyPending() {return db.prepare("SELECT id,payload FROM service_history_outbox WHERE delivered=0 ORDER BY rowid LIMIT 100").all().map(row=>({id:String(row.id),payload:String(row.payload)}));},
    historyDelivered(id:string) {db.prepare("UPDATE service_history_outbox SET delivered=1 WHERE id=?").run(id);},
    storedOrders() {return db.prepare("SELECT sequence,payload FROM orders ORDER BY sequence DESC").all().map(row=>({sequence:Number(row.sequence),input:JSON.parse(String(row.payload)) as OrderInput}));},
    apiEntity(uuid:string) {
      const row=db.prepare("SELECT kind,payload,content FROM pds_api_entities WHERE uuid=?").get(uuid);
      return row ? {uuid,kind:String(row.kind),data:JSON.parse(String(row.payload)) as Record<string,unknown>,content:row.content as Uint8Array | null} : null;
    },
    apiCreate(kind:string,data:Record<string,unknown>,content:Uint8Array|null=null) {
      if(content)uploadData.quota('__shared__',content.byteLength);
      const uuid=randomUUID();const created=db.prepare("INSERT INTO pds_api_entities(uuid,kind,payload,content) VALUES (?,?,?,?)").run(uuid,kind,JSON.stringify(data),content);
      if(kind==="service") {data={...data,vorgangsNummer:`SIM-API-SA-${created.lastInsertRowid}`};db.prepare("UPDATE pds_api_entities SET payload=? WHERE uuid=?").run(JSON.stringify(data),uuid);}
      return {uuid,...data};
    },
    apiPut(uuid:string,kind:string,data:Record<string,unknown>) {
      const existing=db.prepare("SELECT kind FROM pds_api_entities WHERE uuid=?").get(uuid);
      if(existing && existing.kind!==kind)throw new InvalidOrder("Ungültiger API-Entitätstyp.");
      db.prepare("INSERT INTO pds_api_entities(uuid,kind,payload) VALUES (?,?,?) ON CONFLICT(uuid) DO UPDATE SET payload=excluded.payload").run(uuid,kind,JSON.stringify(data));
      return {uuid,...data};
    },
    apiUpdate(uuid:string,data:Record<string,unknown>) {db.prepare("UPDATE pds_api_entities SET payload=? WHERE uuid=?").run(JSON.stringify(data),uuid);return {uuid,...data};},
    apiStep(workflow:string,step:string,body:unknown,execute:()=>unknown) {
      const hash=createHash("sha256").update(JSON.stringify(body)).digest("hex");
      db.exec("BEGIN IMMEDIATE");
      try {
        const old=db.prepare("SELECT request_hash,response FROM pds_api_steps WHERE workflow_key=? AND step_key=?").get(workflow,step);
        if(old && old.request_hash!==hash)throw new InvalidOrder("Wiederholungsversuch enthält andere Daten.");
        const result=old ? JSON.parse(String(old.response)) : execute();
        if(!old)db.prepare("INSERT INTO pds_api_steps VALUES (?,?,?,?)").run(workflow,step,hash,JSON.stringify(result));
        db.exec("COMMIT");return result;
      }catch(error){rollback();throw error;}
    },
    uploadBytes(id:string,user:string) {const row=db.prepare("SELECT content,transfer_id,chunked_size FROM uploads WHERE id=? AND created_by=?").get(id,user);if(!row)throw new InvalidOrder("Upload fehlt.");return uploadData.bytes(row);},
    assignPerson(id:unknown,customerNumber:unknown,user:string):CustomerPerson {
      const person=allPersons().find(person=>person.id===id);
      if(!person)throw new InvalidOrder("Unbekannte Person.");
      const target=checkedCustomer(customerNumber);
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT INTO person_customer_assignment VALUES (?,?,?) ON CONFLICT(person_id) DO UPDATE SET customer_number=excluded.customer_number,changed_by=excluded.changed_by").run(person.id,target,user);
        db.prepare("DELETE FROM person_customer_links WHERE person_id=?").run(person.id);
        db.exec("COMMIT");
      }catch(error){rollback();throw error;}
      return allPersons().find(item=>item.id===id)!;
    },
    persons(objectId:string): CustomerPerson[] {
      const customer=objects.find(object=>object.id===objectId)?.customerNumber;
      if(!customer)throw new InvalidOrder("Bitte ein gültiges Objekt auswählen.");
      return allPersons().filter(person=>person.customerNumbers?.includes(customer));
    },
    createPerson(objectId:unknown,name:unknown,phone:unknown,user:string,personFunction:unknown,mobile:unknown,deviatingCustomer:unknown=""):CustomerPerson {
      const objectCustomer=objects.find(object=>object.id===objectId)?.customerNumber;
      const customer=deviatingCustomer ? checkedCustomer(deviatingCustomer) : objectCustomer;
      const validPhone=(value:unknown)=>typeof value==="string" && (!value.trim() || /^[+0-9() /.-]{3,50}$/.test(value.trim()));
      if(!objectCustomer || !customer || typeof name!=="string" || !name.trim() || name.trim().length>160 || typeof personFunction!=="string" || !personFunction.trim() || personFunction.trim().length>100 || !validPhone(phone) || !validPhone(mobile) || !(String(phone).trim() || String(mobile).trim())) throw new InvalidOrder("Bitte Name, Funktion und mindestens eine gültige geschäftliche Telefonnummer angeben.");
      db.exec("BEGIN IMMEDIATE");
      try {
      const fullName=name.trim(), landline=String(phone).trim(), cell=String(mobile).trim(), job=personFunction.trim();
      const row=db.prepare("SELECT id, function, mobile FROM customer_persons WHERE customer_number=? AND name=? AND phone=?").get(customer,fullName,landline);
      if(row && (row.function!==job || row.mobile!==cell)) throw new InvalidOrder("Eine Person mit diesem Namen und Festnetz existiert bereits mit anderen Angaben. Bitte über die Suche auswählen.");
      const id=row ? String(row.id) : randomUUID();
      if(!row) db.prepare("INSERT INTO customer_persons(id,customer_number,name,phone,created_by,function,mobile) VALUES (?,?,?,?,?,?,?) ON CONFLICT(customer_number,name,phone) DO NOTHING").run(id,customer,fullName,landline,user,job,cell);
      const saved=db.prepare("SELECT id, function, mobile FROM customer_persons WHERE customer_number=? AND name=? AND phone=?").get(customer,fullName,landline)!;
      if(saved.function!==job || saved.mobile!==cell) throw new InvalidOrder("Person bereits mit anderen Angaben vorhanden.");
      db.exec("COMMIT");
      return allPersons().find(person=>person.id===String(saved.id))!;
      }catch(error){rollback();throw error;}

    },
    upload(id:string,name:string,bytes:Buffer,user:string) {
      documentName(name);
      if(!/^[a-f0-9-]{36}$/.test(id) || !bytes.length || bytes.length>MAX_DOCUMENT_BYTES) throw new InvalidOrder("Ungültige Datei (maximal 100 MB).");
      const checksum=createHash("sha256").update(bytes).digest("hex");
      if(!db.prepare("SELECT 1 FROM uploads WHERE id=?").get(id))uploadData.quota(user,bytes.length);
      db.prepare("INSERT INTO uploads(id,name,content,checksum,created_by) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(id,name,bytes,checksum,user);
      const row=db.prepare("SELECT name,checksum,created_by FROM uploads WHERE id=?").get(id)!;
      if(row.created_by!==user || row.checksum!==checksum || row.name!==name) throw new InvalidOrder("Upload-Kennung ist bereits vergeben.");
      return {uploadId:id,name,mime:"application/octet-stream",category:"Grunddaten" as const};
    },
    uploaded(id:string,user:string) {
      const row=db.prepare("SELECT name FROM uploads WHERE id=? AND created_by=?").get(id,user);
      if(!row) throw new InvalidOrder("Dokument fehlt oder gehört nicht zur Sitzung.");
      return {uploadId:id,name:String(row.name),mime:"application/octet-stream",category:"Grunddaten" as const};
    },
    savedOrder(key:string,user:string): (OrderInput & {number:string;plannedFrom:string|null})|null {const row=db.prepare("SELECT sequence,payload,created_by FROM orders WHERE request_key=?").get(key);if(!row)return null;if(row.created_by!==user)throw new InvalidOrder("Vorgangskennung gehört zu einem anderen Konto.");const input=JSON.parse(String(row.payload)) as OrderInput;return {...input,number:input.pdsReceipt?.number??`SIM-SA-${10002+Number(row.sequence)}`,plannedFrom:input.appointment?berlinInstant(input.appointment):null};},
    save(input: OrderInput, key: string, user: string) {
      const payload = JSON.stringify(input);
      db.exec("BEGIN IMMEDIATE");
      try {
        const old = db.prepare("SELECT sequence, payload, created_by FROM orders WHERE request_key=?").get(key);
        if (old && (old.payload !== payload || old.created_by !== user)) throw new InvalidOrder("Diese Anfrage wurde bereits für einen anderen Auftrag verwendet.");
        const sequence = old?.sequence ?? db.prepare("INSERT INTO orders(request_key,payload,created_by) VALUES (?,?,?)").run(key, payload, user).lastInsertRowid;
        db.exec("COMMIT");
        return {number:input.pdsReceipt?.number ?? `SIM-SA-${10002 + Number(sequence)}`, ...input, plannedFrom:input.appointment ? berlinInstant(input.appointment) : null};
      } catch(error) { rollback(); throw error; }
    },
    document(number:string) {
      const parsed=Number(number.replace(/^SIM-SA-/,""))-10002;
      const sequence=Number.isSafeInteger(parsed)?parsed:-1;
      if (!/^SIM-(?:API-)?SA-\d+$/.test(number)) return null;
      const row=db.prepare("SELECT payload FROM orders WHERE json_extract(payload,'$.pdsReceipt.number')=? OR sequence=?").get(number,sequence);
      const file=row ? (JSON.parse(String(row.payload)) as OrderInput).document ?? null : null;
      if(!file) return null;
      const receipt=row ? (JSON.parse(String(row.payload)) as OrderInput).pdsReceipt : undefined;
      if(receipt?.documentUUID){const doc=db.prepare("SELECT content FROM pds_api_entities WHERE uuid=? AND kind='document'").get(receipt.documentUUID);return doc ? {...file,bytes:Buffer.from(doc.content as Uint8Array)} : null;}
      if(file.uploadId) {
        const upload=db.prepare("SELECT content,transfer_id,chunked_size FROM uploads WHERE id=?").get(file.uploadId);
        return upload ? {...file,bytes:uploadData.bytes(upload)} : null;
      }
      return {...file,bytes:Buffer.from(file.base64 ?? "","base64")};
    },
    list(objectId: string) {
      return db.prepare("SELECT sequence, payload FROM orders ORDER BY sequence DESC").all().flatMap(row => {
        const input = JSON.parse(String(row.payload)) as OrderInput;
        return input.objectId === objectId ? [{id:`saved-${row.sequence}`, ...(input.document ? {documentUrl:`/api/pds-simulator/orders/${input.pdsReceipt?.number ?? `SIM-SA-${10002 + Number(row.sequence)}`}/document`,documentName:input.document.name} : {}), label:`${input.pdsReceipt?.number ?? `SIM-SA-${10002 + Number(row.sequence)}`} · ${input.problem} · Offen${input.technicianId ? " · Techniker eingeplant" : ""}`}] : [];
      });
    },
  };
}
export function localStore() { return openOrderStore(resolve(".local/pds-simulator/development.sqlite")); }
