CREATE TABLE platform.duty_employee_links (
 user_id text PRIMARY KEY REFERENCES platform.users(id) ON DELETE CASCADE,
 resource_id text NOT NULL UNIQUE CHECK(length(resource_id) BETWEEN 1 AND 200),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.duty_exclusions (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES platform.users(id),
 resource_id text NOT NULL,
 week_day date NOT NULL CHECK(extract(isodow FROM week_day)=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(resource_id,week_day)
);
CREATE TABLE platform.duty_swaps (
 id uuid PRIMARY KEY,
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2100),
 requester_id text NOT NULL REFERENCES platform.users(id),
 partner_id text NOT NULL REFERENCES platform.users(id),
 first_event jsonb NOT NULL,
 second_event jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','executing','complete','rejected','cancelled')),
 version integer NOT NULL DEFAULT 1,
 progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 2),
 partner_agreed_at timestamptz,
 approved_by text REFERENCES platform.users(id),
 approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK(requester_id<>partner_id)
);
CREATE UNIQUE INDEX duty_swap_executing_year ON platform.duty_swaps(year) WHERE status='executing';
CREATE TABLE platform.duty_wish_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 target_id text NOT NULL,
 actor_id text NOT NULL REFERENCES platform.users(id),
 action text NOT NULL,
 at timestamptz NOT NULL DEFAULT now()
);
