-- ============================================================
-- Error Log Table — bakery-gps
-- Run once in Supabase SQL editor to enable client-side error logging.
-- ============================================================

CREATE TABLE IF NOT EXISTS error_log (
  id          BIGSERIAL PRIMARY KEY,
  page        TEXT,
  action      TEXT,
  message     TEXT,
  stack       TEXT,
  user_role   TEXT,
  user_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Keep only last 30 days of logs automatically (optional)
-- You can set up a pg_cron job or delete manually.

-- View recent errors (most recent first):
-- SELECT id, page, action, message, user_role, user_name, created_at
-- FROM error_log ORDER BY created_at DESC LIMIT 100;

-- Drop old errors manually:
-- DELETE FROM error_log WHERE created_at < NOW() - INTERVAL '30 days';
