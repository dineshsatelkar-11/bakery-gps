-- Finance: UPI + tempo rent basis + salary structure (run once in Supabase SQL editor)
ALTER TABLE fin_drivers
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_payee_name text,
  ADD COLUMN IF NOT EXISTS tempo_rent_basis text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS tempo_daily_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tempo_only boolean DEFAULT false;

COMMENT ON COLUMN fin_drivers.upi_vpa IS 'Driver UPI ID for in-app salary/advance payments';
COMMENT ON COLUMN fin_drivers.upi_payee_name IS 'Name shown on UPI pay screen';
COMMENT ON COLUMN fin_drivers.tempo_rent_basis IS 'monthly | daily — how tempo rent is charged to driver';
COMMENT ON COLUMN fin_drivers.tempo_daily_rate IS 'When tempo_rent_basis=daily, rent per day';
COMMENT ON COLUMN fin_drivers.tempo_only IS 'True if driver has no salary — only tempo rent relationship';
