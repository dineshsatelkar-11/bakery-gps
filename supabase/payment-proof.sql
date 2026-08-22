-- Payment request screenshot + UTR on customer_orders
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_proof_file_id text,
  ADD COLUMN IF NOT EXISTS payment_proof_at timestamptz;
-- payment_ref may already exist from invoice payment setup
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS payment_ref text;
