CREATE TABLE platform.duty_plans (
 id uuid PRIMARY KEY,
 actor_id text NOT NULL,
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2100),
 category_id text NOT NULL,
 payload jsonb NOT NULL,
 cursor integer NOT NULL DEFAULT 0,
 complete boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX duty_plan_active_year_idx ON platform.duty_plans(year) WHERE NOT complete;
