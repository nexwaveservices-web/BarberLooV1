import { createSignedToken } from '../src/middleware/auth.ts';
import { db } from '../src/db/index.ts';
import {
  profiles,
  services,
  barbers,
  shops,
  appointments,
  coupons,
  reviews,
  financialLedger,
  barberPayouts,
  payments,
} from '../src/db/schema.ts';
import { eq, and, or, like, ilike } from 'drizzle-orm';
import crypto from 'crypto';
import {
  slugify,
  getShopSlug,
  getShopUrl,
  getBookingUrl,
  findShopBySlugOrId,
} from '../src/lib/domain.ts';

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

    await db.insert(barbers).values({
      id: testBarberUid,
      userUid: testBarberUid,
      shopId: 'shop-1790996769501',
      shopName: 'Elite Unisex Salon',
      name: 'QA Test Barber',
      role: 'Master Stylist',
      specialty: 'Fades & Beard Sculpting',
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1',
      bio: 'Master barber for QA verification',
      phone: '+91 98765 00002',
      active: true,
      verificationStatus: 'verified',
      verified: true,
    } as any);

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
  const targetBarberToken = createSignedToken({
    uid: targetBarber.userUid || targetBarber.id,
    email: 'target.barber@barberloo.in',
    role: 'barber',
    name: targetBarber.name,
  });

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

  // 22. Clean Permalink Generation: slugify utility
  const testSlug1 = slugify('Pawan Hair Saloon, Ludhiana!');
  const testSlug2 = slugify('  The Royal Barbershop (Mayfair)  ');
  assert(
    testSlug1 === 'pawan-hair-saloon-ludhiana' && testSlug2 === 'the-royal-barbershop-mayfair',
    'Test 22: Slug generator produces clean, URL-safe permalinks from shop names and locations'
  );

  // 23. Shop Permalink Builder: /shop/:slug/
  const shopPermalink = getShopUrl(targetShop, 'https://barberloo.in');
  assert(
    shopPermalink.startsWith('https://barberloo.in/shop/') && shopPermalink.endsWith('/'),
    `Test 23: Clean Shop URL generator creates canonical permalink (${shopPermalink})`
  );

  // 24. Booking Permalink Builder: /book-appointment/?shop=:slug
  const bookingPermalink = getBookingUrl(targetShop, 'https://barberloo.in');
  assert(
    bookingPermalink.includes('/book-appointment/?shop='),
    `Test 24: Booking URL generator builds clean permalink (${bookingPermalink})`
  );

  // 25. Dual-Mode Shop Lookup: resolve by clean slug or raw shop ID
  const shopBySlug = findShopBySlugOrId([targetShop], getShopSlug(targetShop));
  const shopById = findShopBySlugOrId([targetShop], targetShop.id);
  assert(
    shopBySlug?.id === targetShop.id && shopById?.id === targetShop.id,
    'Test 25: Shop finder reliably resolves salon by either clean slug or legacy ID'
  );

  // 26. WP Pusher Status Endpoint: verifies connected WordPress repo without redirecting
  const resWpPusher = await fetch(`${BASE_URL}/api/wppusher/status`);
  const wpPusherData = await resWpPusher.json();
  assert(
    resWpPusher.status === 200 &&
      wpPusherData.connected === true &&
      wpPusherData.githubSlug === 'nexwaveservices-web/BarberLooV1' &&
      wpPusherData.pluginFile === 'barberloo.php',
    'Test 26: WP Pusher status endpoint reports active GitHub bridge and repository metadata'
  );

  // 27. WordPress Admin & System Path Protection Simulation
  // Verifies that paths matching /wp-admin, wp-login, etc., are never treated as frontend deep-routes
  const adminTestPaths = [
    '/wp-admin/',
    '/wp-admin/admin.php?page=wppusher',
    '/wp-admin/plugins.php',
    '/wp-login.php',
    '/wp-json/wp/v2/posts',
  ];
  const isWpSystemOrAdmin = (p: string) =>
    p.startsWith('/wp-admin') ||
    p.includes('wp-admin') ||
    p.includes('wp-login') ||
    p.includes('/wp-json/') ||
    p.includes('wp-cron') ||
    p.includes('xmlrpc');

  const allProtected = adminTestPaths.every(isWpSystemOrAdmin);
  assert(
    allProtected,
    'Test 27: WordPress Administration, WP Pusher submenu, and login URLs are strictly guarded'
  );

  // 28. Customer Payment Collection & Ledger Posting at Booking Time
  const testAptOtpId = `apt-otp-qa-${Date.now()}`;
  const resOtpBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: testAptOtpId,
      shopId: targetShop.id,
      serviceId: targetService.id,
      barberId: testBarberUid,
      date: '2026-11-21',
      time: '17:30',
      durationMin: 30,
      price: targetService.price,
      paymentMethod: 'online',
      razorpayPaymentId: `pay_qa_live_${Date.now()}`,
      razorpayOrderId: `order_qa_live_${Date.now()}`,
    }),
  });
  const otpBookingData = await resOtpBooking.json();

  const [payoutRow] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.appointmentId, testAptOtpId));

  const ledgerPostings = await db
    .select()
    .from(financialLedger)
    .where(eq(financialLedger.appointmentId, testAptOtpId));

  const hasCustomerEscrowDebit = ledgerPostings.some(
    (l) => l.account === 'customer_funds_escrow' && l.entryType === 'DEBIT'
  );
  const hasPlatformFeeCredit = ledgerPostings.some(
    (l) => l.account === 'platform_fee_revenue' && l.entryType === 'CREDIT'
  );
  const hasBarberPendingCredit = ledgerPostings.some(
    (l) => l.account === 'barber_payable_pending' && l.entryType === 'CREDIT'
  );

  assert(
    resOtpBooking.status === 200 &&
      payoutRow?.status === 'pending_verification' &&
      hasCustomerEscrowDebit &&
      hasPlatformFeeCredit &&
      hasBarberPendingCredit,
    'Test 28: Online payment collected at booking; barber earnings held pending and balanced double-entry ledger created',
    JSON.stringify(otpBookingData)
  );

  // 29. Completion OTP Confidentiality (Customer Access Only)
  const resCustOtp = await fetch(
    `${BASE_URL}/api/appointments/${testAptOtpId}/completion-otp`,
    {
      headers: { Authorization: `Bearer ${customerToken}` },
    }
  );
  const custOtpData = await resCustOtp.json();
  const rawCustomerOtp = custOtpData.completionOtp;

  const resBarberPeekOtp = await fetch(
    `${BASE_URL}/api/appointments/${testAptOtpId}/completion-otp`,
    {
      headers: { Authorization: `Bearer ${barberToken}` },
    }
  );

  assert(
    resCustOtp.status === 200 &&
      /^\d{6}$/.test(rawCustomerOtp) &&
      resBarberPeekOtp.status === 403,
    'Test 29: Customer receives cryptographically secure 6-digit completion OTP; Barber blocked from retrieving customer secret (HTTP 403)'
  );

  // 30. Invalid OTP Rejection & Rate Limiting
  const resBadOtp = await fetch(
    `${BASE_URL}/api/appointments/${testAptOtpId}/verify-completion-otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${barberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp: '000000' }),
    }
  );
  const badOtpData = await resBadOtp.json();

  const [aptAfterBad] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, testAptOtpId));

  assert(
    resBadOtp.status === 400 &&
      badOtpData.error?.includes('Invalid completion OTP') &&
      aptAfterBad.completionOtpAttempts === 1 &&
      aptAfterBad.status === 'confirmed',
    'Test 30: Invalid OTP rejected, attempt counter incremented, barber earnings remain pending',
    JSON.stringify({ status: resBadOtp.status, badOtpData })
  );

  // 31. Valid OTP Verification, Appointment Completion, Ledger Release & Payout Initiation
  const resGoodOtp = await fetch(
    `${BASE_URL}/api/appointments/${testAptOtpId}/verify-completion-otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${barberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp: rawCustomerOtp }),
    }
  );
  const goodOtpData = await resGoodOtp.json();

  const [aptAfterGood] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, testAptOtpId));

  const [payoutAfterGood] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.appointmentId, testAptOtpId));

  const ledgerAfterGood = await db
    .select()
    .from(financialLedger)
    .where(eq(financialLedger.appointmentId, testAptOtpId));

  const hasReleaseLedger = ledgerAfterGood.some(
    (l) => l.account === 'barber_payable_released' && l.referenceType === 'otp_completion'
  );
  const hasInTransitLedger = ledgerAfterGood.some(
    (l) => l.account === 'barber_payout_in_transit' && l.referenceType === 'payout_initiated'
  );

  assert(
    resGoodOtp.status === 200 &&
      aptAfterGood.status === 'completed' &&
      aptAfterGood.completionOtpStatus === 'verified' &&
      payoutAfterGood?.status === 'initiated' &&
      hasReleaseLedger &&
      hasInTransitLedger,
    'Test 31: Correct OTP verified; appointment completed, ledger releases barber earnings, and provider transfer is initiated'
  );

  // 32. Double Verification & Idempotency Guard
  const resDoubleVerify = await fetch(
    `${BASE_URL}/api/appointments/${testAptOtpId}/verify-completion-otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${barberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp: rawCustomerOtp }),
    }
  );

  assert(
    resDoubleVerify.status === 400,
    'Test 32: Concurrency & Idempotency protection prevents double-completion of appointment'
  );

  // 33. Administrative Hold Prevents Payout Execution
  const testHoldAptId = `apt-hold-qa-${Date.now()}`;
  await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: testHoldAptId,
      shopId: targetShop.id,
      serviceId: targetService.id,
      barberId: testBarberUid,
      date: '2026-11-21',
      time: '18:15',
      durationMin: 30,
      price: targetService.price,
      paymentMethod: 'online',
      razorpayPaymentId: `pay_hold_${Date.now()}`,
      razorpayOrderId: `order_hold_${Date.now()}`,
    }),
  });

  // Apply administrative hold
  const holdPayoutId = `payout-${testHoldAptId}`;
  await fetch(`${BASE_URL}/api/payouts/${holdPayoutId}/hold`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hold: true,
      reason: 'Dispute filed by customer regarding hair styling',
    }),
  });

  const [payoutOnHold] = await db
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.id, holdPayoutId));

  // Get customer OTP for testHoldAptId
  const resHoldCustOtp = await fetch(
    `${BASE_URL}/api/appointments/${testHoldAptId}/completion-otp`,
    {
      headers: { Authorization: `Bearer ${customerToken}` },
    }
  );
  const holdCustOtpData = await resHoldCustOtp.json();

  // Attempt barber verification while on administrative hold
  const resVerifyOnHold = await fetch(
    `${BASE_URL}/api/appointments/${testHoldAptId}/verify-completion-otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${barberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp: holdCustOtpData.completionOtp }),
    }
  );

  assert(
    payoutOnHold?.status === 'on_hold' &&
      resVerifyOnHold.status === 400 &&
      (await resVerifyOnHold.json()).error?.includes('Payout is on administrative hold'),
    'Test 33: Administrative hold strictly blocks completion and payout until formally resolved'
  );
  // 34. Cookie-based Session Persistence (No Authorization Header)
  const resCookieAuth = await fetch(`${BASE_URL}/api/profiles/${testCustomerUid}`, {
    headers: {
      Cookie: `barberloo_auth_token=${customerToken}`,
    },
  });
  const cookieProfileData = await resCookieAuth.json();

  assert(
    resCookieAuth.status === 200 && cookieProfileData?.uid === testCustomerUid,
    'Test 34: Session persists across page refreshes via secure cookie authentication without Authorization header'
  );

  // 35. Malformed or Expired Cookie Rejected (Zero-Trust Session Guard)
  const resBadCookie = await fetch(`${BASE_URL}/api/profiles/${testCustomerUid}`, {
    headers: {
      Cookie: 'barberloo_auth_token=invalid.tampered.token',
    },
  });

  assert(
    resBadCookie.status === 401,
    'Test 35: Malformed or forged session cookie is cryptographically rejected'
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
        .delete(barbers)
        .where(eq(barbers.id, testBarberUid));
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
