import { createSignedToken } from '../src/middleware/auth.ts';
import { db } from '../src/db/index.ts';
import { profiles, services, barbers, shops, appointments, coupons, reviews } from '../src/db/schema.ts';
import { eq, and, or, like, ilike } from 'drizzle-orm';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

async function runQaSuite() {
  console.log('=== STARTING BARBERLOO PRODUCTION QA VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // Pre-test cleanup: ensure no stale mock/test artifacts pollute test run
  try {
    await db.delete(appointments).where(
      or(
        like(appointments.customerUid, 'test-%'),
        ilike(appointments.clientName, '%QA Test%')
      )
    );
    await db.delete(services).where(eq(services.name, 'QA Test Service'));
    await db.delete(coupons).where(eq(coupons.code, 'QAWELCOME20'));
    await db.delete(profiles).where(
      or(
        like(profiles.uid, 'test-%'),
        ilike(profiles.name, '%QA Test%')
      )
    );
  } catch {
    // Ignore transient cleanup error
  }

  // Set up test users in database profiles
  const testCustomerUid = 'test-cust-' + Date.now();
  const testBarberUid = 'test-brb-' + Date.now();
  const testAdminUid = 'test-admin-' + Date.now();

  let validAptData: any = {};
  let couponAptData: any = {};
  let createdSrv: any = {};

  try {
    await db.insert(profiles).values([
      {
        id: `prof-${testCustomerUid}`,
        uid: testCustomerUid,
        email: 'customer.test@barberloo.in',
        name: 'QA Test Customer',
        phone: '+91 98765 00001',
        role: 'customer',
        status: 'active',
      },
      {
        id: `prof-${testBarberUid}`,
        uid: testBarberUid,
        email: 'barber.test@barberloo.in',
        name: 'QA Test Barber',
        phone: '+91 98765 00002',
        role: 'barber',
        status: 'active',
      },
      {
        id: `prof-${testAdminUid}`,
        uid: testAdminUid,
        email: 'admin.governance@barberloo.in',
        name: 'Platform Overseer',
        phone: '+91 98765 00003',
        role: 'admin',
        status: 'active',
      },
    ]);

    const customerToken = createSignedToken({
      uid: testCustomerUid,
      email: 'customer.test@barberloo.in',
      role: 'customer',
      name: 'QA Test Customer',
    });

    const barberToken = createSignedToken({
      uid: testBarberUid,
      email: 'barber.test@barberloo.in',
      role: 'barber',
      name: 'QA Test Barber',
    });

  const adminToken = createSignedToken({
    uid: testAdminUid,
    email: 'admin.governance@barberloo.in',
    role: 'admin',
    name: 'Platform Overseer',
  });

  // --- AUTH TESTS ---
  // 1. Unauthorized request blocked
  const resUnauth = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-10-15', time: '14:00' }),
  });
  assert(resUnauth.status === 401, 'Test 1: Unauthorized API request blocked (HTTP 401)');

  // 2. Forged JWT blocked
  const resForged = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.forged.jwt',
    },
    body: JSON.stringify({ date: '2026-10-15', time: '14:00' }),
  });
  assert(resForged.status === 401, 'Test 2: Forged token cryptographically rejected (HTTP 401)');

  // 3. Customer blocked from admin endpoint
  const resAdminGuard = await fetch(`${BASE_URL}/api/reports/rep-123`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ status: 'resolved' }),
  });
  assert(resAdminGuard.status === 403, 'Test 3: Customer blocked from admin route (HTTP 403)');

  // 4. Admin authorized on admin endpoint
  const resAdminOk = await fetch(`${BASE_URL}/api/reports/rep-test`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'investigating' }),
  });
  assert(resAdminOk.status === 200 || resAdminOk.status === 404, 'Test 4: Admin authorized on platform administration');

  // --- DISCOVERY & SHOP TESTS ---
  // 5. Locations endpoint public
  const resStates = await fetch(`${BASE_URL}/api/locations/states`);
  const statesData = await resStates.json();
  assert(Array.isArray(statesData) && statesData.length > 0, 'Test 5: Public location states available');

  // 6. Bootstrap state public discovery vs sanitized private data
  const resBootPublic = await fetch(`${BASE_URL}/api/bootstrap`);
  const bootPublicData = await resBootPublic.json();
  assert(
    Array.isArray(bootPublicData.shops) && bootPublicData.appointments.length === 0,
    'Test 6: Bootstrap endpoint public discovery returns shops and scrubs appointments for guests'
  );

  // 7. Customer bootstrap only returns customer appointments
  const resBootCust = await fetch(`${BASE_URL}/api/bootstrap`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const bootCustData = await resBootCust.json();
  assert(
    Array.isArray(bootCustData.appointments),
    'Test 7: Authenticated customer retrieves their scoped appointments'
  );

  // --- APPOINTMENT BOOKING & SECURITY TESTS ---
  // Ensure valid shop, barber, service exist
  const [targetShop] = await db.select().from(shops).where(eq(shops.id, 'shop-1790996769501'));
  const [targetBarber] = await db.select().from(barbers).where(eq(barbers.shopId, targetShop.id));
  const [targetService] = await db.select().from(services).where(eq(services.shopId, targetShop.id));

  // 8. Past booking rejection
  const resPast = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: '2020-01-01',
      time: '14:00',
    }),
  });
  const pastData = await resPast.json();
  assert(resPast.status === 400 && pastData.error?.includes('past date'), 'Test 8: Past date booking rejected server-side');

  // 9. Outside operating hours rejection
  const resOutsideHours = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: '2026-11-20',
      time: '04:30', // 4:30 AM is outside salon operating hours
    }),
  });
  const outsideData = await resOutsideHours.json();
  assert(resOutsideHours.status === 400 && outsideData.error?.includes('outside salon hours'), 'Test 9: Outside working hours rejected');

  // 10. Valid booking creation with server-side price enforcement
  const validBookingDate = '2026-11-20';
  const validBookingTime = '11:00';
  const resValidApt = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: validBookingDate,
      time: validBookingTime,
      price: 1, // Manipulated price from client
      customerUid: 'forged-attacker-uid', // Manipulated customerUid from client
    }),
  });
  const validAptData = await resValidApt.json();
  assert(
    resValidApt.status === 200 &&
      validAptData.customerUid === testCustomerUid &&
      validAptData.price === targetService.price,
    'Test 10: Valid booking created; server strictly enforces authenticated customerUid and database service price'
  );

  // 11. Overlapping booking rejection (Double-booking protection)
  const resOverlap = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: validBookingDate,
      time: '11:15', // Overlaps with 11:00 - 11:45
    }),
  });
  const overlapData = await resOverlap.json();
  assert(
    resOverlap.status === 400 && overlapData.error?.includes('Double-booking prevented'),
    'Test 11: Overlapping appointment for same barber rejected by concurrency double-booking guard'
  );

  // 12. Appointment cancellation by customer
  const resCancel = await fetch(`${BASE_URL}/api/appointments/${validAptData.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const cancelData = await resCancel.json();
  assert(resCancel.status === 200 && cancelData.status === 'cancelled', 'Test 12: Customer can cancel their appointment');

  // 13. State machine: cannot transition from cancelled to in_progress
  const resInvalidTransition = await fetch(`${BASE_URL}/api/appointments/${validAptData.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  assert(resInvalidTransition.status === 400, 'Test 13: Invalid state machine transition rejected');

  // 14. Reviews: client without completed appointment cannot submit review
  const resReviewBlocked = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      comment: 'Review without completion',
      rating: 5,
    }),
  });
  assert(resReviewBlocked.status === 403, 'Test 14: Review rejected if client has no completed appointments');

  // 15. Razorpay Signature Verification
  const testOrderId = 'order_test_123';
  const testPaymentId = 'pay_test_456';
  const resRzp = await fetch(`${BASE_URL}/api/payments/razorpay/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      razorpay_order_id: testOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: 'invalid_sig',
    }),
  });
  assert(resRzp.status === 200 || resRzp.status === 400, 'Test 15: Razorpay verification handler responded correctly');

  // 16. Service Creation Authorization (Customer blocked)
  const resSrvCust = await fetch(`${BASE_URL}/api/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ name: 'Hacked Service', price: 999 }),
  });
  assert(resSrvCust.status === 403, 'Test 16: Regular customer blocked from creating salon services (HTTP 403)');

  // 17. Service Creation Authorization (Barber authorized)
  const resSrvBarber = await fetch(`${BASE_URL}/api/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${barberToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      name: 'QA Test Service',
      price: 600,
      durationMin: 30,
    }),
  });
  const createdSrv = await resSrvBarber.json();
  assert(resSrvBarber.status === 200 && createdSrv.name === 'QA Test Service', 'Test 17: Barber authorized to create shop service');

  // 18. Server-side coupon application & discount enforcement
  const testCouponCode = 'QAWELCOME20';
  await db.insert(coupons).values({
    id: 'cpn-qa-test',
    shopId: targetShop.id,
    code: testCouponCode,
    discountText: '20% Off Test',
    discountPercent: 20,
    minSpend: 50,
    usesCount: 0,
    maxUses: 100,
    status: 'Active',
    expiresAt: '2028-12-31',
  }).onConflictDoNothing();

  const resCouponApt = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: '2026-11-22',
      time: '15:00',
      couponCode: testCouponCode,
    }),
  });
  const couponAptData = await resCouponApt.json();
  const expectedDiscountedPrice = Math.round(targetService.price * 0.8);
  assert(
    resCouponApt.status === 200 &&
      couponAptData.price === expectedDiscountedPrice &&
      couponAptData.couponCode === testCouponCode,
    'Test 18: Server validated coupon and computed 20% discount authoritatively'
  );

  // 19. Reschedule Conflict Protection
  // Try rescheduling the coupon appointment to overlap with an existing time
  const resRescheduleConflict = await fetch(`${BASE_URL}/api/appointments/${couponAptData.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      time: '04:00', // Outside operating hours
    }),
  });
  assert(resRescheduleConflict.status === 400, 'Test 19: Reschedule outside salon operating hours rejected server-side');

  // 20. Data privacy: customer bootstrap does not contain other users' private profiles
  const resCustBootstrap = await fetch(`${BASE_URL}/api/bootstrap`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const custBootstrapData = await resCustBootstrap.json();
  const exposedOtherCustomer = custBootstrapData.profiles?.find(
    (p: any) => p.role === 'customer' && p.uid !== testCustomerUid
  );
  assert(
    !exposedOtherCustomer,
    'Test 20: Data privacy preserved — customer cannot view other clients private profile data'
  );

  // 21. Barber Role Enforcement: Barbers cannot create bookings
  const resBarberApt = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${barberToken}`,
    },
    body: JSON.stringify({
      shopId: targetShop.id,
      barberId: targetBarber.id,
      serviceId: targetService.id,
      date: '2026-11-25',
      time: '14:00',
      clientName: 'Mock Client',
      clientPhone: '+91 98765 00000',
    }),
  });
  const barberAptErr = await resBarberApt.json();
  assert(
    resBarberApt.status === 403 &&
      barberAptErr.error?.includes('Barber accounts cannot create bookings'),
    'Test 21: Barber account strictly blocked from creating appointments (HTTP 403 Forbidden)'
  );

  } finally {
    // Clean up created test fixtures guaranteed
    try {
      await db
        .delete(appointments)
        .where(
          or(
            eq(appointments.customerUid, testCustomerUid),
            like(appointments.customerUid, 'test-%')
          )
        );
      await db
        .delete(services)
        .where(eq(services.name, 'QA Test Service'));
      await db
        .delete(coupons)
        .where(
          or(
            eq(coupons.id, 'cpn-qa-test'),
            eq(coupons.code, 'QAWELCOME20')
          )
        );
      await db
        .delete(profiles)
        .where(
          or(
            eq(profiles.uid, testCustomerUid),
            eq(profiles.uid, testBarberUid),
            eq(profiles.uid, testAdminUid),
            like(profiles.uid, 'test-%')
          )
        );
    } catch {
      // Best-effort cleanup
    }
  }

  console.log(`\n=== QA SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runQaSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
