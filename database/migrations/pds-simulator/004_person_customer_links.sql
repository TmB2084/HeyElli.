CREATE TABLE person_customer_links (
  person_id TEXT NOT NULL,
  customer_number TEXT NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(person_id, customer_number)
);
