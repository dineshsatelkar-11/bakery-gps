-- Optional columns for multi-device push detail (Notify → Manage)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_type text;

COMMENT ON COLUMN push_subscriptions.user_agent IS 'Browser user agent at registration';
COMMENT ON COLUMN push_subscriptions.device_type IS 'phone | desktop | tablet | unknown';
