-- Indexes to reduce Disk IO on hot customer_orders / orders polls
-- Run once in Supabase SQL Editor (safe: IF NOT EXISTS)

-- Pending order polls (admin every 20s when Open Orders is ON)
CREATE INDEX IF NOT EXISTS idx_customer_orders_status_created
  ON customer_orders (status, created_at DESC);

-- Payment-request polls (admin when Payment poll enabled)
CREATE INDEX IF NOT EXISTS idx_customer_orders_claimed_payment
  ON customer_orders (customer_claimed_paid, payment_status)
  WHERE customer_claimed_paid IS TRUE;

-- Customer app: orders by shop + delivery date
CREATE INDEX IF NOT EXISTS idx_customer_orders_shop_delivery
  ON customer_orders (shop_id, delivery_date);

-- Delivery date lookups (notify list, packaging, etc.)
CREATE INDEX IF NOT EXISTS idx_customer_orders_delivery_date
  ON customer_orders (delivery_date);

-- Driver / admin orders by date + driver
CREATE INDEX IF NOT EXISTS idx_orders_date_driver
  ON orders (date, driver);

-- Early-approve sync by dc_num
CREATE INDEX IF NOT EXISTS idx_orders_dc_num
  ON orders (dc_num);

-- Push subscriptions lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_shop
  ON push_subscriptions (shop_id);

-- Optional: check index usage after a day
-- SELECT * FROM pg_stat_user_indexes WHERE relname IN ('customer_orders','orders') ORDER BY idx_scan;
