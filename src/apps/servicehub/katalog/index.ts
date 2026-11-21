import "server-only";
import { redirect } from "next/navigation";
import { session, permitted } from "@/platform/session";
import { exampleServiceCatalog } from "./example-repository";
import type { ServiceCatalogRepository } from "./model";

// Public module entry point: authorize before reading any catalog data.
export const serviceCatalog: ServiceCatalogRepository = {
  async list() {
    const user = await session();
    if (!permitted(user, "read")) redirect("/anmeldung");
    return exampleServiceCatalog.list();
  },
};
export type { Service, ServiceCatalogRepository } from "./model";
export { ServiceMenu } from "./service-menu";
