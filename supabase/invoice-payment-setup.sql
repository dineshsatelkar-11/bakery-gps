-- Phase A: Customer invoice / payment fields on customer_orders
-- Run once in Supabase SQL editor.

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS invoice_total numeric,
  ADD COLUMN IF NOT EXISTS balance_due numeric,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS payment_ref text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by text,
  ADD COLUMN IF NOT EXISTS customer_claimed_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_claim_note text,
  ADD COLUMN IF NOT EXISTS zoho_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamptz;

COMMENT ON COLUMN customer_orders.payment_status IS 'unpaid | partial | paid | stale';
COMMENT ON COLUMN customer_orders.balance_due IS 'Remaining amount; 0 when paid';
COMMENT ON COLUMN customer_orders.customer_claimed_paid IS 'Shop tapped I have paid; admin must still verify';
