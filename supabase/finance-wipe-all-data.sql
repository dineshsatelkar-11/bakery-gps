-- ═══════════════════════════════════════════════════════════════
-- FINANCE PROJECT ONLY — wipe all finance data
-- Does NOT touch bakery tables: shops, orders, customer_orders,
-- products, deliveries, routes, drivers (bakery), etc.
--
-- Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Child / transactional tables first
DELETE FROM loan_emis;
DELETE FROM loan_charges;
DELETE FROM bank_transactions;
DELETE FROM customer_payments;   -- finance ledger parties (not bakery)
DELETE FROM customer_bills;      -- finance ledger parties (not bakery)
DELETE FROM driver_advances;
DELETE FROM driver_leaves;
DELETE FROM driver_salary;
DELETE FROM driver_tempo_rent;
DELETE FROM driver_tempo_advance;
DELETE FROM tempo_rent_in;
DELETE FROM tempo_rent_out;
DELETE FROM tempo_service;
DELETE FROM fin_expenses;

-- Masters
DELETE FROM loans;
DELETE FROM bank_accounts;
DELETE FROM tempos;
DELETE FROM fin_parties;
DELETE FROM fin_drivers;

COMMIT;

-- Optional: reset sequences (ignore errors if no serial id)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'loan_emis','loan_charges','bank_transactions','customer_payments','customer_bills',
    'driver_advances','driver_leaves','driver_salary','driver_tempo_rent','driver_tempo_advance',
    'tempo_rent_in','tempo_rent_out','tempo_service','fin_expenses',
    'loans','bank_accounts','tempos','fin_parties','fin_drivers'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER SEQUENCE IF EXISTS %I_id_seq RESTART WITH 1', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Verify (all should be 0):
-- SELECT 'loan_emis' AS t, count(*) FROM loan_emis
-- UNION ALL SELECT 'loans', count(*) FROM loans
-- UNION ALL SELECT 'bank_transactions', count(*) FROM bank_transactions
-- UNION ALL SELECT 'bank_accounts', count(*) FROM bank_accounts
-- UNION ALL SELECT 'fin_expenses', count(*) FROM fin_expenses
-- UNION ALL SELECT 'fin_drivers', count(*) FROM fin_drivers
-- UNION ALL SELECT 'fin_parties', count(*) FROM fin_parties
-- UNION ALL SELECT 'driver_advances', count(*) FROM driver_advances
-- UNION ALL SELECT 'driver_salary', count(*) FROM driver_salary
-- UNION ALL SELECT 'driver_leaves', count(*) FROM driver_leaves
-- UNION ALL SELECT 'tempos', count(*) FROM tempos
-- UNION ALL SELECT 'tempo_rent_in', count(*) FROM tempo_rent_in
-- UNION ALL SELECT 'tempo_rent_out', count(*) FROM tempo_rent_out
-- UNION ALL SELECT 'customer_bills', count(*) FROM customer_bills
-- UNION ALL SELECT 'customer_payments', count(*) FROM customer_payments;

-- After wipe, in finance page browser console (optional):
-- localStorage.removeItem('fin_default_bank');
-- localStorage.removeItem('fin_exp_cats');
-- localStorage.removeItem('fin_driver_upi');
-- sessionStorage.removeItem('fin_auth');
