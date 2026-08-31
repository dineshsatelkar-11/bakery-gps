-- Cache Zoho contact_person_id so invoice/challan create can skip live get_contact
-- Run once in Supabase → SQL Editor

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS zoho_person_id text;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS zoho_person_id2 text;

COMMENT ON COLUMN shops.zoho_person_id IS 'Zoho contact_person_id for primary email (Email Communications To)';
COMMENT ON COLUMN shops.zoho_person_id2 IS 'Zoho contact_person_id for email2 / Head Office (CC)';
