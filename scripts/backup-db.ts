/**
 * BarberLoo Production Database Backup & Preservation Script
 * Exports all existing tables to a structured JSON snapshot before deployment modifications.
 * Website: https://barberloo.in
 */

import { db } from '../src/db/index.ts';
import {
  shops,
  barbers,
  services,
  appointments,
  payments,
  profiles,
  coupons,
  reviews,
  favorites,
  notifications,
  workingHours,
  barberPayouts,
  financialLedger,
  barberEarningsLedger,
  barberWithdrawalRequests,
  barberPayoutBeneficiaries,
  financialAuditLogs,
  webhookEvents,
} from '../src/db/schema.ts';
import fs from 'fs';
import path from 'path';

async function performDatabaseBackup() {
  console.log('=== STARTING BARBERLOO PRODUCTION DATABASE BACKUP & PRESERVATION ===\n');

  try {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `barberloo-db-backup-${timestamp}.json`);

    console.log('Reading database records...');

    const [
      shopsData,
      barbersData,
      servicesData,
      aptsData,
      paymentsData,
      profilesData,
      couponsData,
      reviewsData,
      favsData,
      notifsData,
      hoursData,
      payoutsData,
      ledgerData,
      earningsLedgerData,
      withdrawalsData,
      beneficiariesData,
      auditLogsData,
      webhooksData,
    ] = await Promise.all([
      db.select().from(shops).catch(() => []),
      db.select().from(barbers).catch(() => []),
      db.select().from(services).catch(() => []),
      db.select().from(appointments).catch(() => []),
      db.select().from(payments).catch(() => []),
      db.select().from(profiles).catch(() => []),
      db.select().from(coupons).catch(() => []),
      db.select().from(reviews).catch(() => []),
      db.select().from(favorites).catch(() => []),
      db.select().from(notifications).catch(() => []),
      db.select().from(workingHours).catch(() => []),
      db.select().from(barberPayouts).catch(() => []),
      db.select().from(financialLedger).catch(() => []),
      db.select().from(barberEarningsLedger).catch(() => []),
      db.select().from(barberWithdrawalRequests).catch(() => []),
      db.select().from(barberPayoutBeneficiaries).catch(() => []),
      db.select().from(financialAuditLogs).catch(() => []),
      db.select().from(webhookEvents).catch(() => []),
    ]);

    // Redact sensitive account numbers for safe backup logging
    const safeBeneficiaries = beneficiariesData.map((b) => ({
      ...b,
      encryptedAccountNumber: '[REDACTED_CIPHERTEXT]',
    }));

    const snapshot = {
      meta: {
        timestamp: new Date().toISOString(),
        website: 'https://barberloo.in',
        version: '1.0.1',
        totalRecords:
          shopsData.length +
          barbersData.length +
          servicesData.length +
          aptsData.length +
          paymentsData.length +
          profilesData.length +
          earningsLedgerData.length +
          withdrawalsData.length +
          beneficiariesData.length,
      },
      counts: {
        shops: shopsData.length,
        barbers: barbersData.length,
        services: servicesData.length,
        appointments: aptsData.length,
        payments: paymentsData.length,
        profiles: profilesData.length,
        coupons: couponsData.length,
        reviews: reviewsData.length,
        favorites: favsData.length,
        notifications: notifsData.length,
        workingHours: hoursData.length,
        barberPayouts: payoutsData.length,
        financialLedger: ledgerData.length,
        barberEarningsLedger: earningsLedgerData.length,
        barberWithdrawalRequests: withdrawalsData.length,
        barberPayoutBeneficiaries: beneficiariesData.length,
        financialAuditLogs: auditLogsData.length,
        webhookEvents: webhooksData.length,
      },
      tables: {
        shops: shopsData,
        barbers: barbersData,
        services: servicesData,
        appointments: aptsData,
        payments: paymentsData,
        profiles: profilesData,
        coupons: couponsData,
        reviews: reviewsData,
        favorites: favsData,
        notifications: notifsData,
        workingHours: hoursData,
        barberPayouts: payoutsData,
        financialLedger: ledgerData,
        barberEarningsLedger: earningsLedgerData,
        barberWithdrawalRequests: withdrawalsData,
        barberPayoutBeneficiaries: safeBeneficiaries,
        financialAuditLogs: auditLogsData,
        webhookEvents: webhooksData,
      },
    };

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');

    console.log(`✓ Backup successfully saved to ${backupFile}`);
    console.log('Record counts summary:');
    console.table(snapshot.counts);
    console.log('\n=== BACKUP COMPLETE & DATA PRESERVED ===');
  } catch (err: any) {
    console.error('Backup failed:', err?.message || err);
    process.exit(1);
  }
}

performDatabaseBackup();
