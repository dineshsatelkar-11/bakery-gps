-- ================================================================
-- SATELKAR LOGISTICS — Historical Data Import
-- Run in Supabase → SQL Editor AFTER setup-finance.sql
-- ================================================================

BEGIN;

-- ── 0. CLEAN SLATE (safe to re-run) ───────────────────────────
TRUNCATE TABLE
  loan_emis, loans,
  tempo_rent_in, tempo_rent_out, tempo_service,
  driver_salary, driver_advances, driver_leaves,
  fin_expenses, bank_transactions, bank_accounts,
  customer_payments,
  fin_drivers, driver_tempo_rent, fin_parties,
  loan_charges, tempos
CASCADE;

-- ── 1. TEMPOS ──────────────────────────────────────────────────
INSERT INTO tempos (name, type, owner_name, active) VALUES
  ('MH12VW8026', 'Electric Tempo', '', true),
  ('MH12VW8646', 'Electric Tempo', '', true),
  ('MH12YL3911', 'Bajaj Electric (New Nov-2025)', '', true),
  ('MH12VW8086', 'Euler Demo Tempo', '', true);

-- ── 2. LOANS ───────────────────────────────────────────────────
INSERT INTO loans (lender_name, purpose, principal, interest_rate, emi_amount, total_emis, start_date, down_payment, vehicle_cost, active, note) VALUES
  ('Warna Sahkari Bank', 'Electric Tempo MH12YL3911 (Bajaj Koan)', 379000, 0, 7960, 48, '2025-11-19', 68366.50, 447366.50, true,  'Loan 1 — disbursed 19 Nov 2025. Vehicle total 447366.50, down 68366.50'),
  ('Warna Sahkari Bank', 'Electric Tempo 2nd (Bajaj)',              379000, 0, 7960, 48, '2026-01-13', 68366.50, 447366.50, true,  'Loan 2 — disbursed 13 Jan 2026. Vehicle total 447366.50, down 68366.50'),
  ('Bajaj (Personal)',   'Working Capital / EMI Support',           154104, 14, 0,    0,  '2026-01-13', 0,        0,         false, 'Informal revolving loan. Received 154104 total. Repaid 150000 + interest 3169. ~4104 balance');

-- ── 3. LOAN EMIs ───────────────────────────────────────────────
-- New Bajaj Koan EMIs
INSERT INTO loan_emis (loan_id, due_date, amount, paid_date, status, note)
SELECT l.id, v.due_date, 7960, v.paid_date, v.status, v.note
FROM loans l,
(VALUES
  ('2025-12-09'::date, '2025-12-09'::date, 'paid'::text,    'EMI 1'),
  ('2026-01-09'::date,  NULL::date,         'pending'::text,  'EMI 2 — verify'),
  ('2026-02-09'::date, '2026-02-09'::date, 'paid'::text,    'EMI 3'),
  ('2026-03-09'::date, '2026-03-09'::date, 'paid'::text,    'EMI 4'),
  ('2026-04-09'::date, '2026-04-09'::date, 'paid'::text,    'EMI 5'),
  ('2026-05-09'::date,  NULL::date,         'pending'::text,  'EMI 6'),
  ('2026-06-09'::date,  NULL::date,         'pending'::text,  'EMI 7'),
  ('2026-07-09'::date,  NULL::date,         'pending'::text,  'EMI 8'),
  ('2026-08-09'::date,  NULL::date,         'pending'::text,  'EMI 9'),
  ('2026-09-09'::date,  NULL::date,         'pending'::text,  'EMI 10'),
  ('2026-10-09'::date,  NULL::date,         'pending'::text,  'EMI 11'),
  ('2026-11-09'::date,  NULL::date,         'pending'::text,  'EMI 12')
) AS v(due_date, paid_date, status, note)
WHERE l.note LIKE '%Koan%';

-- New Bajaj 2 Loan EMIs
INSERT INTO loan_emis (loan_id, due_date, amount, paid_date, status, note)
SELECT l.id, v.due_date, 7960, v.paid_date, v.status, v.note
FROM loans l,
(VALUES
  ('2026-02-03'::date, '2026-02-03'::date, 'paid'::text,    'EMI 1 partial 2000 — confirm'),
  ('2026-02-12'::date, '2026-02-12'::date, 'paid'::text,    'EMI 2'),
  ('2026-03-12'::date, '2026-03-12'::date, 'paid'::text,    'EMI 3'),
  ('2026-04-12'::date, '2026-04-12'::date, 'paid'::text,    'EMI 4'),
  ('2026-05-12'::date,  NULL::date,         'pending'::text,  'EMI 5'),
  ('2026-06-12'::date,  NULL::date,         'pending'::text,  'EMI 6'),
  ('2026-07-12'::date,  NULL::date,         'pending'::text,  'EMI 7'),
  ('2026-08-12'::date,  NULL::date,         'pending'::text,  'EMI 8'),
  ('2026-09-12'::date,  NULL::date,         'pending'::text,  'EMI 9'),
  ('2026-10-12'::date,  NULL::date,         'pending'::text,  'EMI 10'),
  ('2026-11-12'::date,  NULL::date,         'pending'::text,  'EMI 11'),
  ('2026-12-12'::date,  NULL::date,         'pending'::text,  'EMI 12')
) AS v(due_date, paid_date, status, note)
WHERE l.note LIKE '%2 Loan%';

-- ── 3b. LOAN EXTRA CHARGES ─────────────────────────────────────
INSERT INTO loan_charges (loan_id, date, description, amount, paid_by, note)
SELECT l.id, v.date, v.description, v.amount, v.paid_by, v.note
FROM loans l,
(VALUES
  -- Loan 1 (MH12YL3911 — Bajaj Koan)
  ('2025-11-19'::date, 'Warna Bank Processing Fee',  1180::numeric, 'Cash',              'Loan 1'),
  ('2025-11-19'::date, 'RTO Registration',           400::numeric,  'Cash',              'Loan 1 — vehicle nominal fee'),
  ('2025-11-19'::date, 'Class Members Fee (Shares)', 10100::numeric,'Cash',              'Loan 1 — required for Warna bank membership'),
  ('2025-11-19'::date, 'Notary Charges',             800::numeric,  'Cash',              'Loan 1'),
  ('2025-11-18'::date, 'Stamp Paper',                2000::numeric, 'Cash',              'Loan 1'),
  ('2025-11-19'::date, 'Project Report',             1500::numeric, 'Cash',              'Loan 1 — Rajan'),
  ('2025-11-18'::date, 'CIBIL - Dinesh',             199.42::numeric,'Cash',             'Loan 1'),
  ('2025-11-18'::date, 'CIBIL - Siddhesh',           199.42::numeric,'Cash',             'Loan 1'),
  ('2025-11-18'::date, 'CIBIL - Satelkars Logistics',2537::numeric, 'Cash',              'Loan 1')
) AS v(date, description, amount, paid_by, note)
WHERE l.note LIKE '%Loan 1%';

INSERT INTO loan_charges (loan_id, date, description, amount, paid_by, note)
SELECT l.id, v.date, v.description, v.amount, v.paid_by, v.note
FROM loans l,
(VALUES
  -- Loan 2 (2nd Bajaj)
  ('2026-01-13'::date, 'Warna Bank Processing Fee',  1180::numeric, 'Cash',  'Loan 2'),
  ('2026-01-13'::date, 'RTO Registration',           400::numeric,  'Cash',  'Loan 2')
) AS v(date, description, amount, paid_by, note)
WHERE l.note LIKE '%2 Loan%';

-- ── 4. TEMPO SERVICE HISTORY ───────────────────────────────────
INSERT INTO tempo_service (tempo_id, tempo_name, service_date, km_at_service, next_service_km, service_type, cost, workshop, note)
SELECT t.id, t.name, v.service_date, v.km_at_service, v.next_service_km, v.service_type, v.cost, v.workshop, v.note
FROM tempos t,
(VALUES
  ('MH12VW8026', '2024-03-29'::date, 0,  0,  'First Servicing',      1234,  '', ''),
  ('MH12VW8026', '2024-09-11'::date, 0,  0,  '3rd Free Servicing',   1906,  '', ''),
  ('MH12VW8026', '2025-05-15'::date, 0,  0,  'Full Service',         11343, '', ''),
  ('MH12VW8026', '2026-01-13'::date, 0,  0,  'Service',              5319,  '', 'Warna Sahkari payment'),
  ('MH12VW8646', '2024-08-27'::date, 0,  0,  'Repair',               955,   '', ''),
  ('MH12VW8646', '2024-09-11'::date, 0,  0,  'Maintenance',          2543,  '', '2000+543'),
  ('MH12VW8646', '2025-06-03'::date, 0,  0,  'Service (OSM DD)',     1000,  '', ''),
  ('MH12VW8646', '2025-07-25'::date, 0,  0,  'Full Service',         10565, '', ''),
  ('MH12VW8646', '2026-01-13'::date, 0,  0,  'Service',              2711,  '', '')
) AS v(tempo_name, service_date, km_at_service, next_service_km, service_type, cost, workshop, note)
WHERE t.name = v.tempo_name;

-- ── 5. TEMPO RENT IN (Salman — you pay him) ────────────────────
INSERT INTO tempo_rent_in (tempo_id, tempo_name, month, agreed_rent, breakdown_days, breakdown_deduct, final_rent, paid, note)
SELECT t.id, t.name, v.month, v.agreed_rent, v.bd_days, v.bd_deduct, v.final_rent, v.paid, v.note
FROM tempos t,
(VALUES
  ('MH12VW8026', '2025-07', 12000::numeric, 0, 0::numeric,  8903.07::numeric, true,  'Partial month: 9 Jul - 31 Jul'),
  ('MH12VW8026', '2025-08', 12000::numeric, 0, 0::numeric,  12000::numeric,   true,  'Aug — paid 10 Sep'),
  ('MH12VW8026', '2025-09', 12000::numeric, 0, 0::numeric,  12000::numeric,   true,  'Sep — paid 10 Oct'),
  ('MH12VW8026', '2025-10', 12000::numeric, 0, 3400::numeric, 8600::numeric,  true,  '12000 agreed. 3400 deducted for maintenance (part 2500 + fitting 900). Paid 8 Nov'),
  ('MH12VW8026', '2025-11', 12000::numeric, 0, 0::numeric,  12000::numeric,   false, 'Paid 10000 on 10 Dec. Balance 2000 pending — verify')
) AS v(tempo_name, month, agreed_rent, bd_days, bd_deduct, final_rent, paid, note)
WHERE t.name = v.tempo_name;

-- ── 6. TEMPO RENT OUT ──────────────────────────────────────────

-- Raftar
INSERT INTO tempo_rent_out (tempo_id, tempo_name, customer_name, customer_mobile, month, agreed_rent, breakdown_days, breakdown_deduct, final_rent, received, balance, note)
SELECT t.id, t.name, v.customer, '', v.month, v.agreed_rent, 0, 0, v.agreed_rent, v.received, v.agreed_rent - v.received, v.note
FROM tempos t,
(VALUES
  ('MH12VW8026', 'Raftar', '2024-07', 12000::numeric, 0::numeric,   'First month'),
  ('MH12VW8026', 'Raftar', '2024-08', 12000::numeric, 12000::numeric, 'Received Oct 2024 (10250+1750 maintenance)'),
  ('MH12VW8026', 'Raftar', '2024-09', 12000::numeric, 5000::numeric,  'Received partial 5000 on 14 Oct'),
  ('MH12VW8026', 'Raftar', '2024-10', 12000::numeric, 0::numeric,   'Verify receipt'),
  ('MH12VW8026', 'Raftar', '2024-11', 12000::numeric, 0::numeric,   'Verify receipt'),
  ('MH12VW8026', 'Raftar', '2024-12', 12000::numeric, 0::numeric,   'Verify receipt'),
  ('MH12VW8026', 'Raftar', '2025-01', 12000::numeric, 10000::numeric, 'Received 10000 on 29 Jan 2025'),
  ('MH12VW8026', 'Raftar', '2025-02', 12000::numeric, 5000::numeric,  'Received 5000 on 6 Mar 2025'),
  ('MH12VW8026', 'Raftar', '2025-03', 12000::numeric, 5000::numeric,  'Received 5000 on 8 Apr 2025'),
  ('MH12VW8026', 'Raftar', '2025-04', 12000::numeric, 5000::numeric,  'Received 5000 on 28 May 2025'),
  ('MH12VW8026', 'Raftar', '2025-07', 7443::numeric,  5000::numeric,  'Partial month. Received 5000 on 6 Aug')
) AS v(tempo_name, customer, month, agreed_rent, received, note)
WHERE t.name = v.tempo_name;

-- Amazon Datta Bhau
INSERT INTO tempo_rent_out (tempo_id, tempo_name, customer_name, customer_mobile, month, agreed_rent, breakdown_days, breakdown_deduct, final_rent, received, balance, note)
SELECT t.id, t.name, v.customer, '', v.month, v.agreed_rent, 0, 0, v.agreed_rent, v.received, v.agreed_rent - v.received, v.note
FROM tempos t,
(VALUES
  ('MH12VW8646', 'Amazon Datta Bhau', '2024-09', 12000::numeric, 0::numeric,    'Sep 2024 start'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2024-10', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2024-11', 14271::numeric, 11000::numeric, '12000 rent + 2271 servicing. Received 11000 on 24 Nov via Siddhesh'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2024-12', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-01', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-02', 12000::numeric, 22000::numeric, 'Received 12000 on 4 Feb + 10000 on 27 Feb'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-03', 24000::numeric, 20000::numeric, 'Two tempos now. Received 20000 on 13 May (partial of Feb+Mar)'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-04', 24000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-05', 12065::numeric, 0::numeric,    'Servicing month 17 May. Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-06', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-07', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-08', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-09', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-10', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-11', 12000::numeric, 5000::numeric,  'Received 5000 on 23 Nov via Siddhesh (cash)'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2025-12', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2026-01', 12000::numeric, 5000::numeric,  'Received 5000 on 20 Jan via Siddhesh (bank)'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2026-02', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2026-03', 12000::numeric, 0::numeric,    'Verify receipt'),
  ('MH12VW8646', 'Amazon Datta Bhau', '2026-04', 12000::numeric, 0::numeric,    'Current month — verify receipt')
) AS v(tempo_name, customer, month, agreed_rent, received, note)
WHERE t.name = v.tempo_name;

-- Vishal Salunkhe
INSERT INTO tempo_rent_out (tempo_id, tempo_name, customer_name, customer_mobile, month, agreed_rent, breakdown_days, breakdown_deduct, final_rent, received, balance, note)
SELECT t.id, t.name, 'Vishal Salunkhe', '', v.month, v.agreed_rent, v.bd_days, v.bd_deduct, v.final_rent, v.received, v.final_rent - v.received, v.note
FROM tempos t,
(VALUES
  ('MH12YL3911', '2025-12', 10000::numeric, 9, 2903.24::numeric, 7096.76::numeric, 4219::numeric,  'Tempo from 3 Dec. 22 days @ 322.58/day. Drop to service 26-31 Dec. Paid 4219 service, 2878 balance paid Jan'),
  ('MH12YL3911', '2026-01', 10000::numeric, 0, 0::numeric,       10000::numeric,   0::numeric,     'Verify Jan payment')
) AS v(tempo_name, month, agreed_rent, bd_days, bd_deduct, final_rent, received, note)
WHERE t.name = v.tempo_name;

-- ── 7. DRIVER SALARY RECORDS ───────────────────────────────────
INSERT INTO driver_salary (driver_name, month, base_salary, advance_given, advance_deducted, leave_days, leave_deduction, bonus, net_paid, note)
VALUES
  -- Suraj (2024)
  ('Suraj',    '2024-03', 17400, 1774, 5238, 0, 0, 0, 13162, 'March salary. Advance: 4238+1000+500+1274. Net 13162 paid 10 Apr'),
  -- Dhiraj (2024)
  ('Dhiraj',   '2024-03', 9000,  0,    1177, 0, 0, 0, 7823,  'March salary. Paid 1177 on 25 Jul, balance 7823 outstanding'),
  -- Driver Jay (2024)
  ('Driver Jay','2024-07', 3930,  2885, 0,    0, 0, 0, 3930,  'Total parcels delivered. Advance 2885 paid Jul. Charged 1500 for charging'),
  -- Rama
  ('Rama',     '2025-07', 14000, 0,    1338, 0, 0, 0, 12661, 'Full attendance. Net 12661.14 paid 8 Aug'),
  ('Rama',     '2025-08', 14000, 500,  3197, 3, 1354.92, 0, 8802, '3 days leave. Salary 12645.08. Paid 8802.60 on 11 Sep after advance deductions'),
  ('Rama',     '2025-09', 13066.76, 1000, 6000, 0, 0, 0, 7066.76, 'Paid 7066.76 on 9 Oct. Advance taken Vikram 500'),
  ('Rama',     '2025-10', 14000, 2000, 8000, 0, 0, 0, 7000, 'No leave. Paid 7000 on 13 Nov. Earlier advances deducted'),
  ('Rama',     '2025-11', 11200.08, 200, 4200, 6, 2799.92, 0, 4200, '6 days leave (9,10,11,28,29,30 Nov). Paid 4200 on 10 Dec'),
  ('Rama',     '2025-12', 10838.88, 600, 600,  1, 1161.12, 0, 5975, '1 day leave + 10 days tempo not working. Paid 4200 bal Dec + 200 Jan'),
  -- Akash
  ('Akash',    '2025-07', 12451.70, 2000, 7000, 0, 0, 0, 0,     'Join 5 July. Training 19&20 Jul. Balance pending — large advances given'),
  ('Akash',    '2025-08', 13096.69, 7000, 13096.69, 2, 903.31, 0, 0, '2 days leave. Heavy advance given. Salary absorbed by advances'),
  ('Akash',    '2025-09', 14000,    22000, 14000, 0, 0, 0, 0,    'Vikas worked some days. Large advances Sep. Net consumed by advances'),
  ('Akash',    '2025-10', 12645.08, 0,    0,     0, 0, 0, 12645.08, 'Paid. 6 days tempo not working — deducted from rent'),
  -- Bharat
  ('Driver Bharat', '2025-07', 4258.10,  0,    4258.10, 0, 0, 0, 4258.10, 'Joined 19 Jul. Training 19&20. Individual tempo from 21 Jul. Paid 8 Aug'),
  ('Driver Bharat', '2025-08', 13548.30, 2500, 2500,    1, 451.70, 0, 11048.30, '1 day leave. Paid 11 Sep after advance deduction'),
  ('Driver Bharat', '2025-09', 13066.48, 999,  4499,    0, 0, 0, 8567.48, 'Sep salary. Porter ID 999. Paid 8902 on 7 Oct after advances'),
  ('Driver Bharat', '2025-10', 12645.08, 3000, 3700,    3, 1354.92, 0, 3928, '3 days leave. Paid 3928 on 14 Nov'),
  ('Driver Bharat', '2025-11', 14000,    5000, 5000,    0, 0, 0, 9000, 'No leave. Nov advance 5000. Paid balance Dec'),
  ('Driver Bharat', '2025-12', 14000,    0,    0,       0, 0, 0, 14000, 'Dec salary. Paid in parts Jan'),
  ('Driver Bharat', '2026-01', 13096.69, 1000, 10300,   2, 903.31, 0, 2796.69, '2 days leave (19,20 Jan). Paid 7417 full final in Mar'),
  ('Driver Bharat', '2026-02', 14000,    0,    0,       0, 0, 0, 14000, 'Feb salary. Full & final Mar 2026'),
  ('Driver Bharat', '2026-03', 1354.83,  0,    0,       0, 0, 0, 1354.83, 'Partial March. Full & Final 7417 paid 4 Mar 2026'),
  -- Vikas
  ('Driver Vikas',  '2025-11', 13066.48, 0,    0,       2, 933.52, 0, 13066.48, '2 days leave (25 & 26 Nov). Paid in parts Dec-Jan'),
  ('Driver Vikas',  '2025-12', 14000,    0,    0,       0, 0, 0, 14000, 'Dec salary. Paid 4500+1000+3000+2139 in parts'),
  ('Driver Vikas',  '2026-01', 14000,    0,    5349,    0, 0, 0, 7193.40, 'Jan salary. Advance deducted. Paid remaining 2139 on 16 Feb'),
  ('Driver Vikas',  '2026-02', 12000,    5000, 5000,    4, 2000, 0, 2000, '4 days leave (1,2,3 Feb + 24 Feb). Paid 999 portal. Balance pending'),
  ('Driver Vikas',  '2026-03', 13548.30, 0,    3500,    0, 0, 0, 9548.30, 'No leave. Paid in parts'),
  -- Anand
  ('Driver Anand',  '2025-12', 4516.20,  0,    3117,    0, 0, 0, 1399, 'Partial month. Paid 3117 on 3 Jan. Balance paid after'),
  ('Driver Anand',  '2026-01', 12193.47, 5000, 12193.47,4, 1806.53, 0, 0, '4 days leave (5,6,7,22 Jan). Large advances consumed salary'),
  ('Driver Anand',  '2026-02', 13500,    0,    6750,    1, 500, 0, 6750, '1 day leave (RTO passing). Advance deducted'),
  ('Driver Anand',  '2026-03', 12645.08, 0,    5000,    2, 1354.92, 0, 6015.60, '2 days leave (3&4 Mar — route done Devraj)'),
  -- Ballu
  ('Driver Ballu',  '2026-01', 5870.93,  0,    0,       0, 0, 0, 5870.93, 'Partial month. Paid 5871 on 1 Feb'),
  ('Driver Ballu',  '2026-02', 14000,    6000, 6000,    0, 0, 0, 2140, 'Rent for 10 days only (19-28 Feb). Advances deducted. Extra service days 1-3 Feb (1500)'),
  ('Driver Ballu',  '2026-03', 13548.30, 520,  520,     0, 0, 0, 13028.30, 'No leave'),
  -- Sonu
  ('Driver Sonu',   '2026-03', 4516.10,  0,    0,       0, 0, 0, 4516.10, 'March month salary'),
  -- Devraj (substitute/riksha service)
  ('Devraj',        '2025-09', 4700,     0,    0,       0, 0, 0, 3700, 'Sep: 2 days Bharat, 2 days Rama. Oct: 2 days Bharat, 1 day Akash extra + riksha 2 days'),
  ('Devraj',        '2025-11', 1800,     0,    0,       0, 0, 0, 1800, 'Akash 2 days diwali leave + Rama 1 day (9 Nov). Riksha for Bharat breakdown. Paid 12 Nov'),
  ('Devraj',        '2025-12', 1000,     0,    0,       0, 0, 0, 1000, '2 days Vikas (25,26 Nov). Paid 10 Dec'),
  ('Devraj',        '2026-01', 5500,     0,    0,       0, 0, 0, 5500, '27 Dec to 6 Jan: 11 days. Paid 5500 on 5 Jan'),
  ('Devraj',        '2026-02', 2000,     0,    0,       0, 0, 0, 2000, '1 day Anand leave + 1 day Vikas leave Feb. 2 days Anand March. Paid Mar 9');

-- ── 8. DRIVER ADVANCES (significant ones) ──────────────────────
INSERT INTO driver_advances (driver_name, date, amount, reason, recovered)
VALUES
  -- Suraj
  ('Suraj',        '2024-03-17', 4238,  'March advance', true),
  ('Suraj',        '2024-04-14', 1000,  'Advance', true),
  ('Suraj',        '2024-04-14', 500,   'Advance', true),
  ('Suraj',        '2024-04-30', 1274,  'Missing amount', true),
  -- Dhiraj
  ('Dhiraj',       '2024-04-10', 11340, 'April payment', false),
  -- Akash
  ('Akash',        '2025-07-14', 2000,  'Advance Payment', false),
  ('Akash',        '2025-08-06', 2000,  'Aug Month Advance', false),
  ('Akash',        '2025-08-06', 3600,  'Advance', false),
  ('Akash',        '2025-08-06', 1400,  'Advance', false),
  ('Akash',        '2025-07-25', 8000,  'Advance (payment for Akash via Dinesh)', false),
  ('Akash',        '2025-09-05', 5000,  'Sept advance', false),
  ('Akash',        '2025-09-08', 5000,  'Sept advance 2nd', false),
  ('Akash',        '2025-09-12', 7000,  'Advance for mothers treatment', false),
  ('Akash',        '2025-09-21', 10000, 'Advance', false),
  ('Akash',        '2025-10-09', 5000,  'Advance', false),
  ('Akash',        '2025-10-19', 3500,  'Advance', false),
  -- Rama
  ('Rama',         '2025-08-14', 1000,  'Aug advance', false),
  ('Rama',         '2025-09-09', 500,   'Advance taken Vikram', false),
  ('Rama',         '2025-09-23', 1000,  'Advance', false),
  ('Rama',         '2025-10-19', 1000,  'Advance', false),
  ('Rama',         '2025-10-28', 2000,  'Advance', false),
  ('Rama',         '2025-11-03', 2000,  'Advance', false),
  ('Rama',         '2025-12-25', 500,   'Police fine 8026', false),
  ('Rama',         '2025-12-26', 600,   'Key making', false),
  -- Bharat
  ('Driver Bharat','2025-10-06', 500,   'Sep advance', false),
  ('Driver Bharat','2025-10-06', 500,   'Advance', false),
  ('Driver Bharat','2025-10-09', 1000,  'Advance', false),
  ('Driver Bharat','2025-10-19', 3000,  'Advance', false),
  ('Driver Bharat','2025-10-29', 200,   'Advance', false),
  ('Driver Bharat','2025-11-20', 5000,  'November Advances', false),
  ('Driver Bharat','2025-09-28', 2000,  'Advance', false),
  ('Driver Bharat','2025-09-29', 999,   'Porter ID charges', false),
  ('Driver Bharat','2026-01-01', 500,   'Advance', false),
  ('Driver Bharat','2026-01-10', 1000,  'Advance', false),
  ('Driver Bharat','2026-01-18', 1000,  'Advance', false),
  ('Driver Bharat','2026-01-20', 500,   'Advance', false),
  ('Driver Bharat','2026-01-20', 500,   'Advance', false),
  -- Vikas
  ('Driver Vikas', '2026-02-02', 5000,  'Advance', false),
  ('Driver Vikas', '2026-02-12', 999,   'Porter ID activation', false),
  -- Anand
  ('Driver Anand', '2026-01-06', 1000,  'Advance', false),
  ('Driver Anand', '2026-01-06', 500,   'Advance', false),
  ('Driver Anand', '2026-01-09', 200,   'Advanced', false),
  ('Driver Anand', '2026-01-11', 160,   'Advance for puncture', false),
  ('Driver Anand', '2026-01-12', 5000,  'Advance payment Jan', false),
  ('Driver Anand', '2026-01-13', 1000,  'Advance', false),
  ('Driver Anand', '2026-02-10', 600,   'Advance for plywood', false),
  ('Driver Anand', '2026-02-15', 500,   'Advance', false),
  ('Driver Anand', '2026-02-19', 1000,  'Advance', false),
  ('Driver Anand', '2026-02-22', 1000,  'Advance on others accounts', false),
  ('Driver Anand', '2026-02-24', 1000,  'Advance', false),
  ('Driver Anand', '2026-02-27', 5000,  'Advance', false),
  ('Driver Anand', '2026-03-08', 2000,  'Advance (5 Mar from Dinesh acc)', false),
  ('Driver Anand', '2026-03-13', 4000,  'Advance', false),
  ('Driver Anand', '2026-03-22', 1000,  'Advance', false),
  -- Ballu
  ('Driver Ballu', '2026-02-13', 1000,  'Advance', false),
  ('Driver Ballu', '2026-02-14', 2500,  'Advance', false),
  ('Driver Ballu', '2026-02-14', 2500,  'Advance', false),
  ('Driver Ballu', '2026-02-17', 300,   'Advance', false),
  ('Driver Ballu', '2026-02-17', 4000,  'Cash given', false),
  ('Driver Ballu', '2026-02-24', 1100,  'Advance for porter id', false),
  ('Driver Ballu', '2026-03-04', 500,   'Advance', false),
  ('Driver Ballu', '2026-03-10', 3000,  'Advance', false),
  ('Driver Ballu', '2026-03-22', 6000,  'Advance', false),
  ('Driver Ballu', '2026-03-29', 520,   'Advanced', false),
  -- Sonu
  ('Driver Sonu',  '2026-03-23', 500,   'Advance', false),
  ('Driver Sonu',  '2026-04-15', 2000,  'Advance', false),
  ('Driver Sonu',  '2026-04-15', 2000,  'Advance', false),
  ('Driver Sonu',  '2026-04-15', 600,   'Advance', false);

-- ── 9. DRIVER LEAVES ───────────────────────────────────────────
INSERT INTO driver_leaves (driver_name, date, type, substitute_driver, substitute_cost, note)
VALUES
  ('Rama',         '2025-11-09', 'unpaid', 'Driver Aditya', 1000, '9 Nov — Aditya did route'),
  ('Rama',         '2025-11-10', 'unpaid', 'Driver Aditya', 0,    '10 Nov — Aditya continued'),
  ('Rama',         '2025-11-11', 'unpaid', 'Driver Aditya', 500,  '11 Nov — 1 day leave'),
  ('Rama',         '2025-11-28', 'unpaid', '', 0,  '28 Nov leave'),
  ('Rama',         '2025-11-29', 'unpaid', '', 0,  '29 Nov leave'),
  ('Rama',         '2025-11-30', 'unpaid', '', 0,  '30 Nov leave'),
  ('Akash',        '2025-10-28', 'unpaid', '', 0,  'Diwali Oct leave 1'),
  ('Akash',        '2025-10-29', 'unpaid', '', 0,  'Diwali Oct leave 2'),
  ('Driver Bharat','2025-10-28', 'unpaid', '', 0,  'Tempo breakdown 28 Oct'),
  ('Driver Bharat','2025-10-29', 'unpaid', '', 0,  'Tempo breakdown 29 Oct'),
  ('Driver Vikas', '2025-11-25', 'unpaid', 'Devraj', 500, '25 Nov leave'),
  ('Driver Vikas', '2025-11-26', 'unpaid', 'Devraj', 500, '26 Nov leave'),
  ('Driver Anand', '2026-01-05', 'unpaid', '', 0, '5 Jan leave'),
  ('Driver Anand', '2026-01-06', 'unpaid', '', 0, '6 Jan leave'),
  ('Driver Anand', '2026-01-07', 'unpaid', '', 0, '7 Jan leave'),
  ('Driver Anand', '2026-01-22', 'unpaid', '', 0, '22 Jan leave'),
  ('Driver Bharat','2026-01-19', 'unpaid', '', 0, '19 Jan leave'),
  ('Driver Bharat','2026-01-20', 'unpaid', '', 0, '20 Jan leave');

-- ── 10. EXPENSES ───────────────────────────────────────────────

-- Tempo MH12VW8026 specific
INSERT INTO fin_expenses (date, category, amount, tempo_name, driver_name, note) VALUES
  ('2024-03-29', 'tempo_repair',  1234,   'MH12VW8026', '', 'First Servicing'),
  ('2024-04-18', 'tempo_repair',  7516,   'MH12VW8026', '', 'Insurance 2024'),
  ('2024-08-01', 'tempo_repair',  1750,   'MH12VW8026', '', 'Repair'),
  ('2024-09-11', 'tempo_repair',  1906,   'MH12VW8026', '', '3rd Free Servicing'),
  ('2025-05-15', 'tempo_repair',  11343,  'MH12VW8026', '', 'Full Service'),
  ('2025-07-25', 'tempo_repair',  1600,   'MH12VW8026', '', 'Towing charges'),
  ('2026-01-08', 'tempo_repair',  1468,   'MH12VW8026', '', 'Repair'),
  ('2026-01-13', 'tempo_repair',  5319,   'MH12VW8026', '', 'Servicing bill'),
  ('2026-02-05', 'tempo_repair',  400,    'MH12VW8026', '', 'Welding'),
  ('2026-02-21', 'tempo_repair',  360,    'MH12VW8026', '', 'Bulb'),
  ('2026-02-21', 'tempo_repair',  925,    'MH12VW8026', '', 'Repair'),
  ('2026-02-22', 'tempo_repair',  2500,   'MH12VW8026', '', 'Tempo passing (RTO)'),
  ('2026-03-22', 'tempo_repair',  1054,   'MH12VW8026', '', 'Charger repair discount 2012'),
  ('2025-09-06', 'tempo_repair',  3238,   'MH12VW8026', '', 'Front Wheel replacement'),

-- Tempo MH12VW8646 specific
  ('2024-08-27', 'tempo_repair',  955,    'MH12VW8646', '', 'Repair'),
  ('2024-09-11', 'tempo_repair',  2543,   'MH12VW8646', '', 'Maintenance (2000+543)'),
  ('2025-05-03', 'tempo_repair',  7163,   'MH12VW8646', '', 'Insurance 2025'),
  ('2025-07-22', 'tempo_repair',  999,    'MH12VW8646', '', 'Porter activation'),
  ('2025-07-25', 'tempo_repair',  1970,   'MH12VW8646', '', 'Battery replacement'),
  ('2025-07-25', 'tempo_repair',  10565,  'MH12VW8646', '', 'Full Service'),
  ('2025-08-03', 'tempo_repair',  1880,   'MH12VW8646', '', 'Handle repair'),
  ('2025-09-10', 'tempo_repair',  700,    'MH12VW8646', '', 'Welding'),
  ('2025-10-06', 'tempo_repair',  1000,   'MH12VW8646', '', 'Welding advance'),
  ('2025-10-07', 'tempo_repair',  2000,   'MH12VW8646', '', 'Shaft removal, pin changes'),
  ('2025-10-07', 'tempo_repair',  1000,   'MH12VW8646', '', 'Repair by Akash & Bharat'),
  ('2025-10-07', 'tempo_repair',  3500,   'MH12VW8646', '', 'Welding work payment'),
  ('2025-10-07', 'tempo_repair',  85,     'MH12VW8646', '', 'Oil & grease'),
  ('2025-10-10', 'tempo_repair',  1086,   'MH12VW8646', '', 'Drum repair'),
  ('2025-10-14', 'tempo_repair',  3500,   'MH12VW8646', '', 'Display repairing'),
  ('2025-11-24', 'tempo_repair',  420,    'MH12VW8646', '', 'Tempo part'),
  ('2025-11-24', 'tempo_repair',  600,    'MH12VW8646', '', 'Service charges by Bharat'),
  ('2025-11-24', 'tempo_repair',  50,     'MH12VW8646', '', 'Pipe use charges'),
  ('2026-01-13', 'tempo_repair',  2711,   'MH12VW8646', '', 'Service'),
  ('2026-02-21', 'tempo_repair',  2617,   'MH12VW8646', '', 'Repair'),

-- MH12YL3911
  ('2025-11-30', 'tempo_repair',  1000,   'MH12YL3911', '', 'Number plate'),

-- General Tempo Expenses
  ('2024-04-10', 'tempo_fuel',    670,    '', '', 'Bal kaka'),
  ('2024-04-10', 'tempo_fuel',    740,    '', '', 'Baban kaka'),
  ('2024-07-07', 'tempo_repair',  1555,   '', '', 'Khala electric / fitting & material'),
  ('2024-08-01', 'office',        5000,   '', '', 'Electricity meter installation'),
  ('2025-07-22', 'tempo_repair',  100,    '', '', '3-pin for 8646'),
  ('2025-07-22', 'tempo_repair',  144,    '', '', 'Porter for charger'),
  ('2025-07-22', 'tempo_repair',  144,    '', '', 'Porter for charger (duplicate entry)'),
  ('2025-07-22', 'tempo_repair',  50,     '', '', 'Charging'),
  ('2025-07-27', 'tempo_repair',  999,    '', '', 'Porter fee paid'),
  ('2025-08-11', 'tempo_repair',  365.80, '', '', 'Tempo mirror (rabab)'),
  ('2025-08-14', 'tempo_repair',  3500,   '', '', 'Charger repair'),
  ('2025-08-21', 'tempo_repair',  878.32, '', '', 'Mudguard demo tempo'),
  ('2025-09-17', 'tempo_repair',  2000,   '', '', 'Service material'),
  ('2025-09-18', 'tempo_repair',  1700,   '', '', 'DD labor charges'),
  ('2025-09-27', 'tempo_repair',  154,    '', '', 'Porter charges for charger'),
  ('2025-09-29', 'tempo_repair',  4000,   '', '', 'Charger repair'),
  ('2025-10-03', 'tempo_repair',  6000,   '', '', 'Demo tempo charger repair'),
  ('2025-10-29', 'tempo_repair',  2500,   '', '', 'Part cost'),
  ('2025-10-29', 'tempo_repair',  900,    '', '', 'Repairing cost'),
  ('2025-11-09', 'tempo_repair',  100,    '', '', 'Travel for Bharat'),
  ('2025-11-09', 'tempo_repair',  400,    '', '', 'Part cost'),
  ('2025-12-02', 'tempo_repair',  350,    '', '', 'Tyre puncture'),
  ('2025-12-03', 'tempo_repair',  200,    '', '', 'Payment to Salman driver for late tempo'),
  ('2026-02-09', 'tempo_repair',  125,    '', '', 'Part for demo tempo'),
  ('2026-03-04', 'tempo_repair',  300,    '', '', 'Driver no plate on tempo'),
  ('2026-03-17', 'tempo_repair',  200,    '', '', 'Euler tempo washing'),
  ('2026-07-02', 'tempo_repair',  999,    'MH12VW8026', '', 'ID creation'),

-- Charger Repair (major)
  ('2025-12-19', 'tempo_repair',  4963,   '', '', 'Charger repair'),
  ('2025-12-19', 'tempo_repair',  4130,   '', '', 'Charger repair'),
  ('2026-01-27', 'tempo_repair',  12994,  '', '', 'New charger purchase'),

-- Porter charges
  ('2025-07-21', 'delivery',      70,     '', 'Driver Aditya', 'Porter wrong delivery location'),
  ('2025-07-21', 'delivery',      814,    '', 'Driver Aditya', 'CNG fill — tempo not charged in night'),
  ('2026-02-03', 'delivery',      180,    '', '', 'Porter from 100 burger'),
  ('2026-02-06', 'delivery',      130,    '', '', 'Porter charging pin from anubhav to Its Baked'),
  ('2026-02-09', 'delivery',      125,    '', '', 'Part for demo tempo porter'),
  ('2026-02-11', 'delivery',      100,    '', '', 'Porter from high street to malunge tea post'),
  ('2026-01-16', 'delivery',      129,    '', '', 'Document courier to Bajaj main office'),
  ('2026-01-19', 'delivery',      78,     '', '', 'Puff porter'),
  ('2026-01-20', 'delivery',      154,    '', '', 'Charge return porter'),
  ('2026-01-21', 'delivery',      221,    '', '', 'Charger return to Anibhav'),
  ('2026-01-21', 'delivery',      122,    '', '', 'Porter bun from kothrud'),
  ('2026-01-21', 'delivery',      312,    '', '', 'Charger porter to bhosari'),
  ('2026-01-12', 'delivery',      172,    '', '', 'Stamp sent to bank for new loan'),
  ('2026-02-25', 'delivery',      96,     '', '', 'Porter — vikas low charging 1 parcel'),
  ('2026-03-05', 'delivery',      189,    '', 'Driver Vikas', 'Porter for vikas low charging'),
  ('2026-03-05', 'delivery',      90,     '', '', 'Porter Baam'),
  ('2026-03-18', 'delivery',      110,    '', '', 'Charger porter deccan to station'),
  ('2026-03-23', 'delivery',      174,    '', '', 'Porter for missing bread law college road'),
  ('2026-03-27', 'delivery',      85,     '', '', 'Porter'),
  ('2026-04-08', 'delivery',      328,    '', '', 'Misplace puff by Sonu & Ballu'),
  ('2025-12-19', 'delivery',      104,    '', '', 'Porter kothrud to bhugaon'),
  ('2025-12-22', 'delivery',      271,    '', 'Driver Anand', 'Porter for missing sweet bun Mi Chaiwala pimpri'),
  ('2025-12-24', 'delivery',      135,    '', '', 'Porter paid by Shubhada'),
  ('2025-12-31', 'delivery',      158,    '', 'Driver Bharat', 'Porter for missing bread'),

-- Petrol
  ('2025-10-28', 'tempo_fuel',    200,    '', '', 'Petrol in 2 wheeler'),
  ('2025-10-28', 'tempo_fuel',    300,    '', '', 'Petrol paid by Dinesh'),
  ('2025-10-29', 'tempo_fuel',    200,    '', '', 'CNG'),
  ('2025-11-09', 'tempo_fuel',    300,    '', '', 'Vehicle petrol'),
  ('2025-11-30', 'tempo_fuel',    725,    '', '', 'Eco car CNG'),
  ('2025-11-28', 'tempo_fuel',    150,    '', 'Driver Bharat', 'Petrol for vehicle pickup'),

-- Extra Driver
  ('2025-10-11', 'driver',        1200,   '', '', 'Bharat not available — Vinayak driver service & tempo'),
  ('2025-11-03', 'driver',        500,    '', 'Driver Aditya', 'Aditya payment — extra route'),
  ('2025-11-29', 'driver',        1500,   '', '', 'Paid to Vinayak'),
  ('2025-11-30', 'driver',        300,    '', 'Driver Bharat', 'For Ramas route'),
  ('2025-11-30', 'driver',        200,    '', '', 'Porter charges extra driver'),
  ('2026-03-11', 'driver',        500,    '', 'Driver Ballu', '11 Mar new driver service'),

-- Loss Due to Breakdown
  ('2025-09-17', 'other',         1200,   'MH12VW8086', '', 'Breakdown MH12VW8086 — riksha sent for delivery'),

-- Challan / Fines
  ('2025-12-19', 'other',         500,    '', '', 'Challan'),
  ('2025-03-25', 'other',         200,    '', '', 'Challan'),
  ('2026-03-08', 'other',         500,    '', '', 'Challan for no entry — paid by Dinesh on 5 Mar'),

-- Company Creation
  ('2025-10-31', 'office',        243,    '', '', 'Porter charges swargate to kharadi'),
  ('2025-11-03', 'office',        198,    '', '', 'Porter kharadi to swargate'),
  ('2025-12-27', 'office',        7000,   '', '', 'Company creation/registration'),

-- Vehicle Purchase Expenses
  ('2025-11-13', 'office',        83,     '', '', 'Print out'),
  ('2025-11-13', 'office',        128,    '', '', 'Print out'),
  ('2025-11-14', 'office',        106.20, '', '', 'SMS charges Warna Bank'),
  ('2025-11-17', 'office',        159,    '', '', 'Print out income tax file'),
  ('2025-11-18', 'office',        2000,   '', '', 'Stamp paper charges'),
  ('2025-11-18', 'office',        199.42, '', '', 'CIBIL charges Dinesh'),
  ('2025-11-18', 'office',        199.42, '', '', 'CIBIL charges Siddhesh'),
  ('2025-11-18', 'office',        2537,   '', '', 'CIBIL charges Satelkars Logistics'),
  ('2025-11-18', 'office',        1180,   '', '', 'Processing fee loan 1'),
  ('2025-11-19', 'office',        1500,   '', '', 'Project report Rajan'),
  ('2025-11-19', 'office',        400,    '', '', 'Vehicle nominal fee'),
  ('2025-11-19', 'office',        10100,  '', '', 'Class members fee (shares)'),
  ('2025-11-19', 'office',        800,    '', '', 'Notary charges'),
  ('2026-01-08', 'office',        2000,   '', '', 'Stamp paper for vehicle 2'),
  ('2026-01-13', 'office',        1180,   '', '', 'Processing fee loan 2'),
  ('2026-01-13', 'office',        300,    '', '', 'TRF B class fee by bank'),
  ('2026-01-13', 'office',        10000,  '', '', 'Loan excess share'),
  ('2026-01-13', 'office',        350,    '', '', 'Notary'),
  ('2026-01-13', 'office',        133,    '', '', 'Xerox, print, photo for agreement'),
  ('2026-01-13', 'office',        1040,   '', '', 'Stamp paper'),
  ('2026-01-13', 'office',        300,    '', '', 'Stamp making'),
  ('2026-02-07', 'other',         12104,  '', '', 'Ajjas device payment (4 units)'),
  ('2026-01-21', 'other',         5000,   '', '', 'Dinesh google account'),
  ('2026-01-21', 'other',         4000,   '', '', 'Vehicle body (Warna)'),
  ('2026-01-21', 'other',         15000,  '', '', 'Vehicle purchase expense'),
  ('2026-01-24', 'other',         5000,   '', '', 'Tempo body payment (cash)'),
  ('2026-02-21', 'other',         1576,   '', '', 'Charging pin for demo tempo'),
  ('2025-11-13', 'other',         125,    '', '', 'Porter charges Dombavali to kalyan'),
  ('2025-10-31', 'other',         243,    '', '', 'Porter swargate to kharadi'),
  ('2025-12-24', 'other',         600,    '', '', 'GPS installation'),
  ('2026-01-14', 'other',         999,    '', 'Driver Bharat', 'Porter ID activation Bharat'),
  ('2026-01-10', 'office',        169,    '', '', 'Folder/file purchase for documents (Dmart)'),
  ('2026-01-04', 'other',         20,     '', '', 'Allen key'),
  ('2026-01-12', 'office',        200,    '', '', 'Loan document xerox'),

-- Other / Miscellaneous
  ('2025-10-02', 'other',         425,    '', '', 'Dasara samosa'),
  ('2025-10-02', 'other',         250,    '', '', 'Har'),
  ('2025-10-02', 'other',         150,    '', '', 'Sweet'),
  ('2025-10-06', 'other',         1000,   '', '', 'OSM DD charger extension'),
  ('2025-10-07', 'other',         171,    '', '', 'Porter charges for charger'),
  ('2025-10-07', 'other',         240,    '', '', 'Vadapav'),
  ('2025-11-21', 'other',         80,     '', '', 'Har'),
  ('2025-11-21', 'other',         300,    '', '', 'Pedha'),
  ('2025-11-24', 'other',         267,    '', '', 'Porter charges'),
  ('2025-12-03', 'other',         248,    '', '', 'Item missed from production team (Huber & Holly - Salunke Vihar)'),
  ('2025-12-21', 'other',         450,    '', '', 'Demo gadi number plate'),
  ('2025-12-27', 'other',         100,    '', 'Driver Anand', 'Bus ticket'),
  ('2025-12-30', 'other',         100,    '', 'Driver Anand', 'Bus pass'),
  ('2026-01-01', 'other',         400,    '', 'Driver Anand', 'Tempo pickup & drop'),
  ('2026-02-10', 'other',         50,     '', 'Driver Ballu', 'Nashta'),
  ('2026-02-10', 'other',         640,    '', '', 'Part purchase for Anubhav tempo'),
  ('2026-02-12', 'other',         100,    '', 'Driver Ballu', 'Bus pass'),
  ('2026-02-17', 'other',         300,    '', '', 'Number plate for 8086'),
  ('2026-02-22', 'other',         100,    '', 'Driver Anand', 'Nashta'),
  ('2026-03-03', 'other',         120,    '', 'Driver Ballu', 'Food'),
  ('2026-03-23', 'other',         100,    '', '', 'Rashi'),
  ('2026-03-23', 'other',         210,    '', '', 'Food for Ballu & Sonu'),
  ('2026-02-21', 'other',         300,    '', 'Driver Anand', 'Recharge Anand phone'),

-- Application / Membership
  ('2025-09-02', 'office',        942,    '', '', 'Application Membership (Porter/Delivery App)');

-- ── 11. CUSTOMER PAYMENTS (Its Baked — main client) ────────────
INSERT INTO customer_payments (customer_name, date, amount, mode, reference, note) VALUES
  ('Its Baked', '2025-08-06', 73327,  'bank',   '', 'July Month Payment'),
  ('Its Baked', '2025-09-09', 75000,  'bank',   '', 'August Month Payment (500 deducted - Rama cash)'),
  ('Its Baked', '2025-10-08', 75000,  'bank',   '', 'September Month Payment'),
  ('Its Baked', '2025-11-15', 25000,  'bank',   '', 'Oct payment - partial 1'),
  ('Its Baked', '2025-11-18', 50000,  'bank',   '', 'Oct payment - partial 2. Total Oct = 75000'),
  ('Its Baked', '2025-11-19', 50000,  'bank',   '', 'November Advance'),
  ('Its Baked', '2025-12-10', 25000,  'bank',   '', 'Partial payment'),
  ('Its Baked', '2025-12-24', 75000,  'bank',   '', 'Advance payment Dec'),
  ('Its Baked', '2026-02-10', 10790,  'bank',   '', 'December remaining payment (82258 billed - earlier received)'),
  ('Its Baked', '2026-02-16', 80900,  'bank',   '', 'January Month Payment (84432 billed)'),
  ('Its Baked', '2026-03-08', 94129,  'bank',   '', 'February Month Payment'),
  ('Its Baked', '2026-04-15', 83500,  'bank',   '', 'March Month Payment (83333 billed)'),
  -- Amazon Datta Bhau
  ('Amazon Datta Bhau', '2024-11-24', 11000,  'cash',  '', 'Received via Siddhesh'),
  ('Amazon Datta Bhau', '2025-02-04', 12000,  'bank',  '', 'Feb payment done by Siddhesh'),
  ('Amazon Datta Bhau', '2025-02-27', 10000,  'bank',  '', 'Feb payment 2nd part'),
  ('Amazon Datta Bhau', '2025-05-13', 20000,  'bank',  '', 'Payment via Siddhesh'),
  ('Amazon Datta Bhau', '2025-11-23', 5000,   'cash',  '', 'Payment on Siddhesh account'),
  ('Amazon Datta Bhau', '2026-01-20', 5000,   'bank',  '', 'Payment via Siddhesh'),
  -- Raftar
  ('Raftar', '2024-10-01', 12000, 'bank', '', 'Aug month rent received'),
  ('Raftar', '2024-10-14', 5000,  'bank', '', 'Sept partial payment'),
  ('Raftar', '2025-01-29', 10000, 'bank', '', 'Payment (Dinesh account)'),
  ('Raftar', '2025-03-06', 5000,  'bank', '', 'Payment'),
  ('Raftar', '2025-04-08', 5000,  'bank', '', 'Payment'),
  ('Raftar', '2025-05-28', 5000,  'bank', '', 'Payment'),
  ('Raftar', '2025-08-06', 5000,  'bank', '', 'Payment'),
  ('Raftar', '2025-10-10', 5000,  'bank', '', 'Received via Dinesh'),
  ('Raftar', '2025-12-16', 5000,  'bank', '', 'Payment'),
  ('Raftar', '2026-04-11', 3000,  'bank', '', 'Tempo Rent payment (Vikas account)'),
  -- Vishal Salunkhe (Rent Out payment)
  ('Vishal Salunkhe', '2026-01-01', 2878, 'bank', '', 'December month rent balance (after 4219 service)'),
  -- Amazon Imran
  ('Amazon Imran', '2024-07-15', 2336, 'bank', '', 'Sale payment 1'),
  ('Amazon Imran', '2024-07-15', 3682, 'bank', '', 'Sale payment 2'),
  ('Amazon Imran', '2024-07-27', 3380, 'bank', '', 'Sale payment'),
  ('Amazon Imran', '2024-08-13', 6217, 'bank', '', 'Sale payment'),
  ('Amazon Imran', '2024-08-13', 1227, 'bank', '', 'Sale payment'),
  -- Yuvraj (cylinder advance)
  ('Yuvraj', '2026-03-28', 2000, 'bank', '', 'Cylinder payment');

-- ── 12. BANK ACCOUNTS ──────────────────────────────────────────
INSERT INTO bank_accounts (name, account_no, opening_balance, active, note) VALUES
  ('Warna Sahkari Bank', '', 0, true,  'Main operations account — EMIs, salaries, Its Baked payments'),
  ('Kotak Bank',         '', 0, true,  'Secondary account — interest credits'),
  ('Cash',               '', 0, true,  'Physical cash on hand'),
  ('Dinesh - Personal',  '', 0, true,  'Owner Dinesh Satelkar personal account'),
  ('Siddhesh - Personal','', 0, true,  'Owner Siddhesh Satelkar personal account');

-- ── 13. BANK TRANSACTIONS (key entries) ────────────────────────
INSERT INTO bank_transactions (account_name, date, type, amount, description, reference, balance_after) VALUES
  -- Warna Sahkari Bank — 2025
  ('Warna Sahkari Bank', '2025-08-06', 'credit', 73327,     'Its Baked - July Month Payment', '', NULL),
  ('Warna Sahkari Bank', '2025-08-06', 'debit',  7153,      'Salman - July rent payment', '', NULL),
  ('Warna Sahkari Bank', '2025-09-09', 'credit', 75000,     'Its Baked - Aug Month Payment', '', NULL),
  ('Warna Sahkari Bank', '2025-09-10', 'debit',  12000,     'Salman - Aug rent payment', '', NULL),
  ('Warna Sahkari Bank', '2025-10-08', 'credit', 75000,     'Its Baked - Sept Month Payment', '', NULL),
  ('Warna Sahkari Bank', '2025-10-10', 'debit',  12000,     'Salman - Sept rent payment', '', NULL),
  ('Warna Sahkari Bank', '2025-11-15', 'credit', 25000,     'Its Baked - Oct payment partial 1', '', NULL),
  ('Warna Sahkari Bank', '2025-11-18', 'credit', 50000,     'Its Baked - Oct payment partial 2', '', NULL),
  ('Warna Sahkari Bank', '2025-11-19', 'credit', 50000,     'Its Baked - Nov Advance', '', NULL),
  ('Warna Sahkari Bank', '2025-11-19', 'credit', 379000,    'New Bajaj Koan - Loan Disbursement', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2025-11-19', 'debit',  447366.50, 'Lakshmi Bajaj - Vehicle remaining payment', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2025-12-09', 'emi',    7960,      'New Bajaj Koan - EMI 1', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2025-12-10', 'credit', 25000,     'Its Baked - partial', '', NULL),
  ('Warna Sahkari Bank', '2025-12-24', 'credit', 75000,     'Its Baked - Advance Dec', '', NULL),
  -- Warna Sahkari Bank — 2026
  ('Warna Sahkari Bank', '2026-01-13', 'credit', 99000,     'Bajaj Loan - informal loan received', '', NULL),
  ('Warna Sahkari Bank', '2026-01-13', 'credit', 379000,    'New Bajaj 2 Loan - Disbursement', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-01-13', 'debit',  447366.50, 'Lakshmi Bajaj - 2nd vehicle payment', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-02-09', 'emi',    7960,      'New Bajaj Koan - EMI 3', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-02-12', 'emi',    7960,      'New Bajaj 2 Loan - EMI 2', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-02-16', 'credit', 80900,     'Its Baked - Jan Payment', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-02-17', 'debit',  50677,     'Bajaj Loan repayment 50000 + interest 677', '', NULL),
  ('Warna Sahkari Bank', '2026-03-08', 'credit', 94129,     'Its Baked - Feb Payment', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-03-08', 'debit',  51046,     'Bajaj Loan repayment 50000 + interest 1046', '', NULL),
  ('Warna Sahkari Bank', '2026-03-09', 'emi',    7960,      'New Bajaj Koan - EMI 4', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-03-12', 'emi',    7960,      'New Bajaj 2 Loan - EMI 3', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-04-09', 'emi',    7960,      'New Bajaj Koan - EMI 5', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-04-12', 'emi',    7960,      'New Bajaj 2 Loan - EMI 4', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-04-15', 'credit', 83500,     'Its Baked - March Payment', 'Warna Sahkari', NULL),
  ('Warna Sahkari Bank', '2026-04-16', 'debit',  51446,     'Bajaj Loan repayment 50000 + interest 1446', '', NULL),
  -- Kotak Bank
  ('Kotak Bank',         '2025-09-30', 'credit', 147,       'Bank interest', '', NULL);

-- ── 14. DRIVERS ────────────────────────────────────────────────
INSERT INTO fin_drivers (name, mobile, base_salary, active, note) VALUES
  ('Rama',          '', 11200, true,  ''),
  ('Akash',         '', 11200, true,  ''),
  ('Driver Bharat', '', 14000, true,  ''),
  ('Driver Vikas',  '', 13000, true,  ''),
  ('Driver Anand',  '', 0,     false, 'Left'),
  ('Driver Ballu',  '', 0,     false, 'Left'),
  ('Driver Sonu',   '', 0,     false, 'Left'),
  ('Devraj',        '', 0,     true,  'Substitute driver');

-- ── 15. PARTIES ────────────────────────────────────────────────
INSERT INTO fin_parties (name, type, note) VALUES
  ('Its Baked',          'client',   ''),
  ('Amazon Datta Bhau',  'client',   ''),
  ('Amazon Imran',       'client',   ''),
  ('Raftar',             'client',   ''),
  ('Vishal Salunkhe',    'client',   ''),
  ('Yuvraj',             'client',   ''),
  ('Raftar',             'rent_out', 'Tempo MH12VW8026 rented out'),
  ('Amazon Datta Bhau',  'rent_out', 'Tempo MH12VW8646 rented out'),
  ('Vishal Salunkhe',    'rent_out', 'Tempo MH12YL3911 rented out'),
  ('Salman',             'rent_in',  'Tempo owner — we rent in');

COMMIT;

-- ================================================================
-- SUMMARY OF WHAT WAS IMPORTED
-- ================================================================
-- Tempos:             4 (MH12VW8026, MH12VW8646, MH12YL3911, MH12VW8086)
-- Loans:              3 (Warna Koan, Warna 2, Bajaj informal)
-- Loan EMIs:          24 rows (12 per active loan)
-- Tempo Service:      9 service records
-- Tempo Rent IN:      5 months (Salman)
-- Tempo Rent OUT:     ~25 records (Raftar, Datta Bhau, Vishal)
-- Driver Salary:      35+ monthly records (2024-2026)
-- Driver Advances:    55+ advance entries
-- Driver Leaves:      18 leave day records
-- Expenses:           130+ entries (tempo, porter, fuel, office, other)
-- Customer Payments:  35+ entries (Its Baked, Raftar, Datta Bhau, Imran)
-- Bank Transactions:  30 key entries
-- ================================================================
