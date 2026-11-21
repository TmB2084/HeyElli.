import { employees, objects, orders, units, persons } from "./fixtures.ts";
import type { LookupResult, PdsReadSource, SearchRequest } from "./model";

export class InvalidSearch extends Error {}
export function parseSearch(params: URLSearchParams): SearchRequest {
  const resource = params.get("resource");
  if (resource !== "objects" && resource !== "units" && resource !== "employees" && resource !== "siteManagers" && resource !== "orders" && resource !== "persons" && resource !== "customers" && resource !== "functions") throw new InvalidSearch("Unbekannte Datenart.");
  const query = (params.get("q") ?? "").trim();
  if (query.length > 100) throw new InvalidSearch("Suchbegriff darf höchstens 100 Zeichen enthalten.");
  const objectId = params.get("objectId") || undefined;
  if ((resource === "units" || resource === "orders" || resource === "persons") && !objectId) throw new InvalidSearch("Objektzuordnung erforderlich.");
  if (objectId && !objects.some(object => object.id === objectId)) throw new InvalidSearch("Unbekanntes Simulationsobjekt.");
  const integer = (name: string, fallback: number, max: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) throw new InvalidSearch("Ungültige Seitenauswahl.");
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value > max || (name === "limit" && value === 0)) throw new InvalidSearch("Ungültige Seitenauswahl.");
    return value;
  };
  return { resource, query, objectId, offset: integer("offset", 0, 10000), limit: integer("limit", 20, 50) };
}
const normalize = (value: string) => value.toLocaleLowerCase("de").normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("ß", "ss");
export const simulatedPds: PdsReadSource = {
  search({ resource, query, objectId, offset, limit }) {
    let rows: LookupResult[];
    switch (resource) {
      case "objects": rows = objects.map(object => ({ id: object.id, label: `${object.number} · ${object.name} · ${object.street} · ${object.postalCode} ${object.city} · ${object.customerNumber}`, customerNumber:object.customerNumber,address: `${object.street}, ${object.postalCode} ${object.city} · ${object.name}` })); break;
      case "units": rows = units.filter(unit => unit.objectId === objectId).map(unit => ({ id: unit.id, label: `${unit.number} · ${unit.name} · ${unit.location} · ${unit.trade} · ${unit.manufacturer} ${unit.type}` })); break;
      case "employees": rows = employees.filter(employee => employee.plannable).map(employee => ({ id: employee.id, label: `${employee.personnelNumber} · ${employee.firstName} ${employee.lastName} · ${employee.specialty} · ${employee.department}` })); break;
      case "siteManagers": rows = employees.filter(employee => employee.siteManager).map(employee => ({id:employee.id,label:`${employee.personnelNumber} · ${employee.firstName} ${employee.lastName} · Bauleiter · ${employee.department}`})); break;
      case "functions":rows=[...new Set(persons.map(person=>person.function))].map(name=>({id:name,label:name}));break;
      case "customers": rows = [...new Set(objects.map(object=>object.customerNumber))].filter(number=>!objectId || number===objects.find(object=>object.id===objectId)?.customerNumber).map(number=>({id:number,label:`${number} · ${objects.filter(object=>object.customerNumber===number).map(object=>object.name).join(", ")}`})); break;
      case "persons": {
        const customer = objects.find(object => object.id === objectId)?.customerNumber;
        rows = persons.filter(person => person.customerNumber === customer).map(person => ({id:person.id,label:`${person.name} · ${person.function} · ${person.customerNumber}`,function:person.function,phones:person.phones})); break;
      }
      case "orders": rows = orders.filter(order => order.objectId === objectId).map(order => ({ id: order.id, label: `${order.number} · ${order.description} · ${order.status}` })); break;
    }
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matches = rows.filter(row => terms.every(term => normalize(row.label).includes(term))).sort((a, b) => a.label.localeCompare(b.label, "de"));
    return { items: matches.slice(offset, offset + limit), total: matches.length };
  },
};
