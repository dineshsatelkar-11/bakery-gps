-- =============================================================================
-- RESET PAYMENTS / INVOICES / CHALLANS IN APP DB  (for testing)
-- Supabase → SQL Editor → Run
-- Result: no invoice/challan links, no paid amounts, all balance treated as 0
-- Does NOT touch Zoho online books — only our database.
-- =============================================================================

BEGIN;

-- Clear known payment / invoice columns (skip any that do not exist)
DO $$
DECLARE
  cols text[] := ARRAY[
    'zoho_invoice_id',
    'zoho_invoice_number',
    'zoho_invoice_status',
    'zoho_payment_id',
    'invoice_total',
    'invoice_subtotal',
    'tax_amount',
    'tax_cgst',
    'tax_sgst',
    'tax_igst',
    'shipping_amount',
    'balance_due',
    'payment_status',
    'paid_amount',
    'payment_mode',
    'payment_ref',
    'paid_at',
    'paid_by',
    'customer_claimed_at',
    'customer_claim_note',
    'payment_reminder_sent_at',
    'payment_proof_url',
    'payment_proof_file_id'
  ];
  c text;
  sql text := 'UPDATE customer_orders SET ';
  parts text[] := ARRAY[]::text[];
BEGIN
  FOREACH c IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_orders' AND column_name = c
    ) THEN
      parts := array_append(parts, format('%I = NULL', c));
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_orders' AND column_name = 'customer_claimed_paid'
  ) THEN
    parts := array_append(parts, 'customer_claimed_paid = false');
  END IF;

  IF array_length(parts, 1) IS NULL THEN
    RAISE NOTICE 'No payment columns found on customer_orders';
  ELSE
    sql := sql || array_to_string(parts, ', ');
    EXECUTE sql;
    RAISE NOTICE 'customer_orders payment/invoice fields cleared';
  END IF;
END $$;

-- Finance cash/bank payment rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_payments'
  ) THEN
    DELETE FROM customer_payments;
    RAISE NOTICE 'customer_payments emptied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_requests'
  ) THEN
    DELETE FROM payment_requests;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_payments'
  ) THEN
    DELETE FROM invoice_payments;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_attachments'
  ) THEN
    DELETE FROM payment_attachments;
  END IF;
END $$;

COMMIT;

-- Verify
SELECT
  count(*) AS total_orders,
  count(*) FILTER (WHERE payment_status IS NOT NULL) AS still_have_payment_status,
  count(*) FILTER (WHERE zoho_invoice_number IS NOT NULL) AS still_have_invoice_no,
  count(*) FILTER (WHERE coalesce(balance_due, 0) <> 0) AS still_have_balance
FROM customer_orders;
