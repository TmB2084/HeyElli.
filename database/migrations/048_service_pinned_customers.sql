-- Persönlich angeheftete Kunden in Service (Seitenleiste „Angeheftet“), je Benutzer und Datenquelle.
-- Enthält nur Benutzerreferenz, Datenquellenbereich und PDS-Kundenkennung; keine Fachdaten.
CREATE TABLE platform.service_pinned_customers (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (length(source) BETWEEN 1 AND 200),
 customer_id text NOT NULL CHECK (length(customer_id) BETWEEN 1 AND 200),
 pinned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,source,customer_id)
);
