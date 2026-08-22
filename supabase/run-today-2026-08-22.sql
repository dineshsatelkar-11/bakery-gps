-- =============================================================================
-- IBCAB / bakery-gps — SQL to run for features shipped 2026-08-22
-- Run once in Supabase → SQL Editor → New query → Run
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- 1) Sticker print tracking (admin Orders → Print sticker / Mark printed)
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS sticker_printed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sticker_printed_at timestamptz;

-- 2) Second customer email for Zoho CC (sync + customer form)
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS email_cc text;

-- 3) Customer payment request screenshot + UTR
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_proof_file_id text,
  ADD COLUMN IF NOT EXISTS payment_proof_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_ref text;

-- Done. No other tables required for today's admin mark-delivered (uses existing deliveries).
