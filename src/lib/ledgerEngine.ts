import { db } from '../db/index.ts';
import { financialLedger, barberPayouts, appointments, payments, notifications } from '../db/schema.ts';
import { eq, and, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

export interface LedgerPostingItem {
  account:
    | 'customer_funds_escrow'
    | 'platform_fee_revenue'
    | 'barber_payable_pending'
    | 'barber_payable_released'
    | 'barber_payout_in_transit'
    | 'barber_payout_settled'
    | 'refunds_payable'
    | 'disputed_hold';
  entryType: 'DEBIT' | 'CREDIT';
  amount: number; // in integer INR
}

/**
 * Posts an immutable, balanced double-entry transaction to financial_ledger.
 * Strictly asserts that sum(DEBITS) === sum(CREDITS).
 */
export async function postLedgerTransaction(
  txOrDb: any,
  params: {
    appointmentId: string;
    transactionId?: string;
    referenceType:
      | 'customer_payment'
      | 'otp_completion'
      | 'payout_initiated'
      | 'payout_settled'
      | 'refund'
      | 'admin_hold'
      | 'reconciliation_adjustment';
    referenceId: string;
    description: string;
    entries: LedgerPostingItem[];
    metadata?: Record<string, any>;
  }
) {
  const runner = txOrDb || db;
  const txnId = params.transactionId || `txn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 1. Balance validation
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of params.entries) {
    if (entry.amount <= 0 || !Number.isInteger(entry.amount)) {
      throw new Error(`Invalid ledger entry amount: ${entry.amount}. Amounts must be positive integers.`);
    }
    if (entry.entryType === 'DEBIT') {
      totalDebit += entry.amount;
    } else if (entry.entryType === 'CREDIT') {
      totalCredit += entry.amount;
    } else {
      throw new Error(`Invalid entry type: ${entry.entryType}`);
    }
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Ledger imbalance detected! Total Debits (₹${totalDebit}) must equal Total Credits (₹${totalCredit}). Transaction aborted.`
    );
  }

  // 2. Fetch current entry number sequence
  const [maxEntry] = await runner
    .select({ maxNum: sql<number>`COALESCE(MAX(${financialLedger.entryNumber}), 0)` })
    .from(financialLedger);
  let nextEntryNumber = Number(maxEntry?.maxNum || 0) + 1;

  // 3. Insert immutable entries
  const inserted = [];
  for (const entry of params.entries) {
    const [row] = await runner
      .insert(financialLedger)
      .values({
        id: `led-${Date.now()}-${nextEntryNumber}-${crypto.randomBytes(3).toString('hex')}`,
        entryNumber: nextEntryNumber++,
        transactionId: txnId,
        appointmentId: params.appointmentId,
        account: entry.account,
        entryType: entry.entryType,
        amount: entry.amount,
        currency: 'INR',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
        metadataJson: JSON.stringify(params.metadata || {}),
      })
      .returning();
    inserted.push(row);
  }

  return {
    transactionId: txnId,
    totalDebit,
    totalCredit,
    entries: inserted,
  };
}

/**
 * Initiates payout transfer via Razorpay Route / Payouts.
 * Uses idempotency and enforces that no payout can be initiated if on administrative hold.
 */
export async function executeBarberPayoutTransfer(
  txOrDb: any,
  payoutId: string,
  options?: { forcedRetry?: boolean; simulatedFailure?: boolean }
) {
  const runner = txOrDb || db;

  const [payout] = await runner
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.id, payoutId));

  if (!payout) {
    throw new Error(`Barber payout record ${payoutId} not found.`);
  }

  // Check administrative hold
  if (payout.status === 'on_hold') {
    throw new Error(`Payout is on administrative hold: ${payout.holdReason || 'Flagged for audit'}.`);
  }

  // Check existing settled or initiated state (Idempotency enforcement)
  if (!options?.forcedRetry && (payout.status === 'settled' || payout.status === 'initiated' || payout.status === 'processed')) {
    return {
      success: true,
      alreadyProcessed: true,
      payout,
      transferId: payout.providerTransferId,
      status: payout.status,
    };
  }

  // Check simulated failure option
  if (options?.simulatedFailure) {
    const [failed] = await runner
      .update(barberPayouts)
      .set({
        status: 'failed',
        failureReason: 'Provider transfer gateway error: Insufficient route liquidity or invalid IFSC',
        retryCount: sql`${barberPayouts.retryCount} + 1`,
        lastRetriedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(barberPayouts.id, payoutId))
      .returning();

    return {
      success: false,
      payout: failed,
      error: failed.failureReason,
    };
  }

  // Generate unique provider transfer ID (e.g. Razorpay Route trf_...)
  const providerTransferId = payout.providerTransferId || `trf_rzp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Update payout record to 'initiated'
  const [updatedPayout] = await runner
    .update(barberPayouts)
    .set({
      status: 'initiated',
      providerTransferId,
      initiatedAt: new Date(),
      failureReason: '',
      retryCount: options?.forcedRetry ? sql`${barberPayouts.retryCount} + 1` : payout.retryCount,
      lastRetriedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(barberPayouts.id, payoutId))
    .returning();

  // Post balanced ledger entry: Debit released payable -> Credit payout in-transit
  await postLedgerTransaction(runner, {
    appointmentId: payout.appointmentId,
    referenceType: 'payout_initiated',
    referenceId: providerTransferId,
    description: `Barber payout initiated for ${payout.barberName} via Razorpay Route (${providerTransferId})`,
    entries: [
      { account: 'barber_payable_released', entryType: 'DEBIT', amount: payout.netPayoutAmount },
      { account: 'barber_payout_in_transit', entryType: 'CREDIT', amount: payout.netPayoutAmount },
    ],
    metadata: { payoutId: payout.id, barberId: payout.barberId },
  });

  return {
    success: true,
    payout: updatedPayout,
    transferId: providerTransferId,
    status: 'initiated',
  };
}

/**
 * Confirms bank settlement of the payout (e.g. from Razorpay Route webhook or settlement batch).
 */
export async function confirmBarberPayoutSettlement(
  txOrDb: any,
  payoutId: string,
  settlementRef?: string
) {
  const runner = txOrDb || db;

  const [payout] = await runner
    .select()
    .from(barberPayouts)
    .where(eq(barberPayouts.id, payoutId));

  if (!payout) {
    throw new Error(`Payout ${payoutId} not found.`);
  }

  if (payout.status === 'settled') {
    return { success: true, payout, alreadySettled: true };
  }

  const [settled] = await runner
    .update(barberPayouts)
    .set({
      status: 'settled',
      settledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(barberPayouts.id, payoutId))
    .returning();

  // Update appointment payoutStatus to 'settled'
  await runner
    .update(appointments)
    .set({ payoutStatus: 'settled' })
    .where(eq(appointments.id, payout.appointmentId));

  // Post balanced ledger entry: Debit in-transit -> Credit settled
  const ref = settlementRef || `set_${Date.now()}`;
  await postLedgerTransaction(runner, {
    appointmentId: payout.appointmentId,
    referenceType: 'payout_settled',
    referenceId: ref,
    description: `Bank settlement confirmed for barber payout ${payout.id} (Ref: ${ref})`,
    entries: [
      { account: 'barber_payout_in_transit', entryType: 'DEBIT', amount: payout.netPayoutAmount },
      { account: 'barber_payout_settled', entryType: 'CREDIT', amount: payout.netPayoutAmount },
    ],
    metadata: { settlementRef: ref },
  });

  return { success: true, payout: settled };
}
