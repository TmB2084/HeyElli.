CREATE INDEX login_limits_window_start ON platform.login_limits(window_start);
DELETE FROM platform.login_limits WHERE scope='login';
COMMENT ON TABLE platform.login_limits IS 'Fixed 15-minute login budgets: source/account pair, optional trusted source, generous global guard. Keys contain hashes rather than raw usernames/IPs. Blocked local attempts do not consume the global guard.';
