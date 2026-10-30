import { db } from './index.ts';
import {
  users,
  states,
  cities,
  profiles,
  shops,
  barbers,
  services,
  appointments,
  reviews,
  favorites,
  notifications,
  workingHours,
  shopGallery,
  barberGallery,
  payments,
  coupons,
  reports,
  platformSettings,
  barberPayouts,
  financialLedger,
} from './schema.ts';
import { eq, asc, desc, and, sql } from 'drizzle-orm';
import { ASSETS } from '../data/barberlooData.ts';
import { generateSecureCompletionOtp, decryptCompletionOtp, verifyCompletionOtp } from '../lib/payoutOtp.ts';
import { postLedgerTransaction, executeBarberPayoutTransfer } from '../lib/ledgerEngine.ts';

export function resolveAllowedRole(
  requestedRole?: string | null,
  existingRole?: string | null
): 'admin' | 'shop_owner' | 'barber' | 'customer' {
  if (existingRole) {
    return existingRole as any;
  }
  if (requestedRole === 'admin') {
    return 'customer'; // Prevent privilege escalation to admin via signup
  }
  if (requestedRole === 'shop_owner') {
    return 'shop_owner';
  }
  if (requestedRole === 'barber') {
    return 'barber';
  }
  return 'customer';
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  requestedRole?: string,
  phone?: string,
  stateId?: string,
  cityId?: string,
  stateName?: string,
  cityName?: string
) {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = name?.trim() || cleanEmail.split('@')[0];

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.uid, uid))
    .limit(1);

  let userRecord = existingUsers[0];
  if (!userRecord) {
    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      userRecord = inserted;
    } else {
      const retry = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1);
      userRecord = retry[0];
    }
  }

  const existingProfiles = await db
    .select()
    .from(profiles)
    .where(eq(profiles.uid, uid))
    .limit(1);

  const finalRole = resolveAllowedRole(
    requestedRole,
    existingProfiles[0]?.role
  );

  if (existingProfiles.length === 0) {
    await db
      .insert(profiles)
      .values({
        id: `prof-${uid}`,
        uid,
        email: cleanEmail,
        name: displayName,
        phone: phone || '',
        avatarUrl: '',
        role: finalRole,
        stateId: stateId || 'st-pb',
        cityId: cityId || 'ct-jal',
        state: stateName || 'Punjab',
        city: cityName || 'Jalandhar',
        preferredNotes: '',
        status: 'active',
        assignedShopId: '',
        assignedBarberId: '',
      })
      .onConflictDoNothing();
  } else {
    const updates: Record<string, any> = {};
    if (name && name.trim() && existingProfiles[0].name !== name.trim()) {
      updates.name = name.trim();
    }
    if (phone && phone.trim() && !existingProfiles[0].phone) {
      updates.phone = phone.trim();
    }
    if (stateId && existingProfiles[0].stateId !== stateId) {
      updates.stateId = stateId;
    }
    if (cityId && existingProfiles[0].cityId !== cityId) {
      updates.cityId = cityId;
    }
    if (stateName && existingProfiles[0].state !== stateName) {
      updates.state = stateName;
    }
    if (cityName && existingProfiles[0].city !== cityName) {
      updates.city = cityName;
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(profiles)
        .set(updates)
        .where(eq(profiles.uid, uid));
    }
  }

  return userRecord;
}

let runtimeCustomDomain = process.env.CUSTOM_DOMAIN || 'https://barberloo.in';

export async function getPlatformSettings() {
  try {
    const [settings] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 'default'))
      .limit(1);
    return (
      settings
        ? {
            id: 'default',
            feeType: settings.feeType,
            feeAmount: settings.feeAmount,
            minFee: settings.minFee,
            refundPolicy: (settings as any).refundPolicy || 'service_only',
            customDomain: runtimeCustomDomain,
          }
        : {
            id: 'default',
            feeType: 'fixed',
            feeAmount: 10,
            minFee: 5,
            refundPolicy: 'service_only',
            customDomain: runtimeCustomDomain,
          }
    );
  } catch {
    return {
      id: 'default',
      feeType: 'fixed',
      feeAmount: 10,
      minFee: 5,
      refundPolicy: 'service_only',
      customDomain: runtimeCustomDomain,
    };
  }
}

export async function updatePlatformSettingsInDb(payload: {
  feeType?: string;
  feeAmount?: number;
  minFee?: number;
  refundPolicy?: string;
  customDomain?: string;
}) {
  if (payload.customDomain && payload.customDomain.trim()) {
    const trimmed = payload.customDomain.trim();
    if (!trimmed.includes('run.app') && !trimmed.includes('localhost')) {
      runtimeCustomDomain = trimmed;
    }
  }
  const current = await getPlatformSettings();
  const feeType = payload.feeType === 'percentage' ? 'percentage' : 'fixed';
  const feeAmount = Number(payload.feeAmount ?? current.feeAmount);
  const minFee = Number(payload.minFee ?? current.minFee);
  const refundPolicy =
    payload.refundPolicy === 'full' ? 'full' : payload.refundPolicy === 'service_only' ? 'service_only' : ((current as any).refundPolicy || 'service_only');

  const [updated] = await db
    .insert(platformSettings)
    .values({
      id: 'default',
      feeType,
      feeAmount: Math.max(1, feeAmount),
      minFee: Math.max(1, minFee),
      refundPolicy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        feeType,
        feeAmount: Math.max(1, feeAmount),
        minFee: Math.max(1, minFee),
        refundPolicy,
        updatedAt: new Date(),
      },
    })
    .returning();

  return updated;
}

export async function calculateServerBookingPrice(
  serviceId: string,
  couponCode?: string
) {
  const [dbService] = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);

  if (!dbService) {
    throw new Error('Service not found.');
  }

  const servicePrice = Number(dbService.price);
  let discountAmount = 0;

  if (couponCode) {
    const cleanCoupon = String(couponCode).trim().toUpperCase();
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());

    const [c] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, cleanCoupon))
      .limit(1);

    if (
      c &&
      c.status === 'Active' &&
      c.expiresAt >= todayIST &&
      c.usesCount < c.maxUses &&
      servicePrice >= c.minSpend
    ) {
      discountAmount = Math.round(servicePrice * (c.discountPercent / 100));
    }
  }

  const discountedServicePrice = Math.max(0, servicePrice - discountAmount);
  const settings = await getPlatformSettings();

  let platformFee = Number(settings.feeAmount || 10);
  if (settings.feeType === 'percentage') {
    platformFee = Math.max(
      Number(settings.minFee || 5),
      Math.round(discountedServicePrice * (Number(settings.feeAmount) / 100))
    );
  }

  const totalAmount = discountedServicePrice + platformFee;

  return {
    serviceId: dbService.id,
    serviceName: dbService.name,
    shopId: dbService.shopId,
    durationMin: dbService.durationMin,
    servicePrice,
    discountAmount,
    discountedServicePrice,
    platformFee,
    totalAmount,
    feeType: settings.feeType,
  };
}

export async function validateTimeWithinWorkingHours(
  shopId: string,
  dateStr: string,
  timeStr: string,
  durationMin: number
) {
  // Parse date to day of week
  const dateObj = new Date(`${dateStr}T12:00:00+05:30`);
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dayOfWeek = days[dateObj.getDay()];

  // Query working hours for this shop and day
  const whList = await db
    .select()
    .from(workingHours)
    .where(
      and(
        eq(workingHours.shopId, shopId),
        eq(workingHours.dayOfWeek, dayOfWeek)
      )
    )
    .limit(1);

  const wh = whList[0];
  if (wh?.isDayOff) {
    throw new Error(`The salon is closed on ${dayOfWeek}.`);
  }

  const [sh, sm] = (wh?.startTime || '09:00').split(':').map(Number);
  const [eh, em] = (wh?.endTime || '21:00').split(':').map(Number);
  const [th, tm] = timeStr.split(':').map(Number);

  const openMin = sh * 60 + sm;
  const closeMin = eh * 60 + em;
  const aptStartMin = th * 60 + tm;
  const aptEndMin = aptStartMin + durationMin;

  if (aptStartMin < openMin || aptEndMin > closeMin) {
    throw new Error(
      `Selected appointment time (${timeStr} - ${Math.floor(aptEndMin / 60)}:${String(aptEndMin % 60).padStart(2, '0')}) is outside salon hours on ${dayOfWeek} (${wh?.startTime || '09:00'} – ${wh?.endTime || '21:00'}).`
    );
  }
}

export async function getBootstrapState(
  activeUid?: string,
  userRole?: string
) {
  const isAdmin = userRole === 'admin';
  const isBarber = userRole === 'barber';
  const isShopOwner = userRole === 'shop_owner';

  const [
    stateRows,
    cityRows,
    shopRows,
    barberRows,
    serviceRows,
    appointmentRows,
    reviewRows,
    favoriteRows,
    notificationRows,
    workingHourRows,
    shopGalleryRows,
    barberGalleryRows,
    paymentRows,
    couponRows,
    profileRows,
    reportRows,
  ] = await Promise.all([
    db.select().from(states).orderBy(asc(states.name)),
    db.select().from(cities).orderBy(asc(cities.name)),
    db.select().from(shops).orderBy(asc(shops.distanceMilesTenths)),
    db.select().from(barbers),
    db.select().from(services).orderBy(asc(services.indexCode)),
    db.select().from(appointments).orderBy(desc(appointments.createdAt)),
    db.select().from(reviews).orderBy(desc(reviews.createdAt)),
    activeUid
      ? db
          .select()
          .from(favorites)
          .where(eq(favorites.customerUid, activeUid))
      : Promise.resolve([]),
    activeUid
      ? db
          .select()
          .from(notifications)
          .where(eq(notifications.recipientUid, activeUid))
          .orderBy(desc(notifications.createdAt))
      : Promise.resolve([]),
    db.select().from(workingHours).orderBy(asc(workingHours.dayOrder)),
    db.select().from(shopGallery),
    db.select().from(barberGallery),
    db.select().from(payments).orderBy(desc(payments.createdAt)),
    db.select().from(coupons),
    db.select().from(profiles),
    db.select().from(reports).orderBy(desc(reports.createdAt)),
  ]);

  const mappedServices = serviceRows.map((s) => ({
    id: s.id,
    shopId: s.shopId,
    index: s.indexCode,
    name: s.name,
    category: s.category as any,
    duration: `${s.durationMin} min`,
    durationMins: s.durationMin,
    price: s.price,
    description: s.description,
    popular: s.popular,
    active: s.active,
    image: s.image || ASSETS.serviceSkinFade,
  }));

  const mappedBarbers = barberRows.map((b) => ({
    id: b.id,
    userUid: b.userUid,
    shopId: b.shopId,
    name: b.name,
    role: b.role,
    rating: parseFloat(b.rating) || 5.0,
    reviews: b.reviewCount,
    experience: `${b.experienceYears} yrs`,
    experienceYears: b.experienceYears,
    specialty: b.specialty,
    shopName: b.shopName,
    nextAvailable: b.nextAvailable,
    priceFrom: b.priceFrom,
    image: b.image || ASSETS.barberMarcus,
    avatar: b.image || ASSETS.barberMarcus,
    bio: b.bio,
    featured: b.featured,
    active: b.active,
    verified: b.verified,
    verificationStatus: b.verificationStatus,
    chairBreakActive: b.chairBreakActive,
    assignedServiceIds: b.assignedServiceIds,
  }));

  const mappedShops = shopRows.map((sh) => ({
    id: sh.id,
    ownerUid: sh.ownerUid,
    name: sh.name,
    stateId: sh.stateId,
    cityId: sh.cityId,
    state: sh.state,
    district: sh.district,
    city: sh.city,
    address: sh.address,
    phone: sh.phone,
    distance: sh.distance,
    distanceMilesTenths: sh.distanceMilesTenths,
    rating: parseFloat(sh.rating) || 5.0,
    reviewCount: sh.reviewCount,
    isOpen: sh.isOpen,
    closesAt: sh.closesAt,
    priceTier: sh.priceTier,
    minPrice: sh.minPrice,
    verified: sh.verified,
    approvalStatus: sh.approvalStatus,
    image: sh.image || ASSETS.royalInterior,
    tagline: sh.tagline,
    about: sh.about,
    qrCodeSlug: sh.qrCodeSlug,
    qrCodeUrl: `${runtimeCustomDomain}/shop/${sh.qrCodeSlug || sh.id}/`,
    latitude: sh.latitude || '',
    longitude: sh.longitude || '',
    pinCode: sh.pinCode || '',
    landmark: sh.landmark || '',
  }));

  // Role-based data privacy filtering for appointments
  let visibleAppointments = appointmentRows;
  if (isAdmin) {
    visibleAppointments = appointmentRows;
  } else if (isBarber || isShopOwner) {
    const ownedShopIds = shopRows
      .filter((s) => s.ownerUid === activeUid)
      .map((s) => s.id);
    const assignedBarberIds = barberRows
      .filter((b) => b.userUid === activeUid || b.id === activeUid)
      .map((b) => b.id);
    visibleAppointments = appointmentRows.filter(
      (a) =>
        a.barberId === activeUid ||
        assignedBarberIds.includes(a.barberId) ||
        ownedShopIds.includes(a.shopId)
    );
  } else if (activeUid) {
    visibleAppointments = appointmentRows.filter(
      (a) => a.customerUid === activeUid
    );
  } else {
    visibleAppointments = [];
  }

  const mappedAppointments = visibleAppointments.map((a) => {
    // Only barbers, shop owners, or admins can see internal barber notes
    const canSeeInternalNotes =
      isAdmin || isBarber || isShopOwner || a.barberId === activeUid;
    const safeInternalNotes = canSeeInternalNotes
      ? a.internalBarberNotes
      : '';

    return {
      id: a.id,
      referenceCode: a.id.toUpperCase(),
      customerUid: a.customerUid,
      clientName: a.clientName,
      clientPhone:
        canSeeInternalNotes || a.customerUid === activeUid
          ? a.clientPhone
          : 'Protected',
      clientTier: 'Client',
      shopId: a.shopId,
      shopName: a.shopName,
      barberId: a.barberId,
      barberName: a.barberName,
      barberAvatar: ASSETS.barberMarcus,
      serviceId: a.serviceId,
      serviceName: a.serviceName,
      date: a.date,
      time: a.time,
      durationMin: a.durationMin,
      durationMins: a.durationMin,
      price: a.price,
      servicePrice: a.servicePrice ?? (a.price - (a.platformFee ?? 10)),
      platformFee: a.platformFee ?? 10,
      totalPrice: a.totalPrice ?? a.price,
      status:
        a.status === 'confirmed'
          ? 'Confirmed'
          : a.status === 'completed'
          ? 'Completed'
          : a.status === 'cancelled'
          ? 'Cancelled'
          : a.status === 'in_progress'
          ? 'In Progress'
          : a.status === 'no_show'
          ? 'No-Show'
          : 'Pending',
      rawStatus: a.status,
      paymentMethod: a.paymentMethod,
      paymentStatus: a.paymentStatus,
      notes: a.notes,
      barberNotes: safeInternalNotes,
      internalBarberNotes: safeInternalNotes,
      couponCode: a.couponCode,
      completionOtp:
        a.customerUid === activeUid && a.completionOtpCipher
          ? decryptCompletionOtp(a.completionOtpCipher) || undefined
          : undefined,
      completionOtpStatus: a.completionOtpStatus || 'active',
      completionOtpExpiresAt: a.completionOtpExpiresAt,
      completionOtpAttempts: a.completionOtpAttempts ?? 0,
      completionOtpMaxAttempts: a.completionOtpMaxAttempts ?? 5,
      payoutStatus: a.payoutStatus || 'pending_verification',
      payoutHoldReason: a.payoutHoldReason || '',
      completionVerifiedAt: a.completionVerifiedAt,
    };
  });

  const mappedReviews = reviewRows.map((r) => ({
    id: r.id,
    appointmentId: r.appointmentId,
    customerUid: r.customerUid,
    author: r.author,
    role: r.role,
    organization: r.organization,
    shopId: r.shopId,
    barberId: r.barberId,
    barber: r.barberName,
    barberName: r.barberName,
    service: r.serviceName,
    serviceName: r.serviceName,
    rating: r.rating,
    date: r.date,
    comment: r.comment,
    outcome: r.outcome,
    status: r.status,
    moderationNote: isAdmin ? r.moderationNote : '',
  }));

  // Role-based filtering for sensitive resources
  const visibleReports = isAdmin
    ? reportRows
    : reportRows.filter((r) => r.reporterUid === activeUid);

  const visiblePayments = isAdmin
    ? paymentRows
    : paymentRows.filter((p) => p.customerUid === activeUid);

  const visibleProfiles = isAdmin
    ? profileRows
    : profileRows.filter(
        (p) => p.uid === activeUid || p.role === 'barber'
      );

  return {
    states: stateRows,
    cities: cityRows,
    shops: mappedShops,
    barbers: mappedBarbers,
    services: mappedServices,
    appointments: mappedAppointments,
    reviews: mappedReviews,
    favorites: favoriteRows,
    notifications: notificationRows,
    workingHours: workingHourRows,
    shopGallery: shopGalleryRows,
    barberGallery: barberGalleryRows,
    payments: visiblePayments,
    coupons: couponRows,
    profiles: visibleProfiles,
    reports: visibleReports,
    platformSettings: await getPlatformSettings(),
  };
}

export async function createBookingInDb(payload: {
  id: string;
  customerUid: string;
  clientName: string;
  clientPhone: string;
  shopId: string;
  shopName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  durationMin: number;
  price: number;
  paymentMethod: string;
  notes?: string;
  couponCode?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  woocommerceOrderId?: string | number;
  addOns?: any[];
  addOnsTotal?: number;
}) {
  if (!payload.customerUid) {
    throw new Error('Authentication required: A verified customer session must exist to create a booking.');
  }

  // 0. Server-side validation of Date and Time format & Past booking rejection (Section 18)
  if (!payload.date || !payload.time) {
    throw new Error('Appointment date and time are required.');
  }

  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormatRegex.test(payload.date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }

  const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeFormatRegex.test(payload.time)) {
    throw new Error('Invalid time format. Expected HH:mm.');
  }

  const [y, m, d] = payload.date.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(y, m - 1, d));
  if (
    parsedDate.getUTCFullYear() !== y ||
    parsedDate.getUTCMonth() !== m - 1 ||
    parsedDate.getUTCDate() !== d
  ) {
    throw new Error('Invalid calendar date.');
  }

  const now = new Date();
  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(now);
  const timeIST = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  if (payload.date < todayIST) {
    throw new Error('Cannot book an appointment for a past date.');
  }
  if (payload.date === todayIST && payload.time < timeIST) {
    throw new Error('Cannot book an appointment for a past time.');
  }

  // 1. Server-side validation of Shop
  if (!payload.shopId) {
    throw new Error('Please select a valid barber shop.');
  }
  const [dbShop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, payload.shopId));
  if (!dbShop) {
    throw new Error('Barber shop not found.');
  }
  if (!dbShop.isOpen) {
    throw new Error('This barber shop is currently not accepting appointments.');
  }
  payload.shopName = dbShop.name;

  // 2. Server-side validation of Service
  if (!payload.serviceId) {
    throw new Error('Please select a service.');
  }
  const [dbService] = await db
    .select()
    .from(services)
    .where(eq(services.id, payload.serviceId));
  if (!dbService) {
    throw new Error('Selected service not found.');
  }
  if (dbService.shopId && dbService.shopId !== payload.shopId) {
    throw new Error('Service does not belong to the selected shop.');
  }
  if (dbService.active === false) {
    throw new Error('Selected service is currently inactive.');
  }

  payload.durationMin = dbService.durationMin;
  payload.serviceName = dbService.name;

  // 3. Server-side validation of Barber (Supports "ANY AVAILABLE BARBER")
  const isAnyBarber =
    !payload.barberId ||
    payload.barberId === 'any' ||
    payload.barberId === 'any_available';

  if (isAnyBarber) {
    const shopBarbers = await db
      .select()
      .from(barbers)
      .where(
        and(
          eq(barbers.shopId, payload.shopId),
          eq(barbers.active, true)
        )
      );

    if (shopBarbers.length === 0) {
      throw new Error('No active barbers found for this shop.');
    }

    // Find first barber without time conflict
    let assignedBarber: any = null;
    const [nh, nm] = payload.time.split(':').map(Number);
    const newStartMin = nh * 60 + nm;
    const newEndMin = newStartMin + Number(payload.durationMin || 45);

    for (const b of shopBarbers) {
      if (b.verificationStatus === 'suspended') continue;
      const existing = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.barberId, b.id),
            eq(appointments.date, payload.date)
          )
        );
      const conflict = existing.find((c) => {
        if (c.status === 'cancelled' || c.status === 'no_show') return false;
        const [ch, cm] = (c.time || '00:00').split(':').map(Number);
        const curStart = ch * 60 + cm;
        const curEnd = curStart + Number(c.durationMin || 45);
        return newStartMin < curEnd && newEndMin > curStart;
      });
      if (!conflict) {
        assignedBarber = b;
        break;
      }
    }

    if (!assignedBarber) {
      throw new Error('All barbers are fully booked for this time slot. Please choose another time.');
    }

    payload.barberId = assignedBarber.id;
    payload.barberName = assignedBarber.name;
  } else {
    const [dbBarber] = await db
      .select()
      .from(barbers)
      .where(eq(barbers.id, payload.barberId));
    if (dbBarber) {
      if (dbBarber.shopId && dbBarber.shopId !== payload.shopId) {
        throw new Error('Barber does not belong to the selected shop.');
      }
      if (dbBarber.active === false || dbBarber.verificationStatus === 'suspended') {
        throw new Error('Selected barber is currently unavailable.');
      }
      payload.barberName = dbBarber.name;
    }
  }

  // 4. Server-side Working Hours Validation
  await validateTimeWithinWorkingHours(
    payload.shopId,
    payload.date,
    payload.time,
    payload.durationMin
  );

  // 5. Server-side Authoritative Pricing: Service Price + BarberLoo Platform Fee - Discount
  const pricing = await calculateServerBookingPrice(
    payload.serviceId,
    payload.couponCode
  );

  const platformFee = pricing.platformFee;
  const discountAmount = pricing.discountAmount;
  const totalPrice = pricing.totalAmount;

  // 6. ONLINE PAYMENT & SIMULATOR ENFORCEMENT (Sections 24 & 25)
  const isProduction = process.env.NODE_ENV === 'production';
  const isWalkIn =
    payload.paymentMethod === 'cash' ||
    payload.paymentMethod === 'counter' ||
    payload.paymentMethod === 'walk_in' ||
    payload.paymentMethod === 'in_person';

  const paymentStatus = isWalkIn ? 'paid' : 'paid';

  if (isProduction && !isWalkIn) {
    if (!payload.razorpayPaymentId && !payload.razorpayOrderId) {
      throw new Error(
        'Online payment required. Please complete online payment through Razorpay to confirm your appointment.'
      );
    }
    if (
      payload.razorpayPaymentId?.includes('sim') ||
      payload.razorpayPaymentId?.includes('fake')
    ) {
      throw new Error(
        'Payment verification failed: simulated payments are rejected in production.'
      );
    }
  } else if (!payload.razorpayPaymentId && !payload.razorpayOrderId) {
    // Generate tracking IDs for evaluation or walk-in audits
    const prefix = isWalkIn ? 'counter' : 'dev';
    payload.razorpayPaymentId = `pay_${prefix}_${Date.now().toString(36)}`;
    payload.razorpayOrderId = `order_${prefix}_${Date.now().toString(36)}`;
  }

  const methodDisplay = isWalkIn
    ? 'In-Salon Counter / Cash'
    : payload.razorpayPaymentId
    ? `Razorpay Online (${payload.razorpayPaymentId})`
    : 'Razorpay Online (UPI / Cards / NetBanking)';

  let finalNotes = payload.notes || '';
  if (payload.razorpayPaymentId) {
    finalNotes += ` | Razorpay Txn: ${payload.razorpayPaymentId}`;
  }
  if (payload.razorpayOrderId) {
    finalNotes += ` | Razorpay Order: ${payload.razorpayOrderId}`;
  }

  // 7. Concurrency-safe Double-Booking Conflict Prevention inside Database Transaction (Section 17)
  const [nh, nm] = payload.time.split(':').map(Number);
  const newStartMin = nh * 60 + nm;
  const newEndMin = newStartMin + Number(payload.durationMin || 45);

  return await db.transaction(async (tx) => {
    // Acquire PostgreSQL transaction-level advisory lock on (barberId, date)
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${payload.barberId} || '_' || ${payload.date}))`
    );

    const existingApts = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, payload.barberId),
          eq(appointments.date, payload.date)
        )
      );

    const activeConflict = existingApts.find((c) => {
      if (c.status === 'cancelled' || c.status === 'no_show') return false;
      const [ch, cm] = (c.time || '00:00').split(':').map(Number);
      const curStartMin = ch * 60 + cm;
      const curEndMin = curStartMin + Number(c.durationMin || 45);
      return newStartMin < curEndMin && newEndMin > curStartMin;
    });

    if (activeConflict) {
      throw new Error(
        `Double-booking prevented: ${payload.barberName} is already booked on ${payload.date} around ${activeConflict.time} IST.`
      );
    }

    if (payload.couponCode && discountAmount > 0) {
      const cleanCoupon = String(payload.couponCode).trim().toUpperCase();
      await tx
        .update(coupons)
        .set({ usesCount: sql`${coupons.usesCount} + 1` })
        .where(eq(coupons.code, cleanCoupon));
    }

    // Cryptographic 6-digit Completion OTP generation with Salt, HMAC-SHA256, and AES-256-GCM cipher
    const secureOtp = generateSecureCompletionOtp(48);

    const [created] = await tx
      .insert(appointments)
      .values({
        id: payload.id,
        customerUid: payload.customerUid,
        clientName: payload.clientName,
        clientPhone: payload.clientPhone,
        shopId: payload.shopId,
        shopName: payload.shopName,
        barberId: payload.barberId,
        barberName: payload.barberName,
        serviceId: payload.serviceId,
        serviceName: payload.serviceName,
        date: payload.date,
        time: payload.time,
        durationMin: payload.durationMin,
        price: pricing.discountedServicePrice,
        servicePrice: pricing.discountedServicePrice,
        platformFee,
        totalPrice,
        status: 'confirmed',
        paymentMethod: payload.paymentMethod || 'online',
        paymentStatus,
        razorpayOrderId: payload.razorpayOrderId || '',
        razorpayPaymentId: payload.razorpayPaymentId || '',
        notes: finalNotes,
        internalBarberNotes: '',
        couponCode: payload.couponCode || '',
        completionOtpHash: secureOtp.hash,
        completionOtpSalt: secureOtp.salt,
        completionOtpCipher: secureOtp.cipher,
        completionOtpAttempts: 0,
        completionOtpMaxAttempts: 5,
        completionOtpExpiresAt: secureOtp.expiresAt,
        completionOtpStatus: 'active',
        payoutStatus: 'pending_verification',
      })
      .returning();

    // Complete Payment Ledger Record
    await tx.insert(payments).values({
      id: `pay-${Date.now()}`,
      appointmentId: payload.id,
      customerUid: payload.customerUid,
      clientName: payload.clientName,
      shopId: payload.shopId,
      shopName: payload.shopName,
      amount: totalPrice,
      serviceAmount: pricing.discountedServicePrice,
      platformFee,
      discountAmount,
      totalAmount: totalPrice,
      currency: 'INR',
      provider: 'razorpay',
      providerOrderId: payload.razorpayOrderId || '',
      providerPaymentId: payload.razorpayPaymentId || '',
      method: 'online',
      methodDisplay,
      status: paymentStatus,
      receiptNumber: payload.razorpayPaymentId
        ? `RZP-${payload.razorpayPaymentId}`
        : `BL-IN-${Math.floor(10000 + Math.random() * 89999)}`,
    });

    // Marketplace Barber Payout Record (Held until OTP verification)
    await tx.insert(barberPayouts).values({
      id: `payout-${payload.id}`,
      appointmentId: payload.id,
      shopId: payload.shopId,
      barberId: payload.barberId,
      barberName: payload.barberName,
      customerUid: payload.customerUid,
      grossAmount: pricing.discountedServicePrice,
      platformFee,
      netPayoutAmount: pricing.discountedServicePrice,
      currency: 'INR',
      status: 'pending_verification',
      idempotencyKey: `idemp-${payload.id}`,
      provider: 'razorpay_route',
    });

    // Balanced Double-Entry Financial Ledger Posting:
    // Debit Customer Funds Escrow (Total) = Credit Platform Fee Revenue + Credit Barber Payable Pending
    await postLedgerTransaction(tx, {
      appointmentId: payload.id,
      referenceType: 'customer_payment',
      referenceId: payload.razorpayPaymentId || `pay-${payload.id}`,
      description: `Customer payment received for booking ${payload.id} (Service: ₹${pricing.discountedServicePrice}, Platform Fee: ₹${platformFee})`,
      entries: [
        { account: 'customer_funds_escrow', entryType: 'DEBIT', amount: totalPrice },
        { account: 'platform_fee_revenue', entryType: 'CREDIT', amount: platformFee },
        { account: 'barber_payable_pending', entryType: 'CREDIT', amount: pricing.discountedServicePrice },
      ],
      metadata: {
        customerUid: payload.customerUid,
        servicePrice: pricing.discountedServicePrice,
        platformFee,
      },
    });

    // Client notification
    await tx.insert(notifications).values({
      id: `notif-${Date.now()}`,
      recipientUid: payload.customerUid,
      type: 'booking_confirmation',
      title: `Confirmed: ${payload.serviceName} with ${payload.barberName} (${payload.date} · ${payload.time} IST)`,
      timeLabel: 'Just now · Booking Engine',
      unread: true,
    });

    return {
      ...created,
      completionOtp: secureOtp.rawOtp,
    };
  });
}

export async function updateAppointmentInDb(
  id: string,
  updates: {
    status?: string;
    date?: string;
    time?: string;
    internalBarberNotes?: string;
    barberNotes?: string;
    paymentStatus?: string;
  },
  userContext?: {
    uid: string;
    email?: string;
    role?: string;
  }
) {
  const existing = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id));
  if (existing.length === 0) {
    throw new Error('Appointment not found');
  }
  const current = existing[0];

  // Enforce Authorization & Field-Level Permissions (Section 23)
  if (userContext) {
    const isCustomerOwner = userContext.uid === current.customerUid;
    const [aptShop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, current.shopId));
    const isShopOwner = aptShop && aptShop.ownerUid === userContext.uid;
    const isAssignedBarber = current.barberId === userContext.uid;
    const isAdmin = userContext.role === 'admin';

    if (!isCustomerOwner && !isShopOwner && !isAssignedBarber && !isAdmin) {
      throw new Error(
        'Forbidden: You do not have permission to modify this appointment.'
      );
    }

    if (isCustomerOwner && !isShopOwner && !isAdmin) {
      // Customer may NEVER directly modify paymentStatus or internal notes
      if (
        updates.paymentStatus !== undefined ||
        updates.internalBarberNotes !== undefined ||
        updates.barberNotes !== undefined
      ) {
        throw new Error(
          'Forbidden: Customers cannot modify payment status or internal notes.'
        );
      }

      // Customer can only cancel or reschedule
      if (
        updates.status &&
        updates.status.toLowerCase() !== 'cancelled' &&
        updates.status.toLowerCase() !== current.status.toLowerCase()
      ) {
        throw new Error(
          'Customers may only cancel or reschedule their appointment.'
        );
      }
    }
  }

  // Enforce State Transitions (Section 22)
  if (updates.status) {
    const fromStatus = current.status.toLowerCase();
    const toStatus = updates.status.toLowerCase();
    if (toStatus === 'completed') {
      throw new Error(
        'Appointments cannot be marked completed directly. Barbers must verify the customer-provided completion OTP to complete the appointment and release payout.'
      );
    }

    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: [
        'arrived',
        'in_progress',
        'cancelled',
        'no_show',
      ],
      arrived: ['in_progress', 'cancelled', 'no_show'],
      in_progress: ['cancelled'],
      completed: [],
      cancelled: [],
      no_show: [],
    };

    if (toStatus !== fromStatus) {
      if (
        fromStatus === 'completed' ||
        fromStatus === 'cancelled' ||
        fromStatus === 'no_show'
      ) {
        throw new Error(`Cannot change status of a ${fromStatus} appointment.`);
      } else if (
        ALLOWED_TRANSITIONS[fromStatus] &&
        !ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)
      ) {
        throw new Error(
          `Invalid appointment state transition from ${fromStatus} to ${toStatus}.`
        );
      }
    }

    if (toStatus === 'cancelled') {
      // Invalidate OTP and cancel payout
      await db
        .update(appointments)
        .set({ completionOtpStatus: 'revoked' })
        .where(eq(appointments.id, id));

      await db
        .update(barberPayouts)
        .set({ status: 'cancelled', holdReason: 'Appointment cancelled' })
        .where(eq(barberPayouts.appointmentId, id));
    }
  }

  // Overlap conflict check & working hours check when rescheduling
  if (
    (updates.date && updates.date !== current.date) ||
    (updates.time && updates.time !== current.time)
  ) {
    const targetDate = updates.date || current.date;
    const targetTime = updates.time || current.time;

    if (updates.date) {
      const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateFormatRegex.test(updates.date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD.');
      }
    }
    if (updates.time) {
      const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeFormatRegex.test(updates.time)) {
        throw new Error('Invalid time format. Expected HH:mm.');
      }
    }

    const now = new Date();
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(now);
    const timeIST = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    if (targetDate < todayIST) {
      throw new Error('Cannot reschedule an appointment to a past date.');
    }
    if (targetDate === todayIST && targetTime < timeIST) {
      throw new Error('Cannot reschedule an appointment to a past time.');
    }

    // Validate working hours for new target time
    await validateTimeWithinWorkingHours(
      current.shopId,
      targetDate,
      targetTime,
      current.durationMin || 45
    );

    const existingApts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, current.barberId),
          eq(appointments.date, targetDate)
        )
      );

    const [nh, nm] = targetTime.split(':').map(Number);
    const newStartMin = nh * 60 + nm;
    const newEndMin = newStartMin + Number(current.durationMin || 45);

    const activeConflict = existingApts.find((c) => {
      if (
        c.id === id ||
        c.status === 'cancelled' ||
        c.status === 'no_show'
      )
        return false;
      const [ch, cm] = (c.time || '00:00').split(':').map(Number);
      const curStartMin = ch * 60 + cm;
      const curEndMin = curStartMin + Number(c.durationMin || 45);
      return newStartMin < curEndMin && newEndMin > curStartMin;
    });

    if (activeConflict) {
      throw new Error(
        `Slot ${targetDate} around ${activeConflict.time} IST is already booked for ${current.barberName}.`
      );
    }
  }

  const updateFields: Record<string, unknown> = {};
  if (updates.status) updateFields.status = updates.status.toLowerCase();
  if (updates.date) updateFields.date = updates.date;
  if (updates.time) updateFields.time = updates.time;
  if (updates.internalBarberNotes !== undefined) {
    updateFields.internalBarberNotes = updates.internalBarberNotes;
  }
  if (updates.barberNotes !== undefined) {
    updateFields.internalBarberNotes = updates.barberNotes;
  }
  if (updates.paymentStatus) updateFields.paymentStatus = updates.paymentStatus;

  // Mark payment paid upon completion if pay_at_shop
  if (updates.status === 'completed') {
    updateFields.paymentStatus = 'paid';
  }

  // Handle cancellation refund logic according to admin refund policy
  if (updates.status === 'cancelled' && current.status !== 'cancelled') {
    updateFields.paymentStatus = 'refunded';
    const settings = await getPlatformSettings();
    const policy = (settings as any).refundPolicy || 'service_only';
    const serviceAmt = current.servicePrice || (current.price - (current.platformFee || 10));
    const feeAmt = current.platformFee || 10;
    const refundService = serviceAmt;
    const refundFee = policy === 'full' ? feeAmt : 0;
    const totalRefund = refundService + refundFee;

    try {
      await db.insert(payments).values({
        id: `ref-${Date.now()}`,
        appointmentId: current.id,
        customerUid: current.customerUid,
        clientName: current.clientName,
        shopId: current.shopId,
        shopName: current.shopName,
        amount: -totalRefund,
        serviceAmount: -refundService,
        platformFee: -refundFee,
        discountAmount: 0,
        totalAmount: -totalRefund,
        currency: 'INR',
        provider: 'razorpay',
        providerOrderId: current.razorpayOrderId || '',
        providerPaymentId: current.razorpayPaymentId || '',
        method: 'online',
        methodDisplay: `Razorpay Online Refund (${policy === 'full' ? 'Full: Service + Platform Fee' : 'Service Price Only'})`,
        status: 'refunded',
        receiptNumber: `REF-${current.id.toUpperCase()}`,
      });
    } catch (e) {
      console.warn('[Refund Ledger Warning]', e);
    }
  }

  const [updated] = await db
    .update(appointments)
    .set(updateFields)
    .where(eq(appointments.id, id))
    .returning();

  let notifTitle = '';
  let notifType = 'booking_update';
  if (updates.status === 'cancelled') {
    notifTitle = `Appointment Cancelled: ${current.serviceName} (${current.date})`;
    notifType = 'booking_cancellation';
  } else if (updates.status === 'in_progress') {
    notifTitle = `${current.barberName} has started your ${current.serviceName}`;
    notifType = 'service_started';
  } else if (updates.status === 'completed') {
    notifTitle = `Service Completed with ${current.barberName} — Leave your verified review`;
    notifType = 'review_request';
  } else if (updates.date || updates.time) {
    notifTitle = `Rescheduled: ${current.serviceName} moved to ${updated.date} at ${updated.time} IST`;
    notifType = 'booking_rescheduled';
  }

  if (notifTitle && current.customerUid) {
    await db.insert(notifications).values({
      id: `notif-${Date.now()}`,
      recipientUid: current.customerUid,
      type: notifType,
      title: notifTitle,
      timeLabel: 'Just now · Salon Desk',
      unread: true,
    });
  }

  return updated;
}

/**
 * Trusted backend verification function for customer OTP and barber payout initiation.
 * Atomically verifies OTP, completes appointment, and dispatches provider transfer.
 */
export async function verifyAndCompleteAppointmentInDb(
  appointmentId: string,
  submittedOtp: string,
  userContext: { uid: string; email?: string; role?: string; name?: string }
) {
  if (!userContext || !userContext.uid) {
    throw new Error('Unauthorized: Authentication required.');
  }

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appointment) {
    throw new Error('Appointment not found.');
  }

  // 1. Role & Identity Check
  const [aptShop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, appointment.shopId));
  const [aptBarber] = await db
    .select()
    .from(barbers)
    .where(eq(barbers.id, appointment.barberId));
  const isShopOwner = aptShop && aptShop.ownerUid === userContext.uid;
  const isAssignedBarber =
    appointment.barberId === userContext.uid ||
    (aptBarber && (aptBarber.userUid === userContext.uid || aptBarber.id === userContext.uid));
  const isAdmin = userContext.role === 'admin';

  if (!isAssignedBarber && !isShopOwner && !isAdmin) {
    throw new Error('Forbidden: Only the assigned barber or salon administrator can verify completion and complete this appointment.');
  }

  // 2. Booking State Eligibility Check
  const fromStatus = (appointment.status || '').toLowerCase();
  if (fromStatus === 'completed') {
    throw new Error('Appointment has already been completed.');
  }
  if (fromStatus === 'cancelled') {
    throw new Error('Cannot complete a cancelled appointment.');
  }
  if (fromStatus === 'no_show') {
    throw new Error('Cannot complete a no-show appointment.');
  }

  // 3. Payment Status Check
  if ((appointment.paymentStatus || '').toLowerCase() !== 'paid') {
    throw new Error('Cannot complete appointment: Customer payment has not been confirmed.');
  }

  // 4. Payout Hold & Dispute Check
  const [payoutRow] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.appointmentId, appointmentId));

  if (appointment.payoutHoldReason || payoutRow?.status === 'on_hold') {
    throw new Error(`Cannot complete appointment: Payout is on administrative hold: ${appointment.payoutHoldReason || payoutRow?.holdReason || 'Flagged for review'}.`);
  }

  // 5. Completion OTP Status & Expiry Check
  if (appointment.completionOtpStatus === 'verified') {
    throw new Error('This completion OTP has already been verified and consumed.');
  }
  if (appointment.completionOtpStatus === 'revoked') {
    throw new Error('This completion OTP has been revoked.');
  }
  if (appointment.completionOtpExpiresAt && new Date(appointment.completionOtpExpiresAt) < new Date()) {
    await db
      .update(appointments)
      .set({ completionOtpStatus: 'expired' })
      .where(eq(appointments.id, appointmentId));
    throw new Error('Completion OTP has expired. Please ask the client to regenerate it from their booking screen.');
  }

  // 6. Max Attempt Rate Limiting Check (5 attempts max)
  const currentAttempts = appointment.completionOtpAttempts ?? 0;
  const maxAttempts = appointment.completionOtpMaxAttempts ?? 5;
  if (currentAttempts >= maxAttempts) {
    throw new Error('Maximum OTP verification attempts (5) exceeded for this appointment. Access locked. Please ask customer to regenerate.');
  }

  // 7. Verify OTP against stored HMAC-SHA256 hash using constant-time comparison
  const isMatch = verifyCompletionOtp(submittedOtp, appointment.completionOtpSalt || '', appointment.completionOtpHash || '');
  if (!isMatch) {
    const nextAttempts = currentAttempts + 1;
    await db
      .update(appointments)
      .set({ completionOtpAttempts: nextAttempts })
      .where(eq(appointments.id, appointmentId));
    const remaining = Math.max(0, maxAttempts - nextAttempts);
    throw new Error(`Invalid completion OTP. ${remaining} attempt(s) remaining.`);
  }

  // 8. Atomic OTP Consumption, Appointment Completion & Payout Initiation inside Transaction
  return await db.transaction(async (tx) => {
    // Acquire PostgreSQL transaction-level lock to prevent concurrent double-consumption
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('complete_' || ${appointmentId}))`
    );

    // Re-verify inside lock
    const [lockedApt] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));

    if (lockedApt.status === 'completed' || lockedApt.completionOtpStatus === 'verified') {
      throw new Error('Appointment has already been completed by a concurrent request.');
    }

    const now = new Date();
    const verifiedBy = userContext.name || userContext.uid;

    // Transition appointment to completed
    const [updatedApt] = await tx
      .update(appointments)
      .set({
        status: 'completed',
        completionOtpStatus: 'verified',
        completionVerifiedAt: now,
        completionVerifiedBy: verifiedBy,
        payoutStatus: 'initiated',
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // Post balanced ledger entries for OTP completion:
    // Debit Barber Payable Pending -> Credit Barber Payable Released
    const barberShare = appointment.servicePrice ?? (appointment.price - (appointment.platformFee ?? 10));
    await postLedgerTransaction(tx, {
      appointmentId,
      referenceType: 'otp_completion',
      referenceId: `otp-vfy-${appointmentId}`,
      description: `Service completed and OTP verified by ${verifiedBy}. Barber earnings released from escrow (₹${barberShare}).`,
      entries: [
        { account: 'barber_payable_pending', entryType: 'DEBIT', amount: barberShare },
        { account: 'barber_payable_released', entryType: 'CREDIT', amount: barberShare },
      ],
      metadata: { verifiedBy, completedAt: now.toISOString() },
    });

    // Execute / Initiate Provider Payout Transfer (Razorpay Route)
    const payoutId = `payout-${appointmentId}`;
    const transferResult = await executeBarberPayoutTransfer(tx, payoutId);

    // Client completion notification
    if (appointment.customerUid) {
      await tx.insert(notifications).values({
        id: `notif-${Date.now()}-c`,
        recipientUid: appointment.customerUid,
        type: 'service_completed',
        title: `Service Completed: Your visit with ${appointment.barberName} has been verified. Thank you!`,
        timeLabel: 'Just now · Salon Desk',
        unread: true,
      });
    }

    // Barber payout notification
    if (appointment.barberId) {
      await tx.insert(notifications).values({
        id: `notif-${Date.now()}-b`,
        recipientUid: appointment.barberId,
        type: 'payout_initiated',
        title: `Payout Initiated: ₹${barberShare} transferred for ${appointment.clientName}'s appointment (#${appointment.id}).`,
        timeLabel: 'Just now · Financial Engine',
        unread: true,
      });
    }

    return {
      success: true,
      appointment: updatedApt,
      payout: transferResult.payout,
      transferId: transferResult.transferId,
    };
  });
}

/**
 * Regenerates the completion OTP for the authorized customer.
 */
export async function regenerateCustomerCompletionOtp(
  appointmentId: string,
  customerUid: string
) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appointment) {
    throw new Error('Appointment not found.');
  }

  if (appointment.customerUid !== customerUid) {
    throw new Error('Forbidden: Only the booked customer can request OTP regeneration.');
  }

  if (appointment.status === 'completed') {
    throw new Error('Cannot regenerate OTP for a completed appointment.');
  }
  if (appointment.status === 'cancelled') {
    throw new Error('Cannot regenerate OTP for a cancelled appointment.');
  }

  const secureOtp = generateSecureCompletionOtp(48);

  await db
    .update(appointments)
    .set({
      completionOtpHash: secureOtp.hash,
      completionOtpSalt: secureOtp.salt,
      completionOtpCipher: secureOtp.cipher,
      completionOtpAttempts: 0,
      completionOtpExpiresAt: secureOtp.expiresAt,
      completionOtpStatus: 'active',
    })
    .where(eq(appointments.id, appointmentId));

  return {
    success: true,
    completionOtp: secureOtp.rawOtp,
    expiresAt: secureOtp.expiresAt,
  };
}

/**
 * Applies or releases administrative payout hold with documented reason.
 */
export async function toggleAdminPayoutHold(
  appointmentId: string,
  adminContext: { uid: string; email?: string; role?: string; name?: string },
  hold: boolean,
  reason?: string
) {
  if (adminContext.role !== 'admin') {
    throw new Error('Forbidden: Only platform administrators can modify payout holds.');
  }

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appointment) {
    throw new Error('Appointment not found.');
  }

  const payoutId = `payout-${appointmentId}`;
  const [payout] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.id, payoutId));

  if (hold) {
    const holdReason = String(reason || '').trim();
    if (!holdReason) {
      throw new Error('A documented reason is required to place a payout on administrative hold.');
    }

    const heldBy = adminContext.name || adminContext.email || adminContext.uid;

    await db
      .update(appointments)
      .set({
        payoutStatus: 'held',
        payoutHoldReason: holdReason,
        payoutHoldAppliedBy: heldBy,
      })
      .where(eq(appointments.id, appointmentId));

    if (payout) {
      await db
        .update(barberPayouts)
        .set({
          status: 'on_hold',
          holdReason,
          heldBy,
          updatedAt: new Date(),
        })
        .where(eq(barberPayouts.id, payoutId));
    }

    // Ledger audit posting
    await postLedgerTransaction(db, {
      appointmentId,
      referenceType: 'admin_hold',
      referenceId: `hold-${appointmentId}`,
      description: `Administrative hold applied to payout ${payoutId}: "${holdReason}" by ${heldBy}`,
      entries: [
        { account: 'barber_payable_pending', entryType: 'DEBIT', amount: appointment.servicePrice ?? 150 },
        { account: 'disputed_hold', entryType: 'CREDIT', amount: appointment.servicePrice ?? 150 },
      ],
    });

    return { success: true, held: true, reason: holdReason };
  } else {
    // Release hold
    await db
      .update(appointments)
      .set({
        payoutStatus: 'pending_verification',
        payoutHoldReason: '',
        payoutHoldAppliedBy: '',
      })
      .where(eq(appointments.id, appointmentId));

    if (payout) {
      await db
        .update(barberPayouts)
        .set({
          status: appointment.status === 'completed' ? 'eligible' : 'pending_verification',
          holdReason: '',
          heldBy: '',
          updatedAt: new Date(),
        })
        .where(eq(barberPayouts.id, payoutId));
    }

    // Ledger audit posting
    await postLedgerTransaction(db, {
      appointmentId,
      referenceType: 'admin_hold',
      referenceId: `release-${appointmentId}`,
      description: `Administrative hold released for payout ${payoutId} by ${adminContext.name || adminContext.uid}`,
      entries: [
        { account: 'disputed_hold', entryType: 'DEBIT', amount: appointment.servicePrice ?? 150 },
        { account: 'barber_payable_pending', entryType: 'CREDIT', amount: appointment.servicePrice ?? 150 },
      ],
    });

    return { success: true, held: false };
  }
}

/**
 * Processes refund with status verification and balanced ledger reversal.
 */
export async function processAppointmentRefund(
  appointmentId: string,
  adminContext: { uid: string; email?: string; role?: string; name?: string },
  reason: string
) {
  if (adminContext.role !== 'admin') {
    throw new Error('Forbidden: Only platform administrators can authorize refunds.');
  }

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appointment) {
    throw new Error('Appointment not found.');
  }

  if (appointment.paymentStatus === 'refunded') {
    throw new Error('Appointment has already been refunded.');
  }

  const totalPrice = appointment.totalPrice ?? appointment.price;
  const platformFee = appointment.platformFee ?? 10;
  const barberShare = appointment.servicePrice ?? (totalPrice - platformFee);

  const payoutId = `payout-${appointmentId}`;
  const [payout] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.id, payoutId));

  let razorpayRefundId = '';
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (
    appointment.razorpayPaymentId &&
    !appointment.razorpayPaymentId.startsWith('pay_audit_') &&
    keyId &&
    keySecret &&
    !keyId.includes('YOUR_KEY_ID') &&
    !keySecret.includes('YOUR_RAZORPAY_SECRET')
  ) {
    try {
      const Razorpay = (await import('razorpay')).default;
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const refundPaise = Math.round(totalPrice * 100);
      const rzpRefund = await razorpay.payments.refund(appointment.razorpayPaymentId, {
        amount: refundPaise,
        notes: {
          appointmentId: appointment.id,
          reason,
          clientName: appointment.clientName,
        },
      });
      razorpayRefundId = rzpRefund?.id || '';
    } catch (err: any) {
      throw new Error(`Razorpay refund API rejected: ${err.message || 'Gateway refund error'}`);
    }
  }

  return await db.transaction(async (tx) => {
    // Update appointment
    const [updatedApt] = await tx
      .update(appointments)
      .set({
        status: 'cancelled',
        paymentStatus: 'refunded',
        completionOtpStatus: 'revoked',
        payoutStatus: 'reversed',
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // Update payout status
    if (payout) {
      await tx
        .update(barberPayouts)
        .set({
          status: 'reversed',
          holdReason: `Refunded: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(barberPayouts.id, payoutId));
    }

    // Insert refund payment record
    await tx.insert(payments).values({
      id: `ref-${Date.now()}`,
      appointmentId,
      customerUid: appointment.customerUid,
      clientName: appointment.clientName,
      shopId: appointment.shopId,
      shopName: appointment.shopName,
      amount: totalPrice,
      serviceAmount: barberShare,
      platformFee,
      discountAmount: 0,
      totalAmount: totalPrice,
      currency: 'INR',
      provider: 'razorpay',
      providerOrderId: appointment.razorpayOrderId || '',
      providerPaymentId: razorpayRefundId || `ref_${Date.now()}`,
      method: 'online',
      methodDisplay: razorpayRefundId ? `Razorpay Refund (${razorpayRefundId})` : 'Refund Reversal',
      status: 'refunded',
      receiptNumber: razorpayRefundId ? `RZP-REF-${razorpayRefundId}` : `REF-${appointment.id.toUpperCase()}`,
    });

    // Balanced Ledger Reversal:
    // Debit Barber Payable Pending (or recovery) + Debit Platform Fee Revenue = Credit Customer Funds Escrow (Total)
    if (payout?.status === 'settled' || payout?.status === 'initiated') {
      // Refund after barber transfer: track as Barber Receivable Recovery
      await postLedgerTransaction(tx, {
        appointmentId,
        referenceType: 'refund',
        referenceId: `ref-post-payout-${appointmentId}`,
        description: `Refund processed after barber payout: Barber recovery balance recorded (₹${barberShare}), Platform fee reversed (₹${platformFee})`,
        entries: [
          { account: 'refunds_payable', entryType: 'DEBIT', amount: barberShare },
          { account: 'platform_fee_revenue', entryType: 'DEBIT', amount: platformFee },
          { account: 'customer_funds_escrow', entryType: 'CREDIT', amount: totalPrice },
        ],
        metadata: { reason, refundAfterPayout: true },
      });
    } else {
      // Standard refund before payout release
      await postLedgerTransaction(tx, {
        appointmentId,
        referenceType: 'refund',
        referenceId: `ref-${appointmentId}`,
        description: `Customer refund processed for booking ${appointmentId} (Total: ₹${totalPrice}) - Reason: ${reason}`,
        entries: [
          { account: 'barber_payable_pending', entryType: 'DEBIT', amount: barberShare },
          { account: 'platform_fee_revenue', entryType: 'DEBIT', amount: platformFee },
          { account: 'customer_funds_escrow', entryType: 'CREDIT', amount: totalPrice },
        ],
        metadata: { reason, authorizedBy: adminContext.name || adminContext.uid },
      });
    }

    return {
      success: true,
      appointment: updatedApt,
      refundedAmount: totalPrice,
    };
  });
}

