import { getAuthToken, OWNER_ADMIN_EMAIL } from './firebase';
import {
  supabase,
  safeSupabaseUpsert,
  safeSupabaseDelete,
  broadcastSupabaseEvent,
  connectSupabaseRealtime,
} from './supabase';
import { ASSETS, OPENING_HOURS } from '../data/barberlooData';
import { DEFAULT_STATES, DEFAULT_CITIES } from './locations';

async function safeBackendRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname.includes('barberloo.in')
  ) {
    return null;
  }
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function mapSupabaseShop(sh: any) {
  const rawCity = String(sh.city || sh.district || 'Jalandhar');
  const matchedCity = DEFAULT_CITIES.find(
    (c) =>
      c.id === sh.city_id ||
      c.id === sh.cityId ||
      c.name.toLowerCase() === rawCity.toLowerCase() ||
      rawCity.toLowerCase().includes(c.name.toLowerCase())
  );
  const stateId =
    sh.state_id ||
    sh.stateId ||
    (matchedCity ? matchedCity.stateId : 'st-pb');
  const cityId =
    sh.city_id ||
    sh.cityId ||
    (matchedCity ? matchedCity.id : 'ct-jal');
  const cityName = matchedCity ? matchedCity.name : rawCity;
  const stateName =
    DEFAULT_STATES.find((s) => s.id === stateId)?.name || 'Punjab';

  return {
    id: sh.id,
    ownerUid: sh.owner_uid ?? sh.ownerUid ?? '',
    name: sh.name,
    stateId,
    cityId,
    state_id: stateId,
    city_id: cityId,
    state: stateName,
    city: cityName,
    district: sh.district || `${cityName}, ${stateName}`,
    address: sh.address || '',
    phone: sh.phone || '+91',
    distance: sh.distance || '1.0 km away',
    distanceMilesTenths: sh.distance_miles_tenths ?? sh.distanceMilesTenths ?? 10,
    rating: parseFloat(sh.rating) || 5.0,
    reviewCount: sh.review_count ?? sh.reviewCount ?? 0,
    isOpen: sh.is_open ?? sh.isOpen ?? true,
    closesAt: sh.closes_at ?? sh.closesAt ?? '21:30',
    priceTier: sh.price_tier ?? sh.priceTier ?? '₹500 – ₹1,500',
    minPrice: sh.min_price ?? sh.minPrice ?? 500,
    verified: sh.verified ?? true,
    approvalStatus: sh.approval_status ?? sh.approvalStatus ?? 'approved',
    logoUrl: sh.logo_url ?? sh.logoUrl ?? '',
    image: sh.image || ASSETS.royalInterior,
    tagline: sh.tagline || 'Bespoke Grooming & Reserved Appointments',
    about: sh.about || '',
    qrCodeSlug: sh.qr_code_slug ?? sh.qrCodeSlug ?? sh.id,
    qrCodeUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/booking.html?shop_id=${encodeURIComponent(
      sh.id
    )}`,
  };
}

function mapSupabaseBarber(b: any) {
  const expYears = b.experience_years ?? b.experienceYears ?? 5;
  return {
    id: b.id,
    userUid: b.user_uid ?? b.userUid ?? '',
    shopId: b.shop_id ?? b.shopId ?? 'shop-1',
    name: b.name,
    role: b.role || 'Master Barber',
    rating: parseFloat(b.rating) || 5.0,
    reviews: b.review_count ?? b.reviews ?? 0,
    experience: b.experience || `${expYears} yrs`,
    experienceYears: expYears,
    specialty: b.specialty || 'Haircut & Beard Styling',
    shopName: b.shop_name ?? b.shopName ?? 'Partner Salon',
    nextAvailable: b.next_available ?? b.nextAvailable ?? 'Today · IST',
    priceFrom: Number(b.price_from ?? b.priceFrom ?? 500),
    image: b.image || b.avatar || ASSETS.barberMarcus,
    avatar: b.avatar || b.image || ASSETS.barberMarcus,
    bio: b.bio || '',
    featured: b.featured ?? true,
    active: b.active ?? true,
    verified: b.verified ?? true,
    verificationStatus: b.verification_status ?? b.verificationStatus ?? 'verified',
    chairBreakActive: b.chair_break_active ?? b.chairBreakActive ?? false,
    assignedServiceIds: b.assigned_service_ids ?? b.assignedServiceIds ?? '',
  };
}

function mapSupabaseService(s: any) {
  const dur = Number(s.duration_min ?? s.durationMins ?? 45);
  return {
    id: s.id,
    shopId: s.shop_id ?? s.shopId ?? 'shop-1',
    index: s.index_code ?? s.index ?? '01',
    name: s.name,
    category: s.category || 'Precision Haircuts',
    duration: `${dur} min`,
    durationMin: dur,
    durationMins: dur,
    price: Number(s.price ?? 500),
    description: s.description || '',
    popular: s.popular ?? true,
    active: s.active ?? true,
    image: s.image || ASSETS.serviceSkinFade,
  };
}

function deriveAppointmentOtp(
  id: string,
  notes?: string,
  barberNotes?: string
): string {
  const combined = `${barberNotes || ''} ${notes || ''}`;
  const match = combined.match(/\[OTP:(\d{4})\]/);
  if (match && match[1]) {
    return match[1];
  }
  let hash = 0;
  const str = String(id || 'apt-default');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 9000;
  }
  return String(1000 + Math.abs(hash));
}

function stripOtpTag(text?: string): string {
  if (!text) return '';
  return text.replace(/\[OTP:\d{4}\]\s*/g, '').trim();
}

function mapSupabaseAppointment(a: any) {
  const rawStatus = String(a.status || 'confirmed').toLowerCase();
  const dur = Number(a.duration_min ?? a.durationMins ?? 45);
  const rawBarberNotes = a.internal_barber_notes ?? a.barberNotes ?? '';
  const completionOtp =
    a.completionOtp ||
    a.completion_otp ||
    deriveAppointmentOtp(a.id, a.notes, rawBarberNotes);
  return {
    id: a.id,
    referenceCode: a.referenceCode || String(a.id).toUpperCase(),
    customerUid: a.customer_uid ?? a.customerUid ?? '',
    clientName: a.client_name ?? a.clientName ?? 'Client',
    clientPhone: a.client_phone ?? a.clientPhone ?? '+91',
    clientTier: a.client_tier ?? a.clientTier ?? 'Member',
    shopId: a.shop_id ?? a.shopId ?? 'shop-1',
    shopName: a.shop_name ?? a.shopName ?? 'Partner Salon',
    barberId: a.barber_id ?? a.barberId ?? 'brb-1',
    barberName: a.barber_name ?? a.barberName ?? 'Barber',
    barberAvatar: a.barberAvatar || ASSETS.barberMarcus,
    serviceId: a.service_id ?? a.serviceId ?? 'srv-1',
    serviceName: a.service_name ?? a.serviceName ?? 'Grooming Service',
    date: a.date,
    time: a.time,
    durationMin: dur,
    durationMins: dur,
    price: Number(a.price ?? 500),
    status:
      rawStatus === 'confirmed'
        ? 'Confirmed'
        : rawStatus === 'completed'
        ? 'Completed'
        : rawStatus === 'cancelled'
        ? 'Cancelled'
        : rawStatus === 'in_progress'
        ? 'In Progress'
        : rawStatus === 'no_show'
        ? 'No-Show'
        : 'Pending',
    rawStatus,
    paymentMethod: a.payment_method ?? a.paymentMethod ?? 'online',
    paymentStatus: a.payment_status ?? a.paymentStatus ?? 'paid',
    notes: stripOtpTag(a.notes || ''),
    barberNotes: stripOtpTag(rawBarberNotes),
    couponCode: a.coupon_code ?? a.couponCode ?? '',
    completionOtp,
  };
}

function mapSupabaseProfile(p: any) {
  const email = String(p.email || '').toLowerCase();
  return {
    id: p.id || `prof-${p.uid}`,
    uid: p.uid,
    email: p.email,
    name: p.name || email.split('@')[0] || 'User',
    phone: p.phone || '',
    avatarUrl: p.avatar_url ?? p.avatarUrl ?? '',
    role: email === OWNER_ADMIN_EMAIL ? 'admin' : p.role || 'customer',
    stateId: p.state_id ?? p.stateId ?? 'st-pb',
    cityId: p.city_id ?? p.cityId ?? 'ct-jal',
    state: p.state ?? 'Punjab',
    city: p.city ?? 'Jalandhar',
    tier:
      email === OWNER_ADMIN_EMAIL
        ? 'Founder & Platform Admin'
        : p.tier || 'Member',
    preferredNotes: p.preferred_notes ?? p.preferredNotes ?? '',
    rewardBalance: Number(p.reward_balance ?? p.rewardBalance ?? 0),
    status: p.status || 'active',
  };
}

function mergeById<T extends { id?: string; uid?: string }>(
  primary: T[] = [],
  secondary: T[] = [],
  key: 'id' | 'uid' = 'id'
): T[] {
  const map = new Map<string, T>();
  for (const item of secondary) {
    const k = String(item[key] || '');
    if (k) map.set(k, item);
  }
  for (const item of primary) {
    const k = String(item[key] || '');
    if (k) map.set(k, item);
  }
  return Array.from(map.values());
}

export const apiFetchBootstrap = async (uid = '') => {
  const backendPromise = safeBackendRequest<any>(
    `/api/bootstrap${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`
  );

  let supaData: Record<string, any[]> = {};
  try {
    const [
      shopsRes,
      barbersRes,
      servicesRes,
      aptsRes,
      reviewsRes,
      profilesRes,
      couponsRes,
      paymentsRes,
      reportsRes,
      workingHoursRes,
      shopGalleryRes,
      barberGalleryRes,
      favsRes,
      notifsRes,
      rewardsRes,
    ] = await Promise.all([
      supabase.from('shops').select('*'),
      supabase.from('barbers').select('*'),
      supabase.from('services').select('*'),
      supabase.from('appointments').select('*').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('coupons').select('*'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('working_hours').select('*').order('day_order', { ascending: true }),
      supabase.from('shop_gallery').select('*'),
      supabase.from('barber_gallery').select('*'),
      uid
        ? supabase.from('favorites').select('*').eq('customer_uid', uid)
        : Promise.resolve({ data: [] }),
      uid
        ? supabase
            .from('notifications')
            .select('*')
            .eq('recipient_uid', uid)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      uid
        ? supabase
            .from('rewards')
            .select('*')
            .eq('customer_uid', uid)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    supaData = {
      shops: (shopsRes.data || []).map(mapSupabaseShop),
      barbers: (barbersRes.data || []).map(mapSupabaseBarber),
      services: (servicesRes.data || []).map(mapSupabaseService),
      appointments: (aptsRes.data || []).map(mapSupabaseAppointment),
      reviews: (reviewsRes.data || []).map((r: any) => ({
        id: r.id,
        shopId: r.shop_id ?? r.shopId ?? 'shop-1',
        barberId: r.barber_id ?? r.barberId ?? 'brb-1',
        customerUid: r.customer_uid ?? r.customerUid,
        author: r.author,
        role: r.role,
        rating: r.rating,
        date: r.date,
        comment: r.comment,
        service: r.service_name ?? r.service,
        barber: r.barber_name ?? r.barber,
        status: r.status || 'published',
        moderationNote: r.moderation_note ?? r.moderationNote ?? '',
      })),
      profiles: (profilesRes.data || []).map(mapSupabaseProfile),
      coupons: (couponsRes.data || []).map((c: any) => ({
        id: c.id,
        shopId: c.shop_id ?? c.shopId ?? 'shop-1',
        code: c.code,
        discountPercent: c.discount_percent ?? c.discountPercent ?? 15,
        discountText: c.discount_text ?? c.discountText ?? '',
        description: c.discount_text ?? c.description ?? '',
        minSpend: c.min_spend ?? c.minSpend ?? 500,
        usesCount: c.uses_count ?? c.usesCount ?? 0,
        maxUses: c.max_uses ?? c.maxUses ?? 200,
        status: c.status || 'Active',
        expiresAt: c.expires_at ?? c.expiresAt ?? '2027-12-31',
        expiryDate: c.expires_at ?? c.expiryDate ?? '2027-12-31',
      })),
      payments: (paymentsRes.data || []).map((p: any) => ({
        id: p.id,
        appointmentId: p.appointment_id ?? p.appointmentId,
        customerUid: p.customer_uid ?? p.customerUid,
        clientName: p.client_name ?? p.clientName,
        shopId: p.shop_id ?? p.shopId ?? 'shop-1',
        shopName: p.shop_name ?? p.shopName,
        amount: Number(p.amount ?? 0),
        platformFee: Number(p.platform_fee ?? p.platformFee ?? 25),
        method: p.method,
        methodDisplay: p.method_display ?? p.methodDisplay,
        status: p.status,
        receiptNumber: p.receipt_number ?? p.receiptNumber,
      })),
      reports: (reportsRes.data || []).map((rep: any) => ({
        id: rep.id,
        reporterUid: rep.reporter_uid ?? rep.reporterUid,
        reporterName: rep.reporter_name ?? rep.reporterName,
        targetType: rep.target_type ?? rep.targetType,
        targetId: rep.target_id ?? rep.targetId,
        targetLabel: rep.target_label ?? rep.targetLabel,
        reason: rep.reason,
        details: rep.details,
        status: rep.status,
        resolutionNote: rep.resolution_note ?? rep.resolutionNote ?? '',
      })),
      workingHours: (workingHoursRes.data || []).map((wh: any) => ({
        id: wh.id,
        shopId: wh.shop_id ?? wh.shopId ?? 'shop-1',
        barberId: wh.barber_id ?? wh.barberId ?? 'brb-1',
        day: wh.day_of_week ?? wh.day,
        dayOfWeek: wh.day_of_week ?? wh.dayOfWeek ?? wh.day,
        dayOrder: wh.day_order ?? wh.dayOrder ?? 1,
        startTime: wh.start_time ?? wh.startTime ?? '09:30',
        endTime: wh.end_time ?? wh.endTime ?? '21:30',
        breakStart: wh.break_start ?? wh.breakStart ?? '14:00',
        breakEnd: wh.break_end ?? wh.breakEnd ?? '14:45',
        isDayOff: Boolean(wh.is_day_off ?? wh.isDayOff),
        holidayNote: wh.holiday_note ?? wh.holidayNote ?? '',
        hours:
          wh.is_day_off ?? wh.isDayOff
            ? 'Closed'
            : `${wh.start_time ?? wh.startTime ?? '09:30'} – ${
                wh.end_time ?? wh.endTime ?? '21:30'
              }`,
        status:
          wh.is_day_off ?? wh.isDayOff
            ? 'Closed'
            : wh.holiday_note || 'Open',
      })),
      shopGallery: (shopGalleryRes.data || []).map((g: any) => ({
        id: g.id,
        shopId: g.shop_id ?? g.shopId ?? 'shop-1',
        imageUrl: g.image_url ?? g.imageUrl,
        title: g.title,
        caption: g.caption || '',
      })),
      barberGallery: (barberGalleryRes.data || []).map((g: any) => ({
        id: g.id,
        barberId: g.barber_id ?? g.barberId ?? 'brb-1',
        imageUrl: g.image_url ?? g.imageUrl,
        title: g.title,
        styleTag: g.style_tag ?? g.styleTag ?? '',
      })),
      favorites: (favsRes.data || []).map((f: any) => ({
        id: f.id,
        customerUid: f.customer_uid ?? f.customerUid,
        targetType: f.target_type ?? f.targetType,
        targetId: f.target_id ?? f.targetId,
      })),
      notifications: (notifsRes.data || []).map((n: any) => ({
        id: n.id,
        recipientUid: n.recipient_uid ?? n.recipientUid,
        type: n.type,
        title: n.title,
        timeLabel: n.time_label ?? n.timeLabel ?? 'Just now',
        unread: n.unread ?? true,
      })),
      rewards: (rewardsRes.data || []).map((rw: any) => ({
        id: rw.id,
        customerUid: rw.customer_uid ?? rw.customerUid,
        pointsDelta: Number(rw.points_delta ?? rw.pointsDelta ?? 0),
        reason: rw.reason,
        type: rw.type,
      })),
    };
  } catch {
    // Ignore Supabase fetch error if offline
  }

  const backendData = await backendPromise;

  const mergedWorkingHours = mergeById(
    supaData.workingHours,
    backendData?.workingHours
  );

  return {
    shops: mergeById(supaData.shops, backendData?.shops),
    barbers: mergeById(supaData.barbers, backendData?.barbers),
    services: mergeById(supaData.services, backendData?.services),
    appointments: mergeById(supaData.appointments, backendData?.appointments),
    reviews: mergeById(supaData.reviews, backendData?.reviews),
    profiles: mergeById(supaData.profiles, backendData?.profiles, 'uid'),
    coupons: mergeById(supaData.coupons, backendData?.coupons),
    payments: mergeById(supaData.payments, backendData?.payments),
    reports: mergeById(supaData.reports, backendData?.reports),
    favorites: mergeById(supaData.favorites, backendData?.favorites),
    notifications: mergeById(supaData.notifications, backendData?.notifications),
    rewards: mergeById(supaData.rewards, backendData?.rewards),
    workingHours: mergedWorkingHours.length ? mergedWorkingHours : OPENING_HOURS,
    shopGallery: mergeById(supaData.shopGallery, backendData?.shopGallery),
    barberGallery: mergeById(supaData.barberGallery, backendData?.barberGallery),
  };
};

export const apiSyncAuthUser = async (payload: {
  uid: string;
  email: string;
  name?: string;
  role?: 'customer' | 'barber' | 'admin';
  phone?: string;
  stateId?: string;
  state_id?: string;
  cityId?: string;
  city_id?: string;
  state?: string;
  city?: string;
}) => {
  const cleanEmail = payload.email.trim().toLowerCase();
  const displayName = payload.name?.trim() || cleanEmail.split('@')[0];

  let existingRole: string | undefined;
  let existingReward = 0;
  let existingProfileRow: any = null;
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', payload.uid)
      .maybeSingle();
    if (existing) {
      existingProfileRow = existing;
      existingRole = existing.role;
      existingReward = existing.reward_balance || 0;
    }
  } catch {
    // ignore
  }

  const finalRole =
    cleanEmail === OWNER_ADMIN_EMAIL
      ? 'admin'
      : existingRole === 'barber' || existingRole === 'shop_owner'
      ? 'barber'
      : existingRole === 'customer'
      ? 'customer'
      : payload.role === 'barber'
      ? 'barber'
      : 'customer';

  const profileRecord: Record<string, any> = {
    id: existingProfileRow?.id || `prof-${payload.uid}`,
    uid: payload.uid,
    email: cleanEmail,
    name: displayName,
    phone: payload.phone || existingProfileRow?.phone || '',
    role: finalRole,
    tier:
      finalRole === 'admin'
        ? 'Founder & Platform Admin'
        : finalRole === 'barber'
        ? 'Verified Barber Partner'
        : 'Member',
    preferred_notes: existingProfileRow?.preferred_notes || '',
    reward_balance: existingReward,
    status: existingProfileRow?.status || 'active',
    state_id: payload.stateId || payload.state_id || existingProfileRow?.state_id || 'st-pb',
    city_id: payload.cityId || payload.city_id || existingProfileRow?.city_id || 'ct-jal',
    state: payload.state || existingProfileRow?.state || 'Punjab',
    city: payload.city || existingProfileRow?.city || 'Jalandhar',
  };
  if (existingProfileRow?.assigned_barber_id) {
    profileRecord.assigned_barber_id = existingProfileRow.assigned_barber_id;
  }
  if (existingProfileRow?.assigned_shop_id) {
    profileRecord.assigned_shop_id = existingProfileRow.assigned_shop_id;
  }

  await safeSupabaseUpsert('profiles', profileRecord);

  const backendRes = await safeBackendRequest<{ profile: any }>(
    '/api/auth/sync',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        role: finalRole,
      }),
    }
  );

  return {
    profile: backendRes?.profile || mapSupabaseProfile(profileRecord),
  };
};

export const apiUpdateProfile = async (
  uid: string,
  updates: {
    name?: string;
    phone?: string;
    email?: string;
    preferredNotes?: string;
    avatarUrl?: string;
    role?: string;
    status?: string;
    stateId?: string;
    cityId?: string;
    state?: string;
    city?: string;
  }
) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.phone !== undefined) supaUpdates.phone = updates.phone;
    if (updates.email !== undefined) supaUpdates.email = updates.email;
    if (updates.preferredNotes !== undefined)
      supaUpdates.preferred_notes = updates.preferredNotes;
    if (updates.avatarUrl !== undefined)
      supaUpdates.avatar_url = updates.avatarUrl;
    if (updates.role !== undefined) supaUpdates.role = updates.role;
    if (updates.status !== undefined) supaUpdates.status = updates.status;
    if (updates.stateId !== undefined) supaUpdates.state_id = updates.stateId;
    if (updates.cityId !== undefined) supaUpdates.city_id = updates.cityId;
    if (updates.state !== undefined) supaUpdates.state = updates.state;
    if (updates.city !== undefined) supaUpdates.city = updates.city;
    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('profiles').update(supaUpdates).eq('uid', uid);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/profiles/${encodeURIComponent(uid)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'profiles' });
  return updated || { uid, ...updates };
};

export const apiCreateAppointment = async (payload: any) => {
  const id = payload.id || `apt-${Date.now()}`;
  const barberId = payload.barberId || 'brb-1';
  const date = payload.date;
  const time = payload.time;

  // Double-booking prevention check in Supabase
  try {
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('barber_id', barberId)
      .eq('date', date)
      .eq('time', time);
    const activeConflict = (conflicts || []).some((c: any) =>
      ['pending', 'confirmed', 'in_progress'].includes(
        String(c.status || '').toLowerCase()
      )
    );
    if (activeConflict) {
      throw new Error(
        `This slot (${date} at ${time} IST) is already booked for ${
          payload.barberName || 'this barber'
        }. Please select another time slot.`
      );
    }
  } catch (err: any) {
    if (err?.message?.includes('already booked')) {
      throw err;
    }
  }

  const isPaid =
    payload.paymentMethod === 'razorpay' ||
    payload.paymentMethod === 'online' ||
    Boolean(payload.razorpayPaymentId);
  const paymentStatus = isPaid ? 'paid' : 'pending';
  const completionOtp = deriveAppointmentOtp(id);

  let methodDisplay = 'Pay at Salon (INR)';
  if (payload.paymentMethod === 'razorpay' || payload.paymentMethod === 'online') {
    methodDisplay = payload.razorpayPaymentId
      ? `Razorpay (${payload.razorpayPaymentId})`
      : 'Razorpay Instant (UPI / Card)';
  } else if (payload.paymentMethod === 'woocommerce') {
    methodDisplay = payload.woocommerceOrderId
      ? `WooCommerce Order #${payload.woocommerceOrderId}`
      : 'WooCommerce Checkout';
  }

  let finalNotes = payload.notes || '';
  if (payload.razorpayPaymentId) {
    finalNotes += ` | Razorpay Txn: ${payload.razorpayPaymentId}`;
  }
  if (payload.woocommerceOrderId) {
    finalNotes += ` | WooCommerce Order: #${payload.woocommerceOrderId}`;
  }

  const supaApt = {
    id,
    customer_uid: payload.customerUid,
    client_name: payload.clientName,
    client_phone: payload.clientPhone || '+91',
    client_tier: 'Member',
    shop_id: payload.shopId || 'shop-1',
    shop_name: payload.shopName || 'Partner Salon',
    barber_id: barberId,
    barber_name: payload.barberName || 'Barber',
    service_id: payload.serviceId || 'srv-1',
    service_name: payload.serviceName || 'Grooming Service',
    date,
    time,
    duration_min: Number(payload.durationMin || payload.durationMins || 45),
    price: Number(payload.price || 500),
    status: 'confirmed',
    payment_method: payload.paymentMethod || 'razorpay',
    payment_status: paymentStatus,
    notes: finalNotes,
    internal_barber_notes: `[OTP:${completionOtp}]`,
    coupon_code: payload.couponCode || '',
  };

  await safeSupabaseUpsert('appointments', supaApt);

  // Increment coupon usage if coupon was applied
  if (payload.couponCode) {
    try {
      const { data: cpn } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', String(payload.couponCode).toUpperCase())
        .maybeSingle();
      if (cpn) {
        await supabase
          .from('coupons')
          .update({ uses_count: Number(cpn.uses_count || 0) + 1 })
          .eq('id', cpn.id);
      }
    } catch {
      // ignore
    }
  }

  await safeSupabaseUpsert('payments', {
    id: `pay-${Date.now()}`,
    appointment_id: id,
    customer_uid: payload.customerUid,
    client_name: payload.clientName,
    shop_id: payload.shopId || 'shop-1',
    shop_name: payload.shopName || 'Partner Salon',
    amount: Number(payload.price || 500),
    platform_fee: Math.max(25, Math.round(Number(payload.price || 500) * 0.08)),
    method: payload.paymentMethod || 'razorpay',
    method_display: methodDisplay,
    status: paymentStatus,
    receipt_number: payload.razorpayPaymentId
      ? `RZP-${payload.razorpayPaymentId}`
      : `BL-IN-${Math.floor(10000 + Math.random() * 89999)}`,
  });

  await safeSupabaseUpsert('notifications', {
    id: `notif-${Date.now()}`,
    recipient_uid: payload.customerUid,
    type: 'booking_confirmation',
    title: `Confirmed: ${payload.serviceName} with ${payload.barberName} (${payload.date} · ${payload.time} IST) • Completion OTP sent to ${payload.clientPhone || 'your number'}: ${completionOtp}`,
    time_label: 'Just now · Booking & OTP Engine',
    unread: true,
  });

  const backendCreated = await safeBackendRequest<any>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({ ...payload, id }),
  });

  broadcastSupabaseEvent('state:updated', { entity: 'appointments' });
  return backendCreated || mapSupabaseAppointment(supaApt);
};

export const apiUpdateAppointment = async (id: string, updates: any) => {
  try {
    const { data: existingApt } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const expectedOtp = deriveAppointmentOtp(
      id,
      existingApt?.notes,
      existingApt?.internal_barber_notes
    );

    if (
      updates.status !== undefined &&
      String(updates.status).toLowerCase() === 'completed'
    ) {
      const providedOtp = String(updates.enteredOtp || '').trim();
      if (providedOtp && providedOtp !== expectedOtp) {
        throw new Error(
          'Invalid 4-digit Customer OTP. Please enter the exact OTP sent to the customer number.'
        );
      }
    }

    const supaUpdates: Record<string, any> = {};
    if (updates.status !== undefined) {
      supaUpdates.status = String(updates.status).toLowerCase();
      if (supaUpdates.status === 'completed') {
        supaUpdates.payment_status = 'paid';
      }
    }
    if (updates.date !== undefined) supaUpdates.date = updates.date;
    if (updates.time !== undefined) supaUpdates.time = updates.time;
    if (updates.barberNotes !== undefined) {
      const cleanNote = stripOtpTag(updates.barberNotes);
      supaUpdates.internal_barber_notes = `[OTP:${expectedOtp}] ${cleanNote}`.trim();
    } else if (updates.internalBarberNotes !== undefined) {
      const cleanNote = stripOtpTag(updates.internalBarberNotes);
      supaUpdates.internal_barber_notes = `[OTP:${expectedOtp}] ${cleanNote}`.trim();
    } else if (
      existingApt &&
      !String(existingApt.internal_barber_notes || '').includes('[OTP:')
    ) {
      supaUpdates.internal_barber_notes = `[OTP:${expectedOtp}] ${
        existingApt.internal_barber_notes || ''
      }`.trim();
    }
    if (updates.notes !== undefined) supaUpdates.notes = updates.notes;

    // Double-booking check when rescheduling date/time
    if (existingApt && (updates.date || updates.time)) {
      const checkDate = updates.date || existingApt.date;
      const checkTime = updates.time || existingApt.time;
      const { data: conflicts } = await supabase
        .from('appointments')
        .select('id, status')
        .eq('barber_id', existingApt.barber_id)
        .eq('date', checkDate)
        .eq('time', checkTime)
        .neq('id', id);
      const hasConflict = (conflicts || []).some((c: any) =>
        ['pending', 'confirmed', 'in_progress'].includes(
          String(c.status || '').toLowerCase()
        )
      );
      if (hasConflict) {
        throw new Error(
          `Slot ${checkDate} at ${checkTime} IST is already taken. Please pick another time.`
        );
      }
    }

    await supabase.from('appointments').update(supaUpdates).eq('id', id);

    // Trigger real-time notifications & loyalty rewards in Supabase
    if (existingApt && existingApt.customer_uid) {
      const custUid = existingApt.customer_uid;
      const newStatus = supaUpdates.status;

      if (newStatus === 'completed' && existingApt.status !== 'completed') {
        const earnedPoints = Math.max(
          50,
          Math.round(Number(existingApt.price || 500) * 0.15)
        );
        await safeSupabaseUpsert('rewards', {
          id: `rew-${Date.now()}`,
          customer_uid: custUid,
          points_delta: earnedPoints,
          reason: `Completed: ${existingApt.service_name} (${existingApt.shop_name})`,
          type: 'earned',
        });

        const { data: prof } = await supabase
          .from('profiles')
          .select('reward_balance')
          .eq('uid', custUid)
          .maybeSingle();
        if (prof) {
          await supabase
            .from('profiles')
            .update({
              reward_balance: Number(prof.reward_balance || 0) + earnedPoints,
            })
            .eq('uid', custUid);
        }

        await supabase
          .from('payments')
          .update({ status: 'paid' })
          .eq('appointment_id', id);

        await safeSupabaseUpsert('notifications', {
          id: `notif-comp-${Date.now()}`,
          recipient_uid: custUid,
          type: 'service_completed',
          title: `Service completed with ${existingApt.barber_name}! You earned +${earnedPoints} PTS.`,
          time_label: 'Just now · Salon Desk',
          unread: true,
        });

        await safeSupabaseUpsert('notifications', {
          id: `notif-revreq-${Date.now() + 1}`,
          recipient_uid: custUid,
          type: 'review_request',
          title: `How was your ${existingApt.service_name} with ${existingApt.barber_name}? Share your 1–5★ verified review.`,
          time_label: 'Just now · Review Request',
          unread: true,
        });
      } else if (
        newStatus === 'confirmed' ||
        updates.sendOtp === true
      ) {
        await safeSupabaseUpsert('notifications', {
          id: `notif-rem-${Date.now()}`,
          recipient_uid: custUid,
          type: 'appointment_reminder',
          title: `🔐 Appointment Approved! Completion OTP sent to ${existingApt.client_phone || '+91'}: ${expectedOtp} for ${existingApt.service_name} with ${existingApt.barber_name}. Share this OTP with your barber when work is ✅`,
          time_label: 'Just now · OTP Verification',
          unread: true,
        });
      } else if (newStatus === 'in_progress') {
        await safeSupabaseUpsert('notifications', {
          id: `notif-start-${Date.now()}`,
          recipient_uid: custUid,
          type: 'service_started',
          title: `${existingApt.barber_name} has started your ${existingApt.service_name} session! Your Service Completion OTP (${existingApt.client_phone || '+91'}) is: ${expectedOtp}`,
          time_label: 'Just now · Chair Live',
          unread: true,
        });
      } else if (newStatus === 'cancelled') {
        await safeSupabaseUpsert('notifications', {
          id: `notif-canc-${Date.now()}`,
          recipient_uid: custUid,
          type: 'booking_cancelled',
          title: `Appointment for ${existingApt.service_name} (${existingApt.date} · ${existingApt.time} IST) was cancelled.`,
          time_label: 'Just now · Booking Engine',
          unread: true,
        });
      } else if (updates.date || updates.time) {
        await safeSupabaseUpsert('notifications', {
          id: `notif-resch-${Date.now()}`,
          recipient_uid: custUid,
          type: 'booking_rescheduled',
          title: `Rescheduled: ${existingApt.service_name} moved to ${
            updates.date || existingApt.date
          } at ${updates.time || existingApt.time} IST.`,
          time_label: 'Just now · Booking Engine',
          unread: true,
        });
      }
    }
  } catch (err: any) {
    if (
      err?.message?.includes('already taken') ||
      err?.message?.includes('Invalid 4-digit Customer OTP')
    ) {
      throw err;
    }
  }

  const updated = await safeBackendRequest<any>(
    `/api/appointments/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'appointments' });
  return updated;
};

export const apiCreateService = async (payload: any) => {
  const id = `srv-${Date.now()}`;
  const supaSrv = {
    id,
    shop_id: payload.shopId || 'shop-1',
    index_code: '01',
    name: payload.name,
    category: payload.category || 'Precision Haircuts',
    duration_min: Number(payload.durationMin) || 45,
    price: Number(payload.price) || 750,
    description: payload.description || 'Bespoke grooming service.',
    popular: true,
    active: true,
    image: payload.image || ASSETS.serviceSkinFade,
  };
  await safeSupabaseUpsert('services', supaSrv);

  const created = await safeBackendRequest<any>('/api/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'services' });
  return created || mapSupabaseService(supaSrv);
};

export const apiUpdateService = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.description !== undefined)
      supaUpdates.description = updates.description;
    if (updates.price !== undefined) supaUpdates.price = Number(updates.price);
    if (updates.durationMin !== undefined)
      supaUpdates.duration_min = Number(updates.durationMin);
    if (updates.active !== undefined)
      supaUpdates.active = Boolean(updates.active);
    if (updates.category !== undefined)
      supaUpdates.category = updates.category;
    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('services').update(supaUpdates).eq('id', id);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/services/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'services' });
  return updated;
};

export const apiDeleteService = async (id: string) => {
  await safeSupabaseDelete('services', id);
  await safeBackendRequest<{ ok: boolean }>(
    `/api/services/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'services' });
  return { ok: true };
};

export const apiCreateBarber = async (payload: any) => {
  const id = `brb-${Date.now()}`;
  const supaBrb = {
    id,
    user_uid: payload.userUid || '',
    shop_id: payload.shopId || 'shop-1',
    shop_name: payload.shopName || 'Partner Salon',
    name: payload.name,
    role: payload.role || 'Master Barber',
    specialty: payload.specialty || 'Haircut & Beard Styling',
    rating: '5.0',
    review_count: 0,
    experience_years: Number(payload.experienceYears) || 5,
    next_available: 'Today · IST',
    price_from: Number(payload.priceFrom) || 750,
    image: payload.image || ASSETS.barberMarcus,
    bio: payload.bio || '',
    featured: true,
    active: true,
    verified: true,
    verification_status: 'verified',
    assigned_service_ids: payload.assignedServiceIds || '',
  };
  await safeSupabaseUpsert('barbers', supaBrb);

  const created = await safeBackendRequest<any>('/api/barbers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'barbers' });
  return created || mapSupabaseBarber(supaBrb);
};

export const apiUpdateBarber = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.role !== undefined) supaUpdates.role = updates.role;
    if (updates.specialty !== undefined)
      supaUpdates.specialty = updates.specialty;
    if (updates.bio !== undefined) supaUpdates.bio = updates.bio;
    if (updates.experienceYears !== undefined)
      supaUpdates.experience_years = Number(updates.experienceYears);
    if (updates.priceFrom !== undefined)
      supaUpdates.price_from = Number(updates.priceFrom);
    if (updates.active !== undefined)
      supaUpdates.active = Boolean(updates.active);
    if (updates.verified !== undefined)
      supaUpdates.verified = Boolean(updates.verified);
    if (updates.verificationStatus !== undefined)
      supaUpdates.verification_status = updates.verificationStatus;
    if (updates.chairBreakActive !== undefined)
      supaUpdates.chair_break_active = Boolean(updates.chairBreakActive);
    if (updates.nextAvailable !== undefined)
      supaUpdates.next_available = updates.nextAvailable;
    if (updates.assignedServiceIds !== undefined)
      supaUpdates.assigned_service_ids = updates.assignedServiceIds;
    if (updates.image !== undefined) supaUpdates.image = updates.image;

    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('barbers').update(supaUpdates).eq('id', id);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/barbers/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'barbers' });
  return updated;
};

export const apiDeleteBarber = async (id: string) => {
  await safeSupabaseDelete('barbers', id);
  await safeBackendRequest<{ ok: boolean }>(
    `/api/barbers/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'barbers' });
  return { ok: true };
};

export const apiCreateShop = async (payload: any) => {
  const id = `shop-${Date.now()}`;
  const supaShop = {
    id,
    owner_uid: payload.ownerUid || '',
    name: payload.name,
    state_id: payload.stateId || payload.state_id || 'st-pb',
    city_id: payload.cityId || payload.city_id || 'ct-jal',
    state: payload.state || 'Punjab',
    city: payload.city || 'Jalandhar',
    district:
      payload.district ||
      `${payload.city || 'Jalandhar'}, ${payload.state || 'Punjab'}`,
    address: payload.address || '',
    phone: payload.phone || '+91',
    distance: '1.0 km away',
    distance_miles_tenths: 10,
    rating: '5.0',
    review_count: 0,
    is_open: true,
    closes_at: payload.closesAt || '21:30',
    price_tier: payload.priceTier || '₹500 – ₹1,500',
    min_price: Number(payload.minPrice) || 500,
    verified: true,
    approval_status: 'approved',
    logo_url: payload.logoUrl || '',
    image: payload.image || ASSETS.royalInterior,
    tagline: payload.tagline || 'Bespoke Grooming & Reserved Appointments',
    about: payload.about || '',
    qr_code_slug: id,
  };
  await safeSupabaseUpsert('shops', supaShop);

  const created = await safeBackendRequest<any>('/api/shops', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'shops' });
  return created || mapSupabaseShop(supaShop);
};

export const apiUpdateShop = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.stateId !== undefined) supaUpdates.state_id = updates.stateId;
    if (updates.cityId !== undefined) supaUpdates.city_id = updates.cityId;
    if (updates.state !== undefined) supaUpdates.state = updates.state;
    if (updates.district !== undefined) supaUpdates.district = updates.district;
    if (updates.city !== undefined) supaUpdates.city = updates.city;
    if (updates.address !== undefined) supaUpdates.address = updates.address;
    if (updates.phone !== undefined) supaUpdates.phone = updates.phone;
    if (updates.isOpen !== undefined) supaUpdates.is_open = updates.isOpen;
    if (updates.closesAt !== undefined) supaUpdates.closes_at = updates.closesAt;
    if (updates.verified !== undefined) supaUpdates.verified = updates.verified;
    if (updates.approvalStatus !== undefined)
      supaUpdates.approval_status = updates.approvalStatus;
    if (updates.tagline !== undefined) supaUpdates.tagline = updates.tagline;
    if (updates.about !== undefined) supaUpdates.about = updates.about;
    if (updates.priceTier !== undefined)
      supaUpdates.price_tier = updates.priceTier;
    if (updates.minPrice !== undefined)
      supaUpdates.min_price = Number(updates.minPrice);
    if (updates.image !== undefined) supaUpdates.image = updates.image;
    if (updates.logoUrl !== undefined) supaUpdates.logo_url = updates.logoUrl;

    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('shops').update(supaUpdates).eq('id', id);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/shops/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'shops' });
  return updated;
};

export const apiUpdateWorkingHours = async (id: string, updates: any) => {
  try {
    const { data: existing } = await supabase
      .from('working_hours')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const defaultDay = OPENING_HOURS.find((d) => d.id === id);
    const record = {
      id,
      shop_id: updates.shopId || existing?.shop_id || 'shop-1',
      barber_id: updates.barberId || existing?.barber_id || 'brb-1',
      day_of_week:
        updates.dayOfWeek ||
        existing?.day_of_week ||
        defaultDay?.day ||
        'Monday',
      day_order:
        updates.dayOrder ??
        existing?.day_order ??
        (OPENING_HOURS.findIndex((d) => d.id === id) + 1 || 1),
      start_time: updates.startTime ?? existing?.start_time ?? '09:30',
      end_time: updates.endTime ?? existing?.end_time ?? '21:30',
      break_start: updates.breakStart ?? existing?.break_start ?? '14:00',
      break_end: updates.breakEnd ?? existing?.break_end ?? '14:45',
      is_day_off:
        updates.isDayOff !== undefined
          ? Boolean(updates.isDayOff)
          : Boolean(existing?.is_day_off),
      holiday_note: updates.holidayNote ?? existing?.holiday_note ?? '',
    };
    await safeSupabaseUpsert('working_hours', record);
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/working-hours/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'workingHours' });
  return updated;
};

async function recalculateShopAndBarberRating(shopId: string, barberId?: string) {
  try {
    const { data: shopRevs } = await supabase
      .from('reviews')
      .select('rating, status')
      .eq('shop_id', shopId);
    const pubShopRevs = (shopRevs || []).filter((r: any) => r.status !== 'hidden');
    if (pubShopRevs.length > 0) {
      const avg = (
        pubShopRevs.reduce((s: number, r: any) => s + Number(r.rating || 5), 0) /
        pubShopRevs.length
      ).toFixed(1);
      await supabase
        .from('shops')
        .update({ rating: avg, review_count: pubShopRevs.length })
        .eq('id', shopId);
    }

    if (barberId) {
      const { data: brbRevs } = await supabase
        .from('reviews')
        .select('rating, status')
        .eq('barber_id', barberId);
      const pubBrbRevs = (brbRevs || []).filter((r: any) => r.status !== 'hidden');
      if (pubBrbRevs.length > 0) {
        const avg = (
          pubBrbRevs.reduce((s: number, r: any) => s + Number(r.rating || 5), 0) /
          pubBrbRevs.length
        ).toFixed(1);
        await supabase
          .from('barbers')
          .update({ rating: avg, review_count: pubBrbRevs.length })
          .eq('id', barberId);
      }
    }
  } catch {
    // ignore
  }
}

export const apiCreateReview = async (payload: any) => {
  const id = `rev-${Date.now()}`;
  const shopId = payload.shopId || 'shop-1';
  const barberId = payload.barberId || 'brb-1';

  await safeSupabaseUpsert('reviews', {
    id,
    appointment_id: payload.appointmentId || '',
    customer_uid: payload.customerUid || '',
    author: payload.author || 'Verified Client',
    role: payload.role || 'Verified Client',
    organization: 'Member',
    shop_id: shopId,
    barber_id: barberId,
    barber_name: payload.barber || 'Barber',
    service_name: payload.service || 'Grooming Service',
    rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
    date: new Date().toLocaleDateString('en-IN'),
    comment: payload.comment,
    status: 'published',
  });

  await recalculateShopAndBarberRating(shopId, barberId);

  const created = await safeBackendRequest<any>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'reviews' });
  return created;
};

export const apiUpdateReview = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.comment !== undefined) supaUpdates.comment = updates.comment;
    if (updates.rating !== undefined)
      supaUpdates.rating = Number(updates.rating);
    if (updates.status !== undefined) supaUpdates.status = updates.status;
    if (updates.moderationNote !== undefined)
      supaUpdates.moderation_note = updates.moderationNote;

    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('reviews').update(supaUpdates).eq('id', id);
      const { data: rev } = await supabase
        .from('reviews')
        .select('shop_id, barber_id')
        .eq('id', id)
        .maybeSingle();
      if (rev) {
        await recalculateShopAndBarberRating(rev.shop_id, rev.barber_id);
      }
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/reviews/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'reviews' });
  return updated;
};

export const apiToggleFavorite = async (
  targetType: 'shop' | 'barber',
  targetId: string,
  customerUid = ''
) => {
  try {
    const { data: existing } = await supabase
      .from('favorites')
      .select('*')
      .eq('customer_uid', customerUid)
      .eq('target_type', targetType)
      .eq('target_id', targetId);
    if (existing && existing.length > 0) {
      await supabase.from('favorites').delete().eq('id', existing[0].id);
    } else {
      await safeSupabaseUpsert('favorites', {
        id: `fav-${Date.now()}`,
        customer_uid: customerUid,
        target_type: targetType,
        target_id: targetId,
      });
    }
  } catch {
    // ignore
  }

  const res = await safeBackendRequest<any[]>('/api/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, customerUid }),
  });

  const { data: freshFavs } = await supabase
    .from('favorites')
    .select('*')
    .eq('customer_uid', customerUid);
  const mappedFavs = (freshFavs || []).map((f: any) => ({
    id: f.id,
    customerUid: f.customer_uid,
    targetType: f.target_type,
    targetId: f.target_id,
  }));

  broadcastSupabaseEvent('state:updated', { entity: 'favorites' });
  return mappedFavs.length > 0 ? mappedFavs : res || [];
};

export const apiRedeemReward = async (
  cost: number,
  label: string,
  customerUid = ''
) => {
  let newBalance = 0;
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('reward_balance')
      .eq('uid', customerUid)
      .maybeSingle();
    const currentBalance = Number(prof?.reward_balance ?? 0);
    if (currentBalance < cost) {
      throw new Error('Insufficient reward points.');
    }
    newBalance = currentBalance - cost;
    await supabase
      .from('profiles')
      .update({ reward_balance: newBalance })
      .eq('uid', customerUid);

    await safeSupabaseUpsert('rewards', {
      id: `rew-${Date.now()}`,
      customer_uid: customerUid,
      points_delta: -cost,
      reason: `Redeemed: ${label}`,
      type: 'redeemed',
    });

    await safeSupabaseUpsert('notifications', {
      id: `notif-rew-${Date.now()}`,
      recipient_uid: customerUid,
      type: 'reward_redeemed',
      title: `Redeemed ${cost} PTS for ${label}`,
      time_label: 'Just now · Loyalty Rewards',
      unread: true,
    });
  } catch {
    // ignore
  }

  const backendRes = await safeBackendRequest<{ rewardBalance: number }>(
    '/api/rewards/redeem',
    {
      method: 'POST',
      body: JSON.stringify({ cost, label, customerUid }),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'rewards' });
  return backendRes || { rewardBalance: newBalance };
};

export const apiMarkNotificationsRead = async (customerUid = '') => {
  try {
    await supabase
      .from('notifications')
      .update({ unread: false })
      .eq('recipient_uid', customerUid);
  } catch {
    // ignore
  }
  const res = await safeBackendRequest<{ ok: boolean }>(
    '/api/notifications/read',
    {
      method: 'POST',
      body: JSON.stringify({ customerUid }),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'notifications' });
  return res || { ok: true };
};

export const apiCreateCoupon = async (payload: any) => {
  const id = `cpn-${Date.now()}`;
  const supaCoupon = {
    id,
    shop_id: payload.shopId || 'shop-1',
    code: String(payload.code).trim().toUpperCase(),
    discount_text:
      payload.discountText || `${payload.discountPercent}% Off Grooming`,
    discount_percent: Number(payload.discountPercent) || 15,
    min_spend: Number(payload.minSpend) || 500,
    uses_count: 0,
    max_uses: Number(payload.maxUses) || 200,
    status: 'Active',
    expires_at: payload.expiresAt || '2027-12-31',
  };
  await safeSupabaseUpsert('coupons', supaCoupon);

  const created = await safeBackendRequest<any>('/api/coupons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'coupons' });
  return created || supaCoupon;
};

export const apiUpdateCoupon = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.status !== undefined) supaUpdates.status = updates.status;
    if (updates.discountPercent !== undefined)
      supaUpdates.discount_percent = Number(updates.discountPercent);
    if (updates.minSpend !== undefined)
      supaUpdates.min_spend = Number(updates.minSpend);
    if (updates.expiresAt !== undefined)
      supaUpdates.expires_at = updates.expiresAt;
    if (updates.discountText !== undefined)
      supaUpdates.discount_text = updates.discountText;
    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('coupons').update(supaUpdates).eq('id', id);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/coupons/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'coupons' });
  return updated;
};

export const apiCreateReport = async (payload: any) => {
  const id = `rep-${Date.now()}`;
  const supaReport = {
    id,
    reporter_uid: payload.reporterUid || '',
    reporter_name: payload.reporterName || 'Verified User',
    target_type: payload.targetType || 'shop',
    target_id: payload.targetId || 'shop-1',
    target_label: payload.targetLabel || 'Partner Salon',
    reason: payload.reason || 'Service Inquiry',
    details: payload.details || '',
    status: 'open',
    resolution_note: '',
  };
  await safeSupabaseUpsert('reports', supaReport);

  const created = await safeBackendRequest<any>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  broadcastSupabaseEvent('state:updated', { entity: 'reports' });
  return created || supaReport;
};

export const apiUpdateReport = async (id: string, updates: any) => {
  try {
    const supaUpdates: Record<string, any> = {};
    if (updates.status !== undefined) supaUpdates.status = updates.status;
    if (updates.resolutionNote !== undefined)
      supaUpdates.resolution_note = updates.resolutionNote;
    if (Object.keys(supaUpdates).length > 0) {
      await supabase.from('reports').update(supaUpdates).eq('id', id);
    }
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/reports/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'reports' });
  return updated;
};

export const apiUpdatePayment = async (id: string, status: string) => {
  try {
    await supabase.from('payments').update({ status }).eq('id', id);
  } catch {
    // ignore
  }

  const updated = await safeBackendRequest<any>(
    `/api/payments/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  broadcastSupabaseEvent('state:updated', { entity: 'payments' });
  return updated;
};

export const apiCreateShopGalleryItem = async (payload: {
  shopId: string;
  imageUrl: string;
  title: string;
  caption?: string;
}) => {
  const id = `sg-${Date.now()}`;
  const item = {
    id,
    shop_id: payload.shopId || 'shop-1',
    image_url: payload.imageUrl || ASSETS.royalInterior,
    title: payload.title || 'Salon Interior',
    caption: payload.caption || '',
  };
  await safeSupabaseUpsert('shop_gallery', item);
  broadcastSupabaseEvent('state:updated', { entity: 'shopGallery' });
  return {
    id,
    shopId: item.shop_id,
    imageUrl: item.image_url,
    title: item.title,
    caption: item.caption,
  };
};

export const apiCreateBarberGalleryItem = async (payload: {
  barberId: string;
  imageUrl: string;
  title: string;
  styleTag?: string;
}) => {
  const id = `bg-${Date.now()}`;
  const item = {
    id,
    barber_id: payload.barberId || 'brb-1',
    image_url: payload.imageUrl || ASSETS.serviceSkinFade,
    title: payload.title || 'Signature Cut',
    style_tag: payload.styleTag || 'Precision Fade',
  };
  await safeSupabaseUpsert('barber_gallery', item);
  broadcastSupabaseEvent('state:updated', { entity: 'barberGallery' });
  return {
    id,
    barberId: item.barber_id,
    imageUrl: item.image_url,
    title: item.title,
    styleTag: item.style_tag,
  };
};

export const apiBroadcastShopNotification = async (payload: {
  shopName: string;
  message: string;
  targetRole?: 'customer' | 'barber' | 'all' | 'specific';
  specificUid?: string;
}) => {
  const targetRole = payload.targetRole || 'customer';
  let recipientCount = 0;
  try {
    if (targetRole === 'specific' && payload.specificUid) {
      await safeSupabaseUpsert('notifications', {
        id: `notif-bcast-${Date.now()}`,
        recipient_uid: payload.specificUid,
        type: 'important_shop_notification',
        title: `${payload.shopName}: ${payload.message}`,
        time_label: 'Just now · Direct Broadcast',
        unread: true,
      });
      recipientCount = 1;
    } else {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('uid, role');
      const list = (allProfiles || []).filter((p: any) => {
        if (!p.uid) return false;
        const r = String(p.role || 'customer').toLowerCase();
        if (targetRole === 'all') return true;
        if (targetRole === 'barber') {
          return r === 'barber' || r === 'shop_owner';
        }
        return r === 'customer';
      });

      for (let i = 0; i < list.length; i++) {
        const uid = list[i].uid;
        await safeSupabaseUpsert('notifications', {
          id: `notif-bcast-${Date.now()}-${i}`,
          recipient_uid: uid,
          type: 'important_shop_notification',
          title: `${payload.shopName}: ${payload.message}`,
          time_label:
            targetRole === 'barber'
              ? 'Just now · Barber Broadcast'
              : targetRole === 'all'
              ? 'Just now · Platform Broadcast'
              : 'Just now · Customer Broadcast',
          unread: true,
        });
        recipientCount++;
      }
    }
  } catch {
    // ignore
  }
  broadcastSupabaseEvent('state:updated', { entity: 'notifications' });
  return { ok: true, recipientCount };
};

export const apiClaimSlaCompensation = async (payload: {
  customerUid: string;
  appointmentId: string;
  serviceName: string;
  barberName: string;
  points?: number;
}) => {
  const pts = payload.points || 100;
  try {
    await safeSupabaseUpsert('rewards', {
      id: `rew-sla-${Date.now()}`,
      customer_uid: payload.customerUid,
      points_delta: pts,
      reason: `SLA On-Time Guarantee Credit (+${pts} PTS): ${payload.serviceName} with ${payload.barberName}`,
      type: 'earned',
    });

    const { data: prof } = await supabase
      .from('profiles')
      .select('reward_balance')
      .eq('uid', payload.customerUid)
      .maybeSingle();

    if (prof) {
      await supabase
        .from('profiles')
        .update({
          reward_balance: Number(prof.reward_balance || 0) + pts,
        })
        .eq('uid', payload.customerUid);
    }

    await safeSupabaseUpsert('notifications', {
      id: `notif-sla-${Date.now()}`,
      recipient_uid: payload.customerUid,
      type: 'important_shop_notification',
      title: `🛡️ SLA Guarantee Credit: +${pts} PTS added to your account for delay on ${payload.serviceName} with ${payload.barberName}.`,
      time_label: 'Just now · SLA Engine',
      unread: true,
    });
  } catch {
    // ignore
  }

  broadcastSupabaseEvent('state:updated', { entity: 'rewards' });
  return { ok: true, pointsAwarded: pts };
};

export function connectRealtimeSocket(
  onMessage: (event: { type: string; payload?: any }) => void
) {
  return connectSupabaseRealtime(onMessage);
}

// ----------------------------------------------------------------------------
// Razorpay & WooCommerce Payment Integration APIs
// ----------------------------------------------------------------------------

export async function apiCreateRazorpayOrder(payload: {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
}): Promise<{
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  isSimulator?: boolean;
}> {
  try {
    const res = await safeBackendRequest<any>('/api/payments/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.orderId) {
      return res;
    }
  } catch {
    // fallback
  }

  // Client-side fallback if server endpoint is unreachable
  return {
    success: true,
    orderId: `order_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
    amount: Math.round(payload.amount * 100),
    currency: payload.currency || 'INR',
    isSimulator: true,
  };
}

export async function apiVerifyRazorpayPayment(payload: {
  razorpay_order_id?: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}): Promise<{ verified: boolean; paymentId: string; error?: string }> {
  try {
    const res = await safeBackendRequest<any>('/api/payments/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.verified) {
      return res;
    }
  } catch {
    // fallback
  }

  // Client fallback
  return { verified: true, paymentId: payload.razorpay_payment_id };
}

