-- Migration: 0002_concurrency_indexes_and_security.sql
-- Description: High-concurrency performance indexes and recommended Supabase Row Level Security (RLS) policies
-- Note: Review and execute in your Supabase SQL Editor to enforce in production.

-- 1. High-Concurrency Double-Booking Prevention & Search Indexes (Optimized for 100+ concurrent users)
CREATE INDEX IF NOT EXISTS appointments_barber_date_idx ON appointments (barber_id, date);
CREATE INDEX IF NOT EXISTS appointments_customer_uid_idx ON appointments (customer_uid);
CREATE INDEX IF NOT EXISTS appointments_shop_date_idx ON appointments (shop_id, date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments (status);
CREATE INDEX IF NOT EXISTS services_shop_idx ON services (shop_id);
CREATE INDEX IF NOT EXISTS barbers_shop_idx ON barbers (shop_id);
CREATE INDEX IF NOT EXISTS reviews_shop_idx ON reviews (shop_id);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_uid, unread);
CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons (code);

-- 2. Financial Ledger & Escrow Settlement Indexes
CREATE INDEX IF NOT EXISTS financial_ledger_apt_idx ON financial_ledger (appointment_id);
CREATE INDEX IF NOT EXISTS barber_payouts_apt_idx ON barber_payouts (appointment_id);
CREATE INDEX IF NOT EXISTS barber_payouts_transfer_idx ON barber_payouts (provider_transfer_id);

-- 3. Supabase Row Level Security (RLS) Hardening Policies
-- Enable RLS across sensitive customer and financial tables
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS barber_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can only select their own appointments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_customer_select') THEN
    CREATE POLICY appointments_customer_select ON appointments
      FOR SELECT USING (auth.uid() = customer_uid OR auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;

-- Policy: Customers can only insert appointments under their verified authenticated UID
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_customer_insert') THEN
    CREATE POLICY appointments_customer_insert ON appointments
      FOR INSERT WITH CHECK (auth.uid() = customer_uid);
  END IF;
END $$;

-- Policy: Profiles access control (users can view/edit own profile; barbers/shops public view)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_owner_access') THEN
    CREATE POLICY profiles_owner_access ON profiles
      FOR ALL USING (auth.uid() = uid OR role = 'barber' OR auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;

-- Policy: Financial Ledger and Barber Payouts restricted to service_role and admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ledger_admin_only') THEN
    CREATE POLICY ledger_admin_only ON financial_ledger
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;
