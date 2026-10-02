import { db } from './index.ts';
import {
  users,
  profiles,
  shops,
  barbers,
  services,
  appointments,
  queue,
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
): 'admin' | 'barber' | 'customer' {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail === OWNER_ADMIN_EMAIL) {
    return 'admin';
  }
  if (existingRole === 'barber' || existingRole === 'shop_owner') {
    return 'barber';
  }
  if (existingRole === 'customer') {
    return 'customer';
  }
  if (requestedRole === 'barber' || requestedRole === 'shop_owner') {
    return 'barber';
  }
  return 'customer';
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  requestedRole?: string,
  phone?: string
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
    shopRows,
    barberRows,
    serviceRows,
    appointmentRows,
    queueRows,
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
    db.select().from(shops).orderBy(asc(shops.distanceMilesTenths)),
    db.select().from(barbers),
    db.select().from(services).orderBy(asc(services.indexCode)),
    db.select().from(appointments).orderBy(desc(appointments.createdAt)),
    db.select().from(queue).orderBy(asc(queue.position)),
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
    queueCount: queueRows.filter(
      (q) =>
        q.shopId === sh.id &&
        (q.status === 'waiting' || q.status === 'called' || q.status === 'serving')
    ).length,
    waitMins:
      queueRows.filter(
        (q) =>
          q.shopId === sh.id &&
          (q.status === 'waiting' || q.status === 'called' || q.status === 'serving')
      ).length * 12,
  }));

  const mappedQueue = queueRows
    .filter(
      (q) =>
        q.status === 'waiting' || q.status === 'called' || q.status === 'serving'
    )
    .map((q) => ({
      id: q.id,
      shopId: q.shopId,
      barberId: q.barberId,
      position: q.position,
      customerUid: q.customerUid,
      clientName: q.clientName,
      serviceId: q.serviceId,
      serviceName: q.serviceName,
      barberName: q.barberName,
      status:
        q.status === 'serving'
          ? 'Serving'
          : q.status === 'called'
          ? 'Next Up'
          : 'Waiting',
      rawStatus: q.status,
      estimatedWaitMin: q.estimatedWaitMin,
      waitMins: q.estimatedWaitMin + q.graceBufferMin,
      graceBufferMin: q.graceBufferMin,
      joinedAt: q.joinedAt,
      isCurrentUser: Boolean(
        activeCustomerUid && q.customerUid === activeCustomerUid
      ),
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
    shops: mappedShops,
    barbers: mappedBarbers,
    services: mappedServices,
    appointments: mappedAppointments,
    queue: mappedQueue,
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
}) {
  if (payload.barberId) {
    const conflicts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, payload.barberId),
          eq(appointments.date, payload.date),
          eq(appointments.time, payload.time)
        )
      );

    const activeConflict = conflicts.find(
      (c) => c.status !== 'cancelled' && c.status !== 'no_show'
    );
    if (activeConflict) {
      throw new Error(
        `Double-booking prevented: ${payload.barberName} is already booked on ${payload.date} at ${payload.time} IST.`
      );
    }
  }

  const paymentStatus = payload.paymentMethod === 'online' ? 'paid' : 'pending';

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
      notes: payload.notes || '',
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
    methodDisplay:
      payload.paymentMethod === 'online'
        ? 'UPI / Razorpay Instant'
        : 'Pay at Salon (INR)',
    status: paymentStatus,
    receiptNumber: `BL-IN-${Math.floor(10000 + Math.random() * 89999)}`,
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

export async function recalculateActiveQueuePositions(shopId = 'shop-1') {
  const rows = await db
    .select()
    .from(queue)
    .where(eq(queue.shopId, shopId))
    .orderBy(asc(queue.position), asc(queue.createdAt));

  const activeRows = rows.filter(
    (r) =>
      r.status === 'serving' || r.status === 'called' || r.status === 'waiting'
  );

  for (let i = 0; i < activeRows.length; i++) {
    const item = activeRows[i];
    const newPos = i + 1;
    const newStatus =
      newPos === 1 ? 'serving' : newPos === 2 ? 'called' : 'waiting';
    const newWait = newPos === 1 ? 0 : (newPos - 1) * 12;

    await db
      .update(queue)
      .set({
        position: newPos,
        status: newStatus,
        estimatedWaitMin: newWait,
      })
      .where(eq(queue.id, item.id));

    if (item.customerUid && newPos <= 2 && item.position !== newPos) {
      await db.insert(notifications).values({
        id: `notif-${Date.now()}-${i}`,
        recipientUid: item.customerUid,
        type: newPos === 1 ? 'service_started' : 'customer_next',
        title:
          newPos === 1
            ? `Your chair is ready! ${item.barberName} is now serving you.`
            : `You are Next Up (#2) for ${item.barberName}. Please head to the salon.`,
        timeLabel: 'Just now · Live Queue Telemetry',
        unread: true,
      });
    }
  }
}

export async function mutateQueueInDb(action: {
  type:
    | 'advance'
    | 'leave'
    | 'rejoin'
    | 'walkin'
    | 'reset'
    | 'status'
    | 'grace';
  customerUid?: string;
  clientName?: string;
  serviceName?: string;
  barberName?: string;
  queueId?: string;
  newStatus?: string;
  shopId?: string;
}) {
  const shopId = action.shopId || 'shop-1';
  const customerUid = action.customerUid || '';

  if (action.type === 'advance') {
    const all = await db
      .select()
      .from(queue)
      .where(eq(queue.shopId, shopId))
      .orderBy(asc(queue.position));
    const active = all.filter(
      (q) =>
        q.status === 'serving' || q.status === 'called' || q.status === 'waiting'
    );
    if (active.length > 0) {
      await db
        .update(queue)
        .set({ status: 'completed', position: 0, estimatedWaitMin: 0 })
        .where(eq(queue.id, active[0].id));
      await recalculateActiveQueuePositions(shopId);
    }
  } else if (action.type === 'leave') {
    if (customerUid) {
      const userEntries = await db
        .select()
        .from(queue)
        .where(eq(queue.customerUid, customerUid));
      for (const entry of userEntries) {
        if (
          entry.status === 'waiting' ||
          entry.status === 'called' ||
          entry.status === 'serving'
        ) {
          await db
            .update(queue)
            .set({ status: 'cancelled', position: 0 })
            .where(eq(queue.id, entry.id));
        }
      }
      await recalculateActiveQueuePositions(shopId);
    }
  } else if (action.type === 'rejoin') {
    if (!customerUid) {
      throw new Error('Please sign in to join the live queue.');
    }
    const all = await db
      .select()
      .from(queue)
      .where(eq(queue.shopId, shopId))
      .orderBy(asc(queue.position));
    const active = all.filter(
      (q) =>
        q.status === 'serving' || q.status === 'called' || q.status === 'waiting'
    );
    const alreadyIn = active.find((q) => q.customerUid === customerUid);
    if (!alreadyIn) {
      const newPos = active.length + 1;
      await db.insert(queue).values({
        id: `q-${Date.now()}`,
        shopId,
        barberId: 'brb-1',
        barberName: action.barberName || 'Available Barber',
        customerUid,
        clientName: action.clientName || 'Verified Guest',
        serviceId: 'srv-1',
        serviceName: action.serviceName || 'Haircut & Grooming',
        position: newPos,
        status: newPos === 1 ? 'serving' : newPos === 2 ? 'called' : 'waiting',
        estimatedWaitMin: Math.max(0, (newPos - 1) * 12),
        graceBufferMin: 0,
        joinedAt: new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      });
      await db.insert(notifications).values({
        id: `notif-${Date.now()}`,
        recipientUid: customerUid,
        type: 'queue_joined',
        title: `Joined Live Queue at Position #${newPos}`,
        timeLabel: 'Just now · Live Queue Telemetry',
        unread: true,
      });
    }
    await recalculateActiveQueuePositions(shopId);
  } else if (action.type === 'walkin') {
    const all = await db
      .select()
      .from(queue)
      .where(eq(queue.shopId, shopId))
      .orderBy(asc(queue.position));
    const active = all.filter(
      (q) =>
        q.status === 'serving' || q.status === 'called' || q.status === 'waiting'
    );
    const newPos = active.length + 1;
    await db.insert(queue).values({
      id: `q-${Date.now()}`,
      shopId,
      barberId: 'brb-1',
      barberName: action.barberName || 'Barber',
      customerUid: `walkin-${Date.now()}`,
      clientName: action.clientName || 'Walk-in Guest',
      serviceId: 'srv-1',
      serviceName: action.serviceName || 'Haircut & Styling',
      position: newPos,
      status: newPos === 1 ? 'serving' : newPos === 2 ? 'called' : 'waiting',
      estimatedWaitMin: Math.max(0, (newPos - 1) * 12),
      graceBufferMin: 0,
      joinedAt: new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    });
    await recalculateActiveQueuePositions(shopId);
  } else if (action.type === 'grace') {
    if (customerUid) {
      const userEntries = await db
        .select()
        .from(queue)
        .where(eq(queue.customerUid, customerUid));
      for (const entry of userEntries) {
        if (entry.status === 'waiting' || entry.status === 'called') {
          const nextGrace = entry.graceBufferMin > 0 ? 0 : 5;
          await db
            .update(queue)
            .set({ graceBufferMin: nextGrace })
            .where(eq(queue.id, entry.id));
        }
      }
    }
  } else if (action.type === 'status' && action.queueId && action.newStatus) {
    await db
      .update(queue)
      .set({ status: action.newStatus })
      .where(eq(queue.id, action.queueId));
    await recalculateActiveQueuePositions(shopId);
  } else if (action.type === 'reset') {
    await db.delete(queue).where(eq(queue.shopId, shopId));
  }

  const state = await getBootstrapState(customerUid);
  return state.queue;
}
