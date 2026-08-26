-- Payment terms (number of days) per shop — from Zoho contact payment_terms
-- Run once in Supabase SQL Editor.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT NULL;

COMMENT ON COLUMN shops.payment_terms_days IS
  'Zoho payment terms in days (0 = Due on Receipt, 15 = Net 15). Used for invoice due_date = doc date + N days.';
