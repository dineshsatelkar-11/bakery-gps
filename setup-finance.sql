-- ================================================================
-- SATELKAR LOGISTICS — Finance App SQL Setup
-- Run in Supabase → SQL Editor (safe to re-run)
-- ================================================================

-- Drop policies first so re-runs don't fail (skips tables that don't exist yet)
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tempos','driver_salary','driver_advances','driver_leaves',
    'tempo_rent_in','tempo_rent_out','tempo_service','fin_expenses',
    'bank_accounts','bank_transactions','loans','loan_charges','loan_emis',
    'customer_payments','customer_bills','fin_drivers','driver_tempo_rent','driver_tempo_advance','fin_parties'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS anon_all ON %I', t);
    END IF;
  END LOOP;
END $$;

-- 1. Tempos (vehicles)
CREATE TABLE IF NOT EXISTS tempos (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT '',
  owner_name  TEXT DEFAULT '',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tempos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON tempos FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 2. Driver Salary (monthly)
CREATE TABLE IF NOT EXISTS driver_salary (
  id               BIGSERIAL PRIMARY KEY,
  driver_name      TEXT NOT NULL,
  month            TEXT NOT NULL,
  base_salary      NUMERIC DEFAULT 0,
  advance_given    NUMERIC DEFAULT 0,
  advance_deducted NUMERIC DEFAULT 0,
  leave_days       INTEGER DEFAULT 0,
  leave_deduction  NUMERIC DEFAULT 0,
  bonus            NUMERIC DEFAULT 0,
  net_paid         NUMERIC DEFAULT 0,
  paid_date        DATE,
  note             TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_name, month)
);
ALTER TABLE driver_salary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON driver_salary FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 3. Driver Advances & Deductions
CREATE TABLE IF NOT EXISTS driver_advances (
  id          BIGSERIAL PRIMARY KEY,
  driver_name TEXT NOT NULL,
  date        DATE NOT NULL,
  amount      NUMERIC NOT NULL,
  type        TEXT DEFAULT 'advance',  -- 'advance' | 'deduction'
  reason      TEXT DEFAULT '',
  recovered   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON driver_advances FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 4. Driver Leaves
CREATE TABLE IF NOT EXISTS driver_leaves (
  id                BIGSERIAL PRIMARY KEY,
  driver_name       TEXT NOT NULL,
  date              DATE NOT NULL,
  type              TEXT DEFAULT 'unpaid',
  substitute_driver TEXT DEFAULT '',
  substitute_cost   NUMERIC DEFAULT 0,
  note              TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON driver_leaves FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 5. Tempo Rent IN (you rent tempo from owner)
CREATE TABLE IF NOT EXISTS tempo_rent_in (
  id               BIGSERIAL PRIMARY KEY,
  tempo_id         BIGINT REFERENCES tempos(id) ON DELETE CASCADE,
  tempo_name       TEXT NOT NULL,
  month            TEXT NOT NULL,
  agreed_rent      NUMERIC DEFAULT 0,
  breakdown_days   INTEGER DEFAULT 0,
  breakdown_deduct NUMERIC DEFAULT 0,
  final_rent       NUMERIC DEFAULT 0,
  paid             BOOLEAN DEFAULT FALSE,
  note             TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tempo_id, month)
);
ALTER TABLE tempo_rent_in ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON tempo_rent_in FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 6. Tempo Rent OUT (you rent tempo to customer)
CREATE TABLE IF NOT EXISTS tempo_rent_out (
  id               BIGSERIAL PRIMARY KEY,
  tempo_id         BIGINT REFERENCES tempos(id) ON DELETE CASCADE,
  tempo_name       TEXT NOT NULL,
  customer_name    TEXT NOT NULL,
  customer_mobile  TEXT DEFAULT '',
  month            TEXT NOT NULL,
  agreed_rent      NUMERIC DEFAULT 0,
  breakdown_days   INTEGER DEFAULT 0,
  breakdown_deduct NUMERIC DEFAULT 0,
  final_rent       NUMERIC DEFAULT 0,
  received         NUMERIC DEFAULT 0,
  balance          NUMERIC DEFAULT 0,
  note             TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tempo_rent_out ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON tempo_rent_out FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 7. Tempo Service History
CREATE TABLE IF NOT EXISTS tempo_service (
  id              BIGSERIAL PRIMARY KEY,
  tempo_id        BIGINT REFERENCES tempos(id) ON DELETE CASCADE,
  tempo_name      TEXT NOT NULL,
  service_date    DATE NOT NULL,
  km_at_service   INTEGER DEFAULT 0,
  next_service_km INTEGER DEFAULT 0,
  service_type    TEXT DEFAULT '',
  cost            NUMERIC DEFAULT 0,
  workshop        TEXT DEFAULT '',
  note            TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tempo_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON tempo_service FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 8. Expenses
CREATE TABLE IF NOT EXISTS fin_expenses (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  category    TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  tempo_name  TEXT DEFAULT '',
  driver_name TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fin_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON fin_expenses FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 9. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  account_no      TEXT DEFAULT '',
  ifsc            TEXT DEFAULT '',
  opening_balance NUMERIC DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE,
  note            TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON bank_accounts FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 10. Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id            BIGSERIAL PRIMARY KEY,
  account_name  TEXT NOT NULL DEFAULT '',
  date          DATE NOT NULL,
  type          TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  description   TEXT DEFAULT '',
  reference     TEXT DEFAULT '',
  balance_after NUMERIC,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON bank_transactions FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 11. Loans
CREATE TABLE IF NOT EXISTS loans (
  id             BIGSERIAL PRIMARY KEY,
  lender_name    TEXT NOT NULL,
  purpose        TEXT DEFAULT '',
  principal      NUMERIC NOT NULL,
  interest_rate  NUMERIC DEFAULT 0,
  emi_amount     NUMERIC NOT NULL,
  total_emis     INTEGER NOT NULL,
  start_date     DATE NOT NULL,
  down_payment   NUMERIC DEFAULT 0,   -- amount paid before loan
  vehicle_cost   NUMERIC DEFAULT 0,   -- total vehicle/asset cost
  active         BOOLEAN DEFAULT TRUE,
  note           TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 11a. Loan Extra Charges (registration, insurance, processing, etc.)
CREATE TABLE IF NOT EXISTS loan_charges (
  id          BIGSERIAL PRIMARY KEY,
  loan_id     BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  description TEXT NOT NULL,   -- 'Registration', 'Insurance', 'Processing Fee', etc.
  amount      NUMERIC NOT NULL,
  paid_by     TEXT DEFAULT '', -- 'Cash' | 'Warna Sahkari Bank' | etc.
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON loans FOR ALL USING (TRUE) WITH CHECK (TRUE);
ALTER TABLE loan_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON loan_charges FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 12. Loan EMIs
CREATE TABLE IF NOT EXISTS loan_emis (
  id         BIGSERIAL PRIMARY KEY,
  loan_id    BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  due_date   DATE NOT NULL,
  amount     NUMERIC NOT NULL,
  paid_date  DATE,
  status     TEXT DEFAULT 'pending',
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE loan_emis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON loan_emis FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 13. Customer Payments (receivables)
CREATE TABLE IF NOT EXISTS customer_payments (
  id            BIGSERIAL PRIMARY KEY,
  shop_id       TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  date          DATE NOT NULL,
  amount        NUMERIC NOT NULL,
  mode          TEXT DEFAULT 'cash',
  reference     TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON customer_payments FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 14. Drivers master list
CREATE TABLE IF NOT EXISTS fin_drivers (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  mobile       TEXT DEFAULT '',
  base_salary  NUMERIC DEFAULT 0,
  has_tempo    BOOLEAN DEFAULT FALSE,
  tempo_name   TEXT DEFAULT '',
  tempo_rent   NUMERIC DEFAULT 0,   -- current monthly rate (updates when rate changes)
  active       BOOLEAN DEFAULT TRUE,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 14a. Driver monthly tempo rent log (one row per driver per month)
-- rate is snapshotted here so historical salary is not affected by future rate changes
CREATE TABLE IF NOT EXISTS driver_tempo_rent (
  id             BIGSERIAL PRIMARY KEY,
  driver_name    TEXT NOT NULL,
  tempo_name     TEXT NOT NULL,
  month          TEXT NOT NULL,          -- 'YYYY-MM'
  days_in_month  INTEGER NOT NULL,
  days_used      INTEGER NOT NULL,       -- actual days tempo was used
  rate_per_month NUMERIC NOT NULL,       -- agreed rate for full month
  rent_amount    NUMERIC NOT NULL,       -- prorated: rate * days_used / days_in_month
  note           TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_name, month)
);
ALTER TABLE driver_tempo_rent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON driver_tempo_rent FOR ALL USING (TRUE) WITH CHECK (TRUE);
ALTER TABLE fin_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON fin_drivers FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 15a. Customer Bills (invoices raised to clients)
CREATE TABLE IF NOT EXISTS customer_bills (
  id            BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  date          DATE NOT NULL,
  amount        NUMERIC NOT NULL,
  description   TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customer_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON customer_bills FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 16. Driver Tempo Advance Rent Payments (driver pays rent day/week/lump sum)
CREATE TABLE IF NOT EXISTS driver_tempo_advance (
  id           BIGSERIAL PRIMARY KEY,
  driver_name  TEXT NOT NULL,
  tempo_name   TEXT NOT NULL DEFAULT '',
  date         DATE NOT NULL,
  amount       NUMERIC NOT NULL,
  period       TEXT DEFAULT 'daily',   -- 'daily' | 'weekly' | 'monthly' | 'advance'
  days_covered INTEGER DEFAULT 0,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_tempo_advance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON driver_tempo_advance FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 15. Parties master list (for Ledger tab)
CREATE TABLE IF NOT EXISTS fin_parties (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, type)
);
ALTER TABLE fin_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON fin_parties FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ================================================================
-- Safe migrations
-- ================================================================
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL DEFAULT '';
ALTER TABLE driver_advances   ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'advance';
ALTER TABLE driver_advances   ADD COLUMN IF NOT EXISTS bank_account TEXT DEFAULT '';
ALTER TABLE driver_salary     ADD COLUMN IF NOT EXISTS actual_paid NUMERIC DEFAULT NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS down_payment  NUMERIC DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS vehicle_cost  NUMERIC DEFAULT 0;
ALTER TABLE fin_drivers ADD COLUMN IF NOT EXISTS has_tempo   BOOLEAN DEFAULT FALSE;
ALTER TABLE fin_drivers ADD COLUMN IF NOT EXISTS tempo_name  TEXT DEFAULT '';
ALTER TABLE fin_drivers ADD COLUMN IF NOT EXISTS tempo_rent  NUMERIC DEFAULT 0;
ALTER TABLE fin_drivers ADD COLUMN IF NOT EXISTS is_parttime BOOLEAN DEFAULT FALSE;
ALTER TABLE fin_drivers ADD COLUMN IF NOT EXISTS daily_rate  NUMERIC DEFAULT 0;
ALTER TABLE driver_salary ADD COLUMN IF NOT EXISTS other_deduction NUMERIC DEFAULT 0;
ALTER TABLE driver_salary ADD COLUMN IF NOT EXISTS substitute_cost NUMERIC DEFAULT 0;
ALTER TABLE driver_leaves ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;

-- ================================================================
-- Indexes for fast queries
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_driver_salary_month    ON driver_salary(month);
CREATE INDEX IF NOT EXISTS idx_driver_leaves_driver   ON driver_leaves(driver_name, date);
CREATE INDEX IF NOT EXISTS idx_driver_advances_driver ON driver_advances(driver_name);
CREATE INDEX IF NOT EXISTS idx_fin_expenses_date      ON fin_expenses(date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date          ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_loan_emis_due          ON loan_emis(due_date, status);
CREATE INDEX IF NOT EXISTS idx_customer_pay_date      ON customer_payments(date);
CREATE INDEX IF NOT EXISTS idx_tempo_service_tempo    ON tempo_service(tempo_id);
CREATE INDEX IF NOT EXISTS idx_driver_tempo_adv       ON driver_tempo_advance(driver_name, date);

-- ================================================================
-- DONE. Now open finance.html and start adding entries.
-- ================================================================

-- ================================================================
-- CLEAR ALL DATA (run this to reset — keeps table structure intact)
-- WARNING: permanently deletes all records, resets IDs to 1
-- ================================================================

-- TRUNCATE TABLE
--   driver_tempo_advance,
--   driver_tempo_rent,
--   driver_salary,
--   driver_advances,
--   driver_leaves,
--   fin_drivers,
--   tempo_service,
--   tempo_rent_out,
--   tempo_rent_in,
--   tempos,
--   fin_expenses,
--   bank_transactions,
--   bank_accounts,
--   loan_emis,
--   loan_charges,
--   loans,
--   customer_payments,
--   customer_bills,
--   fin_parties
-- RESTART IDENTITY CASCADE;
