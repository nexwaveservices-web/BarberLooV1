import { createSignedToken } from '../src/middleware/auth.ts';
import { db } from '../src/db/index.ts';
import {
  profiles,
  barbers,
  shops,
  appointments,
  barberEarningsLedger,
  barberWithdrawalRequests,
  barberPayoutBeneficiaries,
  financialAuditLogs,
} from '../src/db/schema.ts';
import { eq, or, like } from 'drizzle-orm';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

async function runEarningsWithdrawalQaSuite() {
  console.log('=== STARTING BARBERLOO EARNINGS LEDGER & WITHDRAWAL QA SUITE ===\n');
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

  const testCustUid = 'test-cust-earn-' + Date.now();
  const testBarber1Uid = 'test-brb1-' + Date.now();
  const testBarber2Uid = 'test-brb2-' + Date.now();
  const testAdminUid = 'test-admin-earn-' + Date.now();

  const barber1Id = 'brb-test-1-' + Date.now();
  const barber2Id = 'brb-test-2-' + Date.now();
  const testShopId = 'shop-earn-test-' + Date.now();

  const custToken = createSignedToken({ uid: testCustUid, email: 'cust.earn@barberloo.in', role: 'customer' });
  const barber1Token = createSignedToken({ uid: testBarber1Uid, email: 'barber1.earn@barberloo.in', role: 'barber' });
  const barber2Token = createSignedToken({ uid: testBarber2Uid, email: 'barber2.earn@barberloo.in', role: 'barber' });
  const adminToken = createSignedToken({ uid: testAdminUid, email: 'admin.earn@barberloo.in', role: 'admin' });

  try {
    // 1. Seed test profiles, shop, and barbers
    await db.insert(profiles).values([
      {
        id: `prof-${testCustUid}`,
        uid: testCustUid,
        email: 'cust.earn@barberloo.in',
        name: 'Test Customer',
        role: 'customer',
        status: 'active',
      },
      {
        id: `prof-${testBarber1Uid}`,
        uid: testBarber1Uid,
        email: 'barber1.earn@barberloo.in',
        name: 'Master Barber 1',
        role: 'barber',
        assignedBarberId: barber1Id,
        assignedShopId: testShopId,
        status: 'active',
      },
      {
        id: `prof-${testBarber2Uid}`,
        uid: testBarber2Uid,
        email: 'barber2.earn@barberloo.in',
        name: 'Master Barber 2',
        role: 'barber',
        assignedBarberId: barber2Id,
        assignedShopId: testShopId,
        status: 'active',
      },
      {
        id: `prof-${testAdminUid}`,
        uid: testAdminUid,
        email: 'admin.earn@barberloo.in',
        name: 'Admin Controller',
        role: 'admin',
        status: 'active',
      },
    ]);

    await db.insert(shops).values({
      id: testShopId,
      name: 'QA Luxury Salon',
      district: 'Ludhiana, Punjab',
      address: '123 Model Town',
      image: '/assets/images/royal_barber_shop_1790869681010.jpg',
      tagline: 'Precision Craftsmen',
      about: 'Verified luxury salon',
    });

    await db.insert(barbers).values([
      {
        id: barber1Id,
        userUid: testBarber1Uid,
        shopId: testShopId,
        shopName: 'QA Luxury Salon',
        name: 'Master Barber 1',
        role: 'Master Craftsman',
        specialty: 'Skin Fades',
        image: '/assets/images/barber_portrait_marcus_1790869694473.jpg',
        bio: 'Expert stylist',
      },
      {
        id: barber2Id,
        userUid: testBarber2Uid,
        shopId: testShopId,
        shopName: 'QA Luxury Salon',
        name: 'Master Barber 2',
        role: 'Senior Barber',
        specialty: 'Beard Sculpting',
        image: '/assets/images/barber_portrait_julian_1790869707086.jpg',
        bio: 'Master barber',
      },
    ]);

    // Scenario 1: Customer blocked from accessing barber earnings (HTTP 403 Forbidden)
    const res1 = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(res1.status === 403, 'Scenario 1: Customer strictly blocked from barber earnings (HTTP 403)');

    // Scenario 2: Barber 1 accesses own earnings successfully (empty initial state)
    const res2 = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${barber1Token}` },
    });
    const data2 = await res2.json();
    assert(
      res2.status === 200 && data2.availableEarnings === 0 && data2.canWithdraw === false,
      'Scenario 2: Barber accesses own earnings ledger (starts at ₹0)',
      `available: ${data2.availableEarnings}`
    );

    // Scenario 3: Barber attempting withdrawal without bank account rejected
    const res3 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 150 }),
    });
    assert(res3.status === 400, 'Scenario 3: Withdrawal without bank account rejected (HTTP 400)');

    // Scenario 4: Saving bank account with invalid IFSC rejected
    const res4 = await fetch(`${BASE_URL}/api/barber/bank-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({
        accountHolderName: 'Master Barber 1',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        confirmAccountNumber: '123456789012',
        ifsc: 'INVALID_IFSC',
      }),
    });
    assert(res4.status === 400, 'Scenario 4: Invalid IFSC code rejected by validation (HTTP 400)');

    // Scenario 5: Saving bank account with mismatched confirmation rejected
    const res5 = await fetch(`${BASE_URL}/api/barber/bank-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({
        accountHolderName: 'Master Barber 1',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        confirmAccountNumber: '999999999999',
        ifsc: 'HDFC0000123',
      }),
    });
    assert(res5.status === 400, 'Scenario 5: Account confirmation mismatch rejected (HTTP 400)');

    // Scenario 6: Successfully saving bank account details with masked account number returned
    const res6 = await fetch(`${BASE_URL}/api/barber/bank-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({
        accountHolderName: 'Master Barber 1',
        bankName: 'HDFC Bank',
        accountNumber: '50100412345678',
        confirmAccountNumber: '50100412345678',
        ifsc: 'HDFC0000123',
      }),
    });
    const data6 = await res6.json();
    assert(
      res6.status === 200 && data6.beneficiary?.maskedAccountNumber?.includes('5678'),
      'Scenario 6: Valid bank account registered and masked (•••• •••• •••• 5678)',
      JSON.stringify(data6.beneficiary)
    );

    // Scenario 7: Credit verified earnings of ₹450 to Barber 1's ledger
    const belId1 = `bel-test-${Date.now()}`;
    await db.insert(barberEarningsLedger).values({
      id: belId1,
      barberId: barber1Id,
      shopId: testShopId,
      appointmentId: 'apt-seed-1',
      transactionId: `txn-seed-1`,
      transactionType: 'appointment_earnings',
      entryType: 'CREDIT',
      amount: 450,
      balanceAfter: 450,
      status: 'available',
      description: 'Verified Appointment Earnings: Skin Fade',
      paymentReference: 'pay_rzp_seed_1',
    });

    const res7 = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${barber1Token}` },
    });
    const data7 = await res7.json();
    assert(
      res7.status === 200 && data7.availableEarnings === 450 && data7.canWithdraw === true,
      'Scenario 7: Verified earnings credited to ledger (Available: ₹450)'
    );

    // Scenario 8: Withdrawal below ₹100 minimum rejected (e.g. ₹50)
    const res8 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 50 }),
    });
    const data8 = await res8.json();
    assert(
      res8.status === 400 && data8.error?.includes('100'),
      'Scenario 8: Withdrawal below ₹100 rejected (HTTP 400)',
      data8.error
    );

    // Scenario 9: Withdrawal exceeding available earnings rejected (e.g. ₹500 when available is ₹450)
    const res9 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 500 }),
    });
    const data9 = await res9.json();
    assert(
      res9.status === 400 && data9.error?.includes('exceeds'),
      'Scenario 9: Withdrawal exceeding available balance rejected (HTTP 400)',
      data9.error
    );

    // Scenario 10: Valid withdrawal of ₹200 submitted (₹450 -> ₹250 remaining available)
    const res10 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 200, notes: 'Weekly payout request' }),
    });
    const data10 = await res10.json();
    const withdrawalId1 = data10.withdrawal?.id;
    assert(
      res10.status === 201 && data10.withdrawal?.requestedAmount === 200,
      'Scenario 10: Valid withdrawal of ₹200 created (HTTP 201)',
      `id: ${withdrawalId1}`
    );

    // Scenario 11: Funds reservation verified: available earnings decreased from ₹450 to ₹250
    const res11 = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${barber1Token}` },
    });
    const data11 = await res11.json();
    assert(
      data11.availableEarnings === 250 && data11.activeReservedAmount === 200,
      'Scenario 11: Balance atomically reserved (Available: ₹250, Reserved: ₹200)',
      `Available: ${data11.availableEarnings}`
    );

    // Scenario 12: Second withdrawal of ₹300 rejected because available is now only ₹250
    const res12 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 300 }),
    });
    assert(res12.status === 400, 'Scenario 12: Concurrency & reservation prevents over-withdrawal (HTTP 400)');

    // Scenario 13: Barber A cannot access Barber B's earnings
    const res13 = await fetch(`${BASE_URL}/api/barber/earnings?barberId=${barber1Id}`, {
      headers: { Authorization: `Bearer ${barber2Token}` },
    });
    const data13 = await res13.json();
    assert(
      data13.barberId === barber2Id && data13.availableEarnings === 0,
      'Scenario 13: Barber data isolation enforced (Barber B cannot query Barber A earnings)',
      `Returned Barber: ${data13.barberId}`
    );

    // Scenario 14: Customer blocked from admin payout management (HTTP 403)
    const res14 = await fetch(`${BASE_URL}/api/admin/payouts-management`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(res14.status === 403, 'Scenario 14: Customer blocked from Admin Payout Management (HTTP 403)');

    // Scenario 15: Admin loads platform payout management overview and requests
    const res15 = await fetch(`${BASE_URL}/api/admin/payouts-management`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data15 = await res15.json();
    assert(
      res15.status === 200 && Array.isArray(data15.requests) && data15.metrics?.totalPendingReviewAmount >= 200,
      'Scenario 15: Admin loads platform-wide payout metrics and withdrawal requests',
      `status: ${res15.status}, body: ${JSON.stringify(data15)}`
    );

    // Scenario 16: Admin moves withdrawal to under_review
    const res16 = await fetch(`${BASE_URL}/api/admin/payouts/${withdrawalId1}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'under_review' }),
    });
    const data16 = await res16.json();
    assert(
      res16.status === 200 && data16.withdrawal?.status === 'under_review',
      'Scenario 16: Admin transitions withdrawal to UNDER_REVIEW'
    );

    // Scenario 17: Admin rejecting without reason fails (HTTP 400)
    const res17 = await fetch(`${BASE_URL}/api/admin/payouts/${withdrawalId1}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'rejected', rejectionReason: '' }),
    });
    assert(res17.status === 400, 'Scenario 17: Rejection without documented reason is rejected (HTTP 400)');

    // Scenario 18: Admin rejects withdrawal with reason -> funds released back to available balance!
    const res18 = await fetch(`${BASE_URL}/api/admin/payouts/${withdrawalId1}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'rejected', rejectionReason: 'Test account review rejection' }),
    });
    assert(res18.status === 200, 'Scenario 18: Admin rejects withdrawal with reason');

    const res18b = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${barber1Token}` },
    });
    const data18b = await res18b.json();
    assert(
      data18b.availableEarnings === 450 && data18b.activeReservedAmount === 0,
      'Scenario 18b: Reserved funds (₹200) restored to available balance upon rejection (Available: ₹450)',
      `Available: ${data18b.availableEarnings}`
    );

    // Scenario 19: Barber creates new withdrawal request of ₹350
    const res19 = await fetch(`${BASE_URL}/api/barber/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${barber1Token}` },
      body: JSON.stringify({ amount: 350, notes: 'Payout to settle' }),
    });
    const data19 = await res19.json();
    const withdrawalId2 = data19.withdrawal?.id;
    assert(res19.status === 201, 'Scenario 19: Second withdrawal request created (₹350)');

    // Scenario 20: Admin marking as paid without UTR fails (HTTP 400)
    const res20 = await fetch(`${BASE_URL}/api/admin/payouts/${withdrawalId2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'paid', utrReference: '' }),
    });
    assert(res20.status === 400, 'Scenario 20: Marking payout paid without genuine UTR rejected (HTTP 400)');

    // Scenario 21: Admin records payout as PAID with genuine UTR reference
    const genuineUtr = 'HDFC' + Date.now();
    const res21 = await fetch(`${BASE_URL}/api/admin/payouts/${withdrawalId2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'paid', utrReference: genuineUtr, notes: 'NEFT transfer batch' }),
    });
    const data21 = await res21.json();
    assert(
      res21.status === 200 && data21.withdrawal?.status === 'paid' && data21.withdrawal?.utrReference === genuineUtr,
      'Scenario 21: Payout marked PAID with authentic UTR reference',
      `UTR: ${genuineUtr}`
    );

    // Verify final ledger state for Barber 1:
    // Total Earned: ₹450, Total Withdrawn: ₹350, Available: ₹100
    const res21b = await fetch(`${BASE_URL}/api/barber/earnings`, {
      headers: { Authorization: `Bearer ${barber1Token}` },
    });
    const data21b = await res21b.json();
    assert(
      data21b.totalEarned === 450 && data21b.totalWithdrawn === 350 && data21b.availableEarnings === 100,
      'Scenario 21b: Reconciled balances exact (Earned: ₹450, Withdrawn: ₹350, Available: ₹100)',
      `Available: ${data21b.availableEarnings}, Withdrawn: ${data21b.totalWithdrawn}`
    );

    // Scenario 22: Financial audit log records exist for all operations
    const auditEntries = await db
      .select()
      .from(financialAuditLogs)
      .where(or(like(financialAuditLogs.entityId, '%wdr-%'), like(financialAuditLogs.entityId, '%ben-%')));
    assert(
      auditEntries.length >= 4,
      'Scenario 22: Financial audit logs recorded for creation, rejection, and payment',
      `Entries: ${auditEntries.length}`
    );

  } finally {
    // Teardown test records
    try {
      await db.delete(barberEarningsLedger).where(eq(barberEarningsLedger.barberId, barber1Id));
      await db.delete(barberWithdrawalRequests).where(eq(barberWithdrawalRequests.barberId, barber1Id));
      await db.delete(barberPayoutBeneficiaries).where(eq(barberPayoutBeneficiaries.barberId, barber1Id));
      await db.delete(barbers).where(or(eq(barbers.id, barber1Id), eq(barbers.id, barber2Id)));
      await db.delete(shops).where(eq(shops.id, testShopId));
      await db.delete(profiles).where(
        or(
          eq(profiles.uid, testCustUid),
          eq(profiles.uid, testBarber1Uid),
          eq(profiles.uid, testBarber2Uid),
          eq(profiles.uid, testAdminUid)
        )
      );
    } catch {
      // Best effort cleanup
    }
  }

  console.log(`\n=== EARNINGS & WITHDRAWAL QA SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runEarningsWithdrawalQaSuite().catch((err) => {
  console.error('Fatal earnings test error:', err);
  process.exit(1);
});
