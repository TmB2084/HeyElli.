-- Only normalized, authenticated diagnostics; never raw reports/URLs/samples.
CREATE TABLE platform.browser_reports (
 user_id text NOT NULL REFERENCES platform.users(id),
 day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 app text NOT NULL,
 directive text NOT NULL,
 blocked_kind text NOT NULL,
 disposition text NOT NULL,
 occurrences integer NOT NULL DEFAULT 1 CHECK(occurrences BETWEEN 1 AND 1000000),
 first_seen timestamptz NOT NULL DEFAULT now(),
 last_seen timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,day,app,directive,blocked_kind,disposition)
);
CREATE INDEX browser_reports_recent ON platform.browser_reports(last_seen DESC);
CREATE TABLE platform.browser_report_budgets (
 scope text PRIMARY KEY,
 window_start timestamptz NOT NULL DEFAULT now(),
 accepted integer NOT NULL DEFAULT 0
);
