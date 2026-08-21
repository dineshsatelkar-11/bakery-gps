-- Optional columns for Masters / opening balances (run once in Supabase SQL)

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'bank';

ALTER TABLE fin_parties
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;

-- Driver opening advance uses existing driver_advances (type = balance_adj_debit)
-- No schema change required for that path.
