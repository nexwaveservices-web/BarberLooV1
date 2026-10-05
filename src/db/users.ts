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
  rewards,
  reports,
} from './schema.ts';
import { eq, asc, desc, and } from 'drizzle-orm';
import { ASSETS } from '../data/barberlooData.ts';

export const OWNER_ADMIN_EMAIL = 'nexwaveservices@gmail.com';

export function resolveAllowedRole(
  email: string | undefined | null,
  requestedRole?: string | null,
  existingRole?: string | null
): 'admin' | 'shop_owner' | 'barber' | 'customer' {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail === OWNER_ADMIN_EMAIL) {
    return 'admin';
  }
  if (existingRole === 'shop_owner' || requestedRole === 'shop_owner') {
    return 'shop_owner';
  }
  if (existingRole === 'barber' || requestedRole === 'barber') {
    return 'barber';
  }
  if (existingRole === 'customer') {
    return 'customer';
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
    cleanEmail,
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
        tier:
          finalRole === 'admin'
            ? 'Founder & Platform Admin'
            : finalRole === 'barber'
            ? 'Verified Barber Partner'
            : 'Member',
        preferredNotes: '',
        rewardBalance: 0,
        status: 'active',
        assignedShopId: '',
        assignedBarberId: '',
      })
      .onConflictDoNothing();
  } else {
    const updates: Record<string, any> = {};
    if (cleanEmail === OWNER_ADMIN_EMAIL && existingProfiles[0].role !== 'admin') {
      updates.role = 'admin';
      updates.tier = 'Founder & Platform Admin';
    } else if (
      existingProfiles[0].role !== 'admin' &&
      requestedRole &&
      (requestedRole === 'barber' || requestedRole === 'customer') &&
      existingProfiles[0].role !== requestedRole
    ) {
      updates.role = requestedRole;
      updates.tier =
        requestedRole === 'barber' ? 'Verified Barber Partner' : 'Member';
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

export async function getBootstrapState(activeCustomerUid?: string) {
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
    rewardRows,
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
    activeCustomerUid
      ? db
          .select()
          .from(favorites)
          .where(eq(favorites.customerUid, activeCustomerUid))
      : Promise.resolve([]),
    activeCustomerUid
      ? db
          .select()
          .from(notifications)
          .where(eq(notifications.recipientUid, activeCustomerUid))
          .orderBy(desc(notifications.createdAt))
      : Promise.resolve([]),
    db.select().from(workingHours).orderBy(asc(workingHours.dayOrder)),
    db.select().from(shopGallery),
    db.select().from(barberGallery),
    db.select().from(payments).orderBy(desc(payments.createdAt)),
    db.select().from(coupons),
    activeCustomerUid
      ? db
          .select()
          .from(rewards)
          .where(eq(rewards.customerUid, activeCustomerUid))
          .orderBy(desc(rewards.createdAt))
      : Promise.resolve([]),
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
  }));

  const mappedAppointments = appointmentRows.map((a) => ({
    id: a.id,
    referenceCode: a.id.toUpperCase(),
    customerUid: a.customerUid,
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    clientTier: a.clientTier,
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
    barberNotes: a.internalBarberNotes,
    internalBarberNotes: a.internalBarberNotes,
    couponCode: a.couponCode,
  }));

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
    moderationNote: r.moderationNote,
  }));

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
    payments: paymentRows,
    coupons: couponRows,
    rewards: rewardRows,
    profiles: profileRows,
    reports: reportRows,
  };
}

export async function createBookingInDb(payload: {
  id: string;
  customerUid: string;
  clientName: string;
  clientPhone: string;
  clientTier?: string;
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
  // 1. Server-side validation of Service
  if (payload.serviceId) {
    const [dbService] = await db
      .select()
      .from(services)
      .where(eq(services.id, payload.serviceId));
    if (dbService) {
      if (payload.shopId && dbService.shopId && dbService.shopId !== payload.shopId) {
        throw new Error('Service does not belong to the selected shop.');
      }
      if (dbService.active === false) {
        throw new Error('Selected service is currently inactive.');
      }
      // Never trust client price or duration: enforce verified database values
      payload.price = dbService.price;
      payload.durationMin = dbService.durationMin;
      payload.serviceName = dbService.name;
    }
  }

  // 2. Server-side validation of Barber
  if (payload.barberId && payload.barberId.startsWith('brb-') && !payload.barberId.includes('master')) {
    const [dbBarber] = await db
      .select()
      .from(barbers)
      .where(eq(barbers.id, payload.barberId));
    if (dbBarber) {
      if (payload.shopId && dbBarber.shopId && dbBarber.shopId !== payload.shopId) {
        throw new Error('Barber does not belong to the selected shop.');
      }
      if (dbBarber.active === false || dbBarber.verificationStatus === 'suspended') {
        throw new Error('Selected barber is currently unavailable.');
      }
      payload.barberName = dbBarber.name;
    }
  }

  // 3. Dynamic overlap double-booking check
  if (payload.barberId && payload.date && payload.time) {
    const existingApts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, payload.barberId),
          eq(appointments.date, payload.date)
        )
      );

    const [nh, nm] = payload.time.split(':').map(Number);
    const newStartMin = nh * 60 + nm;
    const newEndMin = newStartMin + Number(payload.durationMin || 45);

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
  }

  const isPaidOnline =
    payload.paymentMethod === 'razorpay' ||
    payload.paymentMethod === 'online' ||
    Boolean(payload.razorpayPaymentId);
  const paymentStatus = isPaidOnline ? 'paid' : 'pending';

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
  if (Array.isArray(payload.addOns) && payload.addOns.length > 0) {
    const addOnNames = payload.addOns.map((a: any) => `${a.name} (+₹${a.price})`).join(', ');
    finalNotes += ` | Add-ons: ${addOnNames}`;
  }
  if (payload.razorpayPaymentId) {
    finalNotes += ` | Razorpay Txn: ${payload.razorpayPaymentId}`;
  }
  if (payload.woocommerceOrderId) {
    finalNotes += ` | WooCommerce Order: #${payload.woocommerceOrderId}`;
  }

  const [created] = await db
    .insert(appointments)
    .values({
      id: payload.id,
      customerUid: payload.customerUid,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientTier: payload.clientTier || 'Member',
      shopId: payload.shopId,
      shopName: payload.shopName,
      barberId: payload.barberId,
      barberName: payload.barberName,
      serviceId: payload.serviceId,
      serviceName: payload.serviceName,
      date: payload.date,
      time: payload.time,
      durationMin: payload.durationMin,
      price: payload.price,
      status: 'confirmed',
      paymentMethod: payload.paymentMethod,
      paymentStatus,
      notes: finalNotes,
      internalBarberNotes: '',
      couponCode: payload.couponCode || '',
    })
    .returning();

  await db.insert(payments).values({
    id: `pay-${Date.now()}`,
    appointmentId: payload.id,
    customerUid: payload.customerUid,
    clientName: payload.clientName,
    shopId: payload.shopId,
    shopName: payload.shopName,
    amount: payload.price,
    platformFee: Math.max(25, Math.round(payload.price * 0.08)),
    method: payload.paymentMethod,
    methodDisplay,
    status: paymentStatus,
    receiptNumber: payload.razorpayPaymentId
      ? `RZP-${payload.razorpayPaymentId}`
      : `BL-IN-${Math.floor(10000 + Math.random() * 89999)}`,
  });

  await db.insert(notifications).values({
    id: `notif-${Date.now()}`,
    recipientUid: payload.customerUid,
    type: 'booking_confirmation',
    title: `Confirmed: ${payload.serviceName} with ${payload.barberName} (${payload.date} · ${payload.time} IST)`,
    timeLabel: 'Just now · Booking Engine',
    unread: true,
  });

  const pointsEarned = payload.price * 2;
  await db.insert(rewards).values({
    id: `rew-${Date.now()}`,
    customerUid: payload.customerUid,
    pointsDelta: pointsEarned,
    reason: `Booked ${payload.serviceName}`,
    type: 'earned',
  });

  const profs = await db
    .select()
    .from(profiles)
    .where(eq(profiles.uid, payload.customerUid));
  if (profs.length > 0) {
    await db
      .update(profiles)
      .set({ rewardBalance: (profs[0].rewardBalance || 0) + pointsEarned })
      .where(eq(profiles.uid, payload.customerUid));
  }

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

  if (
    (updates.date && updates.date !== current.date) ||
    (updates.time && updates.time !== current.time)
  ) {
    const targetDate = updates.date || current.date;
    const targetTime = updates.time || current.time;
    const conflicts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, current.barberId),
          eq(appointments.date, targetDate),
          eq(appointments.time, targetTime)
        )
      );
    const otherConflict = conflicts.find(
      (c) =>
        c.id !== id && c.status !== 'cancelled' && c.status !== 'no_show'
    );
    if (otherConflict) {
      throw new Error(
        `Slot ${targetDate} at ${targetTime} IST is already taken for ${current.barberName}.`
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

