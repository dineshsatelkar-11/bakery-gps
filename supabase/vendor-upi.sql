
-- Vendor UPI on parties (garage, fuel pump, etc.)
ALTER TABLE fin_parties ADD COLUMN IF NOT EXISTS upi_vpa text;
ALTER TABLE fin_parties ADD COLUMN IF NOT EXISTS upi_payee_name text;
