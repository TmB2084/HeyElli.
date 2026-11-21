export const contractServiceLabels={MIT:"Störung mit Vertragsleistung",OHNE:"Störung ohne Vertragsleistung",UNBEKANNT:"Vertragsleistung nicht eindeutig zugeordnet"};
export type ContractService=keyof typeof contractServiceLabels;
export const contractFilterValues=["KEIN","INTERVALL","WARTUNGSVORGANG"] as const;
export type ContractFilter=typeof contractFilterValues[number];
export const contractDefaultColors={MIT:"#99ccff",OHNE:"#ccffcc"};
export function contractMembership(filters:ReadonlySet<ContractFilter>):ContractService{
 const yes=filters.has("INTERVALL")||filters.has("WARTUNGSVORGANG"),no=filters.has("KEIN");
 return yes&&!no?"MIT":no&&!yes?"OHNE":"UNBEKANNT";
}
export function incidentKey(serviceId:string,incidentId:string){return JSON.stringify([serviceId,incidentId]);}
