-- ================================================================
-- CUSTOMER ORDERING SYSTEM — Supabase SQL Setup
-- Run these statements in Supabase → SQL Editor
-- ================================================================

-- 1. Product Groups table
CREATE TABLE IF NOT EXISTS product_groups (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anon key to read/write (same pattern as other tables)
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON product_groups FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 2. Add group_id and active columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES product_groups(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Add customer portal login fields to shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS login_username TEXT UNIQUE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS login_password TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS product_group_id BIGINT REFERENCES product_groups(id) ON DELETE SET NULL;

-- 4. Customer Orders table (tracks the full pipeline)
CREATE TABLE IF NOT EXISTS customer_orders (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         TEXT NOT NULL,
  shop_name       TEXT NOT NULL,
  delivery_date   DATE NOT NULL,
  items           TEXT NOT NULL,   -- comma-separated product names
  qty             TEXT NOT NULL,   -- comma-separated quantities
  note            TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  -- status flow: pending → approved | rejected
  --              approved → kitchen
  --              kitchen → packaging
  --              packaging → dispatched
  admin_note      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  kitchen_done_at TIMESTAMPTZ,
  packaged_at     TIMESTAMPTZ
);

ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON customer_orders FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 5. RPC function: customer_login
--    Returns shop info if credentials match; password never sent to browser.
CREATE OR REPLACE FUNCTION customer_login(p_username TEXT, p_password TEXT)
RETURNS TABLE(
  shop_id         TEXT,
  shop_name       TEXT,
  mobile          TEXT,
  product_group_id BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.shop_id,
    s.name          AS shop_name,
    s.mobile,
    s.product_group_id
  FROM shops s
  WHERE s.login_username = p_username
    AND s.login_password = p_password
  LIMIT 1;
END;
$$;

-- ================================================================
-- DONE. After running:
--   • Go to admin → Products tab → assign Group to each product
--   • Go to admin → Customers tab → set Login Username, Password, Group
--   • Customers can then login at /order (order.html)
-- ================================================================
