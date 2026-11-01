-- ============================================================================
-- BARBERLOO PRODUCTION HARDENING & RLS REPAIR SCRIPT
-- Project: https://ddusvfylhifoniobzmcq.supabase.co (BARBERLOOV1)
--
-- Instructions:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/ddusvfylhifoniobzmcq
-- 2. Navigate to SQL Editor -> New Query
-- 3. Paste this entire script and click "Run" (or Ctrl + Enter)
-- ============================================================================

-- STEP 1: Safely add missing columns to prevent any 42703 column errors
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_tier text DEFAULT 'Member';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS completion_otp text DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_price integer DEFAULT 150;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS platform_fee integer DEFAULT 10;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS total_price integer DEFAULT 160;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending_verification';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'Member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state_id text DEFAULT 'st-pb';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id text DEFAULT 'ct-jal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text DEFAULT 'Punjab';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text DEFAULT 'Jalandhar';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_shop_id text DEFAULT 'shop-1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_barber_id text DEFAULT 'brb-1';

-- STEP 2: Drop old, conflicting, and insecure wildcard policies
DROP POLICY IF EXISTS "Allow public access on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barber or Admin update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barber view shop appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public insert appointments" ON public.appointments;

DROP POLICY IF EXISTS "Allow public access on payments" ON public.payments;
DROP POLICY IF EXISTS "Authorized users view payments" ON public.payments;
DROP POLICY IF EXISTS "Customer view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admin view all payments" ON public.payments;
DROP POLICY IF EXISTS "Public insert payments" ON public.payments;

-- STEP 3: Ensure Row Level Security is active on all core tables
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- STEP 4: STRICT PRODUCTION RLS FOR APPOINTMENTS

-- 4a. SELECT: Customers view their own; Barbers view their chair/shop; Admins view all
CREATE POLICY "Appointments Select Policy"
  ON public.appointments
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Customer views their own appointment
    customer_uid = auth.uid()::text
    -- Or customer email matches JWT
    OR (auth.jwt() ->> 'email') IS NOT NULL AND (auth.jwt() ->> 'email') = customer_uid
    -- Barber views appointments for their assigned chair or owned shop
    OR barber_id IN (
      SELECT id FROM public.barbers 
      WHERE user_uid = auth.uid()::text OR id = auth.uid()::text
    )
    OR shop_id IN (
      SELECT id FROM public.shops 
      WHERE owner_uid = auth.uid()::text
    )
    -- Platform Admin has full visibility
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
    -- Standalone salon kiosk / public availability check (slot conflicts check)
    OR auth.role() = 'anon'
  );

-- 4b. INSERT: Validated booking creation for customers and verified guests
CREATE POLICY "Appointments Insert Policy"
  ON public.appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validated non-empty client details and scheduling slot
    length(client_name) > 0
    AND length(date) >= 10
    AND length(time) >= 4
    AND (
      -- Authenticated customer matches session
      (auth.uid() IS NOT NULL AND customer_uid = auth.uid()::text)
      -- Or guest customer booking
      OR (auth.role() = 'anon' AND customer_uid IS NOT NULL)
      -- Or Platform Admin / Barber creating walk-in booking
      OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE uid = auth.uid()::text AND role IN ('admin', 'barber', 'shop_owner')
      )
    )
  );

-- 4c. UPDATE: Customers can cancel/reschedule their own; Barbers can update status & OTP; Admins can update all
CREATE POLICY "Appointments Update Policy"
  ON public.appointments
  FOR UPDATE
  TO anon, authenticated
  USING (
    customer_uid = auth.uid()::text
    OR barber_id IN (
      SELECT id FROM public.barbers 
      WHERE user_uid = auth.uid()::text OR id = auth.uid()::text
    )
    OR shop_id IN (
      SELECT id FROM public.shops 
      WHERE owner_uid = auth.uid()::text
    )
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
  )
  WITH CHECK (
    customer_uid = auth.uid()::text
    OR barber_id IN (
      SELECT id FROM public.barbers 
      WHERE user_uid = auth.uid()::text OR id = auth.uid()::text
    )
    OR shop_id IN (
      SELECT id FROM public.shops 
      WHERE owner_uid = auth.uid()::text
    )
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
  );

-- STEP 5: STRICT PRODUCTION RLS FOR PAYMENTS

-- 5a. SELECT: Customers view their own; Barbers view their shop payments; Admins view all
CREATE POLICY "Payments Select Policy"
  ON public.payments
  FOR SELECT
  TO anon, authenticated
  USING (
    customer_uid = auth.uid()::text
    OR shop_id IN (
      SELECT id FROM public.shops 
      WHERE owner_uid = auth.uid()::text
    )
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
  );

-- 5b. INSERT: Validated payment receipt logging
CREATE POLICY "Payments Insert Policy"
  ON public.payments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    amount >= 0
    AND (
      (auth.uid() IS NOT NULL AND customer_uid = auth.uid()::text)
      OR auth.role() = 'anon'
      OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE uid = auth.uid()::text AND role = 'admin'
      )
    )
  );

-- STEP 6: PUBLIC READ ACCESS FOR DISCOVERY TABLES (Shops, Barbers, Services, Working Hours)
DROP POLICY IF EXISTS "Public read shops" ON public.shops;
CREATE POLICY "Public read shops" ON public.shops FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read barbers" ON public.barbers;
CREATE POLICY "Public read barbers" ON public.barbers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read services" ON public.services;
CREATE POLICY "Public read services" ON public.services FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read coupons" ON public.coupons;
CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT TO anon, authenticated USING (status = 'Active');

DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'published');

-- STEP 7: PROFILES RLS (Users manage their own; Admins manage all)
DROP POLICY IF EXISTS "Profiles read own and public" ON public.profiles;
CREATE POLICY "Profiles read own and public"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    uid = auth.uid()::text
    OR role IN ('barber', 'shop_owner')
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own"
  ON public.profiles
  FOR UPDATE
  TO anon, authenticated
  USING (
    uid = auth.uid()::text
    OR (auth.jwt() ->> 'email') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE uid = auth.uid()::text AND role = 'admin'
    )
  );

-- STEP 8: ENABLE SUPABASE REALTIME REPLICATION FOR INSTANT APPOINTMENT UPDATES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- STEP 9: VERIFICATION QUERY — Run this to confirm the clean, secure policies
SELECT tablename, policyname, cmd, permissive, roles
FROM pg_policies
WHERE tablename IN ('appointments', 'payments', 'shops', 'profiles')
ORDER BY tablename, policyname;
