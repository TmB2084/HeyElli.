ALTER TABLE platform.system_settings ADD COLUMN session_duration_minutes integer NOT NULL DEFAULT 60 CHECK(session_duration_minutes BETWEEN 5 AND 1440);
