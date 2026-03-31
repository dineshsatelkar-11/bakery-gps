-- Add assigned_driver_id FK column to shops table
-- Run this in Supabase SQL Editor

ALTER TABLE shops ADD COLUMN IF NOT EXISTS assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL;

-- Populate assigned_driver_id for existing rows by matching driver name
UPDATE shops s
SET assigned_driver_id = d.id
FROM drivers d
WHERE d.name = s.assigned_driver
  AND s.assigned_driver IS NOT NULL
  AND s.assigned_driver != '';

-- Index for fast per-driver queries
CREATE INDEX IF NOT EXISTS idx_shops_driver_id ON shops(assigned_driver_id);

-- Tell PostgREST to reload its schema cache (picks up new FK for embedded joins)
NOTIFY pgrst, 'reload schema';
