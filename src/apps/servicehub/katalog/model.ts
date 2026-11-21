export type Service = {
  id: string;
  slug: string;
  href?: string;
  name: string;
  description: string;
  status: "planned" | "available";
};

export interface ServiceCatalogRepository {
  list(): Promise<readonly Service[]>;
}
