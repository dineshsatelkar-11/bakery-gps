-- Sticker print tracking
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS sticker_printed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sticker_printed_at timestamptz;
