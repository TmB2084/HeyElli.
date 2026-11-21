import type {Metadata} from "next";
import { Suspense } from "react";
export const metadata:Metadata={title:"ServiceHub | HeyElli"};
import { serviceCatalog } from "@/apps/servicehub/katalog";

import {ServiceWorkspace} from "@/apps/servicehub/akten";

async function ServiceContent() {
  const services = await serviceCatalog.list();
  return <ServiceWorkspace services={services}/>;
}

export default function ServicePage() {
  return (
    <Suspense fallback={<main className="login-page"><p role="status">Sitzung wird geprüft …</p></main>}>
      <ServiceContent />
    </Suspense>
  );
}
