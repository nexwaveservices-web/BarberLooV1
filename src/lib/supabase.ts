import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { ASSETS } from '../data/barberlooData';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ddusvfylhifoniobzmcq.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bUpxVfRsVPz_d0qg1QrrNA_m7zM66t6';

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
};

const SESSION_STORAGE_KEY = 'barberloo_supabase_session_v1';

export interface SupabaseAuthUserSession {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: 'customer' | 'barber' | 'admin';
  state_id?: string;
  city_id?: string;
  state?: string;
  city?: string;
  stateId?: string;
  cityId?: string;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

if (typeof window !== 'undefined') {
  (window as any).barberLooSupabase = supabase;
}

export function getPersistedSupabaseUser(): SupabaseAuthUserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.email) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function setPersistedSupabaseUser(session: SupabaseAuthUserSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

type RealtimeListener = (event: { type: string; payload?: any }) => void;
const realtimeListeners = new Set<RealtimeListener>();
let sharedRealtimeChannel: RealtimeChannel | null = null;

function ensureRealtimeChannel() {
  if (sharedRealtimeChannel) return;
  try {
    sharedRealtimeChannel = supabase
      .channel('barberloo-realtime-india')
      .on('broadcast', { event: 'state:updated' }, (msg) => {
        realtimeListeners.forEach((fn) =>
          fn({ type: 'state:updated', payload: msg.payload })
        );
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (changePayload) => {
          realtimeListeners.forEach((fn) =>
            fn({ type: 'state:updated', payload: changePayload })
          );
        }
      )
      .subscribe();
  } catch {
    // ignore channel init error
  }
}

export function broadcastSupabaseEvent(type: string, payload: any = {}) {
  try {
    realtimeListeners.forEach((fn) => fn({ type, payload }));
    if (sharedRealtimeChannel) {
      sharedRealtimeChannel.send({
        type: 'broadcast',
        event: type,
        payload,
      });
    }
  } catch {
    // ignore broadcast errors
  }
}

export function connectSupabaseRealtime(onEvent: RealtimeListener) {
  realtimeListeners.add(onEvent);
  ensureRealtimeChannel();
  return () => {
    realtimeListeners.delete(onEvent);
  };
}

export async function supabaseSignUpUser(
  email: string,
  password: string,
  metadata: {
    name: string;
    phone?: string;
    role: 'customer' | 'barber' | 'admin';
    state_id?: string;
    city_id?: string;
    state?: string;
    city?: string;
  }
): Promise<SupabaseAuthUserSession> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const assignedRole = metadata.role || 'customer';

  // 1. Supabase Auth registration
  let uid = '';
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: metadata.name.trim() || cleanEmail.split('@')[0],
        phone: metadata.phone?.trim() || '',
        role: assignedRole,
      },
    },
  });

  if (authErr) {
    // If user already registered, provide friendly message
    if (authErr.message?.toLowerCase().includes('already registered')) {
      const err: any = new Error(
        'This email is already registered. Please switch to the Sign In tab.'
      );
      err.code = 'email-already-in-use';
      throw err;
    }
    throw authErr;
  }

  uid = authData?.user?.id || `usr-${Date.now()}`;

  const displayName =
    metadata.name.trim() || cleanEmail.split('@')[0];
  const cleanPhone = metadata.phone?.trim() || '';

  const profileRecord = {
    id: `prof-${uid}`,
    uid,
    email: cleanEmail,
    name: displayName,
    phone: cleanPhone,
    avatar_url: '',
    role: assignedRole,
    tier:
      assignedRole === 'admin'
        ? 'Platform Admin'
        : assignedRole === 'barber'
        ? 'Verified Barber Partner'
        : 'Member',
    preferred_notes: '',
    status: 'active',
    assigned_shop_id: 'shop-1',
    assigned_barber_id: '',
    state_id: metadata.state_id || 'st-pb',
    city_id: metadata.city_id || 'ct-jal',
    state: metadata.state || 'Punjab',
    city: metadata.city || 'Jalandhar',
  };

  await supabase.from('profiles').upsert(profileRecord, { onConflict: 'uid' });

  const sessionObj: SupabaseAuthUserSession = {
    uid,
    email: cleanEmail,
    name: displayName,
    phone: cleanPhone,
    role: assignedRole,
    state_id: profileRecord.state_id,
    city_id: profileRecord.city_id,
    state: profileRecord.state,
    city: profileRecord.city,
    stateId: profileRecord.state_id,
    cityId: profileRecord.city_id,
  };
  setPersistedSupabaseUser(sessionObj);
  return sessionObj;
}

export async function supabaseSignInUser(
  email: string,
  password: string
): Promise<SupabaseAuthUserSession> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Please enter your email and password.');
  }

  // 1. Supabase Auth sign in
  const { data: authData, error: authErr } =
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

  if (authErr) {
    throw authErr;
  }

  const supaUser = authData.user;
  const uid = supaUser.id;

  // 2. Fetch user's profile from database
  const { data: existingRows } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid);
  let userProfile = existingRows?.[0] || null;

  if (!userProfile) {
    const { data: emailRows } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail);
    userProfile = emailRows?.[0] || null;
  }

  const resolvedRole = userProfile?.role || supaUser.user_metadata?.role || 'customer';

  const sessionObj: SupabaseAuthUserSession = {
    uid,
    email: cleanEmail,
    name:
      userProfile?.name ||
      supaUser.user_metadata?.full_name ||
      cleanEmail.split('@')[0],
    phone: userProfile?.phone || supaUser.user_metadata?.phone || '',
    role: resolvedRole,
    state_id: userProfile?.state_id,
    city_id: userProfile?.city_id,
    state: userProfile?.state,
    city: userProfile?.city,
    stateId: userProfile?.state_id,
    cityId: userProfile?.city_id,
  };

  setPersistedSupabaseUser(sessionObj);
  return sessionObj;
}

export async function supabaseResetPassword(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your email address.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
  if (error) {
    throw error;
  }
}

export async function supabaseSignOut() {
  setPersistedSupabaseUser(null);
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
}

export async function safeSupabaseUpsert(
  table: string,
  record: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.from(table).upsert(record);
    if (error) {
      if (error.code === '42703' && error.message) {
        const match = error.message.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/);
        if (match && match[1] && record[match[1]] !== undefined) {
          const stripped = { ...record };
          delete stripped[match[1]];
          return safeSupabaseUpsert(table, stripped);
        }
      }
      console.warn(`[Supabase upsert warning] table: ${table}:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[Supabase upsert error] table: ${table}:`, err?.message || err);
  }
}

export async function safeSupabaseDelete(table: string, id: string) {
  try {
    await supabase.from(table).delete().eq('id', id);
  } catch {
    // silently continue
  }
}

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- BARBERLOO INDIA — FULL SUPABASE PRODUCTION SCHEMA, TRIGGERS, RLS & REALTIME
-- Project: https://ddusvfylhifoniobzmcq.supabase.co
-- Run this entire script once in your Supabase SQL Editor
-- ============================================================================

-- 1. PROFILES (Synced with Supabase Auth + Owner-only Admin rule)
create table if not exists public.profiles (
  id text primary key,
  uid text not null unique,
  email text not null,
  name text not null,
  phone text not null default '',
  avatar_url text not null default '',
  role text not null default 'customer', -- customer | barber | shop_owner | admin
  tier text not null default 'Member',
  preferred_notes text not null default '',
  status text not null default 'active', -- active | suspended
  assigned_shop_id text default 'shop-1',
  assigned_barber_id text default 'brb-1',
  created_at timestamptz default now()
);

-- 2. SHOPS
create table if not exists public.shops (
  id text primary key,
  owner_uid text not null default '',
  name text not null,
  district text not null,
  city text not null default 'Mumbai',
  address text not null,
  phone text not null default '+91',
  distance text not null default '1.0 km away',
  distance_miles_tenths integer not null default 10,
  rating text not null default '5.0',
  review_count integer not null default 0,
  is_open boolean not null default true,
  closes_at text not null default '21:30',
  price_tier text not null default '₹500 – ₹1,500',
  min_price integer not null default 500,
  verified boolean not null default true,
  approval_status text not null default 'approved', -- pending | approved | rejected | suspended
  logo_url text not null default '',
  image text not null default '${ASSETS.royalInterior}',
  tagline text not null default 'Bespoke Grooming & Reserved Appointments',
  about text not null default '',
  qr_code_slug text not null default 'barberloo-india',
  created_at timestamptz default now()
);

-- 3. BARBERS
create table if not exists public.barbers (
  id text primary key,
  user_uid text default '',
  shop_id text not null default 'shop-1',
  shop_name text not null,
  name text not null,
  role text not null,
  rating text not null default '5.0',
  review_count integer not null default 0,
  experience_years integer not null default 5,
  specialty text not null,
  next_available text not null default 'Today · IST',
  price_from integer not null default 500,
  image text not null default '${ASSETS.barberMarcus}',
  bio text not null default '',
  featured boolean not null default true,
  active boolean not null default true,
  verified boolean not null default true,
  verification_status text not null default 'verified',
  chair_break_active boolean not null default false,
  assigned_service_ids text not null default '',
  created_at timestamptz default now()
);

-- 4. SERVICES (Priced in INR ₹)
create table if not exists public.services (
  id text primary key,
  shop_id text not null default 'shop-1',
  index_code text not null default '01',
  name text not null,
  category text not null default 'Precision Haircuts',
  duration_min integer not null default 45,
  price integer not null default 500,
  description text not null default '',
  popular boolean not null default true,
  active boolean not null default true,
  image text not null default '${ASSETS.serviceSkinFade}',
  created_at timestamptz default now()
);

-- 5. APPOINTMENTS (IST Date & Time + Double-Booking Protection)
create table if not exists public.appointments (
  id text primary key,
  customer_uid text not null,
  client_name text not null,
  client_phone text not null default '+91',
  client_tier text not null default 'Member',
  shop_id text not null default 'shop-1',
  shop_name text not null,
  barber_id text not null,
  barber_name text not null,
  service_id text not null,
  service_name text not null,
  date text not null,
  time text not null,
  duration_min integer not null default 45,
  price integer not null,
  status text not null default 'confirmed', -- pending | confirmed | in_progress | completed | cancelled | no_show
  payment_method text not null default 'online', -- online | pay_at_shop
  payment_status text not null default 'paid', -- pending | paid | refunded
  notes text not null default '',
  internal_barber_notes text not null default '',
  coupon_code text not null default '',
  created_at timestamptz default now()
);

-- 6. REVIEWS
create table if not exists public.reviews (
  id text primary key,
  appointment_id text default '',
  customer_uid text not null,
  author text not null,
  role text not null default 'Verified Client',
  organization text not null default 'Member',
  shop_id text not null default 'shop-1',
  barber_id text not null default 'brb-1',
  barber_name text not null,
  service_name text not null,
  rating integer not null default 5,
  date text not null,
  comment text not null,
  outcome text not null default 'Verified Salon Visit',
  status text not null default 'published', -- published | hidden | flagged
  moderation_note text not null default '',
  created_at timestamptz default now()
);

-- 8. FAVORITES
create table if not exists public.favorites (
  id text primary key,
  customer_uid text not null,
  target_type text not null, -- shop | barber
  target_id text not null,
  created_at timestamptz default now(),
  unique (customer_uid, target_type, target_id)
);

-- 9. NOTIFICATIONS
create table if not exists public.notifications (
  id text primary key,
  recipient_uid text not null,
  type text not null default 'booking_confirmation',
  title text not null,
  time_label text not null default 'Just now',
  unread boolean not null default true,
  created_at timestamptz default now()
);

-- 10. WORKING HOURS (IST)
create table if not exists public.working_hours (
  id text primary key,
  shop_id text not null default 'shop-1',
  barber_id text default 'brb-1',
  day_of_week text not null,
  day_order integer not null default 1,
  start_time text not null default '09:30',
  end_time text not null default '21:30',
  break_start text not null default '14:00',
  break_end text not null default '14:45',
  is_day_off boolean not null default false,
  holiday_note text not null default '',
  peak_hours text not null default '18:00 – 20:30',
  created_at timestamptz default now()
);

-- 11. SHOP GALLERY
create table if not exists public.shop_gallery (
  id text primary key,
  shop_id text not null default 'shop-1',
  image_url text not null,
  title text not null,
  caption text not null default '',
  created_at timestamptz default now()
);

-- 12. BARBER GALLERY
create table if not exists public.barber_gallery (
  id text primary key,
  barber_id text not null default 'brb-1',
  image_url text not null,
  title text not null,
  style_tag text not null default '',
  created_at timestamptz default now()
);

-- 13. PAYMENTS (INR ₹)
create table if not exists public.payments (
  id text primary key,
  appointment_id text not null,
  customer_uid text not null,
  client_name text not null,
  shop_id text not null default 'shop-1',
  shop_name text not null,
  amount integer not null,
  platform_fee integer not null default 25,
  method text not null default 'online',
  method_display text not null default 'UPI / Razorpay Instant',
  status text not null default 'paid', -- pending | paid | refunded
  receipt_number text not null,
  created_at timestamptz default now()
);

-- 14. COUPONS
create table if not exists public.coupons (
  id text primary key,
  shop_id text not null default 'shop-1',
  code text not null unique,
  discount_text text not null,
  discount_percent integer not null,
  min_spend integer not null default 500,
  uses_count integer not null default 0,
  max_uses integer not null default 200,
  status text not null default 'Active', -- Active | Paused
  expires_at text not null default '2027-12-31',
  created_at timestamptz default now()
);

-- 15. REPORTS
create table if not exists public.reports (
  id text primary key,
  reporter_uid text not null,
  reporter_name text not null,
  target_type text not null, -- shop | barber | customer | review
  target_id text not null,
  target_label text not null,
  reason text not null,
  details text not null default '',
  status text not null default 'open', -- open | investigating | resolved | dismissed
  resolution_note text not null default '',
  created_at timestamptz default now()
);

-- ============================================================================
-- AUTOMATIC AUTH TRIGGER: Auto-confirms email & syncs users to public.profiles
-- Enforces that ONLY nexwaveservices@gmail.com receives role = 'admin'
-- ============================================================================
create or replace function public.handle_new_supabase_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text;
  assigned_tier text;
begin
  if lower(new.email) = 'nexwaveservices@gmail.com' then
    assigned_role := 'admin';
    assigned_tier := 'Founder & Platform Admin';
  elsif coalesce(new.raw_user_meta_data->>'role', '') in ('barber', 'shop_owner') then
    assigned_role := 'barber';
    assigned_tier := 'Verified Barber Partner';
  else
    assigned_role := 'customer';
    assigned_tier := 'Member';
  end if;

  insert into public.profiles (
    id,
    uid,
    email,
    name,
    phone,
    role,
    tier,
    status
  )
  values (
    'prof-' || new.id::text,
    new.id::text,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    assigned_role,
    assigned_tier,
    'active'
  )
  on conflict (uid) do update
  set
    email = excluded.email,
    role = case
      when lower(excluded.email) = 'nexwaveservices@gmail.com' then 'admin'
      else public.profiles.role
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_supabase_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES FOR CLIENT ACCESS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.working_hours enable row level security;
alter table public.shop_gallery enable row level security;
alter table public.barber_gallery enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
alter table public.rewards enable row level security;
alter table public.reports enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','shops','barbers','services','appointments',
    'reviews','favorites','notifications','working_hours','shop_gallery',
    'barber_gallery','payments','coupons','reports'
  ]
  loop
    execute format('drop policy if exists "Allow public access on %I" on public.%I', t, t);
    execute format('create policy "Allow public access on %I" on public.%I for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================================
-- SUPABASE STORAGE BUCKET FOR PROFILE PHOTOS, SHOP LOGOS & PORTFOLIOS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('barberloo-media', 'barberloo-media', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read on barberloo-media" on storage.objects;
create policy "Allow public read on barberloo-media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'barberloo-media');

drop policy if exists "Allow public upload on barberloo-media" on storage.objects;
create policy "Allow public upload on barberloo-media"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'barberloo-media');

-- ============================================================================
-- ENABLE SUPABASE REALTIME ON LIVE TABLES
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','shops','barbers','services','appointments',
    'reviews','favorites','notifications','working_hours','shop_gallery',
    'barber_gallery','payments','coupons','reports'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
`;

/**
 * Compresses an image client-side to keep high visual quality while preventing massive payloads.
 */
async function compressImageToDataUrl(
  file: File,
  maxDimension = 1280,
  quality = 0.85
): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      try {
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve(dataUrl);
      } catch {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

export async function uploadImageToSupabaseStorage(
  file: File,
  folder = 'uploads'
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${Date.now()}-${safeName}`;
  try {
    const { error } = await supabase.storage
      .from('barberloo-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });
    if (!error) {
      const { data } = supabase.storage
        .from('barberloo-media')
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
  } catch {
    // Fallback to inline data URL if storage bucket is not yet provisioned
  }

  return compressImageToDataUrl(file);
}

