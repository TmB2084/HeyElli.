ALTER TABLE platform.duty_resource_preferences
 ADD COLUMN holiday_settings jsonb CHECK (holiday_settings IS NULL OR jsonb_typeof(holiday_settings) = 'object'),
 ADD COLUMN holiday_version integer NOT NULL DEFAULT 0 CHECK (holiday_version >= 0);
