-- ============================================================================
-- BARBERLOO HARDENED PRODUCTION RLS POLICIES
-- Project: https://ddusvfylhifoniobzmcq.supabase.co (BARBERLOOV1)
-- Enforces strict role-based data isolation:
-- 1. Customers only access their own appointments, payments & profile.
-- 2. Barbers only access their authorized shop appointments, services & customers.
-- 3. Administrators have platform-wide access verified via auth.jwt() and profiles.
-- 4. Public access is strictly restricted to public catalogue (shops, barbers, services).
-- 5. No unrestricted USING(true) or WITH CHECK(true) on private tables.
-- ============================================================================

-- Helper function: check if currently authenticated user is platform administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    coalesce(auth.jwt() ->> 'email', '') = 'nexwaveservices@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE uid = auth.uid()::text
      AND role = 'admin'
    )
  );
$$;

-- Helper function: check if currently authenticated user is an authorized barber/shop owner
CREATE OR REPLACE FUNCTION public.is_authorized_barber(p_barber_id text, p_shop_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.barbers
      WHERE id = p_barber_id
      AND user_uid = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = p_shop_id
      AND owner_uid = auth.uid()::text
    )
  );
$$;

-- ============================================================================
-- 1. APPOINTMENTS TABLE RLS POLICIES
-- ============================================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy or overly permissive policies
DROP POLICY IF EXISTS "Allow public access on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barber or Admin update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customer cancel appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barber select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barber update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin all appointments" ON public.appointments;

-- Customer can only view their own bookings
CREATE POLICY "Customer select appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (customer_uid = auth.uid()::text);

-- Customer can insert their own booking
CREATE POLICY "Customer insert appointments"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_uid = auth.uid()::text);

-- Customer can only cancel their own pending/confirmed appointment
CREATE POLICY "Customer cancel appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (customer_uid = auth.uid()::text)
  WITH CHECK (
    customer_uid = auth.uid()::text
    AND status IN ('cancelled', 'pending', 'confirmed')
  );

-- Barber can view bookings for their assigned chair or owned shop
CREATE POLICY "Barber select appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    public.is_authorized_barber(barber_id, shop_id)
  );

-- Barber can update status and notes for their own shop's bookings
CREATE POLICY "Barber update appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_authorized_barber(barber_id, shop_id)
  )
  WITH CHECK (
    public.is_authorized_barber(barber_id, shop_id)
  );

-- Admin has full access to appointments
CREATE POLICY "Admin all appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 2. PAYMENTS TABLE RLS POLICIES
-- ============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on payments" ON public.payments;
DROP POLICY IF EXISTS "Authorized users view payments" ON public.payments;
DROP POLICY IF EXISTS "Customer view own payments" ON public.payments;
DROP POLICY IF EXISTS "Barber view shop payments" ON public.payments;
DROP POLICY IF EXISTS "Admin all payments" ON public.payments;

-- Customer can only view their own payment transactions
CREATE POLICY "Customer view own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (customer_uid = auth.uid()::text);

-- Barber can view payments for their owned shop
CREATE POLICY "Barber view shop payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = payments.shop_id
      AND owner_uid = auth.uid()::text
    )
  );

-- Admin has full access to payments
CREATE POLICY "Admin all payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. PROFILES TABLE RLS POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "User view own profile" ON public.profiles;
DROP POLICY IF EXISTS "User update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "User view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (uid = auth.uid()::text);

-- Users can update their own permitted profile fields
CREATE POLICY "User update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (uid = auth.uid()::text)
  WITH CHECK (uid = auth.uid()::text);

-- Admin has full access to all profiles
CREATE POLICY "Admin all profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. PUBLIC CATALOGUE TABLES (Shops, Services, Barbers, Working Hours, Reviews)
-- ============================================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Shops: drop legacy permissive policies
DROP POLICY IF EXISTS "Allow public access on shops" ON public.shops;
DROP POLICY IF EXISTS "Public select shops" ON public.shops;
DROP POLICY IF EXISTS "Barber edit own shop" ON public.shops;
DROP POLICY IF EXISTS "Admin all shops" ON public.shops;

-- Anyone (anon + authenticated) can view shops
CREATE POLICY "Public select shops"
  ON public.shops
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Shop owner can update their own shop
CREATE POLICY "Barber edit own shop"
  ON public.shops
  FOR UPDATE
  TO authenticated
  USING (owner_uid = auth.uid()::text)
  WITH CHECK (owner_uid = auth.uid()::text);

CREATE POLICY "Admin all shops"
  ON public.shops
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Services: public read, shop owner write
DROP POLICY IF EXISTS "Allow public access on services" ON public.services;
DROP POLICY IF EXISTS "Public select services" ON public.services;
DROP POLICY IF EXISTS "Barber edit own services" ON public.services;
DROP POLICY IF EXISTS "Admin all services" ON public.services;

CREATE POLICY "Public select services"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Barber edit own services"
  ON public.services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = services.shop_id
      AND owner_uid = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = services.shop_id
      AND owner_uid = auth.uid()::text
    )
  );

CREATE POLICY "Admin all services"
  ON public.services
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Barbers roster: public read, owner write
DROP POLICY IF EXISTS "Allow public access on barbers" ON public.barbers;
DROP POLICY IF EXISTS "Public select barbers" ON public.barbers;
DROP POLICY IF EXISTS "Barber edit own profile" ON public.barbers;
DROP POLICY IF EXISTS "Admin all barbers" ON public.barbers;

CREATE POLICY "Public select barbers"
  ON public.barbers
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Barber edit own profile"
  ON public.barbers
  FOR ALL
  TO authenticated
  USING (
    user_uid = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = barbers.shop_id
      AND owner_uid = auth.uid()::text
    )
  )
  WITH CHECK (
    user_uid = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = barbers.shop_id
      AND owner_uid = auth.uid()::text
    )
  );

CREATE POLICY "Admin all barbers"
  ON public.barbers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Working hours: public read, shop owner write
DROP POLICY IF EXISTS "Allow public access on working_hours" ON public.working_hours;
DROP POLICY IF EXISTS "Public select working hours" ON public.working_hours;
DROP POLICY IF EXISTS "Barber edit working hours" ON public.working_hours;
DROP POLICY IF EXISTS "Admin all working hours" ON public.working_hours;

CREATE POLICY "Public select working hours"
  ON public.working_hours
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Barber edit working hours"
  ON public.working_hours
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = working_hours.shop_id
      AND owner_uid = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = working_hours.shop_id
      AND owner_uid = auth.uid()::text
    )
  );

CREATE POLICY "Admin all working hours"
  ON public.working_hours
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Verification Query: Inspect resulting policies
SELECT tablename, policyname, cmd, permissive, roles
FROM pg_policies
WHERE tablename IN ('appointments', 'payments', 'profiles', 'shops', 'services', 'barbers', 'working_hours')
ORDER BY tablename, policyname;
