import "server-only";
import type { Service, ServiceCatalogRepository } from "./model";

const examples: readonly Service[] = [
  { id: "00000000-0000-4000-8000-000000000001", slug: "stoerungsaufnahme", href: "/casedesk", name: "CaseDesk", description: "Störungen erfassen, Ansprechpartner zuordnen und Serviceaufträge anlegen.", status: "available" },
  { id: "00000000-0000-4000-8000-000000000002", slug: "ressourcenkalender", href: "/planboard", name: "PlanBoard", description: "Ressourcen planen, Termine verschieben und Einsatzzeiten anpassen.", status: "available" },
  { id: "00000000-0000-4000-8000-000000000003", slug: "bereitschaft", href: "/dutyboard", name: "DutyBoard", description: "Bereitschaften planen, fair verteilen und Tauschwünsche verwalten.", status: "available" },
];

export const exampleServiceCatalog: ServiceCatalogRepository = {
  async list() {
    return examples.map((service) => ({ ...service }));
  },
};
