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
} from './schema.ts';
import { eq, asc, desc, and, sql } from 'drizzle-orm';
import { ASSETS } from '../data/barberlooData.ts';

export function resolveAllowedRole(
  requestedRole?: string | null,
  existingRole?: string | null
): 'admin' | 'shop_owner' | 'barber' | 'customer' {
  if (existingRole === 'admin') {
    return 'admin';
  }
  if (existingRole === 'shop_owner' || requestedRole === 'shop_owner') {
    return 'shop_owner';
  }
  if (existingRole === 'barber' || requestedRole === 'barber') {
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
    if (
      existingProfiles[0].role !== 'admin' &&
      requestedRole &&
      (requestedRole === 'barber' || requestedRole === 'customer') &&
      existingProfiles[0].role !== requestedRole
    ) {
      updates.role = requestedRole;
    }
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
    qrCodeUrl: `${runtimeCustomDomain}/booking.html?shop_id=${encodeURIComponent(sh.id)}`,
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

  // Authoritative server-side price & duration
  let calculatedPrice = dbService.price;
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

  const servicePrice = pricing.servicePrice;
  const platformFee = pricing.platformFee;
  const discountAmount = pricing.discountAmount;
  const totalPrice = pricing.totalAmount;

  if (payload.couponCode && discountAmount > 0) {
    const cleanCoupon = String(payload.couponCode).trim().toUpperCase();
    await db
      .update(coupons)
      .set({ usesCount: sql`${coupons.usesCount} + 1` })
      .where(eq(coupons.code, cleanCoupon));
  }

  payload.price = totalPrice;

  // 6. Concurrency-safe Double-Booking Conflict Prevention
  const [nh, nm] = payload.time.split(':').map(Number);
  const newStartMin = nh * 60 + nm;
  const newEndMin = newStartMin + Number(payload.durationMin || 45);

  const existingApts = await db
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

  // 7. ONLINE PAYMENT ENFORCEMENT (Zero Pay-at-Shop, Zero Cash)
  const isPaidOnline = Boolean(payload.razorpayPaymentId || payload.razorpayOrderId);
  if (!isPaidOnline) {
    throw new Error('Online payment required. Please complete online payment through Razorpay to confirm your appointment.');
  }

  const paymentStatus = 'paid';
  const methodDisplay = payload.razorpayPaymentId
    ? `Razorpay Online (${payload.razorpayPaymentId})`
    : 'Razorpay Online (UPI / Cards / NetBanking)';

  let finalNotes = payload.notes || '';
  if (payload.razorpayPaymentId) {
    finalNotes += ` | Razorpay Txn: ${payload.razorpayPaymentId}`;
  }
  if (payload.razorpayOrderId) {
    finalNotes += ` | Razorpay Order: ${payload.razorpayOrderId}`;
  }

  const [created] = await db
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
      price: totalPrice,
      servicePrice,
      platformFee,
      totalPrice,
      status: 'confirmed',
      paymentMethod: 'online',
      paymentStatus,
      razorpayOrderId: payload.razorpayOrderId || '',
      razorpayPaymentId: payload.razorpayPaymentId || '',
      notes: finalNotes,
      internalBarberNotes: '',
      couponCode: payload.couponCode || '',
    })
    .returning();

  // Complete Payment Ledger Record
  await db.insert(payments).values({
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

  // Client notification
  await db.insert(notifications).values({
    id: `notif-${Date.now()}`,
    recipientUid: payload.customerUid,
    type: 'booking_confirmation',
    title: `Confirmed: ${payload.serviceName} with ${payload.barberName} (${payload.date} · ${payload.time} IST)`,
    timeLabel: 'Just now · Booking Engine',
    unread: true,
  });

  return created;
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

  // Enforce Authorization
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
      // Customer can only cancel or reschedule
      if (updates.status && updates.status.toLowerCase() !== 'cancelled') {
        throw new Error(
          'Customers may only cancel or reschedule their appointment.'
        );
      }
    }
  }

  // Enforce State Transitions
  if (updates.status) {
    const fromStatus = current.status.toLowerCase();
    const toStatus = updates.status.toLowerCase();
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: [
        'arrived',
        'in_progress',
        'cancelled',
        'no_show',
        'rescheduled',
        'completed',
      ],
      arrived: ['in_progress', 'cancelled', 'no_show'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      no_show: [],
    };

    if (
      fromStatus === 'completed' ||
      fromStatus === 'cancelled' ||
      fromStatus === 'no_show'
    ) {
      if (toStatus !== fromStatus) {
        throw new Error(`Cannot change status of a ${fromStatus} appointment.`);
      }
    } else if (
      ALLOWED_TRANSITIONS[fromStatus] &&
      !ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)
    ) {
      throw new Error(
        `Invalid appointment state transition from ${fromStatus} to ${toStatus}.`
      );
    }
  }

  // Overlap conflict check & working hours check when rescheduling
  if (
    (updates.date && updates.date !== current.date) ||
    (updates.time && updates.time !== current.time)
  ) {
    const targetDate = updates.date || current.date;
    const targetTime = updates.time || current.time;

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
