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
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS zoho_invoice_status text;

COMMENT ON COLUMN customer_orders.payment_status IS 'unpaid | partial | paid | stale';
COMMENT ON COLUMN customer_orders.zoho_invoice_status IS 'Zoho status: draft | sent | overdue | paid | void | partially_paid | viewed | …';
COMMENT ON COLUMN customer_orders.balance_due IS 'Remaining amount; 0 when paid';
COMMENT ON COLUMN customer_orders.customer_claimed_paid IS 'Shop tapped I have paid; admin must still verify';


-- GST calculation fields (preview + customer due)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tax_percent numeric DEFAULT NULL;

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS invoice_subtotal numeric,
  ADD COLUMN IF NOT EXISTS tax_amount numeric,
  ADD COLUMN IF NOT EXISTS tax_cgst numeric,
  ADD COLUMN IF NOT EXISTS tax_sgst numeric,
  ADD COLUMN IF NOT EXISTS tax_igst numeric,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric;

COMMENT ON COLUMN products.tax_percent IS 'GST rate % e.g. 5, 12, 18 — used for app preview and customer total';
COMMENT ON COLUMN customer_orders.invoice_subtotal IS 'Sum of line amounts before tax';
COMMENT ON COLUMN customer_orders.tax_amount IS 'Total GST (cgst+sgst+igst)';
