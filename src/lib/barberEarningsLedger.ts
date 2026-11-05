import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  barberEarningsLedger,
  barberWithdrawalRequests,
  barberPayoutBeneficiaries,
  financialAuditLogs,
  appointments,
  barbers,
  profiles,
  notifications,
} from '../db/schema.ts';
import { eq, and, desc, sql, or } from 'drizzle-orm';

const ENCRYPTION_KEY =
  process.env.FINANCIAL_ENCRYPTION_KEY ||
  process.env.AUTH_SECRET ||
  'barberloo-secure-financial-key-32-chars-2026';

function getCipherKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt sensitive bank account details using AES-256-GCM.
 */
export function encryptAccountNumber(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Resolves the authorized barberId, shopId, and barberName for a user.
 */
export async function resolveBarberForUser(uid: string): Promise<{
  barberId: string;
  shopId: string;
  barberName: string;
} | null> {
  if (!uid) return null;

  // 1. Direct match on barbers.userUid
  const [b1] = await db.select().from(barbers).where(eq(barbers.userUid, uid));
  if (b1) {
    return { barberId: b1.id, shopId: b1.shopId, barberName: b1.name };
  }

  // 2. Match via profiles.assignedBarberId
  const [prof] = await db.select().from(profiles).where(eq(profiles.uid, uid));
  if (prof?.assignedBarberId) {
    const [b2] = await db.select().from(barbers).where(eq(barbers.id, prof.assignedBarberId));
    if (b2) {
      return { barberId: b2.id, shopId: b2.shopId, barberName: b2.name };
    }
  }

  // 3. If user is barber role, link to the primary or matching shop barber
  if (prof?.role === 'barber') {
    const [b3] = await db.select().from(barbers).limit(1);
    if (b3) {
      return { barberId: b3.id, shopId: b3.shopId, barberName: b3.name };
    }
  }

  return null;
}

/**
 * Calculates authoritative earnings summary for a barber.
 * Minimum withdrawal: ₹100.
 */
export async function getBarberEarningsSummary(barberId: string) {
  // 1. Fetch all ledger transactions for this barber
  const ledgerRows = await db
    .select()
    .from(barberEarningsLedger)
    .where(eq(barberEarningsLedger.barberId, barberId))
    .orderBy(desc(barberEarningsLedger.createdAt));

  // 2. Fetch withdrawal requests
  const withdrawalRows = await db
    .select()
    .from(barberWithdrawalRequests)
    .where(eq(barberWithdrawalRequests.barberId, barberId))
    .orderBy(desc(barberWithdrawalRequests.createdAt));

  // 3. Fetch pending appointments (paid, not completed, not cancelled)
  const pendingAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.barberId, barberId),
        eq(appointments.paymentStatus, 'paid'),
        sql`${appointments.status} NOT IN ('completed', 'cancelled', 'no_show')`
      )
    );

  let pendingEarnings = 0;
  for (const apt of pendingAppointments) {
    const barberShare =
      apt.servicePrice ?? (apt.price - (apt.platformFee ?? 10));
    pendingEarnings += Math.max(0, barberShare);
  }

  // Calculate ledger balances
  let totalEarned = 0;
  let totalWithdrawn = 0;
  let totalRefundAdjustments = 0;
  let activeReservedAmount = 0;

  for (const entry of ledgerRows) {
    if (entry.transactionType === 'appointment_earnings' && entry.entryType === 'CREDIT') {
      totalEarned += entry.amount;
    } else if (entry.transactionType === 'refund_adjustment' && entry.entryType === 'DEBIT') {
      totalRefundAdjustments += entry.amount;
    } else if (entry.transactionType === 'withdrawal_reversal' && entry.entryType === 'CREDIT') {
      // Reversal cancels out a previous deduction
    }
  }

  for (const wr of withdrawalRows) {
    if (wr.status === 'paid') {
      totalWithdrawn += wr.requestedAmount;
    } else if (
      wr.status === 'requested' ||
      wr.status === 'under_review' ||
      wr.status === 'approved' ||
      wr.status === 'processing'
    ) {
      activeReservedAmount += wr.requestedAmount;
    }
  }

  // Available Earnings = Total Earned - Total Withdrawn - Total Refund Adjustments - Active Reserved Amount
  const availableEarnings = Math.max(
    0,
    totalEarned - totalWithdrawn - totalRefundAdjustments - activeReservedAmount
  );

  // Format transactions for UI table
  const formattedTransactions = ledgerRows.map((entry) => {
    let typeDisplay = 'Appointment Earnings';
    if (entry.transactionType === 'platform_fee') typeDisplay = 'Platform Fee';
    else if (entry.transactionType === 'refund_adjustment') typeDisplay = 'Refund Adjustment';
    else if (entry.transactionType === 'withdrawal_request') typeDisplay = 'Withdrawal Request';
    else if (entry.transactionType === 'withdrawal_paid') typeDisplay = 'Withdrawal Paid';
    else if (entry.transactionType === 'withdrawal_reversal') typeDisplay = 'Withdrawal Reversal';
    else if (entry.transactionType === 'manual_adjustment') typeDisplay = 'Manual Adjustment';

    return {
      transactionId: entry.transactionId,
      appointmentId: entry.appointmentId || '—',
      transactionDate: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
      description: entry.description,
      amount: entry.amount,
      entryType: entry.entryType,
      transactionType: typeDisplay,
      rawType: entry.transactionType,
      currentStatus: entry.status.toUpperCase(),
      paymentReference: entry.paymentReference || '—',
    };
  });

  return {
    barberId,
    availableEarnings,
    pendingEarnings,
    totalEarned,
    totalWithdrawn,
    totalRefundAdjustments,
    activeReservedAmount,
    withdrawalRequestsCount: withdrawalRows.length,
    activeWithdrawalsCount: withdrawalRows.filter((w) =>
      ['requested', 'under_review', 'approved', 'processing'].includes(w.status)
    ).length,
    minimumWithdrawalAmount: 100,
    canWithdraw: availableEarnings >= 100,
    transactions: formattedTransactions,
    withdrawals: withdrawalRows,
  };
}

/**
 * Atomically creates a withdrawal request with strict ₹100 minimum and concurrency lock.
 */
export async function submitBarberWithdrawal(params: {
  barberId: string;
  shopId?: string;
  amount: number;
  userUid: string;
  userRole: string;
  notes?: string;
  idempotencyKey?: string;
}) {
  const { barberId, amount, userUid, userRole, notes } = params;

  // 1. Strict Minimum Rule: ₹100
  if (!Number.isInteger(amount) || amount < 100) {
    throw new Error('Minimum withdrawal amount is ₹100. Withdrawals below ₹100 are rejected.');
  }

  // 2. Fetch beneficiary details
  const [beneficiary] = await db
    .select()
    .from(barberPayoutBeneficiaries)
    .where(eq(barberPayoutBeneficiaries.barberId, barberId))
    .limit(1);

  if (!beneficiary) {
    throw new Error('No registered bank account found. Please add and verify your bank account details before requesting a withdrawal.');
  }

  const idempotencyKey =
    params.idempotencyKey ||
    `wdr-${barberId}-${amount}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 3. Atomic Database Transaction with Advisory Lock
  return await db.transaction(async (tx) => {
    // Acquire PostgreSQL advisory lock on barber hash to serialize requests and prevent double-spending
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('withdrawal_' || ${barberId}))`
    );

    // Check existing idempotency key
    const [existingKey] = await tx
      .select()
      .from(barberWithdrawalRequests)
      .where(eq(barberWithdrawalRequests.idempotencyKey, idempotencyKey));

    if (existingKey) {
      return {
        success: true,
        alreadySubmitted: true,
        withdrawal: existingKey,
      };
    }

    // Re-calculate available balance inside transaction
    const summary = await getBarberEarningsSummary(barberId);
    if (amount > summary.availableEarnings) {
      throw new Error(
        `Requested withdrawal amount (₹${amount}) exceeds eligible available earnings (₹${summary.availableEarnings}).`
      );
    }

    const withdrawalId = `wdr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const txnId = `txn-wdr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newBalance = summary.availableEarnings - amount;

    // Create withdrawal request row
    const [createdRequest] = await tx
      .insert(barberWithdrawalRequests)
      .values({
        id: withdrawalId,
        barberId,
        shopId: params.shopId || beneficiary.shopId || 'shop-1',
        requestedAmount: amount,
        currency: 'INR',
        status: 'requested',
        beneficiaryId: beneficiary.id,
        bankName: beneficiary.bankName,
        accountHolderName: beneficiary.accountHolderName,
        maskedAccountNumber: beneficiary.maskedAccountNumber,
        ifsc: beneficiary.ifsc,
        payoutMode: 'manual_bank_transfer',
        notes: notes || '',
        idempotencyKey,
      })
      .returning();

    // Insert reservation entry into barber_earnings_ledger
    await tx.insert(barberEarningsLedger).values({
      id: `bel-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      barberId,
      shopId: params.shopId || beneficiary.shopId || 'shop-1',
      appointmentId: '',
      transactionId: txnId,
      transactionType: 'withdrawal_request',
      entryType: 'DEBIT',
      amount,
      balanceAfter: newBalance,
      status: 'reserved',
      description: `Withdrawal request submitted (₹${amount}) to bank ${beneficiary.bankName} (${beneficiary.maskedAccountNumber})`,
      paymentReference: withdrawalId,
      metadataJson: JSON.stringify({
        withdrawalId,
        bankName: beneficiary.bankName,
        ifsc: beneficiary.ifsc,
      }),
    });

    // Record in financial audit logs
    await tx.insert(financialAuditLogs).values({
      id: `fal-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actorUid: userUid,
      actorRole: userRole,
      action: 'WITHDRAWAL_REQUEST_CREATED',
      entityType: 'barber_withdrawal_request',
      entityId: withdrawalId,
      previousState: JSON.stringify({ availableBalance: summary.availableEarnings }),
      newState: JSON.stringify({
        withdrawalId,
        amount,
        status: 'requested',
        newAvailableBalance: newBalance,
      }),
      amount,
      notes: `Withdrawal request of ₹${amount} initiated by barber ${barberId}.`,
    });

    // Send in-app notification to barber
    await tx.insert(notifications).values({
      id: `notif-${Date.now()}-w`,
      recipientUid: userUid,
      type: 'withdrawal_requested',
      title: `Withdrawal Request Submitted: ₹${amount} requested. Your request is under administrative review (Ref: #${withdrawalId}).`,
      timeLabel: 'Just now · Barber Payout Desk',
      unread: true,
    });

    return {
      success: true,
      withdrawal: createdRequest,
      availableBalance: newBalance,
    };
  });
}

/**
 * Saves or updates payout beneficiary bank account for a barber.
 */
export async function saveBarberBeneficiary(params: {
  barberId: string;
  shopId?: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber?: string;
  ifsc: string;
  actorUid: string;
  actorRole: string;
}) {
  const { barberId, accountHolderName, bankName, accountNumber, confirmAccountNumber, ifsc, actorUid, actorRole } = params;

  const cleanHolder = accountHolderName.trim();
  const cleanBank = bankName.trim();
  const cleanAccount = accountNumber.replace(/\s+/g, '');
  const cleanIfsc = ifsc.trim().toUpperCase();

  if (!cleanHolder || cleanHolder.length < 3) {
    throw new Error('Please enter a valid Account Holder Name (minimum 3 characters).');
  }
  if (!cleanBank || cleanBank.length < 2) {
    throw new Error('Please enter a valid Bank Name.');
  }
  if (!/^\d{9,18}$/.test(cleanAccount)) {
    throw new Error('Bank account number must be between 9 and 18 numeric digits.');
  }
  if (confirmAccountNumber && cleanAccount !== confirmAccountNumber.replace(/\s+/g, '')) {
    throw new Error('Account number and confirmation do not match.');
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
    throw new Error('Invalid IFSC code. Format: 4 letters, 0, then 6 alphanumeric characters (e.g. HDFC0000001, SBIN0001234).');
  }

  const accountHash = crypto.createHash('sha256').update(cleanAccount).digest('hex');
  const maskedAccount = `•••• •••• •••• ${cleanAccount.slice(-4)}`;
  const encrypted = encryptAccountNumber(cleanAccount);

  return await db.transaction(async (tx) => {
    // Check if beneficiary already exists
    const [existing] = await tx
      .select()
      .from(barberPayoutBeneficiaries)
      .where(eq(barberPayoutBeneficiaries.barberId, barberId))
      .limit(1);

    let savedBeneficiary;
    if (existing) {
      const [updated] = await tx
        .update(barberPayoutBeneficiaries)
        .set({
          accountHolderName: cleanHolder,
          bankName: cleanBank,
          ifsc: cleanIfsc,
          accountNumberHash: accountHash,
          maskedAccountNumber: maskedAccount,
          encryptedAccountNumber: encrypted,
          updatedAt: new Date(),
        })
        .where(eq(barberPayoutBeneficiaries.id, existing.id))
        .returning();
      savedBeneficiary = updated;
    } else {
      const benId = `ben-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const [inserted] = await tx
        .insert(barberPayoutBeneficiaries)
        .values({
          id: benId,
          barberId,
          shopId: params.shopId || 'shop-1',
          accountHolderName: cleanHolder,
          bankName: cleanBank,
          ifsc: cleanIfsc,
          accountNumberHash: accountHash,
          maskedAccountNumber: maskedAccount,
          encryptedAccountNumber: encrypted,
          isVerified: true,
          isPrimary: true,
        })
        .returning();
      savedBeneficiary = inserted;
    }

    // Log to financial audit log
    await tx.insert(financialAuditLogs).values({
      id: `fal-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actorUid,
      actorRole,
      action: existing ? 'BENEFICIARY_UPDATED' : 'BENEFICIARY_CREATED',
      entityType: 'barber_payout_beneficiary',
      entityId: savedBeneficiary.id,
      previousState: existing ? JSON.stringify({ bankName: existing.bankName, masked: existing.maskedAccountNumber }) : '{}',
      newState: JSON.stringify({ bankName: cleanBank, masked: maskedAccount, ifsc: cleanIfsc }),
      amount: 0,
      notes: `Payout beneficiary bank account updated for barber ${barberId}.`,
    });

    return {
      id: savedBeneficiary.id,
      barberId: savedBeneficiary.barberId,
      accountHolderName: savedBeneficiary.accountHolderName,
      bankName: savedBeneficiary.bankName,
      ifsc: savedBeneficiary.ifsc,
      maskedAccountNumber: savedBeneficiary.maskedAccountNumber,
      isVerified: savedBeneficiary.isVerified,
    };
  });
}

/**
 * Admin action on withdrawal request (Approve, Reject, Pay, Fail).
 */
export async function updateWithdrawalStatusByAdmin(params: {
  withdrawalId: string;
  status: 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed';
  adminUid: string;
  rejectionReason?: string;
  utrReference?: string;
  notes?: string;
}) {
  const { withdrawalId, status, adminUid, rejectionReason, utrReference, notes } = params;

  return await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(barberWithdrawalRequests)
      .where(eq(barberWithdrawalRequests.id, withdrawalId));

    if (!request) {
      throw new Error(`Withdrawal request ${withdrawalId} not found.`);
    }

    const previousStatus = request.status;

    // Reject or Fail: Release the reserved balance back to barber
    if (status === 'rejected' || status === 'failed') {
      if (!rejectionReason || !rejectionReason.trim()) {
        throw new Error('A rejection reason is strictly required when rejecting or failing a withdrawal.');
      }

      // Check if already finalized
      if (previousStatus === 'rejected' || previousStatus === 'failed') {
        throw new Error(`Withdrawal is already in ${previousStatus} status.`);
      }
      if (previousStatus === 'paid') {
        throw new Error('Cannot reject a withdrawal that has already been marked as paid.');
      }

      // Update withdrawal request
      const [updated] = await tx
        .update(barberWithdrawalRequests)
        .set({
          status,
          rejectionReason: rejectionReason.trim(),
          processedBy: adminUid,
          processedAt: new Date(),
          notes: notes || request.notes,
          updatedAt: new Date(),
        })
        .where(eq(barberWithdrawalRequests.id, withdrawalId))
        .returning();

      // Post reversal credit to barber_earnings_ledger to restore available balance
      const txnId = `txn-rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await tx.insert(barberEarningsLedger).values({
        id: `bel-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        barberId: request.barberId,
        shopId: request.shopId,
        appointmentId: '',
        transactionId: txnId,
        transactionType: 'withdrawal_reversal',
        entryType: 'CREDIT',
        amount: request.requestedAmount,
        balanceAfter: 0, // balance recomputed dynamically
        status: 'available',
        description: `Withdrawal request #${withdrawalId} rejected: ${rejectionReason.trim()}. Reserved funds of ₹${request.requestedAmount} restored to available balance.`,
        paymentReference: withdrawalId,
        metadataJson: JSON.stringify({
          withdrawalId,
          rejectionReason: rejectionReason.trim(),
          rejectedBy: adminUid,
        }),
      });

      // Financial audit log
      await tx.insert(financialAuditLogs).values({
        id: `fal-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        actorUid: adminUid,
        actorRole: 'admin',
        action: `WITHDRAWAL_${status.toUpperCase()}`,
        entityType: 'barber_withdrawal_request',
        entityId: withdrawalId,
        previousState: JSON.stringify({ status: previousStatus }),
        newState: JSON.stringify({ status, rejectionReason: rejectionReason.trim() }),
        amount: request.requestedAmount,
        notes: `Withdrawal #${withdrawalId} set to ${status}. Reserved funds returned to barber.`,
      });

      // Notification
      await tx.insert(notifications).values({
        id: `notif-${Date.now()}-w`,
        recipientUid: request.barberId,
        type: 'withdrawal_rejected',
        title: `Withdrawal Update: Request #${withdrawalId} for ₹${request.requestedAmount} was rejected: ${rejectionReason.trim()}. Funds returned to your available balance.`,
        timeLabel: 'Just now · Admin Desk',
        unread: true,
      });

      return { success: true, withdrawal: updated };
    }

    // Mark as Paid: Requires genuine UTR / transaction reference
    if (status === 'paid') {
      if (!utrReference || !utrReference.trim()) {
        throw new Error('A genuine UTR or Bank Transaction Reference is strictly required to mark payout as paid.');
      }

      if (previousStatus === 'paid') {
        throw new Error('Withdrawal request has already been marked as paid.');
      }

      const cleanUtr = utrReference.trim();
      const [updated] = await tx
        .update(barberWithdrawalRequests)
        .set({
          status: 'paid',
          utrReference: cleanUtr,
          processedBy: adminUid,
          processedAt: new Date(),
          notes: notes || request.notes,
          updatedAt: new Date(),
        })
        .where(eq(barberWithdrawalRequests.id, withdrawalId))
        .returning();

      // Update corresponding reservation in ledger to completed / paid
      await tx
        .update(barberEarningsLedger)
        .set({
          status: 'completed',
          paymentReference: cleanUtr,
          description: `Withdrawal disbursed (₹${request.requestedAmount}) via Bank Transfer. UTR: ${cleanUtr}`,
        })
        .where(
          and(
            eq(barberEarningsLedger.paymentReference, withdrawalId),
            eq(barberEarningsLedger.transactionType, 'withdrawal_request')
          )
        );

      // Financial audit log
      await tx.insert(financialAuditLogs).values({
        id: `fal-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        actorUid: adminUid,
        actorRole: 'admin',
        action: 'WITHDRAWAL_PAID',
        entityType: 'barber_withdrawal_request',
        entityId: withdrawalId,
        previousState: JSON.stringify({ status: previousStatus }),
        newState: JSON.stringify({ status: 'paid', utrReference: cleanUtr }),
        amount: request.requestedAmount,
        notes: `Payout #${withdrawalId} of ₹${request.requestedAmount} marked paid. UTR: ${cleanUtr}`,
      });

      // Notification
      await tx.insert(notifications).values({
        id: `notif-${Date.now()}-w`,
        recipientUid: request.barberId,
        type: 'withdrawal_paid',
        title: `Payout Transferred: ₹${request.requestedAmount} sent to ${request.bankName} (${request.maskedAccountNumber}). UTR: ${cleanUtr}`,
        timeLabel: 'Just now · Barber Payout Desk',
        unread: true,
      });

      return { success: true, withdrawal: updated };
    }

    // Other status transitions: under_review, approved, processing
    const [updated] = await tx
      .update(barberWithdrawalRequests)
      .set({
        status,
        processedBy: adminUid,
        notes: notes || request.notes,
        updatedAt: new Date(),
      })
      .where(eq(barberWithdrawalRequests.id, withdrawalId))
      .returning();

    await tx.insert(financialAuditLogs).values({
      id: `fal-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actorUid: adminUid,
      actorRole: 'admin',
      action: `WITHDRAWAL_STATUS_${status.toUpperCase()}`,
      entityType: 'barber_withdrawal_request',
      entityId: withdrawalId,
      previousState: JSON.stringify({ status: previousStatus }),
      newState: JSON.stringify({ status }),
      amount: request.requestedAmount,
      notes: `Withdrawal #${withdrawalId} moved from ${previousStatus} to ${status}.`,
    });

    return { success: true, withdrawal: updated };
  });
}
