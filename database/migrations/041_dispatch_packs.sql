CREATE TABLE platform.dispatch_packs (
 scope_key text PRIMARY KEY CHECK(length(scope_key)=64),
 source text NOT NULL,order_id text NOT NULL CHECK(length(order_id) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.dispatch_pack_refs (
 scope_key text NOT NULL REFERENCES platform.dispatch_packs(scope_key),
 ref_key text NOT NULL CHECK(length(ref_key)=64),reference jsonb NOT NULL,
 selected boolean NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 actor_id text NOT NULL REFERENCES platform.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope_key,ref_key)
);
COMMENT ON TABLE platform.dispatch_pack_refs IS 'Shared order document references only. No file bytes, URLs or secrets. Deselection tombstones retain conflict/retry protection.';
