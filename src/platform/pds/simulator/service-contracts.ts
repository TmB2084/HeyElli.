import seed from "../../../../database/seeds/pds-simulator/service-contracts.json" with {type:"json"};
import type {openOrderStore} from "./order-store.ts";
import {contractFilterValues,type ContractFilter} from "../../../apps/planboard/kalender/domain.ts";
type Store=ReturnType<typeof openOrderStore>;
// Internal simulator data. The platform only sees the documented filtered API responses.
function data(store:Store,id:string):Record<string,unknown>{
 const override=store.apiEntity("service-contract:"+id);if(override?.kind==="service-contract")return override.data;
 const fixture=seed[id as keyof typeof seed];if(fixture)return fixture;
 const incident=store.apiEntity(id);if(incident?.kind==="incident")return {...incident.data,mode:incident.data.intervallUUID?"INTERVALL":incident.data.wartungsvertragUUID?"WARTUNGSVORGANG":"KEIN"};
 if(/^legacy-incident-\d+$/.test(id))return {mode:"KEIN"};
 return {};
}
export function simulatorContractMode(store:Store,id:string):ContractFilter|undefined{const mode=data(store,id).mode;return contractFilterValues.includes(mode as ContractFilter)?mode as ContractFilter:undefined;}
export function simulatorContractReferences(store:Store,id:string){const value=data(store,id);return {...(typeof value.intervallUUID==="string"?{intervallUUID:value.intervallUUID}:{}),...(typeof value.wartungsvertragUUID==="string"?{wartungsvertragUUID:value.wartungsvertragUUID}:{})};}
