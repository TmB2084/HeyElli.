import {createHash} from 'node:crypto';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readCore,readList,ServiceReadError} from './reader.ts';
import {dispatchId} from './dispatch-reader.ts';
import {validConfirmationEmail,type AppointmentMessage} from './confirmation-model.ts';
const text=(value:unknown)=>typeof value==='string'?value:'';
const instant=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&Number(value.slice(11,13))<24&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10);
const line=(value:string)=>value.replace(/[\x00-\x1f\x7f]+/g,' ').trim();
export async function readAppointmentMessage(api:PdsTransport,orderId:string,incidentId:string,sourceRevision:string):Promise<AppointmentMessage>{
 dispatchId(orderId);dispatchId(incidentId);const core=await readCore(api,'order',orderId),incident=core.file.incidents?.find(row=>row.id===incidentId);
 if(!incident)throw new ServiceReadError('Der Einsatz gehört nicht zu diesem Auftrag.',404);
 const employees=await readList(api,'/mitarbeiter/listmitarbeiter'),employee=employees.find(row=>row.uuid===incident.technicianId),employeeName=employee?[text(employee.vorname),text(employee.nachname)].filter(Boolean).join(' '):'';
 if(!incident.start||!incident.end||!instant(incident.start)||!instant(incident.end)||Date.parse(incident.end)<=Date.parse(incident.start)||!incident.technicianId||!employeeName)throw new ServiceReadError('Für die Terminbestätigung werden ein gültiger Beginn, ein Ende und ein aufgelöster Haupttechniker benötigt.',409);
 const objects:Record<string,unknown>[]=[],seen=new Set<string>();let id=dispatchId(incident.objectId),location='';
 for(let depth=0;id;depth++){if(depth>=8||seen.has(id))throw new ServiceReadError('Die Objektzuordnung ist nicht eindeutig.',409);seen.add(id);const object=await readCore(api,'object',id);objects.push(object.row);if(object.file.address){location=object.file.address;break;}id=object.row.parentUUID?dispatchId(object.row.parentUUID):'';}
 if(!location)throw new ServiceReadError('Die Objektadresse fehlt. Bitte zuerst die Adresse in PDS vervollständigen.',409);
 if(!core.file.customerId)throw new ServiceReadError('Der Kunde ist nicht zugeordnet.',409);
 const customer=await readCore(api,'customer',dispatchId(core.file.customerId));if(Buffer.byteLength(JSON.stringify(customer.row))>1024*1024)throw new ServiceReadError('Kundenkontakte überschreiten das Abfragebudget.',413);
 const recipients:AppointmentMessage['recipients']=[],today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
 function active(value:unknown){if(value===undefined||value===null)return true;if(typeof value!=='object')return false;const dates=value as Record<string,unknown>;for(const key of ['vonDatum','bisDatum'])if(dates[key]!==undefined&&(typeof dates[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(String(dates[key]))||!Number.isFinite(Date.parse(String(dates[key])))||new Date(String(dates[key])).toISOString().slice(0,10)!==dates[key]))return false;return (!dates.vonDatum||String(dates.vonDatum)<=today)&&(!dates.bisDatum||String(dates.bisDatum)>=today);}
 function add(rows:unknown,label:string){if(rows===undefined)return;if(!Array.isArray(rows)||rows.length>100)throw new ServiceReadError('Die Kundenkontakte sind nicht vollständig prüfbar.',413);for(const row of rows){if(row?.typ!=='EMAIL'||row.kategorie!=='GESCHAEFTLICH'||!validConfirmationEmail(row.value)||!active(row.gueltigkeit))continue;const address=row.value.trim();if(!recipients.some(item=>item.address.toLowerCase()===address.toLowerCase()))recipients.push({address,label:line(label)});if(recipients.length>100)throw new ServiceReadError('Zu viele E-Mail-Kontakte.',413);}}
 // PersonDetails uses the spelling ekommunkationswege in the supplied specification.
 add(customer.row.ekommunkationswege,customer.file.name);
 const contacts=customer.row.ansprechpartner;if(contacts!==undefined&&!Array.isArray(contacts))throw new ServiceReadError('Ungültige Ansprechpartnerliste.');if(Array.isArray(contacts)){if(contacts.length>100)throw new ServiceReadError('Zu viele Ansprechpartner.',413);for(const contact of contacts)add(contact?.ekommunikationswege,text(contact?.person?.name));}
 const order=line(core.file.number||'Serviceauftrag'),technician=line(employeeName),object=line(text(objects[0]?.bezeichnung)),address=line(location),format=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'full',timeStyle:'short'}),subject='Terminbestätigung · '+order;
 const body=['Guten Tag,','','hiermit bestätigen wir Ihren Servicetermin:','','Auftrag: '+order,'Objekt: '+object,'Adresse: '+address,'Beginn: '+format.format(new Date(incident.start))+' Uhr','Ende: '+format.format(new Date(incident.end))+' Uhr','Haupttechniker: '+technician,'','Bei Rückfragen oder Änderungswünschen antworten Sie bitte auf diese Nachricht.','','Freundliche Grüße','Ihr Service-Team'].join('\n');
 if(subject.length>200||body.length>4000)throw new ServiceReadError('Die Terminangaben überschreiten das Nachrichtenbudget.',413);
 const fingerprint=createHash('sha256').update(JSON.stringify({sourceRevision,orderId,incidentId,customer:customer.file.name,recipients,subject,body,planningVersion:incident.planningVersion})).digest('hex');
 // Verify that the order did not change while names/contacts were resolved.
 const after=await readCore(api,'order',orderId);if(JSON.stringify(after.row)!==JSON.stringify(core.row))throw new ServiceReadError('Der Auftrag wurde während der Vorbereitung geändert. Bitte die Vorschau erneut laden.',409);
 return {orderId,incidentId,sourceRevision,fingerprint,customer:customer.file.name,location:address,start:incident.start,end:incident.end,technician,recipients,subject,body};
}
