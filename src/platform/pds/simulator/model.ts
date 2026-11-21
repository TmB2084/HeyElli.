export type PdsObject = {
  id: string; number: string; name: string; customerNumber: string;
  street: string; postalCode: string; city: string;
};
export type PdsUnit = {
  id: string; objectId: string; number: string; name: string;
  trade: string; manufacturer: string; type: string; location: string;
};
export type PdsEmployee = {
  id: string; personnelNumber: string; firstName: string; lastName: string;
  department: string; specialty: string; plannable: boolean; siteManager: boolean;
};
export type PdsServiceOrder = {
  id: string; number: string; objectId: string; unitId: string;
  description: string; status: "Offen" | "Ausgegeben" | "Teilerledigt";
  technicianId: string | null; plannedFrom: string | null;
  externalNumber: string | null;
};
export type SearchResource = "objects" | "units" | "employees" | "siteManagers" | "persons" | "customers" | "functions" | "orders";
export type LookupResult = { id: string; label: string; address?: string;name?:string;customerNumber?:string;customerNumbers?:string[]; function?:string; documentUrl?:string; documentName?:string; phones?: {label:string; number:string}[] };
export type SearchRequest = {
  resource: SearchResource; query: string; objectId?: string; offset: number; limit: number;
};
export interface PdsReadSource {
  search(request: SearchRequest): { items: LookupResult[]; total: number };
}
