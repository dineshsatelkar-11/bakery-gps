-- Second email for Zoho CC
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS email_cc text;
