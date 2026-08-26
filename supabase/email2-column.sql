-- Second email from Zoho contact persons
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS email2 text;

COMMENT ON COLUMN shops.email2 IS 'Secondary email (e.g. 2nd Zoho contact person)';
