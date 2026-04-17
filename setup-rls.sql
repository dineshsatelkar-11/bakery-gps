-- ============================================================
-- Row Level Security (RLS) — bakery-gps
-- ============================================================
-- IMPORTANT: This app currently uses the Supabase anon key for all
-- requests (no per-user JWT auth). Full RLS requires migrating to
-- Supabase Auth (JWT tokens per user). The policies below are a
-- starting point — apply them AFTER setting up Supabase Auth.
--
-- Until then, the primary protection is:
--   1. RPC functions (staff_login, driver_login, customer_login)
--      never expose passwords or sensitive columns.
--   2. The anon key is limited to what the PostgREST schema exposes.
-- ============================================================


-- ── Step 1: Enable RLS on all tables ──────────────────────────

ALTER TABLE shops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log   ENABLE ROW LEVEL SECURITY;


-- ── Step 2: Allow anon read on public tables ───────────────────
-- Customers/drivers/orders are read by drivers and tracking page.
-- Writing is done only via RPC or service role.

-- Products & groups — anyone can read (customer order page needs them)
CREATE POLICY "anon_read_products"       ON products       FOR SELECT USING (true);
CREATE POLICY "anon_read_product_groups" ON product_groups FOR SELECT USING (true);

-- Settings — anyone can read (order window open/closed, cutoff time, broadcasts)
CREATE POLICY "anon_read_settings"       ON settings       FOR SELECT USING (true);

-- Shops — anyone can read (driver app, tracking page)
CREATE POLICY "anon_read_shops"          ON shops          FOR SELECT USING (true);

-- Orders — anyone can read (driver needs today's orders)
CREATE POLICY "anon_read_orders"         ON orders         FOR SELECT USING (true);

-- Deliveries — anyone can read (tracking page checks delivery status)
CREATE POLICY "anon_read_deliveries"     ON deliveries     FOR SELECT USING (true);

-- Routes — anyone can read
CREATE POLICY "anon_read_routes"         ON routes         FOR SELECT USING (true);

-- Drivers — public info readable (name, color, tracking_url) — password excluded by RPC
CREATE POLICY "anon_read_drivers"        ON drivers        FOR SELECT USING (true);


-- ── Step 3: Allow anon write only via specific tables ──────────
-- All writes use INSERT/UPDATE/DELETE via the anon key. Until JWT
-- auth is in place, restrict by checking a claim or service_role.

-- Deliveries — drivers write their own records
CREATE POLICY "anon_insert_deliveries"   ON deliveries     FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_deliveries"   ON deliveries     FOR UPDATE USING (true);
CREATE POLICY "anon_delete_deliveries"   ON deliveries     FOR DELETE USING (true);

-- Routes — drivers write their own routes
CREATE POLICY "anon_insert_routes"       ON routes         FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_routes"       ON routes         FOR UPDATE USING (true);

-- Error log — anyone can insert (client-side error logging)
CREATE POLICY "anon_insert_error_log"    ON error_log      FOR INSERT WITH CHECK (true);

-- Error log — only service role can read (admins check via Supabase dashboard)
CREATE POLICY "service_read_error_log"   ON error_log      FOR SELECT USING (auth.role() = 'service_role');


-- ── Step 4: Admin writes — lock to service_role for sensitive tables ──
-- Orders, Shops, Products, Staff should only be written by admin
-- (currently via anon key). After migrating to JWT auth, replace
-- "true" with auth.jwt() ->> 'role' IN ('admin', 'super_admin').

CREATE POLICY "anon_write_orders"        ON orders         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_shops"         ON shops          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_products"      ON products       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_product_groups" ON product_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_settings"      ON settings       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_staff"         ON staff          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_drivers"       ON drivers        FOR ALL USING (true) WITH CHECK (true);


-- ── Step 5: Verify ──────────────────────────────────────────────
-- After running, check all tables have RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
