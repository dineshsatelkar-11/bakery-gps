-- Optional columns for multi-device push detail (Notify → Manage)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_type text;

COMMENT ON COLUMN push_subscriptions.user_agent IS 'Browser user agent at registration';
COMMENT ON COLUMN push_subscriptions.device_type IS 'phone | desktop | tablet | unknown';

-- Soft-disable flag: Disable in admin keeps the device row
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

COMMENT ON COLUMN push_subscriptions.enabled IS 'false = admin disabled; row kept, no push until re-enabled';
UPDATE push_subscriptions SET enabled = true WHERE enabled IS NULL;
