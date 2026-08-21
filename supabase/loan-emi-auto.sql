
-- Optional columns for EMI auto-debit + outstanding tracking
ALTER TABLE loans ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS outstanding_principal numeric;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS emis_remaining integer;
