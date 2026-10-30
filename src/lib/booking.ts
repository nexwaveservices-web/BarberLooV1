import { supabase } from './supabase';
import { ASSETS, BarberItem, ServiceItem, ShopItem } from '../data/barberlooData';
import { getShopQrDestinationUrl, findShopBySlugOrId } from './domain';

export interface BookingLoadResult {
  shop: ShopItem | null;
  services: ServiceItem[];
  barbers: BarberItem[];
  error: 'missing_shop' | 'shop_not_found' | 'no_services' | null;
}

export function parseShopIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const queryShop = params.get('shop') || params.get('shop_id');
  if (queryShop && queryShop.trim()) {
    return queryShop.trim();
  }

  // Parse path slug from /shop/:slug or /book-appointment/:slug
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith('/shop/')) {
    const slug = pathname.replace(/^\/shop\//, '').replace(/\/.*$/, '').trim();
    if (slug) return slug;
  }
  if (pathname.startsWith('/book-appointment/')) {
    const slug = pathname.replace(/^\/book-appointment\//, '').replace(/\/.*$/, '').trim();
    if (slug) return slug;
  }

  return '';
}

export function mapSupabaseServiceRecord(s: any): ServiceItem {
  const dur = Number(s.duration_min ?? s.durationMins ?? 45);
  return {
    id: s.id,
    shopId: s.shop_id ?? s.shopId ?? '',
    name: s.name,
    category: s.category || 'Precision Haircuts',
    durationMins: dur,
    price: Number(s.price ?? 60),
    description: s.description || '',
    popular: s.popular ?? true,
    active: s.active !== false && s.is_active !== false,
    image: s.image || ASSETS.serviceSkinFade,
  };
}

export function mapSupabaseBarberRecord(b: any): BarberItem {
  const expYears = b.experience_years ?? b.experienceYears ?? 5;
  return {
    id: b.id,
    uid: b.user_uid ?? b.userUid ?? b.uid ?? '',
    shopId: b.shop_id ?? b.shopId ?? '',
    name: b.name,
    role: b.role || 'Master Barber',
    rating: parseFloat(b.rating) || 5.0,
    reviews: b.review_count ?? b.reviews ?? b.reviewCount ?? 0,
    experience: b.experience || `${expYears} yrs`,
    specialty: b.specialty || 'Haircut & Beard Styling',
    shopName: b.shop_name ?? b.shopName ?? 'Pawan Hair Saloon',
    nextAvailable: b.next_available ?? b.nextAvailable ?? 'Today · IST',
    priceFrom: Number(b.price_from ?? b.priceFrom ?? 60),
    avatar: b.avatar || b.image || ASSETS.barberMarcus,
    bio: b.bio || '',
    active: b.active !== false,
    verificationStatus: b.verification_status ?? b.verificationStatus ?? 'verified',
  };
}

export function mapSupabaseShopRecord(sh: any): ShopItem {
  return {
    id: sh.id,
    ownerUid: sh.owner_uid ?? sh.ownerUid ?? '',
    name: sh.name,
    district: sh.district || sh.city || 'Civil Lines, Ludhiana',
    address: sh.address || '',
    phone: sh.phone || '+91',
    distance: sh.distance || '0.8 km away',
    distanceMilesTenths: sh.distance_miles_tenths ?? sh.distanceMilesTenths ?? 8,
    rating: parseFloat(sh.rating) || 5.0,
    reviewCount: sh.review_count ?? sh.reviewCount ?? 0,
    isOpen: sh.is_open ?? sh.isOpen ?? true,
    priceTier: sh.price_tier ?? sh.priceTier ?? '₹60 – ₹120',
    minPrice: sh.min_price ?? sh.minPrice ?? 60,
    verified: sh.verified ?? true,
    approvalStatus: sh.approval_status ?? sh.approvalStatus ?? 'approved',
    image: sh.image || ASSETS.royalInterior,
    tagline: sh.tagline || 'Luxury Grooming & Bespoke Appointments',
    about: sh.about || '',
    qrCodeUrl: getShopQrDestinationUrl(sh.id),
  };
}

/**
 * Loads a shop and its associated active services and barbers from Supabase
 * Enforcing shop validation, strict foreign key scoping, and development logging.
 */
export async function loadShopForBooking(
  targetShopId: string,
  fallbackShops: any[] = [],
  fallbackServices: any[] = [],
  fallbackBarbers: any[] = []
): Promise<BookingLoadResult> {
  const cleanId = String(targetShopId || '').trim();

  if (!cleanId) {
    console.log('BOOKING SHOP ID:', null);
    console.log('SHOP RESULT:', null);
    console.log('SERVICES RESULT:', 0);
    console.log('BARBERS RESULT:', 0);
    console.log('SELECTED SHOP:', null);
    return {
      shop: null,
      services: [],
      barbers: [],
      error: 'missing_shop',
    };
  }

  const supa = (typeof window !== 'undefined' && (window as any).barberLooSupabase) || supabase;

  // 1. Fast Path: If shop and its services exist in fallback bootstrap memory, avoid redundant network requests
  const memoryShop = findShopBySlugOrId(fallbackShops, cleanId);
  if (memoryShop) {
    const memoryServices = fallbackServices
      .filter((s) => (s.shopId === memoryShop.id || s.shop_id === memoryShop.id) && s.active !== false)
      .map(mapSupabaseServiceRecord);
    const memoryBarbers = fallbackBarbers
      .filter((b) => (b.shopId === memoryShop.id || b.shop_id === memoryShop.id) && b.active !== false && b.verificationStatus !== 'suspended')
      .map(mapSupabaseBarberRecord);

    if (memoryServices.length > 0) {
      console.log('BOOKING SHOP ID:', memoryShop.id);
      console.log('SHOP RESULT:', memoryShop);
      console.log('SERVICES RESULT:', memoryServices.length);
      console.log('BARBERS RESULT:', memoryBarbers.length);
      console.log('SELECTED SHOP:', memoryShop.name);
      return {
        shop: memoryShop,
        services: memoryServices,
        barbers: memoryBarbers,
        error: null,
      };
    }
  }

  // 2. Parallel Scoped Fetch: Retrieve shop, services and barbers in a single roundtrip with explicit columns
  let rawShop: any = null;
  let rawServices: any[] = [];
  let rawBarbers: any[] = [];

  try {
    const [shopRes, servicesRes, barbersRes] = await Promise.all([
      supa
        .from('shops')
        .select('id, owner_uid, name, district, address, phone, rating, review_count, is_open, closes_at, price_tier, min_price, verified, logo_url, image, tagline, about, qr_code_slug')
        .eq('id', cleanId)
        .maybeSingle(),
      supa
        .from('services')
        .select('id, shop_id, index_code, name, category, duration_min, price, description, popular, active, image')
        .eq('shop_id', cleanId),
      supa
        .from('barbers')
        .select('id, user_uid, shop_id, name, role, rating, review_count, experience_years, specialty, shop_name, price_from, image, avatar, bio, featured, active, verified, verification_status, chair_break_active, assigned_service_ids')
        .eq('shop_id', cleanId),
    ]);

    if (shopRes.data) rawShop = shopRes.data;
    if (Array.isArray(servicesRes.data)) rawServices = servicesRes.data;
    if (Array.isArray(barbersRes.data)) rawBarbers = barbersRes.data;
  } catch (err) {
    console.warn('[BarberLoo] Supabase scoped booking fetch error:', err);
  }

  if (!rawShop) {
    rawShop = memoryShop || findShopBySlugOrId(fallbackShops, cleanId);
  }

  // Resilient fallback to backend /api/shops/:id
  if (!rawShop) {
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.shop) {
          rawShop = json.shop;
          if (Array.isArray(json.services) && rawServices.length === 0) rawServices = json.services;
          if (Array.isArray(json.barbers) && rawBarbers.length === 0) rawBarbers = json.barbers;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!rawShop) {
    console.log('BOOKING SHOP ID:', cleanId);
    console.log('SHOP RESULT:', null);
    console.log('SERVICES RESULT:', 0);
    console.log('BARBERS RESULT:', 0);
    console.log('SELECTED SHOP:', null);
    return {
      shop: null,
      services: [],
      barbers: [],
      error: 'shop_not_found',
    };
  }

  const currentShop = mapSupabaseShopRecord(rawShop);

  if (rawServices.length === 0) {
    rawServices = fallbackServices.filter(
      (s) => s.shopId === currentShop.id || s.shop_id === currentShop.id
    );
  }

  const shopServices = rawServices
    .map(mapSupabaseServiceRecord)
    .filter((s) => s.active !== false);

  if (rawBarbers.length === 0) {
    rawBarbers = fallbackBarbers.filter(
      (b) => b.shopId === currentShop.id || b.shop_id === currentShop.id
    );
  }

  const shopBarbers = rawBarbers
    .map(mapSupabaseBarberRecord)
    .filter((b) => b.active !== false && b.verificationStatus !== 'suspended');

  // Development logs as required by Section 16
  console.log('BOOKING SHOP ID:', currentShop.id);
  console.log('SHOP RESULT:', currentShop);
  console.log('SERVICES RESULT:', shopServices.length);
  console.log('BARBERS RESULT:', shopBarbers.length);
  console.log('SELECTED SHOP:', currentShop.name);

  // If services = 0
  if (shopServices.length === 0) {
    return {
      shop: currentShop,
      services: [],
      barbers: shopBarbers,
      error: 'no_services',
    };
  }

  return {
    shop: currentShop,
    services: shopServices,
    barbers: shopBarbers,
    error: null,
  };
}
