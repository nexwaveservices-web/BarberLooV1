import { supabase } from './supabase';
import { ASSETS, BarberItem, ServiceItem, ShopItem } from '../data/barberlooData';
import { getShopQrDestinationUrl } from './domain';

export interface BookingLoadResult {
  shop: ShopItem | null;
  services: ServiceItem[];
  barbers: BarberItem[];
  error: 'missing_shop' | 'shop_not_found' | 'no_services' | null;
}

export function parseShopIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop_id') || params.get('shop') || '';
  return shopId.trim();
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

  // 1. Load Shop record
  let rawShop: any = null;
  let apiLoadedServices: any[] = [];
  let apiLoadedBarbers: any[] = [];

  try {
    const { data, error } = await supa
      .from('shops')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error) {
      console.warn('[BarberLoo] Supabase shop query warning:', error.message);
    }
    if (data) {
      rawShop = data;
    }
  } catch (err) {
    console.warn('[BarberLoo] Supabase shop fetch exception:', err);
  }

  if (!rawShop) {
    rawShop = fallbackShops.find((s) => s.id === cleanId || s.qrCodeSlug === cleanId);
  }

  // Resilient fallback to backend /api/shops/:id
  if (!rawShop) {
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.shop) {
          rawShop = json.shop;
          if (Array.isArray(json.services)) apiLoadedServices = json.services;
          if (Array.isArray(json.barbers)) apiLoadedBarbers = json.barbers;
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

  // 2. Load Services strictly scoped to this shop_id
  let rawServices: any[] = [];
  try {
    const { data, error } = await supa
      .from('services')
      .select('*')
      .eq('shop_id', currentShop.id);

    if (error) {
      console.warn('[BarberLoo] Supabase services query warning:', error.message);
    }
    if (Array.isArray(data) && data.length > 0) {
      rawServices = data;
    }
  } catch (err) {
    console.warn('[BarberLoo] Supabase services fetch exception:', err);
  }

  if (rawServices.length === 0 && apiLoadedServices.length > 0) {
    rawServices = apiLoadedServices;
  }

  if (rawServices.length === 0) {
    rawServices = fallbackServices.filter(
      (s) => s.shopId === currentShop.id || s.shop_id === currentShop.id
    );
  }

  if (rawServices.length === 0) {
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(currentShop.id)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.services) && json.services.length > 0) {
          rawServices = json.services;
        }
        if (Array.isArray(json.barbers) && json.barbers.length > 0 && apiLoadedBarbers.length === 0) {
          apiLoadedBarbers = json.barbers;
        }
      }
    } catch {
      // ignore
    }
  }

  const shopServices = rawServices
    .map(mapSupabaseServiceRecord)
    .filter((s) => s.active !== false);

  // 3. Load Barbers strictly scoped to this shop_id
  let rawBarbers: any[] = [];
  try {
    const { data, error } = await supa
      .from('barbers')
      .select('*')
      .eq('shop_id', currentShop.id);

    if (error) {
      console.warn('[BarberLoo] Supabase barbers query warning:', error.message);
    }
    if (Array.isArray(data) && data.length > 0) {
      rawBarbers = data;
    }
  } catch (err) {
    console.warn('[BarberLoo] Supabase barbers fetch exception:', err);
  }

  if (rawBarbers.length === 0 && apiLoadedBarbers.length > 0) {
    rawBarbers = apiLoadedBarbers;
  }

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
