-- ─────────────────────────────────────────────────────────────────
-- BAKED GPS — DB patch for addShop upsert fix
-- Run this ONCE in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Add UNIQUE constraint on shop_id (safe — skips if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_shop_id_unique'
  ) THEN
    ALTER TABLE shops ADD CONSTRAINT shops_shop_id_unique UNIQUE (shop_id);
  END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
