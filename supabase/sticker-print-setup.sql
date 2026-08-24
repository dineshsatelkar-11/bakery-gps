-- Sticker print tracking on customer_orders (admin Shop Orders tab)
-- Run once in Supabase SQL editor if columns are missing.

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS sticker_printed boolean DEFAULT false;

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS sticker_printed_at timestamptz;

COMMENT ON COLUMN customer_orders.sticker_printed IS 'Admin marked delivery sticker as printed for this shop order';
COMMENT ON COLUMN customer_orders.sticker_printed_at IS 'When sticker was marked printed';

-- Optional index for “still to print” counts by date
CREATE INDEX IF NOT EXISTS idx_customer_orders_sticker_printed
  ON customer_orders (delivery_date, sticker_printed)
  WHERE status IS DISTINCT FROM 'no_order' AND status IS DISTINCT FROM 'rejected';
