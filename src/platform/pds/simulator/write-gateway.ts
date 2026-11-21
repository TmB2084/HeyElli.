import type {StandardPosition} from "../../../apps/casedesk/standardpositionen/model.ts";
import {createHash} from "node:crypto";
import {createContact,createService,serviceWorkflow,assignBearbeiter,type PdsActor} from "../api/index.ts";
import {objects} from "./fixtures.ts";
import {SimulatedWriteApi} from "./write-api.ts";
import {InvalidOrder,berlinInstant,type openOrderStore,type OrderInput} from "./order-store.ts";
type Store=ReturnType<typeof openOrderStore>;
export async function createSimulatorContact(store:Store,raw:Record<string,unknown>,user:string) {
  const source=objects.find(object=>object.id===raw.objectId);
  const customer=raw.customerNumber || source?.customerNumber;
  const {name,landline,mobile}=raw,job=raw.function;
  if(!source||!objects.some(object=>object.customerNumber===customer)||typeof name!=="string"||!name.trim()||name.trim().length>160||typeof job!=="string"||!job.trim()||job.trim().length>100||typeof landline!=="string"||typeof mobile!=="string"||(!landline.trim()&&!mobile.trim())||[landline,mobile].some(value=>value && !/^[+0-9() /.-]{3,50}$/.test(value.trim())))throw new InvalidOrder("Bitte gültigen Kunden, Name, Funktion und Telefonnummer angeben.");
  const input={name:name.trim(),functionName:job.trim(),landline:landline.trim(),mobile:mobile.trim(),customerUUID:String(customer)};
  const workflow=user+':person:'+createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const uuid=await createContact(new SimulatedWriteApi(store,workflow),input,"simulator-dual");
  const person=store.allPersons().find(person=>person.id===uuid);if(!person)throw Error("Personenanlage unvollständig.");return person;
}
export async function createSimulatorOrder(store:Store,input:OrderInput,key:string,user:PdsActor & {id:string},defaults:StandardPosition[]=[]) {
  const {bearbeiterUUID}=assignBearbeiter({},user);
  const customer=objects.find(object=>object.id===input.objectId)!.customerNumber;
  const workflow=user.id+':order:'+key;
  store.apiStep(workflow,'order-input',input,()=>true);
  const completed=store.savedOrder(key,user.id);if(completed)return completed;
  const positions=store.apiStep(workflow,'standard-positions',{},()=>defaults) as StandardPosition[];
  const api=new SimulatedWriteApi(store,workflow);
  const document=input.document ? {name:input.document.name,bytes:store.uploadBytes(input.document.uploadId!,user.id),typeUUID:"sim-document-general"} : undefined;
  const args={positions,mobileIssue:input.mobileIssue,customerUUID:customer,objectUUID:input.unitId||input.objectId,description:input.reportSummary,externalNumber:input.externalOrderNumber,reportedAt:input.reportedAt,technicianId:input.technicianId,companions:input.companionTechnicianIds,start:input.appointment?berlinInstant(input.appointment):undefined,end:input.appointment?new Date(Date.parse(berlinInstant(input.appointment))+Number(input.appointmentDuration||60)*60000).toISOString():undefined};
  const receipt=await createService(api,args,"SIM-Serviceauftrag",user,document);
  return store.save({...input,bearbeiterUUID,pdsApiCalls:serviceWorkflow(args,"SIM-Serviceauftrag",user),pdsReceipt:receipt},key,user.id);
}
