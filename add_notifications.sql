-- ─────────────────────────────────────────────
-- BAKED GPS — Notifications table
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  driver_name TEXT      NOT NULL,
  type        TEXT      NOT NULL,   -- 'new_orders' | 'new_shop' | 'shop_reassigned'
  message     TEXT      NOT NULL,
  date        TEXT      DEFAULT '',
  is_read     BOOLEAN   DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast unread lookup per driver
CREATE INDEX IF NOT EXISTS idx_notif_driver_unread ON notifications (driver_name, is_read);

-- Auto-delete notifications older than 7 days (optional cleanup)
-- You can run this manually or schedule via pg_cron
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '7 days';
